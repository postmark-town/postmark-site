// world-cockpit-dock.test.mjs — the Act-As dock's falsifiers (2026-08-28).
//
// THE LAW THESE PIN, in the founder's own words the night he caught it: the
// floating roster "just sits ON TOP of the existing rail" — two controls
// answering "who acts?", neither informing the other. The ruling: who-acts
// sits BESIDE what-they-do (the dock is the bar's leftmost cell), the viewer's
// old row stands down while the dock is mounted, and the dock's selection is
// the one the viewer follows.
//
// Source pins, the repo's standing discipline for closure code (the mount only
// lives inside mountCockpit; a full DOM boot would test the harness, not the
// seam). Every regex here fails against the pre-dock file — the strings it
// demands did not exist — which is the flip.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mount = readFileSync(new URL("../src/lib/world-cockpit-mount.mjs", import.meta.url), "utf8");
/** The world page's own source. The time-travel pill is the SITE's element and
 *  lives there, so the rule that stands it down is asserted where it is written. */
const worldPage = readFileSync(new URL("../town/pages/world.astro", import.meta.url), "utf8");
/** The stylesheet the mount injects, read as itself — so a rule can be asserted
 *  present or gone without a comment about it counting as either. */
const COCKPIT_CSS_BLOCK = mount.slice(
  mount.indexOf("export const COCKPIT_CSS"),
  mount.indexOf("let cssInstalled"),
);

test("the roster rides inside the bar's own row, not as a floating plate", () => {
  // drawBar composes the dock as the row's first cell…
  assert.match(mount, /class="pmc-barrow">\$\{drawRoster\(\)\}<div class="pmc-bar"/,
    "drawBar wraps roster + bar in one .pmc-barrow row");
  // …and paint mounts no second, standalone copy of either plate. The
  // composition is now TWO calls, not three: the roster rides inside drawBar
  // and the standpoint plate rides inside the roster (2026-08-28, below).
  // (CORE-82 adds one more plate, the office's note on a say it took: drawSaidNotes, which is not the roster)
  assert.match(mount, /root\.innerHTML = drawWheel\(\) \+ drawBar\(\) \+ drawSaidNotes\(\);/,
    "paint composes the roster only through drawBar");
  assert.doesNotMatch(mount, /drawWheel\(\) \+ drawRoster\(\) \+ drawBar\(\)/,
    "the old standalone composition is gone");
});

// ── the standpoint plate, ON HOVER, OVER THE DOCK (2026-08-28) ──
//
// THE LAW, the founder's own words at the live rehearsal: "let's make the card
// appear ON HOVER when you hover over the act as bottom bar."
//
// It reverses an always-on card at left 14px / top 14px. That card was the
// SECOND element caught printing on the site's own left rail, and its first fix
// was the bar's painting fence — which held inside parcels and failed in the
// open world, where the map svg is full-bleed so its rect's left edge IS the
// viewport's. Anchoring beats fencing: a plate hung off the dock is inside the
// painting because the dock is, and there is no clamp left to get wrong.
//
// Each of these fails against the pre-ruling file, which is the flip.
test("the standpoint plate hangs off the dock and is revealed by its hover", () => {
  assert.match(mount, /<div class="pmc-cap">ACT AS<\/div>\s*\n\s*\$\{drawHere\(\)\}/,
    "drawRoster draws the plate into the dock itself");
  assert.match(mount, /\.pmc-roster:hover \.pmc-here, \.pmc-roster:focus-within \.pmc-here \{ opacity: 1; \}/,
    "and the dock's hover is what reveals it");
  assert.match(mount, /\.pmc-here \{\r?\n  position: absolute; left: 0; bottom: calc\(100% \+ 3\.2em\);/,
    "it is anchored above the dock, not at a viewport corner");
  assert.match(mount, /\.pmc-here \{[^}]*pointer-events: none;/,
    "and takes no pointer, so it cannot eat the hover that summoned it");
});

test("the here-plate's viewport corner and its fence are both gone", () => {
  // the old rule — the collision itself
  assert.doesNotMatch(mount, /\.pmc-here \{ position: absolute; left: 14px; top: 14px/,
    "no viewport-cornered here-plate");
  // and the fence written for it, which is dead code once it is anchored
  assert.doesNotMatch(mount, /here\.style\.left = `\$\{paint\.left \+ 14\}px`/,
    "placeBar no longer clamps a plate that no longer floats");
});

// ── the way out is measured too (2026-08-28, founder-caught) ──
//
// "step outside" and the room's own name printed on top of each other at the
// dock's end of the row. `.wv-scene-exit` is the viewer's exit pill at the
// painting's bottom-left, bottom:58px — newer than this fence and never
// measured by it. With `.wv-walkdesk` shipping hidden until a walk is armed,
// the tallest measured thing is the coordinate chip and the row lands at about
// 46px, a band running straight through the pill's 58-to-86.
test("the row lifts clear of the viewer's way-out pill, not just its walk desk", () => {
  assert.match(mount, /"\.wv \.wv-walkdesk", "\.wv \.wv-spectator-coordinate", "\.wv \.wv-paint-tallies", "\.wv \.wv-scene-exit"/,
    "placeBar measures the exit pill alongside the rest of the bottom edge");
});

test("the plate stopped floating — the CSS is the row's, not the left edge's", () => {
  // the old rule was `position: absolute; left: 14px; top: 30%` — the collision itself.
  assert.doesNotMatch(mount, /\.pmc-roster \{ position: absolute; left: 14px/,
    "no absolutely-positioned roster plate");
  assert.match(mount, /\.pmc-barrow \{\r?\n  position: absolute; left: 50%; bottom: 18px/,
    "the row owns the bottom-edge placement the bar used to");
});

test("the dock speaks, the viewer can follow: pm:act-as on every face click", () => {
  assert.match(mount, /speakActAs\(\);\s*\n\s*return;/,
    "the face-click branch speaks the selection");
  assert.match(mount, /new w\.CustomEvent\("pm:act-as", \{ detail: \{ actor \} \}\)/,
    "the word is a resident handle on a pm:act-as event");
  assert.match(mount, /if \(!actor \|\| actor === HUMAN_ACTOR/,
    "the human hand stays the cockpit's own grammar — never spoken at the viewer");
});

test("the handshake is two-signal: attribute for late boots, event for early ones", () => {
  assert.match(mount, /setAttribute\("data-pmc-dock", "1"\)/,
    "mount plants the attribute a later-booting viewer can read");
  assert.match(mount, /new w\.CustomEvent\("pm:cockpit-dock", \{ detail: \{ present \} \}\)/,
    "and speaks the event an earlier-booting viewer is listening for");
  assert.match(mount, /dockSignal\(false\); \/\/ hand the Act As question back/,
    "destroy hands the question back to the viewer's own row");
});

test("the row is fenced to the painting, not the viewport", () => {
  // Seen live the moment the dock landed: a viewport-centered row ran its left
  // end under the nav column — ACT AS faces on top of the nav's own text. The
  // row centers over the map pane the cockpit already holds, and never leaves it.
  // The measured reference moved from `o.svg` (mount-time) to `liveSvg()`
  // (2026-08-28, same night): the viewer rebuilds its svg on a view change, and
  // a detached svg answers getBoundingClientRect with zeros — so the fence was
  // measuring a ghost the moment the view changed. Same fence, living ruler.
  assert.match(mount, /const paint = liveSvg\(\)\?\.getBoundingClientRect\?\.\(\);/,
    "placeBar measures the living painting");
  // The fence is now a SPAN rather than a centre-and-width pair, because the row
  // also steps aside from bottom-corner furniture (below) and both ends have to
  // be able to move independently. Its floor and ceiling are still the
  // painting's edges and nothing else's.
  assert.match(mount, /let lo = wide \? paint\.left \+ 10 : 14;/,
    "the row's left edge comes off the painting, not the viewport");
  assert.match(mount, /let hi = wide \? paint\.right - 10 : vw - 14;/,
    "and so does its right edge");
  assert.match(mount, /bar\.style\.left = `\$\{\(berthLo \+ berthHi\) \/ 2\}px`;/,
    "and the row centers between them rather than over the viewport");
});

test("the row holds still under a pointer, so the dock cannot slide out from under a click", () => {
  // ⚑ CAUGHT WHILE PILOTING IT, 2026-08-28, and it is the cost of having made
  // the row re-measure promptly rather than once. The viewer's furniture is
  // transient — the exit pill comes and goes with what it thinks you can step
  // into — so the row stepped aside for it, stepped back when it left, and
  // stepped aside again. A dock whose faces move a hundred pixels while a hand
  // is reaching for one is a dock you misclick: aiming at rei and pressing the
  // illuminator, twice.
  //
  // The harm was only ever the row moving under a pointer that was aiming at
  // it, so that is the whole of the condition: while the row is hovered it does
  // not move in either direction, and the instant the pointer leaves it
  // measures itself honestly again.
  //
  // A first pass never gave the berth back at all. That stopped the dancing and
  // left the row permanently squeezed by furniture long since gone — one armed
  // walk and the bar sat at two thirds width for the rest of the standpoint,
  // trading a misclick for a papercut and keeping the papercut.
  assert.match(mount, /if \(here !== berthKey\) \{ berthKey = here; berthLo = null; berthHi = null; \}/,
    "a new standpoint measures the room again from scratch");
  assert.match(mount, /const held = berthLo != null && \(root\.querySelector\("\.pmc-barrow"\)\?\.matches\?\.\(":hover"\) \?\? false\);/,
    "the row holds its berth only while a pointer is actually on it");
  assert.match(mount, /if \(!held\) \{ berthLo = lo; berthHi = hi; \}/,
    "and measures itself honestly again the moment the pointer leaves");
});

test("the row steps around bottom-corner furniture before it climbs over it", () => {
  // ⚑ FOUNDER-CAUGHT 2026-08-28, mid-fight: "the action buttons somehow floated
  // vertically upwards and now have a horizontal scroll."
  //
  // The fence answered every piece of the viewer's bottom furniture the same
  // way — lift the whole row above the tallest of them. `.wv-walkdesk` is 194px
  // tall and sits in the painting's bottom-RIGHT corner, so arming a walk threw
  // the entire row 216px up a 893px window to clear something it overlapped
  // along one sixth of its length. Measured on his screen at the moment he
  // reported it: desk top 689, row bottom 215.938px, row spanning x 222–1910
  // against a desk spanning 1606–1910.
  //
  // A corner is something you go around. So the lift is no longer computed from
  // every piece on the edge — only from the ones that could not be stepped past.
  assert.match(mount, /if \(box\.right <= lo \|\| box\.left >= hi\) continue;/,
    "furniture the row does not reach is not furniture the row must answer for");
  assert.match(mount, /if \(keepLeft >= keepRight && keepLeft >= full \* KEEP_FRACTION\) hi = endBefore;/,
    "the row ends before a right-hand corner piece rather than rising over it");
  assert.match(mount, /else if \(keepRight > keepLeft && keepRight >= full \* KEEP_FRACTION\) lo = beginAfter;/,
    "and begins after a left-hand one");
  assert.match(mount, /for \(const box of climb\) clear = Math\.max\(clear, h - box\.top \+ 12\);/,
    "and the lift is measured off what is left — never off a piece already dodged");
});

// ── the time-travel pill stands down inside the cockpit (2026-08-28) ──
//
// THE LAW, the founder's words: "we should just remove the time travel icon when
// in this portal."
//
// The pill is the SITE's element (town/pages/world.astro, class .pm-tt), not the
// viewer's — so the rule that stands it down is written in its own stylesheet,
// one element one writer, and asserted here against that file.
//
// It is keyed on data-pmc-dock, which is the same word the viewer's Act As row
// and Actions rail already stand down on. That is what makes the restore free:
// destroy removes the attribute, so nothing has to remember to put the pill
// back, and outside portal ground the rule matches nothing at all.
test("the time-travel pill stands down on the cockpit's own dock signal", () => {
  assert.match(worldPage, /html\[data-pmc-dock\] \.pm-tt \{ display: none; \}/,
    "world.astro hides the pill while the cockpit's dock is mounted");
  // The restore is the attribute going away, so the mount must still be the
  // thing that plants and removes it — a pill hidden by a signal nobody clears
  // is a pill that never comes back.
  assert.match(mount, /removeAttribute\("data-pmc-dock"\)/,
    "and destroy clears the signal, which is what restores the pill");
});

// ══ THE MAP IS A CONTROL (2026-08-28 ruling) ══
//
// "Clicking a point on the map while acting as a walker should prefill/dispatch
// the walk to that point. Clicking a thing offers its context acts with the
// object prefilled."
//
// THE SEAM AND ITS WEAKNESS, pinned together on purpose. The viewer's delegated
// click handler reads `e.target.closest(".stand")` and hands the coordinates to
// its own chooseWalkPoint — and NOTHING IN THE VIEWER CARRIES THAT CLASS, in the
// pinned build or on the branch the pin is heading to. The hook is live and its
// elements are gone. It is the only walk route the viewer publishes (its window
// handle carries rerender/reload/stop and no walk of any kind), so the cockpit
// mints one and clicks it — the same move the page's arrival island already
// makes against `.ctl[data-x]`.
//
// Leaning on a vestigial hook is only safe because the result is CHECKED, which
// is what the second test here exists to keep true. If the world lane ever tidies
// that handler away, the reader is told the shortcut is not working rather than
// left clicking a map that quietly does nothing.
// ══ WALKING JOINED THE ONE FLOW (founder-ruled 2026-08-29) ══════════════════
//
// ⚑ TWO TESTS STOOD HERE AND ARE GONE WITH THE CODE THEY PINNED — named rather
// than deleted quietly, because a falsifier that vanishes and one that was
// deliberately reversed look identical in a diff.
//
// THEY WERE: "a bare-ground click is handed to the viewer's own walk-arming
// path", which pinned the mint-and-click of a `.stand` element into a hook the
// viewer publishes but has no elements behind; and "the vestigial hook is
// verified, not trusted", which pinned the receipt that checked the desk had
// actually opened. Both were right for the ruling they served — the viewer owned
// walking, so the cockpit borrowed it rather than re-implementing pathing.
//
// THE GOVERNING RULING makes walking an ordinary act of the one flow ("in both
// cases, the next step IS the right side panel popup that has the WHO, the FROM,
// and the TO … and the CONFIRM button") and stands the viewer's desk down. A
// hand-off into a hidden panel would arm a walk nobody could confirm.
test("walking is an act of the one flow, not a hand-off to a second desk", () => {
  assert.doesNotMatch(mount, /b\.className = "stand";/, "nothing is minted into the viewer any more");
  assert.doesNotMatch(mount, /const walkFromMap =/, "and the hand-off itself is gone");
  assert.doesNotMatch(mount, /const deskOpen = \(\) =>/, "along with the receipt that watched for its desk");
  // walking is recognised by the door's own words — two fields described as grid
  // metres — and armed like any other targeted act
  assert.match(mount, /if \(kind === "point"\) \{ arm\(action, "point", pointFields\(s\.card\)\); return; \}/,
    "a point-aimed act arms the map instead");
  assert.match(mount, /const m = snapPoint\(pxToWorld\(gridNow\(\), local\), walkStep\(state\.answer\)\);/,
    "and the ground's stride is applied where the target is taken");
});

test("the cockpit takes only the clicks on figures it drew itself", () => {
  // The viewer's marks are the viewer's to answer for. An overlay that
  // hit-tested them would be quietly replacing the surface underneath it.
  assert.match(mount, /if \(ev\.target\?\.closest\?\.\("#wv-overlay \[data-id\], \.wv-card, \.ctl, button, a"\)\) return;/,
    "a click on anything the viewer owns is left alone entirely");
  // The listener moved from the mount-time svg to the DOCUMENT (2026-08-29,
  // the fifth living-svg sighting): bound to o.svg it died with the viewer's
  // first rebuild, and the founder's clicks on the cake landed on a painting
  // nobody was listening to. Capture is kept; the handler gates itself on
  // liveSvg().contains(ev.target) so only the living painting's clicks are
  // considered at all.
  assert.match(mount, /doc\.addEventListener\("click", onMapClick, true\);/,
    "listened for in capture on the document, which cannot be rebuilt away");
  assert.match(mount, /const svg = liveSvg\(\);\r?\n\s*if \(!svg \|\| !svg\.contains\?\.\(ev\.target\) \|\| state\.open\) return;/,
    "and gated on the LIVING painting containing the click");
  assert.match(mount, /doc\.removeEventListener\("click", onMapClick, true\);/,
    "and given back at destroy");
  // stopPropagation happens ONLY on one of our figures — or while an act is
  // armed, which is the reader having said the map is a targeting surface right
  // now (2026-08-29). Both branches take the click before the viewer sees it;
  // nothing else does.
  assert.match(mount, /if \(thing\) \{\r?\n\s*ev\.preventDefault\(\);\r?\n\s*ev\.stopPropagation\(\);/,
    "the viewer's click is swallowed for a figure this cockpit drew");
  assert.match(mount, /if \(state\.aiming\) \{\r?\n\s*ev\.preventDefault\(\);\r?\n\s*ev\.stopPropagation\(\);/,
    "and for any click while an act is armed, so a target is never also a walk");
  // and bare ground with NOTHING armed is left entirely alone now — under the
  // one flow a walk begins at its button, so a stray click is not a half-begun
  // act and this overlay takes nothing it was not asked for
  assert.doesNotMatch(mount, /walkFromMap\(/, "a bare-ground click arms nothing on its own");
});

// ══ VERB-FIRST TARGETING (2026-08-29) — AND THE MENU IT REVERSES ══
//
// ⚑ THIS TEST SUPERSEDES "a context act carries its object into the field the
// menu named", which pinned the object-first menu ruled in on 2026-08-28. The
// superseded law: clicking a thing on the map opened a menu of every act the
// ground affords, with the thing seeded into each one's field. The founder,
// playing the dungeon on 08-29: that behaviour is nonsensical.
//
// The old test is named here rather than silently dropped, because a falsifier
// that vanishes and a falsifier that was deliberately reversed look identical
// in a diff, and the next reader has to be able to tell them apart.
//
// THE NEW LAW: the act is armed first and then aimed. Each assertion below
// fails against the pre-ruling file — the strings did not exist — which is the
// flip.
test("pressing an aimable seat arms it instead of opening a panel", () => {
  assert.match(mount, /if \(kind === "thing" && aimable\(s, state\.answer, \{ only: aimRoles\(action\) \}\)\) \{ arm\(action, "thing", aimField\(s\.card\)\); return; \}/,
    "openSeat arms when the card says the act is aimed at a thing and the answer names one it may be aimed at");
  // ⚑ AND AN ACT AIMED AT NOTHING FALLS STRAIGHT THROUGH TO THE PANEL, which is
  // the founder's own complaint answered: "guard asks you to pick a target on
  // the map... should just be a confirm button." The shape is the card's —
  // aimed at a thing, at a point, or at nothing — never a name.
  assert.match(mount, /const kind = SELF_DIRECTED\.includes\(action\) \? "none" : aimKind\(s\.card\);/,
    "the shape is read off the card, except where the office shares one field across acts that differ");
  // …and the decision is the CARD's, never a name: nothing in openSeat spells
  // an act, and the arithmetic it calls is held to the same rule by its own
  // falsifier (world-cockpit.test.mjs greps that source for verb names).
  assert.match(mount, /function openSeat\(action, \{ focus = true \} = \{\}\) \{/,
    "one route for a click, the tray and the number keys");
  // an armed act finishes through the SAME dispatch a panel uses
  // ⚑ A TARGET CLICK NO LONGER DISPATCHES. The governing ruling puts the panel
  // between the target and the door: "the next step IS the right side panel
  // popup … and the CONFIRM button to actually do the action."
  assert.match(mount, /function takeAim\(args, label\) \{/, "a target is taken, not sent");
  assert.match(mount, /state\.act = \{ action, args, label \};/, "and held until the reader confirms");
  assert.doesNotMatch(mount, /function sendAim\(/, "the dispatch-on-click path is gone");
});

test("the object-first menu is gone, not merely unused", () => {
  // CODE SHAPES, NOT BARE NAMES, and the distinction bit on the first run: the
  // two function names still occur in the comment that records the reversal,
  // which is the repo's own convention (an instruction that reverses an earlier
  // one shows both states) and must not be what a falsifier trips on.
  assert.doesNotMatch(mount, /function contextHtml\s*\(/, "no menu renderer");
  assert.doesNotMatch(mount, /function contextActs\s*\(/, "no menu act-list builder");
  assert.doesNotMatch(mount, /contextHtml\(\)/, "and nothing calls one");
  assert.ok(!mount.includes("data-ctx-act"), "no menu buttons");
  assert.ok(!mount.includes("state.context"), "and no state left for one to live in");
  assert.ok(!COCKPIT_CSS_BLOCK.includes(".pmc-ctx"), "and the menu's own styling is gone with it");
});

test("the adversary opens nothing, and a loose thing is picked up", () => {
  // the entity reading wins in a fight: no menu, and the click is still
  // swallowed so it cannot fall through and arm a walk into the target
  assert.match(mount, /if \(thing\.loose\) takeFromFloor\(thing\);/,
    "a thing on the floor is taken by the click itself");
  assert.doesNotMatch(mount, /state\.context = \{ thing/,
    "and nothing opens a menu on a thing any more");
  // the pick-up seat is the one the ruling named, and it is checked before use
  assert.match(mount, /const s = \[\.\.\.shown, \.\.\.folded\]\.find\(\(x\) => x\.action === "take"\);\r?\n\s*return s\?\.afforded && s\.enabled && s\.card \? s : null;/,
    "click-to-take is refused where the ground does not afford it");
});

test("escape gives back the map before it gives back anything else", () => {
  assert.match(mount, /if \(ev\.key === "Escape" && state\.aiming\) \{ eatKey\(ev\); disarm\(\); return; \}/,
    "an armed act is the innermost thing one press puts down");
  // ⚑ AND THE VIEWER DOES NOT ALSO GET IT. Both surfaces bind document keydown
  // and the viewer's Escape clears ITS own selection, so one press was putting
  // down the cockpit's panel and the map's selection together. A key we ACTED on
  // stops here; a key we ignored is left entirely alone.
  assert.match(mount, /const eatKey = \(ev\) => \{ ev\.preventDefault\(\); ev\.stopPropagation\(\); ev\.stopImmediatePropagation\?\.\(\); \};/,
    "a consumed key is not propagated to the viewer's own handler");
  // and a click on anything that is not a target disarms, which is the other
  // half of the ruling's own escape hatch
  assert.match(mount, /if \(target\) takeAim\([^;]*\);\s*else disarm\(\);/,
    "clicking elsewhere disarms rather than acting");
});

// ══ THE DOCK'S SELECTION ACTUALLY REACHES THE VIEWER (2026-08-28, corrected) ══
//
// THE EVENT WAS DEAD WIRE, measured rather than assumed: the string "pm:" does
// not occur anywhere in spectator/viewer.mjs at the pinned build (package.json
// holds ceeca087), and no listener for it exists under src/ either. The
// listeners DO exist on the world's proto/birthday branch (2cf10d0f, 3d1fbfe0)
// — this pin is simply behind them.
//
// WHAT THAT COST, and it is not cosmetic: confirmSelectedWalk posts
// `state.handle` and takes no per-call actor argument, so with the dock's
// selection never reaching the viewer, a reader who picked a face here and then
// clicked the map armed a walk for whoever the viewer still thought was acting.
// Silently, and for the wrong resident.
//
// The working route is the viewer's own delegated control, minted and clicked:
//     const actor = e.target.closest("[data-act-as]");
//     if (actor) { selectActor(actor.dataset.actAs); return; }   // viewer.mjs:7681
test("the dock drives the viewer's own act-as control, not only the event", () => {
  assert.match(mount, /b\.setAttribute\("data-act-as", actor\);/,
    "speakActAs mints the element the viewer's delegate is looking for");
  assert.match(mount, /new w\.CustomEvent\("pm:act-as", \{ detail: \{ actor \} \}\)/,
    "and still speaks the event, which starts working when the pin is bumped");
});

test("it does not call selectActor when the viewer already agrees", () => {
  // selectActor runs clearSelectionAndDestination() and recenters the camera
  // (viewer.mjs:8060, 8064), so a redundant call throws away an armed walk and
  // moves the map out from under the reader. The guard reads the key the viewer
  // persists its actor under.
  assert.match(mount, /const VIEWER_ACT_AS = "pm\.world\.act_as";/,
    "the viewer's own persisted key is the signal");
  assert.match(mount, /if \(viewerActor\(\) !== actor\) \{/,
    "and the mint happens only on a real difference");
});

// ⚑ "the actor is settled BEFORE the walk is armed, never after" STOOD HERE.
// It pinned an ordering inside `walkFromMap` — settle the actor, then arm,
// because selectActor clears the destination and the other order wiped the walk
// that had just been armed. The function is gone with the hand-off, and so is
// the ordering hazard: the cockpit no longer arms anything inside the viewer.
// The dock still speaks its selection at the viewer on a face press, which is
// what the two tests below this pin.

// ── the seats get glyphs, and the way out folds in (2026-08-29 rulings) ──────
test("every seat draws a glyph, and a verb the map has never heard of still draws one", () => {
  // THE RULING: "some icons on the different actions to make them distinct."
  //
  // This is the nearest thing to a verb list on the surface, which is why the
  // DEFAULT is the part worth pinning. The bar's standing law is that it offers
  // whatever the door listed; a picture cannot be derived from a card, so it
  // costs a lookup by name. What keeps that from becoming a list is that a name
  // the map has never heard of draws the neutral mark and the seat works
  // exactly as it always did — a door growing a verb tomorrow gets a plain
  // glyph, never a missing seat and never a throw.
  assert.match(mount, /const ICON_DEFAULT = /, "there is a mark for the verbs nobody anticipated");
  assert.match(mount, /const d = ICONS\[String\(action \?\? ""\)\.toLowerCase\(\)\] \?\? ICON_DEFAULT;/,
    "and the lookup falls back to it rather than drawing nothing");
  assert.match(mount, /\$\{iconFor\(s\.action\)\}\s*\n\s*<span class="pmc-name">/,
    "the glyph rides on the seat, above its name");
  assert.match(mount, /stroke: currentColor;/,
    "and takes the seat's own colour rather than introducing a second palette");
});

test("the way out is one control: the pill stands down and the seat says where it leads", () => {
  // THE RULING: "if the exit button is IN the action bar, we don't need another
  // redundant button." The pill carried one thing the seat did not — the NAME of
  // what you step out into — so the seat takes it over rather than losing it.
  assert.match(worldPage, /html\[data-pmc-dock\] \.wv-scene-exit \{ display: none; \}/,
    "the viewer's standalone pill stands down while the dock is mounted");
  assert.match(worldPage, /THE SECOND-WRITER TENSION, DISCLOSED/,
    "and the fact that this is the site touching the viewer's furniture is written down, not hidden");
  // WHICH seat, decided by the door's own sentence rather than by a verb name
  assert.ok(mount.includes('const leaves = (s.card?.fields ?? []).some((f) =>'),
    "which seat is the way out is asked of the seat's own card, not of a verb name");
  assert.ok(mount.includes('out of') && mount.includes('.test(f.description ?? "")'),
    "and the question it asks is the door's own sentence about stepping out of something");
  assert.match(mount, /return `→ \$\{String\(parent\)\.split\("\/"\)\.pop\(\)\.replace\(\/-\/g, " "\)\}`;/,
    "and it names the containment the door already published");
});

test("an act names the SELECTED resident's standing, not the key's first handle", () => {
  // ⚑ THE ACT SIDE OF THE SEAT LAW, still on the old rule a day after the read
  // side was fixed. The dispatch passed `orientingHandle(o.me)` — the first
  // handle on the key, written for a key holding one resident. The founder's
  // holds six and the office orders the Illuminator first, so every act went
  // out naming her whoever the dock had selected. The comment beside that line
  // stated the point ("so the bar cannot be drawn for one standpoint and act
  // from another") while the line under it did exactly that.
  //
  // Caught the moment the human could fight at all: the door refused a human's
  // strike in the candle vault with "not afforded where you stand", correctly —
  // the act had oriented from a looking-room that grants no arena verbs.
  assert.match(mount, /const res = await o\.dispatch\(dispatchEnvelope\(\{ action, args, acting: state\.acting, handle: seat\(\) \}\)\);/,
    "the act carries the seat, not the first handle the key happens to list");
  assert.doesNotMatch(mount, /handle: orientingHandle\(o\.me\)/,
    "and the old first-handle rule is gone from the dispatch entirely");
  // the human BORROWS a seat rather than having one, which is the whole seam
  assert.match(mount, /if \(state\.acting !== HUMAN_ACTOR\) state\.seat = state\.acting;/,
    "a resident selection is its own seat");
  assert.match(mount, /if \(state\.acting && state\.acting !== HUMAN_ACTOR\) return state\.acting;\s*\n\s*return state\.seat \?\? orientingHandle\(o\.me\);/,
    "and acting as yourself keeps the seat you were already standing in, first handle only as a last resort");
  // one resolution, not two — the shadow read asks the same question
  assert.match(mount, /const asking = seat\(\);/,
    "the terms read asks whose standing the same way the act does");
});

test("the camera watch follows the living svg, like the layer and the framing before it", () => {
  // ⚑ THE THIRD SIGHTING OF ONE SEAM IN ONE NIGHT — the token layer, then the
  // framing, now the watch. The viewer REBUILDS its painting on a view change,
  // and this observer was pointed at whichever element existed at mount. Once
  // the viewer swapped it the watch was on a detached node and never fired
  // again, so the token kept the size and offset it had at its last draw — both
  // screen constants derived from the viewBox.
  //
  // Caught by reading the transform rather than the picture: the human's token
  // sat at standpoint + 0.0288 units with the viewBox 240 units wide, which is
  // exactly the offset that was right when the view was 1.6 units across. On
  // screen, a portrait several times too large sitting on the ring it is meant
  // to stand beside.
  assert.match(mount, /const svg = liveSvg\(\);\s*\n\s*if \(!svg \|\| svg === watched\) return;/,
    "the watch re-points when the painting under it is replaced, and no-ops when it is not");
  assert.match(mount, /camera\?\.disconnect\(\);/,
    "the old watch is dropped rather than left running on a detached node");
  assert.doesNotMatch(mount, /camera\.observe\(o\.svg,/,
    "and nothing observes the mount-time svg any more");
});
