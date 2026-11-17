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
 * You can read them freely. Edits made by hand are picked up the next time the page
 * loads or you press "Reload from sheet" — but a save from the page rewrites the tab,
 * so prefer entering data in the page.
 */

var HEAD = {
  // Team Metrics side
  Jobs:       ['id', 'level', 'category', 'job', 'ck'],
  Team:       ['id', 'name', 'level', 'jobs'],
  Settings:   ['key', 'value'],
  Entries:    ['month', 'personId', 'jobId', 'goal', 'actual'],
  // Deliverables side (independent of the four above)
  Brands:     ['id', 'name'],
  BrandItems: ['brandId', 'itemId', 'name'],
  Plan:       ['month', 'brandId', 'itemId', 'quantity']
};

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
      case 'load':       var all = loadAll(); return { ok: true, config: all.config, months: all.months, bmonths: all.bmonths };
      case 'saveConfig': saveConfig(req.config || {}); return { ok: true };
      case 'saveMonth':  saveMonth(fmtMonth(req.month), req.entries || {}); return { ok: true };
      case 'savePlan':   savePlan(fmtMonth(req.month), req.plan || {}); return { ok: true };
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
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]).setFontWeight('bold');
    s.setFrozenRows(1);
    if (name === 'Entries' || name === 'Plan') s.getRange('A:A').setNumberFormat('@'); // keep "2026-11" as text
  }
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
             jobs: String(r[3] == null ? '' : r[3]).split(',').map(function (s) { return s.trim(); }).filter(String) };
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
    return { id: id, name: String(r[1]), items: itemsByBrand[id] || [] };
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

  return {
    config: { lib: lib, team: team, settings: settings, brands: brands },
    months: months,
    bmonths: bmonths
  };
}

/* ---------------- Write ---------------- */

function saveConfig(config) {
  var lib = config.lib || [], team = config.team || [], settings = config.settings || {};

  writeRows('Jobs', lib.map(function (x) {
    return [String(x.id), String(x.level), String(x.category), String(x.job), String(x.ck)];
  }));

  writeRows('Team', team.map(function (p) {
    return [String(p.id), String(p.name), String(p.level), (p.jobs || []).join(',')];
  }));

  writeRows('Settings', Object.keys(settings).map(function (k) { return [k, settings[k]]; }));

  var brands = config.brands || [];
  writeRows('Brands', brands.map(function (b) { return [String(b.id), String(b.name)]; }));

  var items = [];
  brands.forEach(function (b) {
    (b.items || []).forEach(function (i) { items.push([String(b.id), String(i.id), String(i.name)]); });
  });
  writeRows('BrandItems', items);
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

/* ---------------- Run once from the editor if you want the tabs created early ---------------- */

function setup() {
  ['Jobs', 'Team', 'Settings', 'Entries', 'Brands', 'BrandItems', 'Plan'].forEach(tab);
  SpreadsheetApp.getActiveSpreadsheet().toast('Tabs ready. Now deploy as a web app.');
}
