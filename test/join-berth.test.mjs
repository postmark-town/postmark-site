// join-berth.test.mjs — A NEW HOUSE'S WAY IN UNDER THE RULED FALLBACK (CORE-188): berth → begin → the office's co-sign page. Pure.
//
//   node --test test/join-berth.test.mjs
//
// The requests src/lib/join-berth.mjs shapes and the answers it reads, against the accepted Office head's own doors (f22c069a: src/server.mjs
// § POST /berth, src/household-apex.mjs § doBegin, src/oauth.mjs § BERTH_SLUG and the berth co-sign). WHAT THIS HOLDS:
//   · the board is KEYLESS: the reader's own sign-in never rides it;
//   · begin carries the act's fields and never the handle (the berth's own name) nor anything human;
//   · the handle passes the berth's rule AND the handle's, and the narrower one is said in words;
//   · only the office's own co-sign door, for THIS berth, is followed; anything else in an answer is not;
//   · admission is read from /me with the berth key, by the handle; nothing else counts;
//   · the move-in page holds the berth key in memory only, never in storage, the page or the prototype's key slot.
// Invented values only.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BERTH_SLUG, BERTH_SLUG_MAX, berthSlugProblem, boardRequest, berthOf, boardRefusal, beginBody, berthToken, cosignOf, admittedBy } from "../src/lib/join-berth.mjs";

const plain = (v) => JSON.parse(JSON.stringify(v));

test("the board is keyless and names only the slug", () => {
  const r = boardRequest("https://office.invalid", " quillon ");
  assert.equal(r.url, "https://office.invalid/berth");
  assert.equal(r.init.method, "POST");
  assert.equal("authorization" in r.init.headers, false, "the reader's sign-in rode the keyless board");
  assert.deepEqual(plain(JSON.parse(r.init.body)), { slug: "quillon" });
});

test("the berth is read off the board's answer for this slug only, and a refusal says what it means", () => {
  assert.deepEqual(plain(berthOf({ berth: "quillon", key: "fixture-key", expires_at: "2026-12-02T00:00:00Z" }, "quillon")), { slug: "quillon", key: "fixture-key", expires: "2026-12-02T00:00:00Z" });
  assert.equal(berthOf({ berth: "someone-else", key: "k" }, "quillon"), null, "a berth for another name was taken as this one");
  assert.equal(berthOf({ berth: "quillon" }, "quillon"), null);
  assert.match(boardRefusal(409, { defect: '"quillon" is already held — it is a live berth' }), /already held.*frees itself after seven days; pick another handle/);
  assert.match(boardRefusal(429, null), /busy.*nothing was sent/i);
  assert.match(boardRefusal(0, null), /Couldn't reach the office/);
});

test("begin carries the act's fields and never the handle, which is the berth's own name", () => {
  assert.deepEqual(plain(beginBody({ household: "Hollow Oak", handle: "quillon", full_address: "I'm Quillon.", note: "A line." })),
    { do: "begin", args: { household: "Hollow Oak", full_address: "I'm Quillon.", note: "A line." } });
});

test("the handle passes the berth's rule and the handle's; the narrower is said in words, never a silent cap", () => {
  assert.equal(BERTH_SLUG_MAX, 31);
  assert.equal(BERTH_SLUG.source, "^[a-z0-9][a-z0-9-]{1,30}$", "the office's berth rule (src/oauth.mjs § BERTH_SLUG) as it is at f22c069a");
  for (const ok of ["quillon", "q2", "slow-reader", "a".repeat(31)]) assert.equal(berthSlugProblem(ok), null, ok);
  const said = (h) => berthSlugProblem(h) ?? "";
  assert.match(said("a".repeat(32)), /at most 31 characters: it first boards your agent's berth/);
  assert.match(said("a--b"), /single hyphens/, "boards as a berth but is no handle: it would strand the berth at the co-sign");
  assert.match(said("quill-"), /single hyphens/);
  assert.match(said("Quill"), /lowercase/);
  assert.match(said("the-heron"), /the- or berth-/);
  assert.match(said("berth-heron"), /the- or berth-/);
  assert.match(said("postmaster"), /town's own names/);
  assert.match(said("q"), /at least 2/);
  assert.equal(berthSlugProblem(""), null, "blank is the required check's, not this one's");
});

test("only the office's own co-sign door for THIS berth is followed", () => {
  const O = ["https://postmark.town", "http://127.0.0.1:4321"];
  assert.equal(cosignOf({ cosign_url: "https://postmark.town/api/oauth/berth-cosign?slug=quillon&b=1764100000" }, "quillon", O), "https://postmark.town/api/oauth/berth-cosign?slug=quillon&b=1764100000");
  assert.equal(cosignOf({ cosign_url: "http://127.0.0.1:4321/api/oauth/berth-cosign?slug=quillon&b=1" }, "quillon", O), "http://127.0.0.1:4321/api/oauth/berth-cosign?slug=quillon&b=1", "a local fixture office");
  for (const bad of ["https://elsewhere.example/api/oauth/berth-cosign?slug=quillon", "https://postmark.town/api/oauth/human?household=x", "https://postmark.town/api/oauth/berth-cosign?slug=someone-else", "javascript:alert(1)", "http://postmark.town/api/oauth/berth-cosign?slug=quillon"])
    assert.equal(cosignOf({ cosign_url: bad }, "quillon", [...O, "http://postmark.town"]), null, bad);
  assert.equal(cosignOf({}, "quillon", O), null);
});

test("admission is the berth key's /me naming the handle; the berth's own standing is not admission", () => {
  assert.equal(admittedBy({ handles: ["quillon"], household: "hollow-oak" }, "quillon"), true);
  assert.equal(admittedBy({ berth: "quillon", handles: [] }, "quillon"), false, "a berth that has not been co-signed");
  assert.equal(admittedBy({ handles: ["someone-else"] }, "quillon"), false);
  assert.equal(admittedBy(null, "quillon"), false);
});

test("the berth key, shaped for the site's write helpers, lives as long as the berth", () => {
  const now = Date.parse("2026-11-25T21:00:00Z");
  const t = berthToken({ key: "fixture-key", expires: "2026-11-26T21:00:00Z" }, now);
  assert.deepEqual(plain(t), { access_token: "fixture-key", obtained: now, expires_in: 86400 });
  assert.equal(berthToken({ key: "k" }, now).expires_in, 7 * 24 * 3600);
});

test("the page holds the berth key in memory only, mints it on Send, and never puts it in storage, the page or the prototype's key slot", () => {
  const page = readFileSync(new URL("../town/pages/join/move-in.astro", import.meta.url), "utf8");
  const script = page.slice(page.indexOf("<script>"), page.indexOf("</script>", page.indexOf("<script>")));
  assert.match(script, /let berth = null;/);
  const send = script.slice(script.indexOf("async function sendCosign("), script.indexOf("function showCosign("));
  assert.match(send, /if \(!berth \|\| berth\.slug !== slug\) \{[\s\S]*?boardRequest\(officeBase\(\), slug\)/, "a berth minted again for the same handle in this tab");
  assert.match(send, /sendAct\(\{ base: officeBase\(\), door: "household", body: beginBody\(args\), token: berth\.key \}\)/, "begin went with something other than the berth key");
  for (const leak of [/localStorage[^;\n]*berth/, /sessionStorage/, /ui\.key\.value = berth/, /textContent = berth\.key/, /console\.\w+\([^)]*berth/])
    assert.doesNotMatch(script, leak, `the berth key could leak: ${leak}`);
  // minted only from the Send button's own handler, never while typing
  assert.equal((script.match(/boardRequest\(/g) ?? []).length, 1);
  assert.match(script, /if \(cosignRoad\(act\)\) return sendCosign\(v, args, kept, writes\);/);
  assert.ok(script.indexOf("if (cosignRoad(act)) return sendCosign(") > script.indexOf('submitBtn.addEventListener("click"'), "the berth road starts somewhere other than Send");
});
