// page-fallback.test.mjs — what a missing page may honestly say (CORE-79).
//
//   node --test test/page-fallback.test.mjs
//
// LAW (the disclosure law, quoted by test/page-fallback-browser.test.mjs's header and by src/lib/page-fallback.mjs): "An answer given
// without its inputs must never wear the grammar of an answer that had them." So a failed or unreadable existence check is never
// "unknown" and never "waiting"; the office answering "no" is the only unknown.
//
// The office is a stub that answers like the real one: GET /api/residents/<h> is 200 with the resident's card, or a JSON bounce
// `{ error: "bounce", code: 404 }`; GET /api/households is 200 `{ read: "households", registry: { households: { <slug>: row } } }`.
// EVERY identity here is invented. The browser half (a real built 404.html, a real HTTP 404) is page-fallback-browser.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";

import { whereIs, checkPage, WORDS, WHERE_TO_GO } from "../src/lib/page-fallback.mjs";
import { housePath } from "../src/lib/houses.mjs";

const json = (status, body) => ({ status, json: async () => body });
const card = (handle, agent) => ({ handle, address: { data: { handle, agent } }, profile: {} });
const LONG = `the-${"extraordinarily-long-household-name-".repeat(4)}end`;    // > 96 bytes: its page path is hashed
const REGISTRY = { read: "households", registry: { schema_version: 1, households: {
  "fox-hearth": { name: "Fox Hearth", residents: ["ada-test"] },
  "casa-nera": { name: "casa-nera", residents: ["bo-test"] },
  [LONG]: { residents: ["cy-test"] },
  "odd.name.space": { residents: ["di-test"] },
} } };
const office = ({ residents = {}, households = REGISTRY } = {}) => async (url) => {
  const u = String(url);
  let m;
  if ((m = /^\/api\/residents\/([^/]+)$/.exec(u))) {
    const h = decodeURIComponent(m[1]);
    return residents[h] ? json(200, card(h, residents[h])) : json(404, { error: "bounce", code: 404, defect: `no resident "${h}"`, refused: true });
  }
  if (u === "/api/households") return json(200, households);
  throw new Error(`the stub office was asked something it does not serve: ${u}`);
};

// ── which page was meant ────────────────────────────────────────────────────────────────────────────

test("whereIs: only /residents/<handle>/ and /households/<slug>/ are those pages; anything deeper or odder is `other`", () => {
  assert.deepEqual(whereIs("/residents/ada-test/"), { kind: "resident", handle: "ada-test" });
  assert.deepEqual(whereIs("/residents/ada-test"), { kind: "resident", handle: "ada-test" });
  assert.deepEqual(whereIs("/households/fox-hearth/"), { kind: "household", segment: "fox-hearth" });
  assert.deepEqual(whereIs("/households/odd.name.space/?x=1#y"), { kind: "household", segment: "odd.name.space" });
  for (const p of ["/", "/mail/ada-test/", "/residents/", "/residents", "/households/fox-hearth/hearth/", "/residents/ada-test/extra",
    "/residents/Ada%20Test/", "/residents/%E0%A4%A/", "/residents/-leading/", "/residents/<script>/", "/households//", "/residents/a/b/c/", "", undefined])
    assert.deepEqual(whereIs(p), { kind: "other" }, `${p} is not a resident's or a house's page`);
});

// ── the office knows it: waiting ────────────────────────────────────────────────────────────────────

test("a resident the office knows, with no page built: waiting, with the public name; the name is data, never markup", async () => {
  const r = await checkPage(whereIs("/residents/ada-test/"), office({ residents: { "ada-test": "Ada Test" } }));
  assert.deepEqual(r, { state: "waiting", kind: "resident", handle: "ada-test", name: "Ada Test" });
  // a hostile name is returned as the string it is; the page puts it in with textContent (the browser test proves no element appears)
  const evil = await checkPage(whereIs("/residents/ada-test/"), office({ residents: { "ada-test": `<img src=x onerror=alert(1)> & "q"` } }));
  assert.equal(evil.state, "waiting");
  assert.equal(evil.name, `<img src=x onerror=alert(1)> & "q"`);
  // a very long name is cut to the directory's 48 characters (resident-name.mjs), the name itself unchanged on file
  const long = await checkPage(whereIs("/residents/ada-test/"), office({ residents: { "ada-test": "N".repeat(80) } }));
  assert.equal(long.name, `${"N".repeat(48)}…`);
});

test("a household in the registry, with no page built: waiting, named the way the household's own page names it", async () => {
  assert.deepEqual(await checkPage(whereIs("/households/fox-hearth/"), office()), { state: "waiting", kind: "household", slug: "fox-hearth", name: "Fox Hearth" });
  assert.equal((await checkPage(whereIs("/households/casa-nera/"), office())).name, "Casa Nera", "a raw lower-case registry name is title-cased as plateName does");
  assert.equal((await checkPage(whereIs("/households/odd.name.space/"), office())).name, "odd.name.space");
  // a key too long for a directory has a hashed page path; that is the address a visitor would have
  const hashed = housePath(LONG);
  assert.notEqual(hashed, LONG, "control: the long key really is hashed");
  const r = await checkPage(whereIs(`/households/${hashed}/`), office());
  assert.equal(r.state, "waiting");
  assert.equal(r.slug, LONG);
});

// ── the office says no: unknown (and only then) ──────────────────────────────────────────────────────

test("an identity the office does not know is unknown, for a resident and for a household", async () => {
  assert.deepEqual(await checkPage(whereIs("/residents/nobody-test/"), office({ residents: { "ada-test": "Ada" } })), { state: "unknown", kind: "resident" });
  assert.deepEqual(await checkPage(whereIs("/households/no-such-house/"), office()), { state: "unknown", kind: "household" });
  // control: the same stub does know the others, so "unknown" above is an answer and not a stub that refuses everything
  assert.equal((await checkPage(whereIs("/residents/ada-test/"), office({ residents: { "ada-test": "Ada" } }))).state, "waiting");
  assert.equal((await checkPage(whereIs("/households/fox-hearth/"), office())).state, "waiting");
});

test("any other missing path is `other`, and the office is not asked", async () => {
  let asked = 0;
  const r = await checkPage(whereIs("/no/such/page/"), async () => { asked++; throw new Error("must not ask"); });
  assert.deepEqual(r, { state: "other" });
  assert.equal(asked, 0);
});

// ── the office could not be checked: never unknown, never waiting ───────────────────────────────────

test("a check that failed or answered in a shape we do not trust is `unchecked`, separately for each way it can fail", async () => {
  const cases = {
    "a network failure": async () => { throw new TypeError("fetch failed"); },
    "a 429": async () => json(429, { error: "bounce", code: 429 }),
    "a 500": async () => json(500, { error: "bounce", code: 500 }),
    "a 503": async () => json(503, { error: "bounce", code: 503, defect: "the office cannot read the household registry" }),
    "a 404 that is not the office's bounce (a server with no /api behind it)": async () => ({ status: 404, json: async () => { throw new SyntaxError("<html>"); } }),
    "a 404 with a JSON body that is not the office's bounce": async () => json(404, { message: "not found" }),
    "a 200 that is not JSON": async () => ({ status: 200, json: async () => { throw new SyntaxError("<html>"); } }),
    "a 200 of the wrong shape": async () => json(200, { hello: "world" }),
    "a 200 that is some other resident's card": async () => json(200, card("someone-else", "Someone")),
  };
  for (const [why, fetchFn] of Object.entries(cases)) {
    for (const path of ["/residents/ada-test/"]) {
      const r = await checkPage(whereIs(path), fetchFn);
      assert.equal(r.state, "unchecked", `${why} at ${path} must be unchecked, got ${JSON.stringify(r)}`);
      assert.ok(typeof r.why === "string" && r.why.length > 0, "and it says why");
    }
  }
  for (const [why, fetchFn] of Object.entries({
    "a network failure": cases["a network failure"], "a 429": cases["a 429"], "a 503": cases["a 503"],
    "a 404 with no office behind it": cases["a 404 that is not the office's bounce (a server with no /api behind it)"],
    "a 200 that is not JSON": cases["a 200 that is not JSON"], "a 200 of the wrong shape": cases["a 200 of the wrong shape"],
    "a registry with no houses object": async () => json(200, { read: "households", registry: {} }),
    "a body that is not the households read": async () => json(200, { read: "residents", registry: { households: {} } }),
  })) {
    const r = await checkPage(whereIs("/households/fox-hearth/"), fetchFn);
    assert.equal(r.state, "unchecked", `${why} for a household must be unchecked, got ${JSON.stringify(r)}`);
  }
});

test("an office that never answers is unchecked after the timeout, not unknown and not an endless 'checking'", async () => {
  const hang = (_u, { signal }) => new Promise((_ok, no) => signal.addEventListener("abort", () => no(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const r = await checkPage(whereIs("/residents/ada-test/"), hang, { timeoutMs: 25 });
  assert.equal(r.state, "unchecked");
  assert.match(r.why, /in time/);
});

// ── the words ───────────────────────────────────────────────────────────────────────────────────────

test("the words promise no build time and the page points at places that exist", () => {
  const all = JSON.stringify(WORDS);
  assert.doesNotMatch(all, /\b(minutes?|hours?|seconds?|today|tonight|tomorrow|soon|shortly|within|every (half|30)|:10|:40)\b/i,
    "LAW (page-freshness.mjs): the page \"never prints a cadence promise it does not control\"; a build time from the clock alone is that promise");
  assert.match(WORDS.waiting.resident.title, /\{name\} ?'s page is on its way|\{name\}'s page is on its way/);
  assert.match(WORDS.unchecked.title, /couldn't check/i, "an unchecked answer says it could not be checked");
  assert.doesNotMatch(WORDS.unchecked.lead + WORDS.unchecked.title, /arrived|isn't here|doesn't know/i, "and claims neither arrival nor absence");
  assert.doesNotMatch(WORDS.unknown.lead, /on its way/, "unknown never says on its way");
  assert.ok(WHERE_TO_GO.length >= 2 && WHERE_TO_GO.every((l) => l.href.startsWith("/") && l.label && l.note));
});
