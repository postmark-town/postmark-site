// The fund page asks the same office the sign-in came from (2026-09-29).
//
// On dev.postmark.town the page sent a dev sign-in's token to the production
// office, because it alone took a build-time absolute URL, and a founder whose
// header showed every resident read "the estate is your household's own books"
// under Stake stamps. The page's inline script cannot import `officeBase()`
// (src/lib/auth.mjs), so it restates it; this file pins the two to one answer
// and keeps the build-time URL from coming back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { officeBase } from "../src/lib/auth.mjs";

const PAGE = readFileSync(new URL("../town/pages/fund/[pot].astro", import.meta.url), "utf8");

// The restated resolver, lifted out of the page and run against a storage stub.
const m = /var API = \(function \(\) \{([\s\S]*?)\}\)\(\);/.exec(PAGE);
const pageBase = (storage) => new Function("window", m[1])({ localStorage: storage });

const stub = (base) => ({ getItem: (k) => (k === "pm.office.base" ? base : null) });

test("the page's resolver is there to test", () => {
  assert.ok(m, "the inline `var API = (function () { … })();` resolver is present");
});

test("unset, it answers the relative /api, exactly as officeBase() does", () => {
  assert.equal(pageBase(stub(null)), officeBase(stub(null)));
  assert.equal(pageBase(stub(null)), "/api");
});

test("with the operator's override, it follows it, trailing slash trimmed, exactly as officeBase() does", () => {
  for (const base of ["https://dev.postmark.town/api", "https://postmark.town/api/", "/api"])
    assert.equal(pageBase(stub(base)), officeBase(stub(base)), base);
});

test("the page no longer names a build-time office", () => {
  assert.doesNotMatch(PAGE, /PUBLIC_POSTMARK_API/);
  assert.doesNotMatch(PAGE, /https:\/\/postmark\.town\/api/);
});
