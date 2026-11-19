/**
 * Team Individual Metrics — Google Sheet backend
 * ----------------------------------------------
 * Paste this into the Apps Script editor of the Google Sheet that should hold the data
 * (Sheet → Extensions → Apps Script → replace everything → Save).
 *
 * Then: Deploy → New deployment → type "Web app"
 *       Execute as:      Me
 *       Who has access:  Anyone
 * Copy the /exec URL and paste it into the page (Jobs & Settings → Google Sheet database).
 *
 * The sheet keeps readable tabs, created automatically on first run.
 *
 * Team Metrics:
 *   Jobs        id | level | category | job | ck
 *   Team        id | name  | level    | jobs (comma separated job ids)
 *   Settings    key | value
 *   Entries     month | personId | jobId | goal | actual
 *
 * Deliverables (a separate feature — nothing here reads the tabs above):
 *   Brands      id | name
 *   BrandItems  brandId | itemId | name
 *   Plan        month | brandId | itemId | quantity
 *
 * Allocation (splits the plan across the team; writes only its own two tabs):
 *   AllocTags   brandId | itemId | ck (Key/Critical) | kind (count/resp)
 *   Alloc       month | brandId | itemId | personId | value
 * You can read them freely. Edits made by hand are picked up the next time the page
 * loads or you press "Reload from sheet" — but a save from the page rewrites the tab,
 * so prefer entering data in the page.
 */

var HEAD = {
  // Team Metrics side
  Jobs:       ['id', 'level', 'category', 'job', 'ck'],
  Team:       ['id', 'name', 'level', 'jobs', 'displayName', 'skills', 'capacity', 'active'],
  Settings:   ['key', 'value'],
  Entries:    ['month', 'personId', 'jobId', 'goal', 'actual'],
  // Deliverables side (independent of the four above)
  Brands:     ['id', 'name', 'kind', 'platforms', 'formats', 'notes', 'active'],
  BrandItems: ['brandId', 'itemId', 'name'],
  Plan:       ['month', 'brandId', 'itemId', 'quantity'],
  // Allocation side (reads nothing from the sheet the other sections own)
  AllocTags:  ['brandId', 'itemId', 'ck', 'kind'],
  Alloc:      ['month', 'brandId', 'itemId', 'personId', 'value'],
  // Structure side: one structure per month
  Pods:        ['month', 'id', 'name', 'type', 'color', 'sortOrder', 'description'],
  PodBrands:   ['month', 'brandId', 'podId'],
  PodMembers:  ['month', 'personId', 'podId', 'roles'],
  BrandOwners: ['month', 'brandId', 'primaryId', 'backupId', 'ownerPct'],
  StructMeta:  ['month', 'key', 'value']
};

function listOf(v) {
  return String(v == null ? '' : v).split(',').map(function (s) { return s.trim(); }).filter(String);
}
function boolOf(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return !(s === 'no' || s === 'false' || s === '0');
}
function yesNo(b) { return b === false ? 'no' : 'yes'; }

/* ---------------- Web app entry points ---------------- */

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return reply(handle(req));
  } catch (err) {
    return reply({ ok: false, error: String((err && err.message) || err) });
  }
}

// Opening the /exec URL in a browser shows the data — handy for checking the deployment.
function doGet() {
  try {
    return reply(handle({ action: 'load' }));
  } catch (err) {
    return reply({ ok: false, error: String((err && err.message) || err) });
  }
}

function handle(req) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(25000);
  try {
    switch (req.action) {
      case 'load':       var all = loadAll();
                         return { ok: true, config: all.config, months: all.months, bmonths: all.bmonths, amonths: all.amonths };
      case 'saveConfig': saveConfig(req.config || {}); return { ok: true };
      case 'saveMonth':  saveMonth(fmtMonth(req.month), req.entries || {}); return { ok: true };
      case 'savePlan':   savePlan(fmtMonth(req.month), req.plan || {}); return { ok: true };
      case 'saveAlloc':  saveAlloc(fmtMonth(req.month), req.alloc || {}); return { ok: true };
      case 'saveStruct': saveStruct(fmtMonth(req.month), req.struct || {}); return { ok: true };
      case 'ping':       return { ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
      default: throw new Error('Unknown action: ' + req.action);
    }
  } finally {
    lock.releaseLock();
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Sheet helpers ---------------- */

function tab(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(name) || ss.insertSheet(name);
  var head = HEAD[name];
  if (s.getLastRow() === 0) {
    s.setFrozenRows(1);
    if (name === 'Entries' || name === 'Plan' || name === 'Alloc' || name === 'Pods' ||
        name === 'PodBrands' || name === 'PodMembers' || name === 'BrandOwners' || name === 'StructMeta') {
      s.getRange('A:A').setNumberFormat('@'); // keep "2026-11" as text
    }
  }
  // Keep the header row in step with HEAD, so a sheet made by an older version of this
  // script picks up new columns instead of silently writing under the wrong headings.
  var width = Math.max(s.getLastColumn(), head.length);
  var current = s.getRange(1, 1, 1, width).getValues()[0];
  var same = current.length >= head.length && head.every(function (h, i) { return String(current[i]) === h; });
  if (!same) s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  return s;
}

function rowsOf(name) {
  var s = tab(name), last = s.getLastRow(), w = HEAD[name].length;
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, w).getValues().filter(function (r) {
    return r.join('').toString().trim() !== '';
  });
}

function writeRows(name, data) {
  var s = tab(name), w = HEAD[name].length;
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, w).clearContent();
  if (data.length) s.getRange(2, 1, data.length, w).setValues(data);
}

function fmtMonth(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2);
  var m = String(v == null ? '' : v).trim().match(/^(\d{4})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}

function num(v) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n;
}

/* ---------------- Read ---------------- */

function loadAll() {
  var lib = rowsOf('Jobs').map(function (r) {
    return { id: String(r[0]), level: String(r[1]) === 'Senior' ? 'Senior' : 'Junior',
             category: String(r[2]), job: String(r[3]), ck: String(r[4]) === 'Critical' ? 'Critical' : 'Key' };
  }).filter(function (x) { return x.id && x.job; });

  var team = rowsOf('Team').map(function (r) {
    return { id: String(r[0]), name: String(r[1]), level: String(r[2]) === 'Senior' ? 'Senior' : 'Junior',
             jobs: listOf(r[3]), display: String(r[4] == null ? '' : r[4]),
             skills: listOf(r[5]), capacity: num(r[6]), active: boolOf(r[7]) };
  }).filter(function (x) { return x.id; });

  var settings = {};
  rowsOf('Settings').forEach(function (r) {
    var k = String(r[0]).trim(); if (!k) return;
    var n = Number(r[1]);
    settings[k] = isNaN(n) ? r[1] : n;
  });

  var months = {};
  rowsOf('Entries').forEach(function (r) {
    var m = fmtMonth(r[0]), pid = String(r[1]).trim(), jid = String(r[2]).trim();
    if (!m || !pid || !jid) return;
    if (!months[m]) months[m] = { e: {} };
    if (!months[m].e[pid]) months[m].e[pid] = {};
    months[m].e[pid][jid] = { g: num(r[3]), a: num(r[4]) };
  });

  // ---- deliverables side ----
  var itemsByBrand = {};
  rowsOf('BrandItems').forEach(function (r) {
    var bid = String(r[0]).trim(), iid = String(r[1]).trim();
    if (!bid || !iid) return;
    if (!itemsByBrand[bid]) itemsByBrand[bid] = [];
    itemsByBrand[bid].push({ id: iid, name: String(r[2]) });
  });

  var brands = rowsOf('Brands').map(function (r) {
    var id = String(r[0]).trim();
    return { id: id, name: String(r[1]), items: itemsByBrand[id] || [],
             kind: String(r[2]) === 'ads' ? 'ads' : 'organic',
             platforms: listOf(r[3]), formats: listOf(r[4]),
             notes: String(r[5] == null ? '' : r[5]), active: boolOf(r[6]) };
  }).filter(function (x) { return x.id; });

  var bmonths = {};
  rowsOf('Plan').forEach(function (r) {
    var m = fmtMonth(r[0]), bid = String(r[1]).trim(), iid = String(r[2]).trim();
    if (!m || !bid || !iid) return;
    var q = num(r[3]);
    if (q === '') return;
    if (!bmonths[m]) bmonths[m] = { q: {} };
    if (!bmonths[m].q[bid]) bmonths[m].q[bid] = {};
    bmonths[m].q[bid][iid] = q;
  });

  // ---- allocation side ----
  var atags = {};
  rowsOf('AllocTags').forEach(function (r) {
    var bid = String(r[0]).trim(), iid = String(r[1]).trim();
    if (!bid || !iid) return;
    atags[bid + '|' + iid] = {
      ck: String(r[2]) === 'Critical' ? 'Critical' : 'Key',
      kind: String(r[3]) === 'resp' ? 'resp' : 'count'
    };
  });

  var amonths = {};
  rowsOf('Alloc').forEach(function (r) {
    var m = fmtMonth(r[0]), bid = String(r[1]).trim(), iid = String(r[2]).trim(), pid = String(r[3]).trim();
    if (!m || !bid || !iid || !pid) return;
    var v = num(r[4]);
    if (v === '' || v <= 0) return;
    if (!amonths[m]) amonths[m] = { a: {} };
    amonths[m].a[bid + '|' + iid + '|' + pid] = v;
  });

  // ---- structure side: one structure per month ----
  var smonths = {};
  function struct(m) {
    if (!smonths[m]) smonths[m] = { pods: [], bpod: {}, mpod: {}, roles: {}, own: {}, meta: { manager: '', lead: '' } };
    return smonths[m];
  }
  rowsOf('Pods').forEach(function (r) {
    var m = fmtMonth(r[0]), id = String(r[1]).trim();
    if (!m || !id) return;
    struct(m).pods.push({ id: id, name: String(r[2]), type: String(r[3]) || 'organic',
                          color: String(r[4]) || '#2f6b4f', sort: num(r[5]) || 0, desc: String(r[6] == null ? '' : r[6]) });
  });
  rowsOf('PodBrands').forEach(function (r) {
    var m = fmtMonth(r[0]), bid = String(r[1]).trim(), pid = String(r[2]).trim();
    if (!m || !bid || !pid) return;
    struct(m).bpod[bid] = pid;
  });
  rowsOf('PodMembers').forEach(function (r) {
    var m = fmtMonth(r[0]), person = String(r[1]).trim(), pid = String(r[2]).trim();
    if (!m || !person || !pid) return;
    struct(m).mpod[person] = pid;
    var roles = listOf(r[3]);
    if (roles.length) struct(m).roles[person] = roles;
  });
  rowsOf('BrandOwners').forEach(function (r) {
    var m = fmtMonth(r[0]), bid = String(r[1]).trim();
    if (!m || !bid) return;
    var p = String(r[2]).trim(), b = String(r[3]).trim();
    if (!p && !b) return;
    var pct = num(r[4]);
    struct(m).own[bid] = { p: p, b: b, pct: pct === '' ? 40 : pct };
  });
  rowsOf('StructMeta').forEach(function (r) {
    var m = fmtMonth(r[0]), k = String(r[1]).trim();
    if (!m || !k) return;
    struct(m).meta[k] = String(r[2] == null ? '' : r[2]);
  });

  return {
    config: { lib: lib, team: team, settings: settings, brands: brands, atags: atags },
    months: months,
    bmonths: bmonths,
    amonths: amonths,
    smonths: smonths
  };
}

/* ---------------- Write ---------------- */

function saveConfig(config) {
  var lib = config.lib || [], team = config.team || [], settings = config.settings || {};

  writeRows('Jobs', lib.map(function (x) {
    return [String(x.id), String(x.level), String(x.category), String(x.job), String(x.ck)];
  }));

  writeRows('Team', team.map(function (p) {
    return [String(p.id), String(p.name), String(p.level), (p.jobs || []).join(','),
            String(p.display || ''), (p.skills || []).join(','), num(p.capacity), yesNo(p.active)];
  }));

  writeRows('Settings', Object.keys(settings).map(function (k) { return [k, settings[k]]; }));

  var brands = config.brands || [];
  writeRows('Brands', brands.map(function (b) {
    return [String(b.id), String(b.name), b.kind === 'ads' ? 'ads' : 'organic',
            (b.platforms || []).join(','), (b.formats || []).join(','), String(b.notes || ''), yesNo(b.active)];
  }));

  var items = [];
  brands.forEach(function (b) {
    (b.items || []).forEach(function (i) { items.push([String(b.id), String(i.id), String(i.name)]); });
  });
  writeRows('BrandItems', items);

  var atags = config.atags || {};
  writeRows('AllocTags', Object.keys(atags).map(function (k) {
    var parts = k.split('|'), t = atags[k] || {};
    return [parts[0] || '', parts[1] || '', t.ck === 'Critical' ? 'Critical' : 'Key', t.kind === 'resp' ? 'resp' : 'count'];
  }));
}

function saveAlloc(month, alloc) {
  if (!month) throw new Error('No month given.');

  // keep every other month untouched, replace this month's rows
  var keep = rowsOf('Alloc').filter(function (r) { return fmtMonth(r[0]) !== month; })
    .map(function (r) { return [fmtMonth(r[0]), String(r[1]), String(r[2]), String(r[3]), num(r[4])]; });

  var add = [];
  Object.keys(alloc).forEach(function (k) {
    var p = k.split('|');
    if (p.length !== 3) return;
    var v = num(alloc[k]);
    if (v === '' || v <= 0) return;
    add.push([month, p[0], p[1], p[2], v]);
  });

  add.sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
  writeRows('Alloc', keep.concat(add));
}

function savePlan(month, plan) {
  if (!month) throw new Error('No month given.');

  // keep every other month untouched, replace this month's rows
  var keep = rowsOf('Plan').filter(function (r) { return fmtMonth(r[0]) !== month; })
    .map(function (r) { return [fmtMonth(r[0]), String(r[1]), String(r[2]), num(r[3])]; });

  var add = [];
  Object.keys(plan).forEach(function (bid) {
    var items = plan[bid] || {};
    Object.keys(items).forEach(function (iid) {
      var q = num(items[iid]);
      if (q === '') return;
      add.push([month, String(bid), String(iid), q]);
    });
  });

  writeRows('Plan', keep.concat(add));
}

function saveMonth(month, entries) {
  if (!month) throw new Error('No month given.');

  // keep every other month untouched, replace this month's rows
  var keep = rowsOf('Entries').filter(function (r) { return fmtMonth(r[0]) !== month; })
    .map(function (r) { return [fmtMonth(r[0]), String(r[1]), String(r[2]), num(r[3]), num(r[4])]; });

  var add = [];
  Object.keys(entries).forEach(function (pid) {
    var e = entries[pid] || {};
    Object.keys(e).forEach(function (jid) {
      var v = e[jid] || {};
      add.push([month, String(pid), String(jid), num(v.g), num(v.a)]);
    });
  });

  add.sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
  writeRows('Entries', keep.concat(add));
}

/** Replace one month's rows in a structure tab, leaving every other month alone. */
function replaceMonth(name, month, rows) {
  var keep = rowsOf(name).filter(function (r) { return fmtMonth(r[0]) !== month; })
    .map(function (r) {
      var out = [fmtMonth(r[0])];
      for (var i = 1; i < HEAD[name].length; i++) out.push(r[i] == null ? '' : r[i]);
      return out;
    });
  writeRows(name, keep.concat(rows));
}

function saveStruct(month, struct) {
  if (!month) throw new Error('No month given.');
  var pods = struct.pods || [], bpod = struct.bpod || {}, mpod = struct.mpod || {},
      roles = struct.roles || {}, own = struct.own || {}, meta = struct.meta || {};

  replaceMonth('Pods', month, pods.map(function (p) {
    return [month, String(p.id), String(p.name), String(p.type || 'organic'),
            String(p.color || ''), num(p.sort), String(p.desc || '')];
  }));

  replaceMonth('PodBrands', month, Object.keys(bpod).filter(function (b) { return bpod[b]; })
    .map(function (b) { return [month, String(b), String(bpod[b])]; }));

  replaceMonth('PodMembers', month, Object.keys(mpod).filter(function (p) { return mpod[p]; })
    .map(function (p) { return [month, String(p), String(mpod[p]), (roles[p] || []).join(',')]; }));

  replaceMonth('BrandOwners', month, Object.keys(own).map(function (b) {
    var o = own[b] || {};
    return [month, String(b), String(o.p || ''), String(o.b || ''), o.pct == null ? 40 : num(o.pct)];
  }).filter(function (r) { return r[2] || r[3]; }));

  replaceMonth('StructMeta', month, Object.keys(meta).map(function (k) {
    return [month, String(k), String(meta[k] == null ? '' : meta[k])];
  }));
}

/* ---------------- Run once from the editor if you want the tabs created early ---------------- */

function setup() {
  ['Jobs', 'Team', 'Settings', 'Entries', 'Brands', 'BrandItems', 'Plan', 'AllocTags', 'Alloc',
   'Pods', 'PodBrands', 'PodMembers', 'BrandOwners', 'StructMeta'].forEach(tab);
  SpreadsheetApp.getActiveSpreadsheet().toast('Tabs ready. Now deploy as a web app.');
}
