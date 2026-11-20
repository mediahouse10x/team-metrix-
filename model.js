/**
 * Team Metrix — structure model
 * ----------------------------
 * Pure functions only: no DOM, no globals, no storage. Everything the Structure
 * feature decides lives here so it can be tested on its own (see tests/run.js),
 * and so other sections look pods and owners up through one place instead of
 * rolling their own.
 *
 * A structure is keyed by month, exactly like the plan and allocation data:
 *   smonths["2026-11"] = {
 *     pods:  [{id,name,type,color,sort,desc}],   type: organic | ads | floater
 *     bpod:  {brandId: podId},                   a brand sits in at most one pod
 *     bteam: {brandId: [personId, ...]},         who works on that channel
 *     mpod:  {personId: podId},                  a person sits in at most one pod
 *     roles: {personId: ["lead","owner","editor","qc","floater"]},
 *     own:   {brandId: {p:primaryId, b:backupId, pct:40}},
 *     meta:  {manager:"", lead:personId}
 *   }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TMModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var POD_TYPES = ["organic", "ads", "floater"];
  var ROLES = [
    { id: "lead", label: "Pod lead" },
    { id: "owner", label: "Channel owner" },
    { id: "editor", label: "Editor" },
    { id: "qc", label: "QC" },
    { id: "floater", label: "Floater" }
  ];
  var DEFAULT_OWNER_PCT = 40;

  function emptyStructure() {
    return { pods: [], bpod: {}, bteam: {}, mpod: {}, roles: {}, own: {}, meta: { manager: "", lead: "" } };
  }

  /** The structure in force for a month. Month-keyed, so "active" means "this month's". */
  function getActiveStructure(smonths, month) {
    var s = (smonths || {})[month];
    if (!s) return emptyStructure();
    return {
      pods: s.pods || [],
      bpod: s.bpod || {},
      bteam: s.bteam || {},
      mpod: s.mpod || {},
      roles: s.roles || {},
      own: s.own || {},
      meta: s.meta || { manager: "", lead: "" }
    };
  }

  function sortedPods(struct) {
    return (struct.pods || []).slice().sort(function (a, b) {
      return (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name));
    });
  }

  function podById(struct, podId) {
    return (struct.pods || []).filter(function (p) { return p.id === podId; })[0] || null;
  }

  function isFloaterPod(struct, podId) {
    var p = podById(struct, podId);
    return !!p && p.type === "floater";
  }

  /** The pod a brand belongs to on a given month, or null. */
  function getPodForBrand(smonths, month, brandId) {
    var s = getActiveStructure(smonths, month);
    return podById(s, s.bpod[brandId]);
  }

  /** {primary, backup, pct} person ids for a brand, or null when nobody owns it. */
  function getOwnerForBrand(smonths, month, brandId) {
    var o = getActiveStructure(smonths, month).own[brandId];
    if (!o || !o.p) return null;
    return { primary: o.p, backup: o.b || "", pct: o.pct == null ? DEFAULT_OWNER_PCT : +o.pct };
  }

  /** Person ids in a pod on a given month. */
  function getMembersOfPod(smonths, month, podId) {
    var mpod = getActiveStructure(smonths, month).mpod, out = [];
    Object.keys(mpod).forEach(function (pid) { if (mpod[pid] === podId) out.push(pid); });
    return out;
  }

  function brandsOfPod(smonths, month, podId) {
    var bpod = getActiveStructure(smonths, month).bpod, out = [];
    Object.keys(bpod).forEach(function (bid) { if (bpod[bid] === podId) out.push(bid); });
    return out;
  }

  /** Everyone working on a channel. The owner always counts as one of them. */
  function peopleOnBrand(struct, brandId) {
    var list = struct.bteam && Array.isArray(struct.bteam[brandId]) ? struct.bteam[brandId].slice() : [];
    var o = struct.own && struct.own[brandId];
    if (o && o.p && list.indexOf(o.p) < 0) list.unshift(o.p);
    return list;
  }

  /** Channels a person works on (not only the ones they own). */
  function brandsWorkedOn(struct, personId) {
    var out = [];
    Object.keys(struct.bpod || {}).forEach(function (bid) {
      if (peopleOnBrand(struct, bid).indexOf(personId) >= 0) out.push(bid);
    });
    return out;
  }

  function getBrandTeam(smonths, month, brandId) {
    return peopleOnBrand(getActiveStructure(smonths, month), brandId);
  }

  /**
   * Share a channel's planned quantity across the people on it. Whole pieces only,
   * remainders going to the first in the list, so the parts always add back up.
   */
  function splitEvenly(total, people) {
    var out = {}, n = (people || []).length, t = Math.max(0, Math.round(+total || 0));
    if (!n || !t) return out;
    var base = Math.floor(t / n), extra = t - base * n;
    people.forEach(function (p, i) {
      var q = base + (i < extra ? 1 : 0);
      if (q > 0) out[p] = q;
    });
    return out;
  }

  /** Hours of work in a quantity of one deliverable, to one decimal. */
  function hoursFor(qty, perPiece) {
    var q = +qty || 0, h = +perPiece || 0;
    if (q <= 0 || h <= 0) return 0;
    return Math.round(q * h * 10) / 10;
  }

  function rolesOf(struct, personId) {
    var r = struct.roles[personId];
    return Array.isArray(r) ? r : [];
  }

  function brandsOwnedBy(struct, personId) {
    return Object.keys(struct.own).filter(function (bid) {
      var o = struct.own[bid];
      return o && o.p === personId;
    });
  }

  /** What is left of a person's capacity once owner duties are taken off the top. */
  function editingCapacity(member, struct) {
    var cap = +(member && member.capacity) || 0;
    if (!cap) return 0;
    var owned = struct ? brandsOwnedBy(struct, member.id) : [];
    if (!owned.length) return cap;
    var pct = owned.reduce(function (t, bid) {
      var o = struct.own[bid];
      return Math.max(t, o && o.pct != null ? +o.pct : DEFAULT_OWNER_PCT);
    }, 0);
    return Math.round(cap * (1 - Math.min(pct, 100) / 100));
  }

  function displayNameOf(member) {
    return String((member && (member.display || member.name)) || "").trim();
  }

  /**
   * Errors block activation; warnings are shown but do not block.
   * opts: {struct, brands, team, loadFor} — loadFor(personId) returns planned pieces
   * for the month, so the capacity warning uses real numbers when they exist.
   */
  function validate(opts) {
    var struct = opts.struct || emptyStructure();
    var brands = opts.brands || [];
    var team = opts.team || [];
    var loadFor = opts.loadFor || function () { return 0; };
    var errors = [], warnings = [];
    var brandById = {}, memberById = {};
    brands.forEach(function (b) { brandById[b.id] = b; });
    team.forEach(function (p) { memberById[p.id] = p; });

    // --- errors ---
    var seen = {};
    team.forEach(function (p) {
      if (p.active === false) return;
      var dn = displayNameOf(p).toLowerCase();
      if (!dn) return;
      if (seen[dn]) errors.push({ code: "duplicate-display-name", ref: p.id, msg: 'Two people share the display name "' + displayNameOf(p) + '". Display names must be unique.' });
      seen[dn] = true;
    });

    Object.keys(struct.bpod).forEach(function (bid) {
      var brand = brandById[bid];
      if (!brand) return;
      var podId = struct.bpod[bid];
      if (!podId) return;
      var own = struct.own[bid];
      if (!own || !own.p) {
        errors.push({ code: "no-owner", ref: bid, msg: brand.name + " has no primary owner." });
        return;
      }
      var ownerPod = struct.mpod[own.p];
      if (ownerPod !== podId && !isFloaterPod(struct, ownerPod)) {
        var owner = memberById[own.p];
        errors.push({
          code: "owner-outside-pod", ref: bid,
          msg: (owner ? displayNameOf(owner) : "The owner") + " owns " + brand.name + " but is not in its pod."
        });
      }
      // Everyone put on a channel must sit in its pod, or be a floater.
      (struct.bteam && struct.bteam[bid] ? struct.bteam[bid] : []).forEach(function (pid) {
        var mp = struct.mpod[pid];
        if (mp !== podId && !isFloaterPod(struct, mp)) {
          var who = memberById[pid];
          errors.push({
            code: "worker-outside-pod", ref: bid,
            msg: (who ? displayNameOf(who) : "Someone") + " works on " + brand.name + " but is not in its pod."
          });
        }
      });
    });

    // --- warnings ---
    sortedPods(struct).forEach(function (pod) {
      var ids = Object.keys(struct.mpod).filter(function (pid) { return struct.mpod[pid] === pod.id; });
      var members = ids.map(function (pid) { return memberById[pid]; }).filter(Boolean);
      // A floater pod supports the others; it is not expected to have a lead of its own.
      if (pod.type !== "floater" && !members.some(function (p) { return rolesOf(struct, p.id).indexOf("lead") >= 0; }))
        warnings.push({ code: "no-pod-lead", ref: pod.id, msg: pod.name + " has no pod lead." });
      if (!members.some(function (p) { return p.level === "Senior"; }))
        warnings.push({ code: "no-senior", ref: pod.id, msg: pod.name + " has no senior." });

      var capacity = members.reduce(function (t, p) { return t + editingCapacity(p, struct); }, 0);
      var load = members.reduce(function (t, p) { return t + (+loadFor(p.id) || 0); }, 0);
      if (capacity > 0 && load > capacity)
        warnings.push({ code: "over-capacity", ref: pod.id, msg: pod.name + " needs " + load + " hours against " + capacity + " hours of capacity." });
    });

    Object.keys(struct.bpod).forEach(function (bid) {
      var brand = brandById[bid];
      if (!brand || !struct.bpod[bid]) return;
      var crew = peopleOnBrand(struct, bid);
      if (!crew.length)
        warnings.push({ code: "channel-no-people", ref: bid, msg: "Nobody is working on " + brand.name + "." });
      else if (crew.length === 1)
        warnings.push({ code: "channel-one-person", ref: bid, msg: brand.name + " has only one person on it — no cover if they are away." });
    });

    team.forEach(function (p) {
      if (p.active === false) return;
      if (!struct.mpod[p.id]) warnings.push({ code: "member-no-pod", ref: p.id, msg: displayNameOf(p) + " is not in any pod." });
      if (p.level === "Senior" && brandsOwnedBy(struct, p.id).length > 3)
        warnings.push({ code: "too-many-brands", ref: p.id, msg: displayNameOf(p) + " owns " + brandsOwnedBy(struct, p.id).length + " brands (more than 3)." });
    });

    return { errors: errors, warnings: warnings, ok: errors.length === 0 };
  }

  return {
    POD_TYPES: POD_TYPES,
    ROLES: ROLES,
    DEFAULT_OWNER_PCT: DEFAULT_OWNER_PCT,
    emptyStructure: emptyStructure,
    getActiveStructure: getActiveStructure,
    getPodForBrand: getPodForBrand,
    getOwnerForBrand: getOwnerForBrand,
    getMembersOfPod: getMembersOfPod,
    getBrandTeam: getBrandTeam,
    peopleOnBrand: peopleOnBrand,
    splitEvenly: splitEvenly,
    hoursFor: hoursFor,
    brandsWorkedOn: brandsWorkedOn,
    brandsOfPod: brandsOfPod,
    sortedPods: sortedPods,
    podById: podById,
    isFloaterPod: isFloaterPod,
    rolesOf: rolesOf,
    brandsOwnedBy: brandsOwnedBy,
    editingCapacity: editingCapacity,
    displayNameOf: displayNameOf,
    validate: validate
  };
});
