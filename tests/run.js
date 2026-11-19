#!/usr/bin/env node
/**
 * Run the model tests from the command line:   node tests/run.js
 * The same cases run in the browser via tests.html.
 */
var M = require("../model.js");
var cases = require("./cases.js");

var out = cases.run(M);
out.results.forEach(function (r) {
  if (r.ok) console.log("  ok   " + r.name);
  else console.log("  FAIL " + r.name + "\n       " + r.msg);
});
console.log("\n" + out.passed + " passed, " + out.failed + " failed");
process.exit(out.failed ? 1 : 0);
