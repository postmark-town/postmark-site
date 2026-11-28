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
import { BERTH_SLUG, BERTH_SLUG_MAX, berthSlugProblem, berthSlugFor, chosenHandleWords, boardRequest, berthOf, boardRefusal, beginBody, berthToken, cosignOf, admittedBy, residentOf, residentWords } from "../src/lib/join-berth.mjs";

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
  // a cut berth name held (Truey F1 on 5c7decf9: the office keeps a co-signed berth's name for good): the advice is to change something within
  // the first 31 characters, never "pick another handle", which a new tail can't satisfy; the control above, an uncut name, keeps its own words
  const cut = boardRefusal(409, { defect: '"quillon-of-hollow-oak-the-slow" is already held — it is a live berth', hint: "names are single-occupancy across the whole town; pick another" }, { cut: true });
  assert.match(cut, /^"quillon-of-hollow-oak-the-slow" is already held — it is a live berth\. /, "the office's own words lead");
  assert.doesNotMatch(cut, /pick another/, "the office's 'pick another' hint, which a new tail can't satisfy, rides a cut name's refusal");
  assert.match(cut, /Your agent's berth uses the first 31 characters of the handle, and that name is already in use, so changing anything after them won't help\. Change something within the first 31 characters to go on\./);
  assert.doesNotMatch(cut, /pick another handle/, "a cut name's refusal still says to pick another handle");
  assert.doesNotMatch(boardRefusal(409, null), /first 31 characters/, "an uncut name's refusal talks about a cut");
  assert.match(boardRefusal(429, null), /busy.*nothing was sent/i);
  assert.match(boardRefusal(0, null), /Couldn't reach the office/);
});

test("begin carries the act's fields AND the chosen handle (the receiver parks it apart from the berth; an office before it ignores it)", () => {
  // Office #1237 candidate c1bd858b (not accepted or merged): doBegin judges `handle` as declare does and parks it; the train's begin validates against
  // DECLARE_SCHEMA with the handle exempt and drops it, declaring the slug (the same name under the 31 rule)
  assert.deepEqual(plain(beginBody({ household: "Hollow Oak", handle: "quillon", full_address: "I'm Quillon.", note: "A line." })),
    { do: "begin", args: { household: "Hollow Oak", handle: "quillon", full_address: "I'm Quillon.", note: "A line." } });
  assert.deepEqual(plain(beginBody({ household: "Hollow Oak", full_address: "x" })), { do: "begin", args: { household: "Hollow Oak", full_address: "x" } }, "no handle is invented");
});

test("THE RESIDENT IS THE OFFICE'S WORD, apart from the berth: begin's answer names it; before the receiver it is the slug", () => {
  // the train's answer (no receiver): { declared, handle: <slug>, cosign_url, … }
  assert.deepEqual(plain(residentOf({ declared: "Hollow Oak", handle: "quillon", cosign_url: "x" }, "quillon")), { resident: "quillon", berth: "quillon", receiver: false });
  // the candidate's answer: { handle: <the chosen resident>, berth: <the slug> }; a chosen name apart from the slug is read as the resident
  assert.deepEqual(plain(residentOf({ handle: "quillon-of-hollow-oak-the-long-name", berth: "quillon" }, "quillon")),
    { resident: "quillon-of-hollow-oak-the-long-name", berth: "quillon", receiver: true });
  // nothing readable: the slug, which is what an office without the receiver declares; never a page-side guess
  for (const odd of [null, {}, { handle: 7 }, { handle: "Not A Handle" }, { handle: "" }])
    assert.equal(residentOf(odd, "quillon").resident, "quillon", JSON.stringify(odd));
  assert.equal(residentOf({ handle: "quillon", berth: "elsewhere" }, "quillon").receiver, false, "another berth's mark is not this berth's receiver");
  // the words only when the office will admit another name than the one asked
  assert.equal(residentWords("quillon", "quillon"), null);
  assert.equal(residentWords("", "quillon"), null);
  assert.match(residentWords("quillon-fixture", "quillon"), /admitted as quillon, not quillon-fixture\. That's the name the co-sign declares\./);
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

// LAW (Wright, CORE-188, 2026-11-26): "keep the accepted 2–40 characters … co-sign declares the chosen handle, not pending.slug". On the receiver
// (Office #1237) the handle's length is the office's, and the berth boards under a name of its own; the grammar, the prefixes and the town's
// names still hold.
test("on the receiver the handle is 2–40 and the berth takes a short name of its own; the- and berth- are still refused in words", () => {
  const apart = (h) => berthSlugProblem(h, { berthLength: false });
  const forty = "a".repeat(18) + "-of-the-" + "b".repeat(14);
  assert.equal([...forty].length, 40);
  for (const ok of ["quillon", "a".repeat(32), forty]) assert.equal(apart(ok), null, ok);
  // and the control: the same 32-character handle IS refused where the berth's name becomes the handle
  assert.match(berthSlugProblem("a".repeat(32)) ?? "", /at most 31 characters/);
  assert.match(apart("the-heron") ?? "", /can't start with the- or berth-: those are the town's own prefixes/);
  assert.match(apart("berth-heron") ?? "", /can't start with the- or berth-/);
  assert.match(apart("a--b") ?? "", /single hyphens/);
  assert.match(apart("postmaster") ?? "", /town's own names/);
  // the berth's own name: the handle itself when it fits, else its first 31 characters, never ending in a hyphen
  assert.equal(berthSlugFor("quillon"), "quillon");
  assert.equal(berthSlugFor("a".repeat(31)), "a".repeat(31));
  assert.equal(berthSlugFor("a".repeat(40)), "a".repeat(31));
  const cut = "a".repeat(30) + "-bcdefghi";
  assert.equal(berthSlugFor(cut), "a".repeat(30), "a cut landing on a hyphen drops it");
  for (const h of ["a".repeat(40), forty, cut]) assert.match(berthSlugFor(h), BERTH_SLUG, `the berth's name for ${h} passes the office's berth rule`);
  assert.match(chosenHandleWords(40), /2–40 lowercase letters, digits and single hyphens, not starting with the- or berth-/);
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
  // on the receiver, the berth key's /me names the CHOSEN resident (householdFor resolves the human's pins, not the berth's slug): admission is
  // checked against the resident the office answered, so a /me naming only the berth's slug is not that resident's admission
  const who = residentOf({ handle: "quillon-of-hollow-oak", berth: "quillon" }, "quillon");
  assert.equal(admittedBy({ handles: ["quillon-of-hollow-oak"] }, who.resident), true);
  assert.equal(admittedBy({ handles: ["quillon"] }, who.resident), false);
});

test("the page binds the co-sign to the office's resident: shown, checked for admission, and the finishing writes' target", () => {
  const page = readFileSync(new URL("../town/pages/join/move-in.astro", import.meta.url), "utf8");
  const script = page.slice(page.indexOf("<script>"), page.indexOf("</script>", page.indexOf("<script>")));
  assert.match(script, /const who = residentOf\(r\.body, slug\);\s*cosign = \{ slug, resident: who\.resident, asked: \(v\.handle \|\| ""\)\.trim\(\)/);
  assert.match(script, /put\("\[data-cosign-handle\]", cosign\.resident\)/);
  assert.match(script, /residentWords\(cosign\.asked, cosign\.resident\)/);
  assert.match(script, /if \(!admittedBy\(me, cosign\.resident\)\)/);
  assert.match(script, /sentWrites = await finishAfter\(cosign\.resident, berthToken\(berth\), cosign\.writes\);/);
  assert.match(script, /paintIn\(\{\}, \{ \.\.\.cosign\.v, handle: cosign\.resident \}\)/, "You're in links the admitted resident's page");
  assert.doesNotMatch(script, /finishAfter\(cosign\.slug|admittedBy\(me, cosign\.slug/, "a finishing write or the admission still keyed to the berth's slug");
  // the berth boards under its own name: the handle where the office declares none (the 31 rule), its short name where it keeps them apart
  assert.match(script, /boardRequest\(officeBase\(\), slug\)/);
  assert.match(script, /const slug = berthNameFor\(v\.handle\);/);
  // a refused board says whether the berth's name was the cut one (Truey F1)
  assert.match(script, /boardRefusal\(r\.status, r\.data, \{ cut: slug !== \(v\.handle \|\| ""\)\.trim\(\) \}\)/);
  assert.match(script, /plan\?\.pieces\.handle\?\.chosenApart \? berthSlugFor\(handle\)/);
  assert.equal(BERTH_SLUG_MAX, 31);
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
