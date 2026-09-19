// world-cockpit-rail.test.mjs — the side rail's three rulings (2026-08-29).
//
// THE LAWS THESE PIN, in the founder's own words:
//
//   ① "the action log can just replace the Lately section in the side rail
//      instead of needing a whole separate panel … tweak the 'lately' section so
//      it's a newest-at-the-bottom chat-like feed, that you can scroll UP to see
//      older things (and we should use this same thing for the log in combat)"
//   ② "there needs to be profiles of tokens loaded into the act as bar"
//   ③ "the act as bar should auto-select the token whose turn it is (if
//      possible) when it becomes their turn"
//
// The feed's GRAMMAR is falsified behaviourally in world-feed.test.mjs — that is
// where the sentences live and it is a pure module. What is left here is the
// wiring, which lives inside the mountCockpit closure and cannot be reached
// without booting a full DOM: source pins, the repo's standing discipline for
// closure code (see world-cockpit-dock.test.mjs, the exemplar). Every regex here
// fails against the pre-ruling files — the strings it demands did not exist —
// which is the flip.
//
// The two halves that ARE reachable — how a face resolves its picture, and how a
// resident's avatar becomes a URL — are tested for real at the bottom.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUMAN_ACTOR, faceImageFor, residentAvatar, TOWN_RAW } from "../src/lib/world-cockpit.mjs";

const mount = readFileSync(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url), "utf8");
const island = readFileSync(new URL("../src/components/WorldCockpit.astro", import.meta.url), "utf8");

// ── ① LATELY IS THE FEED ────────────────────────────────────────────────────

test("the rail's section is reshaped by CSS, and the viewer's own list is never written", () => {
  // ⚑ THE RAIL BELONGS TO THE VIEWER. renderActivity writes .wv-acts's
  // innerHTML and sets the section's hidden attribute on every re-fold, so the
  // ONLY safe way to reshape Lately from this repo is to leave both alone: the
  // section becomes the scrollport, the list is flipped in CSS, and the cockpit
  // appends one element of its own. If this file ever starts writing the
  // viewer's list, that is the regression these two assertions exist to catch.
  assert.match(mount, /html\[data-pmc-feed\] \.wv \.wv-activity \{/,
    "the section is made the scrollport under the cockpit's own attribute");
  assert.match(mount, /html\[data-pmc-feed\] \.wv \.wv-acts \{ flex-direction: column-reverse; \}/,
    "the viewer's newest-first list is flipped to read oldest-at-top — in CSS, not in its DOM");
  assert.doesNotMatch(mount, /\.wv-acts["'`]\s*\)[^)]*\.innerHTML\s*=/,
    "nothing here writes the viewer's activity list");
  assert.doesNotMatch(mount, /wv-activity["'`]\s*\)[^;]*\.hidden\s*=/,
    "nor its hidden attribute — the section is revealed by a CSS override, so the viewer keeps owning it");
});

test("the section is forced visible past the viewer's own hidden attribute", () => {
  // renderActivity hides the section when the record is empty. Inside a portal
  // the fight is the record, and a feed nobody can see is not a feed.
  assert.match(mount, /html\[data-pmc-feed\] \.wv \.wv-activity \{\s*\n?\s*display: flex !important;/,
    "display is forced, so an empty Lately still shows the fight");
});

test("the reshape is one attribute, and destroy takes it back off", () => {
  assert.match(mount, /doc\.documentElement\.setAttribute\("data-pmc-feed", "1"\)/);
  assert.match(mount, /doc\.documentElement\.removeAttribute\("data-pmc-feed"\)/);
  assert.match(mount, /new w\.CustomEvent\("pm:cockpit-feed", \{ detail: \{ present \} \}\)/,
    "and the same two-signal handshake the dock uses, for a viewer that booted either side of us");
  assert.match(mount, /feedSignal\(false\); \/\/ and Lately back to being Lately/,
    "teardown hands the rail back");
  assert.match(mount, /feedList\?\.remove\(\);\s*\n\s*feedNew\?\.remove\(\);/,
    "and takes the cockpit's own elements out of it");
});

test("the feed's host is resolved at USE time, never held from mount", () => {
  // The living-references law, the same one that governs the svg: an element
  // found at mount is not the element that is there now, and a list appended to
  // a rebuilt rail would answer every measurement with zeros while looking
  // perfectly correct in the source.
  assert.match(mount, /const feedSection = \(\) => doc\.querySelector\("\.wv \.wv-activity"\);/,
    "the section is looked up on every call");
  assert.match(mount, /if \(feedList\?\.isConnected && feedList\.parentElement === host\) return feedList;/,
    "and the list is re-homed whenever it is no longer inside the living section");
});

// ── the pin follows the CONTENT, not our own writes (2026-08-29, live) ──
//
// THE FOUNDER, on dev after a hard reload: "lately isn't scrolled down
// correctly". A pin that ran once at draw time was pinning to a page that had
// not finished arriving: the viewer fills Lately from three separate async
// loads (loadWalkLedger / loadSettlements / loadStakeEvents, each .then(
// renderActivity)), and every one of those rewrites grows the content ABOVE the
// feed while the section keeps its scrollTop. The harness could not have caught
// it — its rows were static — which is why it now loads them in waves too.
test("the pin is a watch: the viewer's own late rewrites re-pin the feed", () => {
  assert.match(mount, /feedMutations = new MutationObserver\(\(records\) => \{/,
    "a mutation observer, because the viewer rewrites .wv-acts long after we drew");
  assert.match(mount, /childList: true, subtree: true, characterData: true,\s*\n\s*attributes: true, attributeFilter: \["hidden"\],/,
    "watching the rewrites AND the hidden attribute renderActivity re-sets");
  assert.match(mount, /feedSize = new ResizeObserver\(pinFeed\);/,
    "and a resize observer for reflow that changes no nodes at all");
  assert.match(mount, /if \(feedSize\) \{ feedSize\.disconnect\(\); for \(const child of host\.children\) feedSize\.observe\(child\); \}\s*\n\s*pinFeed\(\);/,
    "a rewrite replaces the children being measured, so the size watch is re-pointed before the pin");
});

test("following is the reader's intent, never re-derived from the geometry", () => {
  // ⚑ THE TRAP THIS AVOIDS. Once content has grown above us we are no longer at
  // the bottom BY MEASUREMENT — so a pin that re-asked atBottom before every
  // pin would read the growth as "the reader scrolled up" and stop following
  // for good. The flag moves only when a scroll event says the reader moved.
  assert.match(mount, /const onFeedScroll = \(\) => \{[\s\S]*?followBottom = atBottom\(box\);/,
    "the scroll event is the only thing that sets it");
  const pin = mount.slice(mount.indexOf("function pinFeed"), mount.indexOf("function watchFeedHost"));
  assert.doesNotMatch(pin, /followBottom = /, "the pin reads the intent and never rewrites it");
  assert.match(pin, /if \(!followBottom\) \{/, "scrolled up, it holds and shows the pill instead");
});

test("the pin lands on the next frame, not in the tick that wrote", () => {
  // scrollHeight still answers for the old content in the tick of the write.
  assert.match(mount, /if \(typeof raf === "function"\) raf\(run\); else run\(\);/);
  assert.match(mount, /if \(pinQueued\) return;\s*\n\s*pinQueued = true;/,
    "and three waves landing together cost one pin");
});

test("the watch does not react to its own writes", () => {
  // ⚑ THE BUG THIS EXISTS FOR, found by the shot runner HANGING rather than
  // failing: pinFeed hides the new-below pill; the pill lives inside the
  // watched section; its `hidden` is an attribute this observer filters on. So
  // every pin caused a mutation that caused a pin — a tight infinite loop with
  // no stack to show for it, and a browser that simply stopped answering.
  assert.match(mount, /if \(!records\.some\(\(r\) => !ourNode\(r\.target\)\)\) return;/,
    "a batch of nothing but our own nodes is not news");
  assert.match(mount, /const ourNode = \(n\) => Boolean\(n && \(n === feedList \|\| n === feedNew/,
    "and ours is both the feed's list and its pill");
  // belt to that brace: the pill is written only when it actually changes, so
  // even a watch that did react would settle after one round
  assert.match(mount, /const showPill = \(on\) => \{ if \(feedNew && feedNew\.hidden === on\) feedNew\.hidden = !on; \};/);
  const pin = mount.slice(mount.indexOf("function pinFeed"), mount.indexOf("function watchFeedHost"));
  assert.doesNotMatch(pin, /feedNew\.hidden =/, "the pin toggles the pill only through showPill");
});

test("the host watch is re-pointed when the viewer rebuilds its rail", () => {
  assert.match(mount, /function watchFeedHost\(host\) \{\s*\n\s*if \(feedWatched === host\) return;/,
    "same living-reference law the camera watch keeps");
  assert.match(mount, /watchFeedHost\(host\);/, "and ensureFeed points it at whichever section is live now");
});

test("your own beat goes in from the act answer, and the poll never tells it twice", () => {
  assert.match(mount, /ingest\(beatsFromAct\(res\.body, \{ acting: seat\(\), adversary: adversaryOf\(state\.answer\)\?\.id \?\? null \}\)\);/,
    "the act answer's own beat, then and joined are read straight into the feed, naming what was swung at");
  assert.match(mount, /state\.encSnap = fresh\.encounter_detail \?\? state\.encSnap;/,
    "and the delta baseline moves with the refreshed answer, so the same swing is not derived again");
});

// ── the tail, when the door grows one (2026-08-29 addendum) ──
//
// bday-law is adding `encounter_detail.beats_tail`. Where it is present the feed
// renders whole attributed lines and the delta stands down; where it is absent
// nothing changes, because dev may deploy the site and the office in either
// order and a page that went silent on the wrong order would be worse than one
// that reads thin for an afternoon.
test("a tail takes the road, and the delta stands down behind it", () => {
  assert.match(mount, /const tail = beatsFromTail\(next, \{ since: state\.beatSeq, adversary \}\);\s*\n\s*if \(tail\) \{/,
    "the tail is asked for first");
  assert.match(mount, /ingest\(tail\.entries\);\s*\n\s*return;\s*\n\s*\}/,
    "and it returns — the delta below is not also walked");
  assert.match(mount, /if \(!prev \|\| !next\) return;\s*\n\s*const \{ entries, unseen \} = beatsFromDelta\(prev, next\);/,
    "the delta is still there, reached only when no tail was sent");
});

test("only a tail advances the watermark", () => {
  // ⚑ THE CORRECTNESS RULE. Your act answer arrives with seqs above anything a
  // tail has shown; letting them advance the watermark would step over somebody
  // else's beat still sitting lower in the window — skipped permanently, with
  // nothing to say so. The seq-derived id is what stops the double print.
  const absorb = mount.slice(mount.indexOf("function absorbEncounter"), mount.indexOf("function autoSelectOnTurn"));
  assert.match(absorb, /state\.beatSeq = Math\.max\(state\.beatSeq, tail\.watermark\);/);
  const submit = mount.slice(mount.indexOf("async function onSubmit"), mount.indexOf("function onKey"));
  assert.doesNotMatch(submit, /state\.beatSeq/, "the act answer draws its lines and leaves the watermark alone");
});

test("a first tail is seeded, not narrated — and an empty one is not the same as none", () => {
  assert.match(mount, /if \(state\.beatSeq == null\) \{ state\.beatSeq = seedBeatSeq\(next\); return; \}/,
    "the first tail ever seen sets the watermark and says nothing");
  assert.match(mount, /Array\.isArray\(detail\?\.beats_tail\) \? \(tailWatermark\(detail\) \?\? -1\) : null/,
    "a present-but-empty tail seeds to -1; only an ABSENT tail leaves the watermark unseeded");
  assert.match(mount, /state\.beatSeq = seedBeatSeq\(state\.encSnap\);/,
    "and the mount seeds by the same rule it polls by");
});

test("the encounter is polled on its own clock, only inside portal ground", () => {
  assert.match(mount, /if \(!o\.refresh \|\| !portalOf\(state\.answer\)\) return;/,
    "no fight, no poll — a town map does not want a two-second read");
  assert.match(mount, /setInterval\?\.\(pullEncounter, 2500\)/,
    "every 2.5s, inside the founder's 2-3s window and faster than the voices' 7s");
  assert.match(mount, /const moved = answerSig\(fresh\) !== answerSig\(state\.answer\);/,
    "and it repaints only when something a paint could show actually moved");
  assert.match(mount, /absorbEncounter\(fresh\);\s*\n\s*state\.answer = fresh;/,
    "the delta is derived against the OLD snapshot before the new answer is adopted");
});

test("one clock reading per voices poll, or every said line is told twice", () => {
  // ⚑ THE BUG THIS PINS, found in the rendered feed rather than in any unit:
  // `recentVoices` turns a timestamp into an AGE against the now it is handed,
  // `voiceEntries` turns that age back into an instant against the now IT is
  // handed, and that instant is the line's id. Two separate Date.now() calls are
  // two different nows, so the round trip lands a millisecond or two past where
  // it started — a fresh id every poll for a line already on screen. It hid
  // while both calls fell inside the same millisecond and surfaced the moment
  // there was more work between them.
  //
  // The pure half is falsified in world-feed.test.mjs; this is the half that
  // lives in the closure, and it is the half that was actually wrong.
  const poll = mount.slice(mount.indexOf("async function pullVoices"), mount.indexOf("// ── the fight, on its own clock"));
  assert.match(poll, /const now = Date\.now\(\);\s*\n\s*const next = recentVoices\(body, \{ now \}\);/,
    "the clock is read once, into a name");
  assert.match(poll, /ingest\(voiceEntries\(next, \{ now \}\)\);/,
    "and the SAME reading is handed to the entries, so the round trip is exact");
  // One READING, counted as assignments — the prose above it names Date.now()
  // to explain the bug, and a blunt count over the slice would be counting the
  // comment that documents the fix.
  assert.equal((poll.match(/=\s*Date\.now\(\)/g) ?? []).length, 1,
    "the clock is read exactly once in the poll");
  assert.doesNotMatch(poll, /recentVoices\(body, \{ now: Date\.now\(\) \}\)/,
    "and never read inline at a call site, which is how the two drifted apart");
});

test("a say reaches the feed even on the tick the map's bubbles are left alone", () => {
  // The voices poll returns early when nothing moved far enough to be worth
  // rebuilding the bubble layer for. The feed dedupes by id, so that guard
  // applied to it could only ever throw lines away.
  assert.match(mount, /ingest\(voiceEntries\(next, \{ now \}\)\);\s*\n\s*if \(sig\(next\) === sig\(state\.voices\)\) return;/,
    "the feed is fed before the bubbles' early return");
});

// ── ② EVERY FACE IS A PICTURE ───────────────────────────────────────────────

test("the dock and the wheel resolve a face through one call", () => {
  assert.match(mount, /const token = faceImageFor\(f, state\.profiles\);/,
    "the dock's faces");
  assert.match(mount, /return row \? faceImageFor\(row, state\.profiles\) : null;/,
    "and the wheel's pips, off the same roster and the same profile bubbles");
  assert.doesNotMatch(mount, /const token = f\.kind === "human" \? tokenFor\(f\) : null;/,
    "the human-only resolution is gone");
});

test("a picture that will not load uncovers the letter it was drawn over", () => {
  assert.match(mount, /<span class="pmc-mono">\$\{mono\}<\/span><img src=/,
    "the letter is always drawn, underneath");
  assert.match(mount, /if \(img\?\.tagName === "IMG" && img\.closest\?\.\("\.pmc-face, \.pmc-turn"\)\) img\.remove\(\);/,
    "and a failed image is removed rather than left as a torn glyph");
  assert.match(mount, /root\.addEventListener\("error", onImgError, true\);/,
    "delegated in the capture phase, because error does not bubble and a repaint re-mints every face");
});

test("the profile read is the island's errand, asked once per handle", () => {
  // The mount's own contract, stated in its header: "DOM only. Nothing here
  // fetches." A fetch in this file would be the first one.
  assert.match(mount, /if \(!o\.readResident\) return;/);
  assert.match(mount, /if \(f\.kind !== "resident" \|\| !f\.handle \|\| profilesAsked\.has\(f\.handle\)\) continue;/,
    "one read per handle for the life of the mount");
  assert.match(island, /const r = await fetch\(OFFICE \+ "\/residents\/" \+ handle, \{ headers: \{ accept: "application\/json" \} \}\);/,
    "and it is GET /residents/{handle} — a door that already exists, read keylessly because a resident's card is public");
  assert.match(island, /dispatch, readTerms, refresh: door, readVoices, readResident,/,
    "handed to the mount beside the other reads");
});

// ── the pinned bubble keeps its own clicks (2026-08-29) ──
//
// A pinned bubble is `pointer-events:auto` at z-index 7 inside the map; the
// cockpit's overlay is fixed at 7000. So the dock did not merely sit over one,
// it ATE ITS CLICKS — the reader pressed the close button on a panel they had
// deliberately opened and nothing happened. Measured before the fix: bubble
// 826..886, dock 788..834, elementFromPoint in the overlap answering
// `pmc-plate pmc-roster pmc-dock`.
test("the row fences against a pinned bubble, the way it fences against the rest", () => {
  assert.match(mount, /"\.wv \.wv-scene-exit", "\.wv \.wv-bubble\.is-pinned"\]\) \{\s*\n\s*const el = doc\.querySelector\(sel\);\s*\n\s*if \(!el \|\| !el\.getClientRects\(\)\.length\) continue;/,
    "placeBar's own list, so the bubble gets step-aside-before-climbing for free");
  // and NOT a cure of its own: no standing the viewer's bubbles down, no
  // z-index game that would bury the dock under a 32rem sheet instead
  assert.doesNotMatch(mount, /data-pmc-bubble|wv-bubble[^.]*\.hidden\s*=|is-pinned["'`]\s*\)\s*\??\.\s*remove/,
    "nothing here writes or suppresses the viewer's bubbles");
});

test("the bubble is watched through its HOST, because it does not exist at mount", () => {
  // ⚑ EVERY OTHER PIECE OF BOTTOM FURNITURE IS IN THE VIEWER'S MARKUP; this one
  // is not. `bubbleEl` creates it lazily on the first pin, so a querySelector at
  // mount finds nothing and would silently observe nothing — the row would fence
  // against a bubble only on paints that happened to run for some other reason.
  assert.match(mount, /const bubbleHost = \(\) => doc\.querySelector\("\.wv \.wv-bubbles"\);/);
  assert.match(mount, /bubbles = new MutationObserver\(replace\);/,
    "the host is watched for the element arriving");
  assert.match(mount, /childList: true, subtree: true,\s*\n\s*attributes: true, attributeFilter: \["hidden", "style", "class"\],/,
    "…for its hidden flag turning, and for the transform that moves it");
  assert.match(mount, /bubbles\?\.disconnect\(\);/, "and it is let go on teardown");
});

// ── ③ AUTO-SELECT ON THE TURN ───────────────────────────────────────────────

test("the dock takes the seat when the turn CHANGES to a handle this key holds", () => {
  assert.match(mount, /if \(turn === state\.lastTurn\) return;/,
    "on the change, and only on the change");
  assert.match(mount, /if \(!handles\.includes\(turn\) \|\| state\.acting === turn\) return;/,
    "and only for a resident this key actually holds");
  assert.match(mount, /state\.acting = turn;\s*\n\s*state\.seat = turn;\s*\n\s*state\.said = null;\s*\n\s*speakActAs\(\);/,
    "it speaks pm:act-as through the same path a face click does");
});

test("it never writes the viewer's selection directly", () => {
  // speakActAs is the one road: it mints the viewer's own data-act-as control
  // and dispatches the event. An auto-select that set the viewer's key or
  // called into it another way would be a second grammar.
  const auto = mount.slice(mount.indexOf("function autoSelectOnTurn"), mount.indexOf("// ── the dock's pictures"));
  assert.doesNotMatch(auto, /localStorage/, "auto-select touches no viewer storage");
  assert.doesNotMatch(auto, /data-act-as/, "and mints no control of its own — speakActAs owns that");
  assert.match(auto, /speakActAs\(\);/);
});

test("a manual click after an auto-select wins until the next turn change", () => {
  // ⚑ AND THERE IS NO FLAG FOR IT. The turn-change guard IS the protection: a
  // reader who picks another face keeps it, because nothing re-fires until the
  // wheel moves. A separate manual flag beside that guard would be a second
  // answer to one question, and the two would drift.
  assert.doesNotMatch(mount, /state\.manual/, "no second bookkeeping for a rule the guard already keeps");
  assert.match(mount, /autoSelectOnTurn\(\);\s*\n\s*if \(moved\) paint\(\);/,
    "the poll asks it on every read, and the guard decides whether anything happens");
});

test("the mount's first read seeds the baseline without narrating it", () => {
  // A reader arriving mid-fight should not be handed the whole fight as things
  // that just happened.
  assert.match(mount, /state\.encSnap = o\.answer\?\.encounter_detail \?\? null;\s*\n\s*state\.beatSeq = seedBeatSeq\(state\.encSnap\);\s*\n\s*autoSelectOnTurn\(\);/,
    "both baselines taken, nothing said — and the turn is read for the first time right after them");
});

// ── the two halves that can be run, run ─────────────────────────────────────

test("a resident's avatar basename becomes the town repo's own URL", () => {
  // GET /residents/{handle} answers `profile.avatar` as a BASENAME — the office
  // avatar door writes WHITE_PAGES/<handle>/avatar.<ext> and records the name.
  // The site's processed /media/ copy lives in a BUILD map this runtime island
  // cannot reach, so this uses the repo's own standing fallback for an
  // unclaimed image (src/lib/pm.mjs), which needs no build artifact to stay true.
  assert.equal(
    residentAvatar("rei", { avatar: "avatar.jpg" }).src,
    `${TOWN_RAW}/WHITE_PAGES/rei/avatar.jpg`);
  assert.equal(residentAvatar("rei", { avatar: "avatar.jpg" }).from, "the town repo");
});

test("a url at the town's own media door wins over anything derived", () => {
  // The contract-forward path: the day the roster or the profile carries a URL,
  // nothing here derives anything, which is the shape every other integration
  // on this surface has taken.
  //
  // MOVED ASSERTION, postmark#2950. This test used to hand in
  // `https://example.test/r.png` and assert it won — written before the ruling,
  // when "the door names it" meant any URL at all. It is a field a resident
  // writes into their own PROFILE.md, so that read this page's <img> off any
  // host the resident chose. The baker closed the same hole on the built pages;
  // the predicate is now shared (src/lib/media-door.mjs) and applied here too,
  // so the winning URL has to be the town's own door. The off-door case is the
  // test below.
  const given = residentAvatar("rei", {
    avatar: "avatar.jpg",
    avatar_url: "https://media.postmark.town/media/sozlin/7037bcfb.webp",
  });
  assert.equal(given.src, "https://media.postmark.town/media/sozlin/7037bcfb.webp");
  assert.equal(given.from, "the door");
});

test("the basename is checked as one — a field the site does not own lands in a URL", () => {
  assert.equal(residentAvatar("rei", { avatar: "../../etc/passwd" }), null);
  assert.equal(residentAvatar("rei", { avatar: "a/b.png" }), null);
  assert.equal(residentAvatar("rei/../x", { avatar: "avatar.png" }), null);
  assert.equal(residentAvatar("rei", { avatar: "" }), null);
  assert.equal(residentAvatar("rei", null), null);
});

test("one call answers every face in the dock, and an absent picture is an ordinary state", () => {
  const human = faceImageFor({ kind: "human", id: "keeminlee", label: "DARKO", allowed: true });
  assert.equal(human.src, "/birthday/darko-token.png", "the human keeps the token the stage serves");

  const withAvatar = faceImageFor({ kind: "resident", handle: "rei", label: "rei" },
    { rei: { avatar: "avatar.jpg" } });
  assert.equal(withAvatar.src, `${TOWN_RAW}/WHITE_PAGES/rei/avatar.jpg`);
  assert.equal(withAvatar.monogram, "R", "and carries the letter to be drawn under it");

  // a read that has not answered yet, and a resident who wrote no profile: the
  // tile every face wore until tonight, which is nobody's failure
  const pending = faceImageFor({ kind: "resident", handle: "wright", label: "wright" }, { rei: {} });
  assert.equal(pending.src, null);
  assert.equal(pending.monogram, "W");
  assert.equal(pending.from, "monogram");

  // a roster row that names its own picture is believed over any derivation
  const fromRow = faceImageFor({ kind: "resident", handle: "rei", label: "rei", token_url: "/x.png" },
    { rei: { avatar: "avatar.jpg" } });
  assert.equal(fromRow.src, "/x.png");
  assert.equal(fromRow.from, "the roster row");
});

test("the human's face is still the human's — HUMAN_ACTOR is untouched by any of this", () => {
  assert.equal(HUMAN_ACTOR, "human:self");
  assert.equal(faceImageFor(null), null);
});
