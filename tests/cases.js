/**
 * Test cases for model.js. Shared by `node tests/run.js` and tests.html,
 * so the browser and the command line run exactly the same checks.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TMCases = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function run(M) {
    var results = [];
    function check(name, fn) {
      try { fn(); results.push({ name: name, ok: true }); }
      catch (e) { results.push({ name: name, ok: false, msg: e && e.message ? e.message : String(e) }); }
    }
    function eq(a, b, what) {
      var A = JSON.stringify(a), B = JSON.stringify(b);
      if (A !== B) throw new Error((what || "value") + ": expected " + B + ", got " + A);
    }
    function has(list, code, what) {
      if (!list.some(function (x) { return x.code === code; }))
        throw new Error((what || "list") + " should contain " + code + ", got [" + list.map(function (x) { return x.code; }).join(", ") + "]");
    }
    function lacks(list, code, what) {
      if (list.some(function (x) { return x.code === code; }))
        throw new Error((what || "list") + " should not contain " + code);
    }

    // ---- fixture: two pods plus a floater, mirroring the seeded structure ----
    var brands = [
      { id: "b1", name: "Doctor Farmer" },
      { id: "b2", name: "My Health Summit" },
      { id: "b3", name: "My Health School" },
      { id: "b4", name: "VSL" }
    ];
    var team = [
      { id: "m1", name: "Basha", display: "Basha", level: "Senior", capacity: 100 },
      { id: "m2", name: "Kamesh", display: "Kamesh", level: "Senior", capacity: 100 },
      { id: "m3", name: "Rahul Ravichandran", display: "Rahul R", level: "Junior", capacity: 80 },
      { id: "m4", name: "Varadharaj", display: "Varadharaj", level: "Senior", capacity: 100 },
      { id: "m5", name: "Ashwin", display: "Ashwin", level: "Senior", capacity: 60 }
    ];
    function struct() {
      return {
        pods: [
          { id: "p1", name: "Pod A", type: "organic", color: "#2f6b4f", sort: 1 },
          { id: "p2", name: "Pod B", type: "organic", color: "#a36a00", sort: 2 },
          { id: "pf", name: "Floater", type: "floater", color: "#5d6b62", sort: 9 }
        ],
        bpod: { b1: "p1", b2: "p1", b3: "p2", b4: "p2" },
        bteam: { b1: ["m2", "m3"], b2: ["m1", "m3"], b3: ["m4"], b4: ["m4", "m5"] },
        mpod: { m1: "p1", m2: "p1", m3: "p1", m4: "p2", m5: "pf" },
        roles: { m1: ["lead", "owner"], m2: ["owner"], m3: ["editor"], m4: ["lead", "owner"], m5: ["qc", "floater"] },
        own: {
          b1: { p: "m2", b: "m1", pct: 40 },
          b2: { p: "m1", b: "m2", pct: 40 },
          b3: { p: "m4", b: "m5", pct: 40 },
          b4: { p: "m4", b: "m5", pct: 40 }
        },
        meta: { manager: "Vasanth", lead: "m1" }
      };
    }
    var smonths = { "2026-11": struct() };

    // ---- lookup helpers ----
    check("getActiveStructure returns the month's structure", function () {
      eq(M.getActiveStructure(smonths, "2026-11").pods.length, 3, "pod count");
    });
    check("getActiveStructure on an unknown month is empty, not undefined", function () {
      var s = M.getActiveStructure(smonths, "2030-01");
      eq(s.pods, [], "pods"); eq(s.bpod, {}, "bpod");
    });
    check("getPodForBrand finds the pod", function () {
      eq(M.getPodForBrand(smonths, "2026-11", "b3").name, "Pod B", "pod name");
    });
    check("getPodForBrand is null for an unassigned brand", function () {
      eq(M.getPodForBrand(smonths, "2026-11", "nope"), null, "pod");
    });
    check("getOwnerForBrand returns primary, backup and percent", function () {
      eq(M.getOwnerForBrand(smonths, "2026-11", "b1"), { primary: "m2", backup: "m1", pct: 40 }, "owner");
    });
    check("getOwnerForBrand is null when nobody owns the brand", function () {
      eq(M.getOwnerForBrand(smonths, "2026-11", "nope"), null, "owner");
    });
    check("getMembersOfPod lists only that pod", function () {
      eq(M.getMembersOfPod(smonths, "2026-11", "p1").sort(), ["m1", "m2", "m3"], "members");
    });
    check("brandsOfPod lists only that pod's brands", function () {
      eq(M.brandsOfPod(smonths, "2026-11", "p2").sort(), ["b3", "b4"], "brands");
    });
    check("sortedPods honours sort_order", function () {
      eq(M.sortedPods(struct()).map(function (p) { return p.name; }), ["Pod A", "Pod B", "Floater"], "order");
    });

    // ---- who works on a channel ----
    check("peopleOnBrand lists the crew", function () {
      eq(M.peopleOnBrand(struct(), "b1").sort(), ["m2", "m3"], "crew");
    });
    check("peopleOnBrand counts the owner even when they are not listed", function () {
      var s = struct(); s.bteam.b1 = ["m3"];
      eq(M.peopleOnBrand(s, "b1").sort(), ["m2", "m3"], "crew with owner added");
    });
    check("peopleOnBrand falls back to the owner alone", function () {
      var s = struct(); delete s.bteam.b1;
      eq(M.peopleOnBrand(s, "b1"), ["m2"], "crew");
    });
    check("getBrandTeam reads through the month", function () {
      eq(M.getBrandTeam(smonths, "2026-11", "b4").sort(), ["m4", "m5"], "crew");
    });
    check("brandsWorkedOn covers channels a person does not own", function () {
      eq(M.brandsWorkedOn(struct(), "m3").sort(), ["b1", "b2"], "Rahul R works on two channels, owns none");
      eq(M.brandsOwnedBy(struct(), "m3"), [], "and owns nothing");
    });
    check("error when someone on a channel is outside its pod", function () {
      var s = struct(); s.bteam.b1 = ["m2", "m4"]; // m4 is Pod B
      has(M.validate({ struct: s, brands: brands, team: team }).errors, "worker-outside-pod", "errors");
    });
    check("a floater may work on any channel", function () {
      var s = struct(); s.bteam.b1 = ["m2", "m5"]; // m5 is the floater
      lacks(M.validate({ struct: s, brands: brands, team: team }).errors, "worker-outside-pod", "errors");
    });
    check("warning when a channel has nobody on it", function () {
      var s = struct(); s.bteam.b1 = []; delete s.own.b1;
      has(M.validate({ struct: s, brands: brands, team: team }).warnings, "channel-no-people", "warnings");
    });
    check("warning when a channel rests on one person", function () {
      has(M.validate({ struct: struct(), brands: brands, team: team }).warnings, "channel-one-person", "warnings");
    });
    check("no cover warning once a channel has two people", function () {
      var s = struct(); s.bteam.b3 = ["m4", "m5"];
      var w = M.validate({ struct: s, brands: brands, team: team }).warnings
        .filter(function (x) { return x.code === "channel-one-person"; });
      eq(w.length, 0, "one-person warnings");
    });

    // ---- sharing a channel's goal ----
    check("splitEvenly divides a goal across the crew", function () {
      eq(M.splitEvenly(60, ["a", "b", "c"]), { a: 20, b: 20, c: 20 }, "even split");
    });
    check("splitEvenly gives the remainder to the first people", function () {
      eq(M.splitEvenly(10, ["a", "b", "c"]), { a: 4, b: 3, c: 3 }, "split of ten over three");
    });
    check("the parts of a split always add back up", function () {
      [1, 7, 13, 100, 251].forEach(function (total) {
        [1, 2, 3, 4, 7].forEach(function (n) {
          var people = []; for (var i = 0; i < n; i++) people.push("p" + i);
          var s = M.splitEvenly(total, people), sum = 0;
          Object.keys(s).forEach(function (k) { sum += s[k]; });
          if (sum !== total) throw new Error(total + " over " + n + " people summed to " + sum);
        });
      });
    });
    check("splitEvenly with nobody or nothing gives nothing", function () {
      eq(M.splitEvenly(50, []), {}, "no people");
      eq(M.splitEvenly(0, ["a"]), {}, "no goal");
    });
    check("splitEvenly never hands anyone a zero", function () {
      eq(M.splitEvenly(2, ["a", "b", "c"]), { a: 1, b: 1 }, "two pieces over three people");
    });

    // ---- capacity ----
    check("editingCapacity takes owner time off the top", function () {
      eq(M.editingCapacity(team[0], struct()), 60, "Basha at 40% owner time");
    });
    check("editingCapacity leaves non-owners alone", function () {
      eq(M.editingCapacity(team[2], struct()), 80, "Rahul R owns nothing");
    });
    check("editingCapacity of someone with no capacity is zero", function () {
      eq(M.editingCapacity({ id: "zz" }, struct()), 0, "no capacity set");
    });

    // ---- validation: the clean fixture ----
    check("the seeded structure has no errors", function () {
      var r = M.validate({ struct: struct(), brands: brands, team: team });
      if (!r.ok) throw new Error("expected no errors, got " + JSON.stringify(r.errors));
    });

    // ---- validation: errors ----
    check("error when a brand has no primary owner", function () {
      var s = struct(); delete s.own.b1;
      var r = M.validate({ struct: s, brands: brands, team: team });
      has(r.errors, "no-owner", "errors");
      if (r.ok) throw new Error("activation should be blocked");
    });
    check("error when the owner sits in another pod", function () {
      var s = struct(); s.own.b1.p = "m4"; // Pod B person owning a Pod A brand
      has(M.validate({ struct: s, brands: brands, team: team }).errors, "owner-outside-pod", "errors");
    });
    check("no error when the owner is a floater", function () {
      var s = struct(); s.own.b1.p = "m5"; // Ashwin, floater pod
      lacks(M.validate({ struct: s, brands: brands, team: team }).errors, "owner-outside-pod", "errors");
    });
    check("error on duplicate display names", function () {
      var t = team.concat([{ id: "m9", name: "Rahul Rajan", display: "Rahul R", level: "Junior" }]);
      has(M.validate({ struct: struct(), brands: brands, team: t }).errors, "duplicate-display-name", "errors");
    });
    check("deactivated people do not trip the duplicate check", function () {
      var t = team.concat([{ id: "m9", name: "Rahul Rajan", display: "Rahul R", level: "Junior", active: false }]);
      lacks(M.validate({ struct: struct(), brands: brands, team: t }).errors, "duplicate-display-name", "errors");
    });
    check("an unassigned brand needs no owner", function () {
      var s = struct(); delete s.bpod.b1; delete s.own.b1;
      lacks(M.validate({ struct: s, brands: brands, team: team }).errors, "no-owner", "errors");
    });

    // ---- validation: warnings ----
    check("warning when a pod has no lead", function () {
      var s = struct(); s.roles.m1 = ["owner"];
      has(M.validate({ struct: s, brands: brands, team: team }).warnings, "no-pod-lead", "warnings");
    });
    check("a floater pod is not warned about having no lead", function () {
      var r = M.validate({ struct: struct(), brands: brands, team: team });
      if (r.warnings.some(function (w) { return w.code === "no-pod-lead" && w.ref === "pf"; }))
        throw new Error("the floater pod should not need a lead");
    });
    check("warning when a pod has no senior", function () {
      var s = struct();
      var t = team.map(function (p) { return p.id === "m4" ? { id: "m4", name: "Varadharaj", display: "Varadharaj", level: "Junior", capacity: 100 } : p; });
      has(M.validate({ struct: s, brands: brands, team: t }).warnings, "no-senior", "warnings");
    });
    check("warning when someone is in no pod", function () {
      var s = struct(); delete s.mpod.m3;
      has(M.validate({ struct: s, brands: brands, team: team }).warnings, "member-no-pod", "warnings");
    });
    check("warning when a senior owns more than three brands", function () {
      var s = struct();
      // put every brand in Pod B and hand all four to Kamesh, who moves there too
      ["b1", "b2", "b3", "b4"].forEach(function (bid) {
        s.bpod[bid] = "p2";
        s.own[bid] = { p: "m2", b: "m5", pct: 40 };
      });
      s.mpod.m2 = "p2";
      var r = M.validate({ struct: s, brands: brands, team: team });
      eq(M.brandsOwnedBy(s, "m2").length, 4, "brands owned by Kamesh");
      has(r.warnings, "too-many-brands", "warnings");
    });
    check("owning exactly three brands is not warned about", function () {
      var s = struct();
      ["b1", "b2", "b3"].forEach(function (bid) {
        s.bpod[bid] = "p2";
        s.own[bid] = { p: "m2", b: "m5", pct: 40 };
      });
      s.mpod.m2 = "p2";
      lacks(M.validate({ struct: s, brands: brands, team: team }).warnings, "too-many-brands", "warnings");
    });
    check("warning when a pod is planned past its capacity", function () {
      var load = { m1: 50, m2: 60, m3: 80 }; // 190 against 60+60+80 = 200 → fine
      lacks(M.validate({ struct: struct(), brands: brands, team: team, loadFor: function (id) { return load[id] || 0; } }).warnings, "over-capacity", "warnings");
      load.m3 = 120; // 230 against 200 → over
      has(M.validate({ struct: struct(), brands: brands, team: team, loadFor: function (id) { return load[id] || 0; } }).warnings, "over-capacity", "warnings");
    });
    check("no capacity warning when nobody has a capacity set", function () {
      var t = team.map(function (p) { return { id: p.id, name: p.name, display: p.display, level: p.level }; });
      lacks(M.validate({ struct: struct(), brands: brands, team: t, loadFor: function () { return 999; } }).warnings, "over-capacity", "warnings");
    });

    var failed = results.filter(function (r) { return !r.ok; });
    return { results: results, passed: results.length - failed.length, failed: failed.length };
  }

  return { run: run };
});
