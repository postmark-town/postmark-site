// world-cockpit-reply.test.mjs — the cockpit's SAY form takes a RESOLVED reply target (CORE-82, CORE-70 call 3).
//
// LAW (CORE-70 call 3, as the CORE-82 brief quotes it): "A say may name `reply_to`"; the speaking forms "take a reply target, show 'replying
// to…' with a clear button, and show the office's 'linked by name' note. The browser never works out that link itself." And the producer
// contract (/var/tmp/POS-1035-envelopes.md): `reply_to` is a say's act number (or { handle, at }); the receipt gains
// `said: { id, reply_to?, to?, linked?, note? (name links only), id_note? }`; the flat say line gains `id`; a refusal is a 422 `defect`.
//
// The behaviour lives in two places. The RULES are pure functions in src/lib/world-cockpit.mjs and are run here for real. The WIRING lives
// inside the mountCockpit closure, which cannot be reached without booting a full DOM, so it is pinned as source (the repo's standing
// discipline for closure code; see world-cockpit-rail.test.mjs), each pin failing against the pre-change file. Every identity is invented.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPLY_FIELD, chatShaped, dispatchEnvelope, formFieldsOf, readBounce, recentVoices, replyTargetOf, replyWords, saidNotes, speechHref,
  takesReply, withReplyTarget,
} from "../src/lib/world-cockpit.mjs";
import { mergeFeed, voiceEntries } from "../src/lib/world-feed.mjs";

const mount = readFileSync(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url), "utf8");

// the door's say card, as the cockpit models it: a prose field, and the OPTIONAL reply_to
const SAY = { action: "say", fields: [
  { name: "text", required: true, type: "string", description: "what you say, at most 500 characters" },
  { name: "reply_to", required: false, type: "string", description: "the say you answer: its act number, or { handle, at }" },
] };
const WALK = { action: "walk", fields: [{ name: "to_x", required: true, type: "number" }, { name: "to_y", required: true, type: "number" }] };

test("the act whose CARD declares reply_to takes a target; no act is named, and an act without the field never does", () => {
  assert.equal(takesReply(SAY), true);
  assert.equal(takesReply(WALK), false);
  assert.equal(takesReply(null), false);
  assert.equal(REPLY_FIELD, "reply_to");
  // with an optional reply_to the say is still CHAT-SHAPED (one prose field, the rest optional), so it keeps its chat line
  assert.equal(chatShaped(SAY), true);
});

test("the raw reply_to is never offered as a field to type into; every other field is", () => {
  assert.deepEqual(formFieldsOf(SAY).map((f) => f.name), ["text"]);
  assert.deepEqual(formFieldsOf(WALK).map((f) => f.name), ["to_x", "to_y"], "an act with no reply_to is untouched");
  assert.deepEqual(formFieldsOf(null), []);
  assert.match(mount, /formFieldsOf\(c\)\.filter\(\(f\) => f\.required && !answered\.includes\(f\.name\) && filled\[f\.name\] == null\)/, "the flow-shaped form draws through it");
  assert.match(mount, /: formFieldsOf\(c\);/, "and the ordinary form too");
  assert.doesNotMatch(mount, /asked = flowShaped\s*\n\s*\? c\.fields\./, "the old unfiltered list is gone");
});

test("a reply target is the whole number the OFFICE served, and nothing the browser has to interpret", () => {
  assert.deepEqual(replyTargetOf({ id: 50105, handle: "claran", said: "Who painted the sign?" }), { id: 50105, handle: "claran", said: "Who painted the sign?", circle: null });
  assert.equal(replyTargetOf({ id: "50105", handle: "x", said: "y", circle: "50101" }).id, 50105, "digits are taken");
  assert.equal(replyTargetOf({ id: "50105", circle: "50101" }).circle, 50101);
  for (const bad of [null, undefined, {}, { id: 0 }, { id: -4 }, { id: 1.5 }, { id: "12x" }, { id: "claran" }, { id: { handle: "claran", at: 1 } }, { id: "9999999999999999999" }, { id: true }])
    assert.equal(replyTargetOf(bad), null, `${JSON.stringify(bad)} is not an id the office served`);
});

test("'replying to <handle>: <words>' cuts at 80 characters, and hostile words are returned as the plain string they are", () => {
  assert.equal(replyWords(replyTargetOf({ id: 7, handle: "pica", said: "Welcome, everyone!" })), "replying to pica: Welcome, everyone!");
  assert.equal(replyWords(replyTargetOf({ id: 7, handle: "pica", said: "x".repeat(200) })), `replying to pica: ${"x".repeat(80)}…`);
  assert.equal(replyWords(replyTargetOf({ id: 7, handle: "", said: "" })), "replying to a say");
  const evil = `<img src=x onerror=alert(1)>&"`;
  assert.equal(replyWords(replyTargetOf({ id: 7, handle: "<b>pica</b>", said: evil })), `replying to <b>pica</b>: ${evil}`, "the string is the string: the mount puts it through esc");
  assert.match(mount, /<span class="pmc-reply-words">\$\{esc\(replyWords\(state\.replyTo\)\)\}<\/span>/, "and it only ever reaches the page through esc()");
});

test("reply_to rides in the act args ONLY when a target is chosen and the card declares the field, and never over one the args already name", () => {
  const target = replyTargetOf({ id: 50105, handle: "claran", said: "hi" });
  assert.deepEqual(withReplyTarget({ text: "Iris did, I think." }, SAY, target), { text: "Iris did, I think.", reply_to: 50105 });
  assert.deepEqual(withReplyTarget({ text: "hello" }, SAY, null), { text: "hello" }, "no target, no reply_to: the key is absent, not null");
  assert.equal("reply_to" in withReplyTarget({ text: "hello" }, SAY, null), false);
  assert.deepEqual(withReplyTarget({ to_x: 1, to_y: 2 }, WALK, target), { to_x: 1, to_y: 2 }, "an act whose card has no reply_to never carries one");
  assert.deepEqual(withReplyTarget({ text: "x", reply_to: 9 }, SAY, target), { text: "x", reply_to: 9 }, "an explicit one is not overwritten");
  // and it is additive on the wire: the same envelope as before, one key more
  assert.deepEqual(dispatchEnvelope({ action: "say", args: withReplyTarget({ text: "hi" }, SAY, target), acting: "amia", handle: "amia" }),
    { do: "say", args: { text: "hi", reply_to: 50105 }, handle: "amia" });
  assert.match(mount, /const whole = withReplyTarget\(\{ \.\.\.\(aimed \?\? \{\}\), \.\.\.args \}, slotFor\(action\)\?\.card, state\.replyTo\);/, "the one send path attaches it");
});

test("the receipt's own words about the link are shown exactly as the office served them, from either place the receipt can sit", () => {
  const note = "Your reply was linked to claran's latest say here, because you named them.";
  assert.deepEqual(saidNotes({ said: { id: 50111, reply_to: 50110, linked: "name", note } }), [note]);
  assert.deepEqual(saidNotes({ result: { said: { id: 50111, linked: "name", note, id_note: "this office is not keeping say ids" } } }), [note, "this office is not keeping say ids"]);
  assert.deepEqual(saidNotes({ said: { id: 5, reply_to: 4, linked: "id" } }), [], "an id link has no note: nothing is composed here");
  assert.deepEqual(saidNotes({ said: { note: "   " } }), []);
  assert.deepEqual(saidNotes({}), []);
  assert.deepEqual(saidNotes(null), []);
  assert.match(mount, /const notes = saidNotes\(res\.body\);/);
  assert.match(mount, /state\.said = \{ ok: true, text: chat \? "sent\." : "done — the door took it\.", notes \};/);
  assert.match(mount, /<span class="hint" data-said-note>\$\{esc\(n\)\}<\/span>/, "under the receipt line, escaped");
  assert.match(mount, /\$\{notes\.map\(\(n\) => esc\(n\)\)\.join\(" "\)\}/, "and on its own plate once the chat line has closed, escaped");
});

test("a refusal is shown as the office worded it, and the target survives it", () => {
  const defect = "say 50999 is not in the room you are speaking into";
  const b = readBounce({ error: "bounce", code: 422, defect, hint: "reply to a say in your own room" }, 422);
  assert.equal(b.defect, defect, "verbatim");
  assert.equal(b.hint, "reply to a say in your own room");
  // the target is cleared ONLY on the ok branch: a refused say keeps it, so the reader retries without choosing again
  const ok = mount.slice(mount.indexOf("if (res.ok && !defect) {"), mount.indexOf("} else {\n        const b = readBounce"));
  assert.match(ok, /if \(REPLY_FIELD in args\) state\.replyTo = null;/);
  const refused = mount.slice(mount.indexOf("} else {\n        const b = readBounce"), mount.indexOf("state.said = { ok: false, text: \"the door could not be reached\""));
  assert.doesNotMatch(refused, /replyTo = null/, "a refusal does not drop the target");
});

test("the wiring: pm:reply-target and Reply set the target, Clear removes it, the chat line shows it, and teardown lets go", () => {
  assert.match(mount, /doc\.defaultView\?\.addEventListener\?\.\("pm:reply-target", onReplyTargetEvent\);/);
  assert.match(mount, /function onReplyTargetEvent\(ev\) \{ setReplyTarget\(ev\?\.detail\); \}/);
  assert.match(mount, /doc\.defaultView\?\.removeEventListener\?\.\("pm:reply-target", onReplyTargetEvent\);/, "teardown removes the listener");
  assert.match(mount, /const target = replyTargetOf\(raw\);\s*\n\s*if \(!target \|\| dead\) return false;/, "only a validated id becomes a target");
  assert.match(mount, /find\(\(s\) => takesReply\(s\.card\) && s\.afforded !== false\)/, "and only on the act whose card declares the field");
  assert.match(mount, /const clearBtn = ev\.target\.closest\?\.\("\[data-reply-clear\]"\);[\s\S]*?state\.replyTo = null;/, "Clear drops it");
  assert.match(mount, /const reply = state\.replyTo && takesReply\(slot\?\.card\)/, "the chat line shows it");
  assert.match(mount, /data-reply-clear aria-label="stop replying to this say">Clear<\/button>/);
  // Reply on a feed line hands the OFFICE's id for that line over; it reads nothing out of the words
  assert.match(mount, /if \(e\?\.say\) setReplyTarget\(\{ id: e\.say\.id, handle: e\.who \?\? "", said: e\.text \}\);/);
});

test("the feed: a spoken line the office numbered links to its CIRCLE and can be replied to; one without an id keeps the room's anchor; neither derives a circle", () => {
  const body = { live: [
    { id: "t1794686460-pica", voices: [
      { handle: "claran", said: "Who painted the sign outside?", at_ms: 1_000_000, x: 1, y: 2, id: 50105, reply_to: 50101, circle: 50101 },
      { handle: "amia", said: "an old unthreaded line", at_ms: 1_000_500, x: 1, y: 2 },
    ] },
    { voices: [{ handle: "rei", said: "a thread with no id", at_ms: 1_000_900, x: 3, y: 4, id: 7 }] },
  ] };
  const voices = recentVoices(body, { now: 1_001_000 });
  const by = (h) => voices.find((v) => v.handle === h);
  assert.equal(by("claran").id, 50105); assert.equal(by("claran").room, "t1794686460-pica");
  assert.equal("id" in by("amia"), false, "old talk carries no id");
  assert.equal(by("amia").room, "t1794686460-pica");
  assert.equal("room" in by("rei"), false);
  const entries = mergeFeed([], voiceEntries(voices, { now: 1_001_000 }));
  const e = (who) => entries.find((x) => x.who === who);
  assert.deepEqual(e("claran").say, { id: 50105 });
  assert.equal(speechHref(e("claran")), "/conversations/#circle-50105", "with the say's id: its circle");
  assert.equal(speechHref(e("amia")), "/conversations/#t1794686460-pica", "without: the room's anchor, as today");
  assert.equal(speechHref(e("rei")), "/conversations/#circle-7", "an id wins even with no room");
  assert.equal(speechHref({ kind: "say", who: "x", text: "y" }), null, "neither: no link at all");
  assert.equal("say" in e("amia"), false);
  // nothing is worked out: a say id is never taken from the reply_to or the circle the line also carries
  assert.notEqual(e("claran").say.id, 50101);
  // the line wears a link and a Reply only through these two
  assert.match(mount, /const href = speechHref\(e\);/);
  assert.match(mount, /data-feed-reply="\$\{esc\(e\.id\)\}" aria-label="reply to this say">reply<\/button>/);
});

test("the old feed is exactly what it was: the same entry for a voice with no office id, and every existing id is unchanged", () => {
  const voices = recentVoices({ live: [{ voices: [{ handle: "amia", said: "hi", at_ms: 5_000, x: 0, y: 0 }] }] }, { now: 6_000 });
  assert.deepEqual(Object.keys(voices[0]).sort(), ["ageMs", "at", "freshness", "handle", "said"]);
  const [entry] = voiceEntries(voices, { now: 6_000 });
  assert.deepEqual(Object.keys(entry).sort(), ["at", "id", "kind", "seq", "text", "tone", "who"]);
  assert.equal(entry.id, "s:amia:5000:hi");
});
