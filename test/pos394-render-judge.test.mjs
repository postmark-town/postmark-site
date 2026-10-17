// pos394-render-judge.test.mjs — the render proof's verdict fails anything incomplete (POS-394).
//
//   node --test --test-concurrency=1 test/pos394-render-judge.test.mjs
//
// PURE: judge() only, on invented child outputs. Importing the harness renders
// nothing and runs nothing (its main is gated); no Vite, Astro or packages.

import test from "node:test";
import assert from "node:assert/strict";
import { judge, merge, falsified, applyEdits, CASES, CHECKS, PRIVACY, MUTANTS, REFUSAL_CHANNELS } from "../tools/pos394-render-proof.mjs";

const OK_RES = { status: 0, signal: null };
const good = () => ({
  cases: Object.fromEntries(Object.entries(CASES).map(([n, checks]) => [n, { checks: Object.fromEntries(checks.map((c) => [c, true])) }])),
  refusals: Object.fromEntries(REFUSAL_CHANNELS.map((k) => [k, []])),
  esbuildSpawns: 1,
});

test("a complete, all-true, zero-refusal result passes (control)", () => {
  const v = judge(good(), OK_RES);
  assert.deepEqual(v.problems, []);
  assert.equal(v.pass, true);
});

test("every incompleteness or failure fails the verdict", () => {
  const variants = {
    "no output": [null, OK_RES],
    "non-zero exit": [good(), { status: 1, signal: null }],
    "killed": [good(), { status: null, signal: "SIGTERM" }],
    "spawn error": [good(), { status: null, error: { code: "ENOENT" } }],
    "crash": [{ ...good(), crash: "Error: boom" }, OK_RES],
    "a case missing": [(() => { const o = good(); delete o.cases.residentCard; return o; })(), OK_RES],
    "an extra case": [(() => { const o = good(); o.cases.extra = { checks: { x: true } }; return o; })(), OK_RES],
    "empty checks": [(() => { const o = good(); o.cases.residentWrapper.checks = {}; return o; })(), OK_RES],
    "checks missing": [(() => { const o = good(); delete o.cases.householdSeat.checks; return o; })(), OK_RES],
    "a check name missing": [(() => { const o = good(); delete o.cases.householdSeat.checks[CHECKS.HDHUMAN]; return o; })(), OK_RES],
    "an extra check": [(() => { const o = good(); o.cases.householdPage.checks.bonus = true; return o; })(), OK_RES],
    "a check false": [(() => { const o = good(); o.cases.householdPage.checks[CHECKS.NEVER] = false; return o; })(), OK_RES],
    "a check truthy but not true": [(() => { const o = good(); o.cases.householdPage.checks[CHECKS.TITLE_H] = "yes"; return o; })(), OK_RES],
    "an fs refusal": [(() => { const o = good(); o.refusals.fs.push({ api: "readFileSync" }); return o; })(), OK_RES],
    "a net refusal": [(() => { const o = good(); o.refusals.net.push("fetch x"); return o; })(), OK_RES],
    "a proc refusal": [(() => { const o = good(); o.refusals.proc.push("spawn sh"); return o; })(), OK_RES],
    "a channel missing": [(() => { const o = good(); delete o.refusals.net; return o; })(), OK_RES],
    "a channel not a list": [(() => { const o = good(); o.refusals.proc = 0; return o; })(), OK_RES],
    "an extra channel": [(() => { const o = good(); o.refusals.other = []; return o; })(), OK_RES],
    "no refusals object": [(() => { const o = good(); delete o.refusals; return o; })(), OK_RES],
  };
  for (const [what, [out, res]] of Object.entries(variants)) {
    const v = judge(out, res);
    assert.equal(v.pass, false, what);
    assert.ok(v.problems.length > 0, `${what}: names its problem`);
  }
  assert.equal(Object.keys(variants).length, 20);
});

test("the expected cases and channels are exactly the five surfaces and three channels", () => {
  assert.deepEqual(Object.keys(CASES), ["householdSeat", "residentWrapper", "residentCard", "householdPage", "residentPage"]);
  assert.deepEqual([...REFUSAL_CHANNELS], ["fs", "net", "proc"]);
  for (const [n, checks] of Object.entries(CASES)) {
    assert.ok(checks.length >= 3, `${n} has its checks`);
    assert.ok(checks.includes(CHECKS.NEVER) && (checks.includes(CHECKS.PROP) || checks.includes(CHECKS.REG)), `${n}: the sentinel check and its positive control`);
  }
});

// A mutant run's verdict: exactly its must-red privacy checks red, nothing structural.
const redReport = (name) => {
  const out = good();
  for (const [c, ks] of Object.entries(MUTANTS[name].mustRed)) for (const k of ks) out.cases[c].checks[k] = false;
  const failed = [];
  for (const [c, ks] of Object.entries(MUTANTS[name].mustRed)) for (const k of ks) failed.push([c, k]);
  return { structural: [], failed };
};

test("falsified(): exactly the mutant's red (case, check) set is the only pass", () => {
  for (const name of Object.keys(MUTANTS)) {
    assert.deepEqual(falsified(redReport(name), name), [], `${name}: control`);
    const short = redReport(name); short.failed.pop();
    assert.ok(falsified(short, name).length > 0, `${name}: a must-red that stayed green fails`);
    const extra = redReport(name); extra.failed.push(["householdPage", CHECKS.TITLE_H]);
    assert.ok(falsified(extra, name).some((p) => /non-privacy/.test(p)), `${name}: a non-privacy red fails`);
    const other = Object.keys(CASES).find((c) => !(c in MUTANTS[name].mustRed));
    const extraNever = redReport(name); extraNever.failed.push([other, CHECKS.NEVER]);
    assert.ok(falsified(extraNever, name).some((p) => /unexpected privacy red/.test(p)), `${name}: an extra sentinel red on ${other} fails`);
    const [c0] = Object.keys(MUTANTS[name].mustRed);
    const spare = CASES[c0].find((k) => PRIVACY.includes(k) && !MUTANTS[name].mustRed[c0].includes(k));
    if (spare) {
      const extraPair = redReport(name); extraPair.failed.push([c0, spare]);
      assert.ok(falsified(extraPair, name).some((p) => /unexpected privacy red/.test(p)), `${name}: an extra privacy red on ${c0} fails`);
    }
    const crashed = redReport(name); crashed.structural.push("child crashed: x");
    assert.ok(falsified(crashed, name).length > 0, `${name}: a crash is not a falsifier`);
    assert.ok(falsified({ structural: [], failed: [] }, name).length > 0, `${name}: nothing red fails`);
    for (const [, ks] of Object.entries(MUTANTS[name].mustRed)) for (const k of ks) assert.ok(PRIVACY.includes(k), `${name}: ${k} is a privacy check`);
  }
});

test("applyEdits(): one anchor exactly once, one old private-human line, or it throws", () => {
  const files = { "a.astro": "<p>\n  <b>x</b>\n</p>\n" };
  const ok = applyEdits(files, [{ path: "a.astro", from: "<p>\n", to: "<p>\n  {house.human}\n" }]);
  assert.equal(ok["a.astro"], "<p>\n  {house.human}\n  <b>x</b>\n</p>\n");
  assert.equal(files["a.astro"], "<p>\n  <b>x</b>\n</p>\n", "the input is not mutated");
  for (const [what, edit] of [
    ["an absent anchor", { path: "a.astro", from: "<q>\n", to: "<q>\n  {house.human}\n" }],
    ["an anchor found twice", { path: "a.astro", from: "\n", to: "\n  {house.human}\n" }],
    ["an edit with no private human", { path: "a.astro", from: "<p>\n", to: "<p>\n  {house.name}\n" }],
    ["two lines inserted", { path: "a.astro", from: "<p>\n", to: "<p>\n  {house.human}\n  {house.human}\n" }],
    ["a file not projected", { path: "b.astro", from: "<p>\n", to: "<p>\n  {house.human}\n" }],
  ]) assert.throws(() => applyEdits(files, [edit]), Error, what);
});

test("merge(): either child's failure is the run's", () => {
  const half = (names) => { const o = good(); for (const n of Object.keys(o.cases)) if (!names.includes(n)) delete o.cases[n]; return o; };
  const ok = [{ kind: "build", res: { status: 0 }, out: half(["householdPage", "residentPage"]) },
    { kind: "container", res: { status: 0 }, out: half(["householdSeat", "residentWrapper", "residentCard"]) }];
  const m = merge(ok);
  assert.equal(judge(m.out, m.res).pass, true, "control: two clean halves make a clean run");
  for (const [what, mutate] of [
    ["a child crashed", (r) => { r[0].out.crash = "Error: x"; }],
    ["a child printed nothing", (r) => { r[1].out = null; }],
    ["a child exited non-zero", (r) => { r[1].res = { status: 1 }; }],
    ["a child was killed", (r) => { r[0].res = { status: null, signal: "SIGTERM" }; }],
    ["a child lost a refusal channel", (r) => { delete r[0].out.refusals.net; }],
    ["a child refused something", (r) => { r[1].out.refusals.fs.push({ api: "x" }); }],
    ["a child's cases are missing", (r) => { r[0].out.cases = {}; }],
  ]) {
    const runs = structuredClone(ok); mutate(runs);
    const mm = merge(runs);
    assert.equal(judge(mm.out, mm.res).pass, false, what);
  }
});
