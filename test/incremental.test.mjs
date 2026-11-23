// incremental.test.mjs — src/lib/incremental.mjs: the key and the filter (POS-1085).
//
//   node --test test/incremental.test.mjs
//
// LAW (POS-1085): the route key is "the hash of its params and props", and a key that
// cannot be computed fails loudly (see the header of src/lib/incremental.mjs).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canon, incremental, keyOf } from "../src/lib/incremental.mjs";

const WORK = mkdtempSync(join(tmpdir(), "incr-unit-"));
after(() => rmSync(WORK, { recursive: true, force: true })); // the temp folder this file made itself

test("a key does not depend on property order, and does depend on every value", () => {
  assert.equal(keyOf({ a: 1 }, { x: 1, y: [1, 2] }), keyOf({ a: 1 }, { y: [1, 2], x: 1 }));
  assert.notEqual(keyOf({ a: 1 }, { x: 1 }), keyOf({ a: 1 }, { x: 2 }));
  assert.notEqual(keyOf({ a: 1 }, { x: 1 }), keyOf({ a: 2 }, { x: 1 }));
  assert.notEqual(keyOf({}, { x: "1" }), keyOf({}, { x: 1 }), "a string and a number are different values");
  assert.notEqual(keyOf({}, { x: undefined }), keyOf({}, { x: null }), "undefined and null are different values");
  assert.notEqual(keyOf({}, { x: [1, 2] }), keyOf({}, { x: [2, 1] }), "array order is data");
});

test("a Map and a Set are keyed by their contents; a function, a class instance and a cycle are refused", () => {
  assert.notEqual(keyOf({}, { m: new Map([["a", 1]]) }), keyOf({}, { m: new Map([["a", 2]]) }));
  assert.notEqual(keyOf({}, { s: new Set([1]) }), keyOf({}, { s: new Set([2]) }));
  assert.throws(() => canon({ f() {} }), /cannot key a function/);
  assert.throws(() => canon({ r: new (class X {})() }), /class instance/);
  const loop = {}; loop.self = loop;
  assert.throws(() => canon(loop), /cyclic/);
  const shared = { v: 1 }; // the same object twice is not a cycle
  assert.doesNotThrow(() => canon({ a: shared, b: shared }));
});

test("with no INCR_OUT nothing is filtered and nothing is written", () => {
  delete process.env.INCR_OUT; delete process.env.INCR_PREV;
  const routes = [{ params: { s: "a" }, props: { v: 1 } }];
  assert.equal(incremental("t-none", routes, { files: () => [] }), routes);
});

test("with INCR_OUT it records every route; with INCR_PREV it drops the unchanged ones only", () => {
  const out = join(WORK, "out");
  process.env.INCR_OUT = out;
  delete process.env.INCR_PREV;
  const routes = (v) => [
    { params: { s: "a" }, props: { v: 1 } },
    { params: { s: "b" }, props: { v } },
  ];
  const files = (p) => [`t/${p.s}/index.html`];
  assert.equal(incremental("t-fam", routes(1), { files }).length, 2, "no previous manifest: all render");
  const first = JSON.parse(readFileSync(join(out, "t-fam.json"), "utf8"));
  assert.equal(first.total, 2);
  assert.equal(first.rendered, 2);
  assert.deepEqual(Object.values(first.entries).map((e) => e.f), [["t/a/index.html"], ["t/b/index.html"]]);

  const prev = join(WORK, "prev.json");
  writeFileSync(prev, JSON.stringify({ version: 1, routes: { "t-fam": first.entries } }));
  process.env.INCR_PREV = prev;
  assert.equal(incremental("t-fam", routes(1), { files }).length, 0, "same props: nothing renders");
  const changed = incremental("t-fam", routes(2), { files });
  assert.deepEqual(changed.map((r) => r.params.s), ["b"], "only the route whose props moved renders");
  const rec = JSON.parse(readFileSync(join(out, "t-fam.json"), "utf8"));
  assert.equal(rec.total, 2, "the manifest still records the skipped route");
  assert.equal(rec.rendered, 1);
  assert.equal(incremental("t-other", routes(1), { files }).length, 2, "a family the previous manifest never held renders in full");
  delete process.env.INCR_OUT; delete process.env.INCR_PREV;
});
