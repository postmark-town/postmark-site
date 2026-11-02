// world-cockpit-mount.mjs — the cockpit's pixels.
//
// DOM only. Nothing here fetches, and nothing here decides what may be done: the
// caller hands it an ANSWER (the apex door's), an identity, the map's grid, and a
// `dispatch` function, and this draws exactly what those say. Split from the
// component so the renderer can be mounted against a fixture answer — which is the
// only way to look at a portal cockpit before any portal exists.
//
// Every word the bar shows about an act comes off the door's entry, through
// `world-cockpit.mjs`. There is no verb list here.

import {
  HUMAN_ACTOR, actorsFor, barSlots, cockpitShows, dispatchEnvelope,
  portalOf, readBounce, statedLimit, termsFromRead, termsRows, tokenFor, tokenPlacement,
  wantsTextarea, worldToPx,
  blockedReason, encounterOf, fighterState, humanWords, looseThings, rollsFrom, spaceOf,
  actCandidates, adversaryOf, adversaryPlacement, chatField, chatShaped, prefillFor,
  // ⚑ `briefWords` WAS IMPORTED HERE AND IS NOT ANY MORE. It cut the door's
  // sentence down to fit the small name box, and the box was deleted the same
  // day — the import outlived its only caller. Nothing in this file has a width
  // to fit a sentence into now. It stays exported from world-cockpit.mjs with
  // its own tests: a pure function nobody calls today is cheaper to keep than to
  // re-derive, and it is not dead there, only unused here.
  pxToWorld, recentVoices, faceImageFor,
  aimField, aimKind, aimTargets, aimable, barFold, combatantBars, consentSplit, dialSpeak, leavingName,
  pointFields, snapPoint, walkStep, weaponFor,
} from "./world-cockpit.mjs";
// The rail's feed — its sentences, its merge rule and its bottom test. All of
// it pure, so the fight's whole grammar is falsifiable against fixtures without
// a browser; this file only draws what it returns.
import { atBottom, beatsFromAct, beatsFromDelta, beatsFromTail, mergeFeed, tailWatermark, voiceEntries } from "./world-feed.mjs";
// ONE resolution of "which resident is this key standing as", shared with the read
// — so the bar cannot be drawn for one standpoint and act from another.
import { orientingHandle } from "./world-cockpit-door.mjs";

const NS = "http://www.w3.org/2000/svg";

// The mockup's palette, and the reason it is repeated here rather than borrowed:
// the world page renders NO site layout (it is a verbatim passthrough of the
// viewer shell), so there are no site tokens on this page to inherit. These are
// the values from the cockpit mockup — panel/gold/ink — and they are the viewer's
// own family, not a second visual language.
//
// ⚠ NO BACKTICKS BELOW, INCLUDING IN THE COMMENTS. This is a template literal, and
// a backtick in prose ENDS IT — the rest of the stylesheet then parses as JS and
// the whole module throws at import. It happened twice in one evening, the second
// time inside the comment written about the first, which is why the export and the
// falsifier below exist: care was not enough, so the last rule in this block is
// now something a test can look for.
export const COCKPIT_CSS = `
.pmc, .pmc * { box-sizing: border-box; }
.pmc {
  --pmc-ink:#e8e4da; --pmc-dim:#9aa1ad; --pmc-gold:#d9a860; --pmc-gold-dim:#8a6a30;
  --pmc-panel:rgba(14,18,26,.90); --pmc-line:rgba(217,168,96,.45);
  --pmc-live:#e0b25c;
  position: fixed; inset: 0; z-index: 7000; pointer-events: none;
  font: 15px/1.5 Georgia, "Times New Roman", serif; color: var(--pmc-ink);
}
/* The cockpit is dark in every theme on purpose: it is chrome over a night map,
   and a light panel here would be a hole punched in the painting. */
.pmc-plate {
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 8px;
  box-shadow: 0 2px 14px rgba(0,0,0,.55); pointer-events: auto;
}
.pmc-cap {
  color: var(--pmc-dim); font: 0.62rem/1 ui-monospace, Consolas, monospace;
  letter-spacing: .18em; margin-bottom: .55em; text-align: center;
}

/* ── the roster, DOCKED (2026-08-28, founder-caught) ──
   The floating left plate sat ON TOP of the viewer's own Act As row — two
   controls answering the same question, neither informing the other. The
   founder's ruling: who-acts sits BESIDE what-they-do. So the roster is now
   the leftmost cell of the bar's own row (.pmc-barrow), the viewer's old row
   stands down while this dock is mounted (data-pmc-dock on <html> is the
   signal), and a face click speaks pm:act-as so the viewer's walk desk and
   enter buttons follow the same selection. One control, one grammar strip. */
.pmc-roster {
  position: relative; flex: 0 0 auto; align-self: center;
  display: flex; align-items: center; gap: .35em;
  padding: .3em .55em; pointer-events: auto;
}
/* THE PICTURE IS CLIPPED, NOT THE BUTTON. An overflow:hidden here rounded the
   token off nicely and also ate the name box, which hangs outside the circle by
   design: the box was in the DOM with opacity 1 and a 239px width, and no reader
   could see a pixel of it. The machine twin read the text and reported it present;
   the screenshot is what caught it. */
.pmc-face {
  width: 2.3em; height: 2.3em; margin: 0; border-radius: 50%; padding: 0; flex: 0 0 auto;
  background: #1b2230; border: 2px solid rgba(154,161,173,.35); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--pmc-dim); font: 1em/1 ui-monospace, Consolas, monospace; position: relative;
}
.pmc-face img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
/* The letter is under every picture rather than instead of one, so a picture
   that fails to load reveals the tile it was covering instead of leaving a hole
   in the dock. Both are stacked in the face's own box; the picture wins while
   it exists. */
.pmc-face .pmc-mono { position: absolute; inset: 0; display: grid; place-items: center; }
.pmc-face .pmc-mono + img { position: absolute; inset: 0; }
.pmc-face[aria-pressed="true"] { border-color: var(--pmc-gold); box-shadow: 0 0 12px rgba(217,168,96,.5); color: var(--pmc-gold); }
/* REFUSED IS aria-disabled, NOT disabled — a truly disabled button fires no
   pointer events, and a face nobody can hover is a face that cannot say why it
   is grey. Same trade the gated seats made, for the same reason. */
.pmc-face[aria-disabled="true"] { opacity: .4; cursor: not-allowed; }
.pmc-face:focus-visible { outline: 2px solid var(--pmc-gold); outline-offset: 2px; }
/* horizontal dock: the residents|human rule stands upright between them */
.pmc-rule { border-left: 1px dotted rgba(154,161,173,.4); align-self: stretch; margin: .15em .2em; }
/* the dock's caption sits above its shoulder, out of the row's height */
.pmc-roster .pmc-cap { position: absolute; left: .7em; bottom: calc(100% + .15em); margin: 0; }
/* ⚑ THE SMALL NAME BOX (.pmc-nm) STOOD HERE AND IS GONE (2026-08-29). Hovering
   a face raised two panels at once — its own box, and the dock's plate — and the
   founder's ruling is that the hover shows the LARGER card and not the small
   nameplate. Everything it said now lives on the plate: see drawHere. The rule
   below stays, because a raised face still must not be painted under its
   neighbour. */
.pmc-face:hover, .pmc-face:focus-visible { z-index: 2; }

/* ── the bar ── */
/* THE BAR IS A ROW, and it stays one. Wrapping was the default and the first
   shot showed what it costs: six fixed seats on one line, the HERE divider
   stranded with ENTER after it, and the afforded tray on a second line below —
   which is the taxonomy the whole bar exists to show, broken. So it does not
   wrap; where a ground grants more than fits, the row scrolls, and the fixed
   seats stay where the hand expects them. */
/* THE ROW THAT OWNS THE BOTTOM EDGE is now .pmc-barrow: dock + bar side by
   side, placed as one thing (placeBar moves the row, the same measured lift as
   before). The bar itself is a static flex child so its scrollport cannot clip
   the dock's name boxes — they are siblings, not passengers. */
.pmc-barrow {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: stretch; gap: .5em;
  max-width: calc(100vw - 28px); pointer-events: none;
}
.pmc-bar {
  position: static; flex: 1 1 auto; min-width: 0;
  display: flex; align-items: stretch; gap: .35em;
  flex-wrap: nowrap;
  justify-content: flex-start; pointer-events: none;
  overflow-x: auto; overflow-y: visible; scrollbar-width: thin;
  padding: 0 .2em 2px;
}
/* A SCROLLPORT CLIPS BOTH AXES — set overflow-x and overflow-y computes to auto
   with it — so a bar that can scroll would eat the very cards that hang above it.
   That is why the card and the form are not children of a slot: they live in the
   overlay and are positioned against the hovered seat, which also lets a card near
   the screen edge stay on screen instead of hanging off it. */
.pmc-bar { scroll-padding-inline: 1em; }
.pmc-slot { flex: 0 0 auto; }
/* A ROW THAT SCROLLS MUST SAY SO. At 390 the bar showed five seats and no sign
   there were five more — a reader on a phone would never find the afforded-here
   tray, which on this surface is the half that is actually about where they are
   standing. The classes are set by the script from a real measurement, so the
   cue appears only when something is genuinely off the edge. */
.pmc-bar.more-right { mask-image: linear-gradient(to right, #000 calc(100% - 3.5em), transparent 100%); }
.pmc-bar.more-left { mask-image: linear-gradient(to right, transparent 0, #000 3.5em); }
.pmc-bar.more-left.more-right { mask-image: linear-gradient(to right, transparent 0, #000 3.5em, #000 calc(100% - 3.5em), transparent 100%); }
.pmc-more {
  position: fixed; z-index: 5; pointer-events: none;
  color: var(--pmc-gold); font: .8rem/1 ui-monospace, Consolas, monospace;
  text-shadow: 0 0 8px rgba(0,0,0,.9);
}
.pmc-more[hidden] { display: none; }
/* TIGHTER NOW THAT THE GLYPHS CARRY SOME OF THE MEANING (2026-08-29). The
   founder: the layout "causes a scroller". Removing the viewer's way-out pill
   gave the row back the painting's left third — measured, 1086px wide to
   1688 — and this gives back the rest that is available to give: a narrower
   floor, tighter flanks, and a shorter cap on the dial line, which is what made
   the five dialled seats a third wider than their neighbours.

   ⚑ IT DOES NOT MAKE THE SCROLL GO AWAY, and no amount of this would. Measured
   on the founder's own screen: seventeen afforded acts want about 1900px and
   the scrollport is 1377 with the dock beside it. Fitting them all means slots
   near 62px, which will not hold the word WITHDRAW at a size anyone reads. So
   the row still scrolls where a ground grants this much, and still says so —
   which is the bar's own standing answer to more verbs than fit. What changed
   is how far: about 520px of overflow, down from where it was. */
.pmc-slot {
  background: var(--pmc-panel); border: 1px solid var(--pmc-line); border-radius: 8px;
  min-width: 5.2em; padding: .8em .3em .45em; text-align: center; position: relative;
  cursor: pointer; pointer-events: auto; color: inherit; font: inherit;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.pmc-slot:hover:not([disabled]), .pmc-slot:focus-visible { border-color: var(--pmc-gold); box-shadow: 0 0 14px rgba(217,168,96,.35); }
.pmc-slot:focus-visible { outline: none; }
.pmc-slot[disabled] { opacity: .38; cursor: not-allowed; }
.pmc-key { position: absolute; top: .3em; left: .45em; color: var(--pmc-dim); font: .68rem/1 ui-monospace, Consolas, monospace; }
.pmc-name { color: var(--pmc-ink); font-size: .95em; letter-spacing: .04em; }
/* THE GLYPH TAKES THE SEAT'S OWN COLOUR — one stroke weight, currentColor, no
   second palette and nothing to fetch. It is drawn above the name rather than
   beside it so the row's widths do not move: a seat gets taller, and the row
   measures its own height when it places itself. */
.pmc-ico {
  display: block; width: 1.15em; height: 1.15em; margin: 0 auto .25em;
  fill: none; stroke: currentColor; stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round;
  color: var(--pmc-dim); opacity: .9;
}
.pmc-slot.afford .pmc-ico, .pmc-slot.open .pmc-ico { color: var(--pmc-gold); opacity: 1; }
.pmc-slot:hover:not([disabled]) .pmc-ico { color: var(--pmc-gold); opacity: 1; }
/* Capped, because one verbose class can otherwise set the width of the whole row
   — a two-dial class (reach_m 3 · burns_crossings 2) made KINDLE twice its
   neighbours' width in the first shot. The full dials are on the card, which is
   where detail belongs. NOTE: this whole block is a JS template literal, so it
   can hold no backticks — one here silently ended the string and the module threw
   on the CSS that followed. */
/* WIDER NOW THAT THE FOLD PAID FOR IT (2026-08-29). The cap above was 6.5em,
   set when seventeen acts were fighting for a 1377px scrollport and one verbose
   class could push the whole row wider. With the row folded to the ground's own
   acts it measures 628px at 1440 — so the cap that was protecting the layout was
   instead cutting the sentence the ruling asked for, and the seat read
   "d20 vs 8 t…". Measured, not guessed: see qa-shots/shoot-cockpit-arena.mjs,
   which fails the run if any ordinary laptop width scrolls. */
.pmc-dial {
  color: var(--pmc-dim); font: .62rem/1.3 ui-monospace, Consolas, monospace; margin-top: .2em;
  max-width: 11em; white-space: nowrap;
}
/* A ROW TOO NARROW FOR ITS OWN SECOND LINE drops the line, never a seat — the
   dial is the only thing on a seat that is repeated whole on the hover card, so
   it is the one part whose absence costs a reader nothing. Set from a real
   measurement in markOverflow, never from a viewport guess: the row's width
   depends on the viewer furniture it is dodging, which a media query cannot see. */
.pmc-bar.tight .pmc-dial { display: none; }
/* and the row closes up a little with it — the seats are shorter without the
   second line, so the gaps that suited a two-line seat are loose around a
   one-line one. Measured: this is what carried the last two pixels at 1280. */
.pmc-bar.tight { gap: .28em; }
.pmc-bar.tight .pmc-slot { padding: .8em .26em .5em; }
.pmc-slot.afford { border-style: dashed; }
.pmc-slot.afford .pmc-name { color: var(--pmc-gold); }
/* WHICH SEAT IS OPEN, said on the seat. Opened by mouse the seat is under the
   pointer and reads as chosen; opened by a number key nothing on the bar changed
   at all, so the form floated over a row with no sign of where it came from. */
.pmc-slot.open { border-color: var(--pmc-gold); background: rgba(217,168,96,.14); }
.pmc-slot.open .pmc-name { color: var(--pmc-gold); }
.pmc-gap { width: .7em; border-left: 1px dotted rgba(154,161,173,.4); margin: 0 .25em; align-self: stretch; display: flex; align-items: flex-end; }
.pmc-gap span { writing-mode: vertical-rl; color: var(--pmc-dim); font: .6rem/1 ui-monospace, Consolas, monospace; letter-spacing: .2em; padding-bottom: .4em; }

/* ── the card ── */
/* THE CARD TAKES NO POINTER, and this is a correctness rule rather than a nicety.
   A card is 24em wide over a 6.2em seat, so it hangs across four of its
   neighbours; with pointer-events on, sliding the mouse along the bar puts the
   previous slot's card under the cursor and the hover never reaches the seat
   beneath it. Caught by the shot runner, which could not hover SAY at all while
   EXIT's card was up. It is role="tooltip" — nothing in it was ever clickable. */
.pmc-card {
  position: fixed; width: 24em; max-width: calc(100vw - 24px);
  background: var(--pmc-panel); border: 1px solid var(--pmc-gold);
  border-radius: 8px; padding: .75em .9em; text-align: left; box-shadow: 0 4px 20px rgba(0,0,0,.6);
  z-index: 3; pointer-events: none;
}
.pmc-card[hidden] { display: none; }
.pmc-blurb { font-style: italic; color: var(--pmc-ink); font-size: .88rem; line-height: 1.45; margin: 0; }
.pmc-blurb.none { font-style: normal; color: var(--pmc-dim); }
/* the thing in your hand, speaking about itself — quieter than the class's own
   blurb because it is a smaller voice, and it names itself so the quote is not
   mistaken for the act's */
.pmc-blurb.pmc-voice-line { margin-top: .45em; font-size: .8rem; color: var(--pmc-gold); }
.pmc-blurb.pmc-voice-line span { font-style: normal; color: var(--pmc-dim); font-size: .92em; }
.pmc-from { color: var(--pmc-dim); font-size: .7rem; margin: .35em 0 .5em; line-height: 1.45; }
.pmc-row { font: .74rem/1.65 ui-monospace, Consolas, monospace; color: var(--pmc-dim); margin: 0; }
.pmc-row b { color: var(--pmc-gold); font-weight: normal; }
/* why a cold seat is cold — the card's first line when it has one, and the only
   line on it in the accent, because it is the answer to the question a reader
   hovering a greyed button actually has */
.pmc-row.pmc-why {
  font: .8rem/1.5 Georgia, serif; color: var(--pmc-accent);
  margin: 0 0 .4em; padding-bottom: .4em; border-bottom: 1px solid rgba(255,255,255,.09);
}

/* ── the act form ── */
/* The form lives in the overlay, not in the bar, for the scrollport reason above.
   Bottom is set by the script against the bar's measured top edge, so it sits over
   the row whatever height the row turns out to be. */
/* ── THE CONFIRM CARD, ON THE RIGHT (founder, live: the old walk confirmation
   "was MUCH more concise; the current is still so verbose", and it must sit on
   the RIGHT SIDE of the screen) ──

   So it takes the walk desk's own register, which is the thing he was comparing
   it to: the desk's corner, near its width, its tight type. It was centred and
   26em wide, which put a paragraph across the middle of the painting for an act
   whose whole content is three rows and a button.

   Vertically it is still MEASURED against the bar (placeAbove), because the bar
   moves to dodge the viewer's own furniture and a fixed bottom would collide
   with whatever it dodged. Only the horizontal is pinned. */
.pmc-form {
  position: fixed; right: 14px; left: auto; transform: none;
  width: min(19rem, 42vw); max-width: calc(100vw - 24px);
  padding: .7em .8em .8em; text-align: left; z-index: 4;
  font-size: .94em;
}
.pmc-form h3 { font-size: .72rem; }
.pmc-form .pmc-actions { margin-top: .7em; }
.pmc-form .pmc-btn { font-size: .7rem; padding: .42em .9em; }
/* the fine print is a footnote on a card this size, not a section */
.pmc-form details.pmc-fine { margin-top: .55em; font-size: .92em; }
.pmc-form details.pmc-fine summary { color: var(--pmc-gold-dim); font-size: .66rem; letter-spacing: .04em; }
/* ── WHO / FROM / TO ──
   The founder's three rows, and the panel leads with them because they are the
   whole of what he asked to see before pressing confirm. Monospaced keys so the
   three line up as a column a reader can scan rather than three sentences. */
.pmc-flow { margin: .5em 0 .2em; border-left: 2px solid var(--pmc-gold-dim); padding-left: .7em; }
.pmc-flow-row { display: flex; gap: .7em; align-items: baseline; margin: .12em 0; }
.pmc-flow-row .k {
  flex: 0 0 3.2em; color: var(--pmc-dim);
  font: .6rem/1.6 ui-monospace, Consolas, monospace; letter-spacing: .14em; text-transform: uppercase;
}
.pmc-flow-row .v { color: var(--pmc-ink); font-size: .84rem; }
.pmc-flow-row .v b { color: var(--pmc-gold); font-weight: 400; }
/* WHAT THIS ACT DOES, as a sentence — the one line that replaced a no-choice
   act's from/to pair. Set as prose rather than as a labelled row, because it is
   not a field with a value: it is the act, said. */
.pmc-doing { margin: .3em 0 0; font: .88rem/1.4 Georgia, serif; color: var(--pmc-ink); }
.pmc-doing b { color: var(--pmc-gold); font-weight: 400; }
.pmc-form h3 { margin: 0 0 .2em; font: .8rem/1.3 ui-monospace, Consolas, monospace; letter-spacing: .12em; color: var(--pmc-gold); font-weight: normal; }
.pmc-form label { display: block; margin: .6em 0 0; font-size: .72rem; color: var(--pmc-dim); }
.pmc-form label .req { color: var(--pmc-gold); }
.pmc-form input, .pmc-form textarea, .pmc-form select {
  width: 100%; margin-top: .25em; padding: .4em .5em; font: .82rem/1.4 Georgia, serif;
  color: var(--pmc-ink); background: rgba(0,0,0,.35); border: 1px solid rgba(154,161,173,.35); border-radius: 5px;
}
.pmc-form textarea { min-height: 4.5em; resize: vertical; }
.pmc-desc { margin: .25em 0 0; font-size: .66rem; line-height: 1.5; color: rgba(154,161,173,.85); }
.pmc-actions { display: flex; gap: .5em; margin-top: .9em; align-items: center; }
.pmc-btn { font: .74rem/1 Georgia, serif; padding: .55em 1em; border-radius: 999px; cursor: pointer; border: 1px solid var(--pmc-line); background: transparent; color: var(--pmc-gold); }
.pmc-btn.go { background: linear-gradient(180deg,#f0d5a8,#e8c48b); color: #0d1426; border-color: #f0d5a8; }
.pmc-btn[disabled] { opacity: .5; cursor: default; }
.pmc-said { margin: .8em 0 0; font-size: .74rem; line-height: 1.55; color: var(--pmc-ink); }
.pmc-said.bad { color: var(--pmc-live); }
.pmc-said .hint { display: block; color: var(--pmc-dim); font-size: .92em; margin-top: .3em; }
.pmc-terms { margin: .6em 0 0; padding: .5em .7em; border-left: 2px solid var(--pmc-gold-dim); font-size: .72rem; line-height: 1.55; color: var(--pmc-dim); }

/* ── THE CONSENT SHEET ──
   RULED 2026-08-29: the crossing sheet "dumps every field, vague and verbose".
   What a player needs before stepping through is the room's own sentence and
   two or three terms; what a lawyer needs is every word, and it is one press
   away rather than in front of the button. Nothing is dropped — see
   consentSplit, and the standing sentence about being shown law at the door. */
.pmc-sheet .flavor {
  margin: 0 0 .7em; font: 1.02rem/1.5 Georgia, serif; color: var(--pmc-ink);
  font-style: italic; border-left: 2px solid var(--pmc-gold); padding-left: .7em;
}
.pmc-sheet .pmc-terms { border-left-color: var(--pmc-gold); color: var(--pmc-ink); }
.pmc-sheet .pmc-terms b.lede { display: block; color: var(--pmc-gold-dim); font-weight: 400; margin-bottom: .3em; font-size: .92em; }
.pmc-sheet .pmc-term { display: block; margin: .12em 0; }
.pmc-sheet .pmc-term b { color: var(--pmc-dim); font-weight: 400; }
.pmc-sheet details { margin-top: .5em; }
.pmc-sheet summary { cursor: pointer; color: var(--pmc-gold-dim); font-size: .92em; }
.pmc-sheet details .pmc-row { white-space: normal; overflow-wrap: anywhere; }

/* ── the trigger plate ──
   RULED 2026-08-28, mid-fight: the arena's acts "must feel like a game — one
   tight line, prefilled, ENTER sends." Which acts get this is decided in
   formHtml by the CARD's shape, never by a verb's name.

   Everything here is a MOVE, not a removal: the fields stay, the terms stay,
   the blurb stays, and each one is still on the face of the plate. What changes
   is that they lie along the line instead of stacking down the page — a fight
   plate is read at a glance between two swings, and a column of captions is a
   column you scroll past to reach the button. */
.pmc-trigger { max-width: 27em; }
.pmc-trigger h3 { margin-bottom: .35em; }
.pmc-trigger .pmc-blurb { margin: 0 0 .5em; font-size: .74rem; }
/* label and control on ONE line, so a prefilled target reads as a filled-in
   sentence rather than as a form with one question in it */
.pmc-trigger label {
  display: flex; align-items: baseline; gap: .5em; margin: .3em 0 0;
}
.pmc-trigger label input, .pmc-trigger label select { margin-top: 0; flex: 1 1 auto; min-width: 0; }
.pmc-trigger .keys { display: block; margin: .55em 0 0; color: var(--pmc-dim); font: .58rem/1.5 ui-monospace, Consolas, monospace; }
/* ENTER is the send, so the buttons stand down to a quiet fallback rather than
   claiming the eye the keys line just asked for. They are kept because a plate
   with no clickable send is a plate a mouse cannot finish. */
.pmc-trigger .pmc-actions { margin-top: .6em; }
.pmc-trigger .pmc-btn { font-size: .66rem; padding: .38em .8em; }
.pmc-trigger .pmc-btn.go { background: none; color: var(--pmc-gold); border-color: var(--pmc-gold-dim); }
/* The clipped-value terms block that stood here is gone with termsBriefHtml
   (2026-08-29) — the consent sheet's own rules below render every terms block
   now, and they clip by which terms are documents rather than by a character
   count applied to all of them. */

/* ── the chat line ──
   RULED 2026-08-28: "everything I can do via the ui buttons, I have to type in
   like filling an mcp form." An act whose whole argument is one sentence should
   read as typing a sentence, so a chat-shaped act (chatShaped, in the arithmetic
   file — a prose field and nothing else required) opens THIS instead of a form.
   One line, docked over the bar, ENTER sends and ESC closes.

   It is not a second dispatch path: what leaves here goes out through the same
   dispatchEnvelope the form uses, carrying the same act name and the same field
   name off the same card. Only the chrome is different, which is the whole of
   the ruling — the grammar was never the complaint. */
.pmc-chat {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 4;
  display: flex; align-items: center; gap: .6em;
  width: 34em; max-width: calc(100vw - 24px); padding: .5em .7em;
}
.pmc-chat .who {
  flex: 0 0 auto; color: var(--pmc-gold);
  font: .62rem/1 ui-monospace, Consolas, monospace; letter-spacing: .14em;
}
.pmc-chat input {
  flex: 1 1 auto; min-width: 0; margin: 0; padding: .45em .7em;
  font: .92rem/1.4 Georgia, serif; color: var(--pmc-ink);
  background: rgba(0,0,0,.35); border: 1px solid rgba(154,161,173,.35); border-radius: 999px;
}
.pmc-chat input::placeholder { color: rgba(154,161,173,.55); font-style: italic; }
.pmc-chat input:focus { outline: none; border-color: var(--pmc-gold); }
/* the keys that work, said quietly and always — a line with no visible send
   button has to tell a reader how to send it */
.pmc-chat .keys { flex: 0 0 auto; color: var(--pmc-dim); font: .58rem/1.5 ui-monospace, Consolas, monospace; }
.pmc-chat .pmc-said { margin: 0; }

/* ── AIMING ──
   RULED 2026-08-29: the act is pressed first, and then what it is aimed at
   lights up. This is the strip that says an act is armed and offers the
   targets the answer could not place on the map. It sits where the act form
   sits, because it IS the act form for an aimable act — one question, asked
   on the map instead of in a box. */
.pmc-aim {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 4;
  display: flex; align-items: center; flex-wrap: wrap; gap: .5em;
  max-width: calc(100vw - 24px); padding: .5em .8em;
}
.pmc-aim .arm {
  flex: 0 0 auto; color: var(--pmc-gold);
  font: .66rem/1 ui-monospace, Consolas, monospace; letter-spacing: .14em;
}
.pmc-aim .tell { flex: 0 0 auto; color: var(--pmc-ink); font-size: .78rem; }
.pmc-aim .keys { flex: 0 0 auto; color: var(--pmc-dim); font: .58rem/1.5 ui-monospace, Consolas, monospace; }
/* A TARGET THE MAP COULD NOT PLACE IS STILL PRESSABLE. The nearby block is a
   budgeted field of view, so someone genuinely down can carry no coordinate on
   a given read — and an act that becomes unreachable exactly when it is needed
   is worse than a chip. Placed targets are on the painting and get no chip.
   (No backticks in this block: it is a template literal. See the warning at the
   head of COCKPIT_CSS, which this comment tripped over on its first draft.) */
.pmc-aim button {
  flex: 0 0 auto; cursor: pointer; padding: .3em .7em; border-radius: 999px;
  border: 1px solid var(--pmc-line); background: transparent;
  color: var(--pmc-ink); font: .74rem/1.3 Georgia, serif;
}
.pmc-aim button:hover, .pmc-aim button:focus-visible {
  border-color: var(--pmc-gold); background: rgba(217,168,96,.14); color: var(--pmc-gold); outline: none;
}
/* the armed seat, so the row says which act the map is now about */
.pmc-slot.armed { border-color: var(--pmc-accent); background: rgba(226,96,63,.16); }
.pmc-slot.armed .pmc-name, .pmc-slot.armed .pmc-ico { color: var(--pmc-accent); opacity: 1; }
/* the map itself says it is waiting for a target */
.pmc-aiming .wv svg { cursor: crosshair; }
/* AND THE RETICLE BREATHES, so it is found by motion on a still painting rather
   than by contrast alone — the founder could not see the first one. Reduced
   motion keeps every stroke and drops only the movement. */
.pmc-aim-ring { animation: pmc-reticle 1.15s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes pmc-reticle { 50% { opacity: .58; } }
@media (prefers-reduced-motion: reduce) { .pmc-aim-ring { animation: none; } }

/* ── THE OVERFLOW TRAY ──
   RULED 2026-08-29: "too many buttons". The acts of the room hold the row; what
   you carry everywhere folds behind this. It is a seat like any other so the
   row's arithmetic does not learn a special case, and it opens a plain list
   above itself rather than a second scrolling row. */
.pmc-slot.pmc-fold-btn { min-width: 3.4em; }
.pmc-slot.pmc-fold-btn .pmc-name { letter-spacing: .1em; }
.pmc-tray {
  position: fixed; z-index: 5; min-width: 12em; max-width: 22em;
  padding: .45em .5em; pointer-events: auto;
  display: flex; flex-direction: column; gap: .15em;
}
.pmc-tray .pmc-cap { text-align: left; margin: .1em .35em .35em; }
.pmc-tray button {
  display: flex; align-items: center; gap: .6em; width: 100%; text-align: left; cursor: pointer;
  padding: .38em .5em; border: 1px solid transparent; border-radius: 5px;
  background: transparent; color: var(--pmc-ink); font: .8rem/1.3 Georgia, serif;
}
/* THE GLYPH DOES NOT CENTRE ITSELF IN A ROW. On a seat it is drawn above the
   name and margin:0 auto is what centres it there; inherited into a flex row it
   ate the free space and shoved every label to the right edge — seen in the
   shot, three act names hard against the tray's border with a gap the width of
   the panel in front of them. Same glyph, different axis. */
.pmc-tray button .pmc-ico { margin: 0; flex: 0 0 auto; }
.pmc-tray button > span { flex: 0 0 auto; }
/* the act's own line, pushed to the far side so the names stay in one column */
.pmc-tray button small { margin-left: auto; text-align: right; }
.pmc-tray button:hover, .pmc-tray button:focus-visible {
  border-color: var(--pmc-gold); background: rgba(217,168,96,.14); color: var(--pmc-gold); outline: none;
}
.pmc-tray button[disabled] { opacity: .42; cursor: not-allowed; }
.pmc-tray button small { color: var(--pmc-dim); font: .62rem/1.4 ui-monospace, Consolas, monospace; }

/* ══ THE TWO SPACES ══
   The founder ruled the dungeon as two rooms that should FEEL different: an
   antechamber — free-roam, social, where a weapon is picked up and spectators
   stand — and a boss room where crossing the inner door joins the fight. The
   difference is carried by the palette and the ground wash, not by new furniture,
   so every panel below is the same panel in both and only its temperature moves.
   These are the two tokens that do it; everything else reads them.

   The antechamber is the cockpit's own gold over ink — hearth-side. The arena
   pulls the accent toward ember and lays a low red wash along the floor of the
   screen, so a reader knows which room they are in before they read a word. */
.pmc[data-space="antechamber"] { --pmc-gold:#d9a860; --pmc-accent:#e0b25c; }
.pmc[data-space="arena"] { --pmc-gold:#e0894e; --pmc-accent:#e2603f; }
/* The ground each room stands on. One element, two paintings — and it has to be
   readable in the first half-second rather than on comparison, which is what the
   ruling asks for: the antechamber is a hearth glow rising off the floor, the
   arena is that glow gone to ember PLUS a vignette closing in from every edge, so
   the boss room feels like a room with walls and the antechamber does not. */
.pmc::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
.pmc[data-space="antechamber"]::after {
  background:
    radial-gradient(120% 62% at 50% 118%, rgba(224,178,92,.16), transparent 70%);
}
.pmc[data-space="arena"]::after {
  background:
    radial-gradient(120% 70% at 50% 118%, rgba(214,74,44,.24), transparent 68%),
    radial-gradient(88% 76% at 50% 44%, transparent 42%, rgba(6,4,6,.62) 100%);
}

/* ══ THE INITIATIVE WHEEL ══
   The turn order, rendered — hostiles hold real slots, the current turn is lit,
   the downed are visibly skipped rather than removed, and a late joiner wears the
   round they came in on. It sits top-centre: the one thing every player at the
   party needs to read at a glance is whose turn it is. */
.pmc-wheel { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); max-width: calc(100vw - 28px); padding: .5em .7em .6em; }
.pmc-wheel-cap { display: flex; align-items: baseline; gap: .8em; justify-content: center; margin-bottom: .5em; }
.pmc-wheel-cap b { color: var(--pmc-gold); font: .62rem/1 ui-monospace, Consolas, monospace; letter-spacing: .18em; font-weight: normal; }
.pmc-wheel-cap span { color: var(--pmc-dim); font-size: .66rem; }
/* An ORDERED list, because initiative order is the whole meaning of it — but the
   markers are painted over the seats by the browser, so they are turned off and
   the order is carried by position and by the ol itself for a screen reader. */
.pmc-wheel-row {
  display: flex; align-items: flex-end; gap: .35em; overflow-x: auto; scrollbar-width: thin;
  padding: 0 0 2px; margin: 0; list-style: none;
}
.pmc-wheel-row > li::marker { content: none; }
.pmc-turn {
  flex: 0 0 auto; width: 4.6em; text-align: center; padding: .4em .25em .35em;
  border: 1px solid transparent; border-radius: 7px; position: relative;
}
.pmc-turn .pip {
  width: 2.1em; height: 2.1em; margin: 0 auto .3em; border-radius: 50%;
  background: #1b2230; border: 2px solid rgba(154,161,173,.35); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  color: var(--pmc-dim); font: .82rem/1 ui-monospace, Consolas, monospace;
}
.pmc-turn .pip img { width: 100%; height: 100%; object-fit: cover; }
/* same stack as the dock's face: the letter underneath, the picture over it */
.pmc-turn .pip .pmc-mono { position: absolute; inset: 0; display: grid; place-items: center; }
.pmc-turn .pip { position: relative; }
.pmc-turn .nm { display: block; color: var(--pmc-ink); font-size: .64rem; line-height: 1.25; overflow-wrap: anywhere; }
.pmc-turn .init { display: block; color: var(--pmc-dim); font: .58rem/1.4 ui-monospace, Consolas, monospace; }
.pmc-turn .hp { display: block; height: 3px; margin: .25em .2em 0; background: rgba(154,161,173,.22); border-radius: 2px; overflow: hidden; }
.pmc-turn .hp i { display: block; height: 100%; background: var(--pmc-accent); }
/* a hostile is not one of us: square shoulders, ember ring, no monogram circle */
.pmc-turn.is-creature .pip { border-radius: 5px; border-color: rgba(226,96,63,.55); color: #e2603f; }
/* the current turn is the loudest thing on the screen after the map */
.pmc-turn.is-current { border-color: var(--pmc-gold); background: rgba(217,168,96,.12); }
.pmc-turn.is-current .pip { border-color: var(--pmc-gold); box-shadow: 0 0 12px rgba(217,168,96,.55); }
.pmc-turn.is-current .nm { color: var(--pmc-gold); }
/* YOU, so a player can find themselves on a crowded wheel */
.pmc-turn.is-you .nm::after { content: " (you)"; color: var(--pmc-dim); }
/* DOWNED-NOT-DEAD. Greyed and struck, and still ON the wheel — being skipped is
   a thing that must be watchable, and a row that vanished would read as death. */
.pmc-turn.is-down { opacity: .45; }
.pmc-turn.is-down .pip { border-style: dashed; }
.pmc-turn.is-down .nm { text-decoration: line-through; }
.pmc-turn.is-down .init::after { content: " · down"; color: var(--pmc-accent); }
.pmc-turn .late {
  position: absolute; top: -.2em; right: -.1em; font: .52rem/1 ui-monospace, Consolas, monospace;
  color: #0d1426; background: var(--pmc-gold); border-radius: 999px; padding: .18em .38em;
}

/* ══ THE TURN GATE ══
   One line above the bar saying why the slots are cold. The slots stay, with
   their cards — the grammar stays legible; only the taking is withheld. */
.pmc-gate {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 4;
  padding: .4em .9em; border-radius: 999px; pointer-events: none;
  background: rgba(14,18,26,.94); border: 1px solid var(--pmc-line);
  color: var(--pmc-gold); font-size: .76rem; white-space: nowrap;
  max-width: calc(100vw - 24px); overflow: hidden; text-overflow: ellipsis;
}
/* Gated reads as cold, not as absent — and it keeps its hover, because the card
   behind it is the whole reason the slot was left standing. */
.pmc-slot.gated { opacity: .5; cursor: not-allowed; }
.pmc-slot.gated .pmc-name { color: var(--pmc-dim); }
.pmc-slot.gated:hover, .pmc-slot.gated:focus-visible { opacity: .72; border-color: var(--pmc-line); box-shadow: none; }

/* ══ THE THROW ══
   A die landing, centre-screen, big enough to be the moment it is. It leaves on
   its own; nothing waits for a reader to dismiss a result they already saw. */
.pmc-throw-layer { z-index: 7100; }
/* Raised well clear of the act form, which opens from the bottom and reaches the
   middle of the screen — at 42% the caption landed straight across the form's own
   blurb and neither could be read. */
.pmc-throw {
  position: fixed; left: 50%; top: 27%; transform: translate(-50%, -50%); z-index: 6;
  display: flex; gap: 1.1em; align-items: flex-start; pointer-events: none;
}
.pmc-die { text-align: center; animation: pmc-land .5s cubic-bezier(.2,1.5,.4,1) both; }
/* The caption carries its own ground. It can land over the painting, over a
   panel, or over a resident's name — a number nobody can read is not a moment. */
.pmc-die .sum, .pmc-die .whose {
  background: rgba(10,13,20,.92); border-radius: 5px; padding: .15em .5em;
  display: inline-block; max-width: 16em;
}
.pmc-die .whose { margin-top: .4em; }
.pmc-die .face {
  width: 3.4em; height: 3.4em; display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--pmc-gold); border-radius: 12px; background: rgba(14,18,26,.95);
  color: var(--pmc-ink); font: 1.9rem/1 Georgia, serif;
  box-shadow: 0 6px 26px rgba(0,0,0,.6);
}
.pmc-die .sum { display: block; margin-top: .35em; color: var(--pmc-dim); font: .64rem/1.4 ui-monospace, Consolas, monospace; }
.pmc-die .whose { display: block; color: var(--pmc-gold); font-size: .62rem; letter-spacing: .1em; }
/* A CRIT IS THE DOOR'S WORD, and it is dressed as the loud thing it is. At-max
   with no ruling gets a quieter mark, because the number is remarkable even when
   the rules have not said it means anything. */
.pmc-die.is-crit .face { border-color: #ffd98a; color: #ffe6b0; box-shadow: 0 0 34px rgba(255,217,138,.6); animation: pmc-crit 1.1s ease-in-out infinite; }
.pmc-die.is-crit .sum { color: #ffd98a; }
.pmc-die.at-max .face { border-color: var(--pmc-accent); }
@keyframes pmc-land {
  0% { opacity: 0; transform: translateY(-38px) rotate(-26deg) scale(.7); }
  70% { opacity: 1; transform: translateY(4px) rotate(4deg) scale(1.06); }
  100% { opacity: 1; transform: none; }
}
@keyframes pmc-crit { 50% { box-shadow: 0 0 52px rgba(255,217,138,.9); } }
@media (prefers-reduced-motion: reduce) {
  .pmc-die { animation: none; }
  .pmc-die.is-crit .face { animation: none; }
}

/* ── the standpoint plate, ON HOVER, OVER THE DOCK ──
   RULED 2026-08-28, at the live rehearsal: "let's make the card appear ON HOVER
   when you hover over the act as bottom bar."

   IT SUPERSEDES an always-on card pinned at left 14px / top 14px, kept named here
   because a reversal that hides what it reversed reads as somebody's regression.
   That card was the second element caught sitting on the site's own left rail —
   the first was the bar, fenced at placeBar; the fix for this one was the same
   fence, and it held for parcels and failed in the open world, where the map svg
   is full-bleed and its rect's left edge IS the viewport's. There was no third
   fence worth writing. Anchored to the dock the question does not arise: the
   plate hangs off a box that is already inside the painting, exactly as the
   faces' own name boxes do, and no page furniture can be underneath it.

   Its clearance is measured against those name boxes rather than guessed: a face
   box sits at 100% + .6em and stands about two ems tall, so the plate starts
   above the tallest of them and hovering a FACE shows both without a collision. */
.pmc-here {
  position: absolute; left: 0; bottom: calc(100% + 3.2em);
  width: max-content; max-width: min(30em, 60vw); padding: .55em .8em;
  opacity: 0; transition: opacity .12s; pointer-events: none;
}
.pmc-roster:hover .pmc-here, .pmc-roster:focus-within .pmc-here { opacity: 1; }
/* (the one-hover-one-card :has() stand-down that stood here is SUPERSEDED by
   the fighter plate below, 2026-08-29: the nameplate is deleted, so hovering a
   face has exactly one card again — the plate itself, carrying that fighter.) */

/* ── LATELY IS THE FEED (2026-08-29, the founder's ruling) ──
   "the action log can just replace the Lately section in the side rail instead
   of needing a whole separate panel ... tweak the 'lately' section so it's a
   newest-at-the-bottom chat-like feed, that you can scroll UP to see older
   things (and we should use this same thing for the log in combat)"

   ⚑ EVERY RULE BELOW IS CSS ON THE VIEWER'S OWN SECTION, and that is the whole
   design. The rail belongs to the viewer: it renders the Lately rows, it hides
   the section when the record is empty, and it rewrites that list on every
   re-fold. So this reshapes the section rather than replacing it — the section
   becomes the scrollport, the viewer's list is flipped to column-reverse so its
   newest-first DOM reads oldest-at-top, and the cockpit's own list is one
   element appended after it. Nothing of the viewer's is written: not its
   innerHTML, not its hidden attribute, not its state. The whole reshape is
   undone by removing one attribute from <html>, which is what destroy() does.

   The attribute is data-pmc-feed, the same shape as data-pmc-dock beside it —
   an attribute a viewer that booted after us can read, and an event
   (pm:cockpit-feed) for one that booted before. Neither is load-bearing at this
   pin; both are the seam, kept for the same reason the dock's is.

   THE COLOURS ARE THE VIEWER'S OWN VARIABLES, read off .wv, because these rules
   land inside its rail and a second palette there would be a patch of another
   page. Everywhere else in this file the cockpit is deliberately its own dark
   chrome over the painting; this is the one place it is a guest. */
html[data-pmc-feed] .wv .wv-activity {
  display: flex !important; flex-direction: column;
  max-height: min(46vh, 460px); overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scroll-behavior: auto;
}
/* ⚑ NOTHING IN A SCROLLPORT MAY SHRINK, and this line is the whole of "you can
   scroll UP to see older things". Found in the shot, 2026-08-29: the oldest two
   Lately rows were painted ABOVE the section's own top edge and no amount of
   scrolling could reach them.

   The cause is the flip meeting the default. A flex item shrinks by default, so
   the moment the section hit its max-height the viewer's list was squeezed below
   its content size — and a column-reverse box that is too short overflows out of
   its START edge, which is the TOP. Overflow above a scrollport's top is
   unreachable by definition: the rows were not merely off-screen, they were
   gone, and the section looked like a feed with a short memory rather than a
   broken one.

   Every child, not just the list: the heading, the absences the viewer names,
   the cockpit's own list and the new-below pill are all in the same box and all
   inherit the same default. */
html[data-pmc-feed] .wv .wv-activity > * { flex: 0 0 auto; }
/* The heading stays put while the record scrolls under it — a feed you scroll
   up through must keep saying what it is. */
/* ⚑ THE SECTION'S OWN TOP PADDING BELONGS TO THE HEADING NOW. Sticky pins at the
   CONTENT box, so the viewer's 14px of padding above it stayed transparent and
   the row scrolling underneath printed through that strip — a line of the record
   sliced in half above the word LATELY, which the shot caught and no measurement
   would have. Moving the padding into the heading makes the heading the top of
   the scrollport, and there is nowhere left for anything to show through. */
html[data-pmc-feed] .wv .wv-activity { padding-top: 0; }
html[data-pmc-feed] .wv .wv-activity > h2 {
  position: sticky; top: 0; z-index: 2;
  margin: 0 0 8px; padding: 14px 0 6px; background: var(--panel);
}
/* THE FLIP ITSELF. recentActivity sorts newest-first and renderActivity writes
   that order into the DOM; column-reverse draws it oldest-at-top without the
   viewer's list being touched. One CSS line is the whole of "newest at the
   bottom" for the half of the feed the viewer owns. */
html[data-pmc-feed] .wv .wv-acts { flex-direction: column-reverse; }
/* the cockpit's half: the fight and what is being said, under the record */
.pmc-feed {
  list-style: none; margin: 0; padding: 0; flex: 0 0 auto;
  display: flex; flex-direction: column; gap: 7px;
}
.pmc-feed:not(:empty) { margin-top: 10px; padding-top: 9px; border-top: 1px dotted var(--line, rgba(154,161,173,.35)); }
.pmc-fline {
  font: .78rem/1.45 Georgia, "Times New Roman", serif;
  color: var(--paper, #e8e0cf); margin: 0;
}
.pmc-fline .who { font-family: var(--mono, ui-monospace, Consolas, monospace); font-size: .68rem;
  letter-spacing: .06em; color: var(--dim, #9a9280); margin-right: .45em; }
/* A SAY READS AS SPEECH AND A BEAT READS AS RECORD, because they are different
   kinds of sentence and a feed that painted them alike would make the fight
   look like chatter. */
.pmc-fline.is-say { color: var(--paper, #e8e0cf); }
.pmc-fline.is-say .said { font-style: italic; }
.pmc-fline.is-hit { color: var(--amber, #e8c56a); }
.pmc-fline.is-miss { color: var(--dim, #9a9280); }
.pmc-fline.is-down { color: var(--you, #e0654a); }
.pmc-fline.is-lift { color: var(--green, #84c98f); }
.pmc-fline.is-join { color: var(--blue, #7ba7e0); }
.pmc-fline.is-loot { color: var(--stamp-violet, #aa8fd8); }
.pmc-fline.is-wipe { color: var(--you, #e0654a); font-weight: 600; }
/* the round rule: a divider that happens to carry a number, not a line of prose */
.pmc-fline.is-turn {
  color: var(--dim, #9a9280); font-family: var(--mono, ui-monospace, Consolas, monospace);
  font-size: .62rem; letter-spacing: .18em; text-transform: uppercase;
  text-align: center; margin: 4px 0 1px;
}
/* WHAT WENT BY UNREAD, said rather than swallowed — the rail's own standing
   rule for a record it could not read, applied to the turns between two polls
   that this page has no door to see. */
.pmc-fline.is-unseen {
  color: var(--dim, #9a9280); font-size: .68rem; font-style: italic; opacity: .8;
}
/* The reader is not at the bottom, so the feed is holding still — and it has to
   say so, or a held feed and a dead feed look exactly alike. Clicking it is the
   way back down. */
.pmc-feed-new {
  position: sticky; bottom: 0; align-self: center; z-index: 3;
  margin-top: 6px; padding: .2em .7em; border-radius: 999px; cursor: pointer;
  background: var(--panel2, #20262f); border: 1px solid var(--amber-dark, #b8964a);
  color: var(--amber, #e8c56a); font: .66rem/1.6 var(--mono, ui-monospace, Consolas, monospace);
}
.pmc-feed-new[hidden] { display: none; }

.pmc-here .who { color: var(--pmc-gold); font-size: .95rem; display: flex; align-items: center; gap: .45em; }
.pmc-here .spine { color: var(--pmc-dim); font-size: .78rem; margin-top: .25em; line-height: 1.45; }
/* ── the fighter's own state, on the plate (2026-08-29) ──
   A NARROWER PLATE THAN THE RECITATION IT REPLACES. The old content was a
   containment chain and wanted 30em; four short rows about one person want a
   card, and a card the width of a paragraph reads as a paragraph. */
.pmc-here { min-width: 15em; max-width: min(24em, 60vw); }
/* the state words that are one word: down, acting now, yourself. They earn a
   pill rather than a sentence because a reader is scanning for them. */
.pmc-here .tag {
  font: .6rem/1 ui-monospace, Consolas, monospace; letter-spacing: .1em; text-transform: uppercase;
  border: 1px solid currentColor; border-radius: 999px; padding: .25em .5em; opacity: .85;
}
.pmc-here .tag.you { color: var(--pmc-dim); }
.pmc-here .tag.down, .pmc-here .tag.cold { color: var(--pmc-accent); }
.pmc-here .tag.turn { color: var(--pmc-live); }
/* THE HP BAR WITH THE NUMBERS ON IT — the founder's own words. The numbers ride
   INSIDE the rail, over both of its grounds, which is why they carry a dark
   halo: a flat colour is unreadable over one side or the other. Same shape as
   the rail drawn over the figure on the map, so the two read as one language. */
.pmc-hp {
  position: relative; height: 1.25em; margin-top: .45em; border-radius: 999px;
  background: rgba(0,0,0,.55); border: 1px solid var(--pmc-line); overflow: hidden;
}
.pmc-hp .fill { position: absolute; inset: 0 auto 0 0; background: var(--pmc-accent); opacity: .85; }
.pmc-hp .num {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font: .68rem/1 ui-monospace, Consolas, monospace; color: #fdf1ea;
  text-shadow: 0 0 3px #0d1015, 0 0 3px #0d1015, 0 1px 2px #0d1015;
}
.pmc-hp.out .fill { display: none; }
/* what is in their hand. The glyph is the same 24-box every seat's icon is
   drawn in, so the plate and the row speak one visual language. */
.pmc-here .kit {
  display: flex; align-items: center; gap: .4em; margin-top: .45em;
  font: .78rem/1.4 Georgia, serif; color: var(--pmc-ink);
}
.pmc-here .kit b { color: var(--pmc-gold); font-weight: normal; font-size: .92em; }
.pmc-here .kit.none { color: var(--pmc-dim); }
.pmc-here .kit.none .pmc-ico { opacity: .45; }
/* ⚑ THE GLYPH IS RE-DRESSED FOR THIS ROW, and the shot is why. The base icon
   rule is written for a SEAT, where the glyph sits above its word: auto side
   margins centre it in the seat's column, and 1.15em of a seat's font is a
   readable mark. Inherited into a flex ROW, those auto margins pushed the glyph
   into the middle of the plate and shoved the thing's name against the
   right-hand edge, at about nine pixels across — a mark that read as a speck.
   Both facts were invisible to every assertion and obvious in the crop. */
.pmc-here .kit .pmc-ico {
  margin: 0; flex: 0 0 auto; width: 1.5em; height: 1.5em;
  color: var(--pmc-gold); opacity: 1;
}

@media (max-width: 720px) {
  .pmc-roster { padding: .25em .4em; gap: .25em; }
  .pmc-face { width: 2em; height: 2em; }
  .pmc-here { display: none; }
  .pmc-barrow { bottom: 10px; gap: .35em; }
  .pmc-bar { gap: .3em; }
  .pmc-slot { min-width: 4.9em; padding: .85em .45em .45em; font-size: .86rem; }
  .pmc-card { width: 18em; }
}
`;

let cssInstalled = false;
function installCss(doc) {
  // Injected at MOUNT, never at page load: outside portal ground this file adds
  // no rule to the document at all, which is the founder's scope ruling kept
  // literally rather than only visually.
  if (cssInstalled) return;
  const el = doc.createElement("style");
  el.id = "pmc-style";
  el.textContent = COCKPIT_CSS;
  doc.head.appendChild(el);
  cssInstalled = true;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Mount the cockpit.
 *
 * @param {object} o
 * @param {Document} o.document
 * @param {Element} o.host          where the overlay is appended
 * @param {SVGElement|null} o.svg   the map's svg, for the token; null = no token
 * @param {object} o.answer         the apex door's answer
 * @param {object|null} o.me        `GET /api/me`
 * @param {object|null} o.grid      `gridFrom(skeleton)`
 * @param {(envelope:object)=>Promise<{ok:boolean,status:number,body:any}>} o.dispatch
 * @param {(()=>Promise<object>)|null} o.refresh  re-read the door after an act
 * @returns {{destroy:()=>void, update:(answer:object)=>void}|null}
 */
export function mountCockpit(o) {
  const doc = o.document;
  if (!cockpitShows(o.answer)) return null;
  installCss(doc);

  const state = {
    answer: o.answer,
    acting: null,      // handle | HUMAN_ACTOR
    open: null,        // the action whose form is open
    said: null,        // the last thing the door said back
    voices: [],        // recent speech, from the conversations door
    aiming: null,      // { action, kind, field } — armed, waiting for a target
    act: null,         // { action, args, label } — a target taken, waiting for confirm
    tray: false,       // is the overflow tray open
    feed: [],          // the rail's own half of Lately — beats and says, newest LAST
    profiles: {},      // handle -> the profile bubble off /residents/{handle}, for the dock's faces
    encSnap: null,     // the encounter block the last delta was derived against
    beatSeq: null,     // highest beat seq drawn FROM A TAIL; null = no tail has ever been seen
    lastTurn: undefined, // the wheel's turn as of the last read; undefined = never read one
    hover: null,       // the id of the cockpit figure under the pointer, if any
    peek: null,        // the dock face being looked at — whose state the plate shows
  };

  const root = doc.createElement("div");
  root.className = "pmc";
  root.setAttribute("data-pmc", "");
  o.host.appendChild(root);

  // A SEPARATE LAYER FOR THE THROW, and it is not decoration — `paint()` replaces
  // root.innerHTML wholesale, so a die appended into root is wiped by the very
  // repaint that follows the act which threw it. Measured: every throw rendered
  // and vanished inside the same tick, and the QA twin read an empty list while
  // the code looked right. It lives beside root, outside that churn.
  const throwLayer = doc.createElement("div");
  throwLayer.className = "pmc pmc-throw-layer";
  throwLayer.setAttribute("data-pmc-throws", "");
  o.host.appendChild(throwLayer);

  // THE LAYER FOLLOWS THE LIVING SVG (found live, 2026-08-28 rehearsal night).
  // The viewer REBUILDS its svg when the view changes — entering a portal, a
  // re-render — so a layer appended once at mount dies quietly with the svg it
  // was appended to, and every token, ring and dropped thing vanishes with it
  // while the bar (body-hosted) stands as if nothing happened. That is exactly
  // what the founder saw: a working bar over a map with nothing on it. The
  // layer is therefore re-acquired at draw time whenever it is no longer
  // CONNECTED, through `o.svgOf` (the caller's own current-svg lookup) with
  // the mount-time `o.svg` as the fallback for harnesses that pass a fixture.
  let tokenLayer = null;
  function ensureTokenLayer() {
    if (tokenLayer?.isConnected) return tokenLayer;
    const svg = o.svgOf?.() ?? o.svg;
    if (!svg || !svg.isConnected) return (tokenLayer = null);
    tokenLayer = doc.createElementNS(NS, "g");
    tokenLayer.setAttribute("id", "pmc-token-layer");
    tokenLayer.setAttribute("pointer-events", "none");
    svg.appendChild(tokenLayer);
    return tokenLayer;
  }
  ensureTokenLayer();
  // Every geometry read goes through the LIVING svg for the same reason: a
  // detached svg still answers getBoundingClientRect (with zeros) and viewBox
  // (with stale numbers), so a fence or a token sized off the mount-time
  // reference would be measured against a ghost.
  const liveSvg = () => (tokenLayer?.isConnected ? tokenLayer.ownerSVGElement : null) ?? o.svgOf?.() ?? o.svg;
  /**
   * WHICH PROJECTION THIS PAINTING SPEAKS (2026-08-29, found live in the
   * founder's vault). A room ground has its own origin and scale — different
   * from the world painting's skeleton grid — and until tonight the cockpit
   * drew every figure through the world grid onto whichever svg was alive: on
   * the world painting that was right, inside a room it put the cake's ring at
   * the bottom edge of a painting whose own wall was three metres away. The
   * viewer now stamps its projection on the svg it paints
   * (data-wv-origin-x/y, data-wv-m-per-px — world repo, the fourth handshake
   * word, and this one is data). The stamped shape IS the grid shape
   * ({originPx, mPerPx}), so worldToPx/pxToWorld take it unchanged; a painting
   * with no stamp is the world painting and the skeleton grid stands exactly
   * as before.
   */
  function gridNow() {
    const svg = liveSvg();
    const ds = svg?.dataset ?? {};
    const ox = Number(ds.wvOriginX), oy = Number(ds.wvOriginY), m = Number(ds.wvMPerPx);
    if (Number.isFinite(ox) && Number.isFinite(oy) && Number.isFinite(m) && m > 0) {
      return { originPx: { x: ox, y: oy }, mPerPx: m };
    }
    return o.grid;
  }

  // ── the roster ────────────────────────────────────────────────────────────
  function faces() {
    return actorsFor(state.answer, o.me, { acting: state.acting });
  }

  /**
   * WHOSE STANDING THE KEY IS ORIENTED FROM — the seat, as opposed to who acts.
   *
   * ⚑ THE ACT SIDE OF THE SEAT LAW, and it was still using the old rule a day
   * after the read side was fixed. This passed `orientingHandle(o.me)`: the
   * FIRST handle on the key, which was written for a key holding one resident.
   * The founder's holds six and the office happens to order the Illuminator
   * first, so every act — the human's included — went out naming her, whoever
   * the dock had selected. The comment beside it said the point out loud ("so
   * the bar cannot be drawn for one standpoint and act from another") while the
   * line under it did exactly that.
   *
   * Caught the moment the human could fight at all: the door refused a human's
   * strike in the candle vault with "not afforded where you stand", and it was
   * right — the act had oriented from the Illuminator's looking-room, which
   * grants no arena verbs. The office fix was sound; the envelope was lying
   * about where the swing came from.
   *
   * A RESIDENT SELECTION IS ITS OWN SEAT. The human's is the seat they are
   * BORROWING, which is the whole of the human seam here — the human face
   * deliberately speaks no selection (it is this cockpit's own grammar, not the
   * viewer's), so acting as yourself keeps whichever resident's place you were
   * already standing in. `state.seat` remembers that across the switch; the
   * first handle survives only as the fallback for a mount that has never had a
   * selection at all.
   */
  function seat() {
    if (state.acting && state.acting !== HUMAN_ACTOR) return state.acting;
    return state.seat ?? orientingHandle(o.me);
  }

  /**
   * Who the bar is serving when nobody has chosen yet.
   *
   * The door's `stance` decides it, not the roster's order: where the record says
   * a HUMAN is the one embodied, the map is already showing that person standing
   * there, and a bar quietly serving one of their residents would contradict the
   * figure on the map. Resolved before the first paint rather than inside the
   * roster's draw — the standpoint plate is painted first and read `null` for its
   * whole first frame, which is what "a spectator · inside a-hall/the-lit-door"
   * in the first QA shot was.
   */
  function resolveActing() {
    if (state.acting) return;
    const list = faces();
    const human = list.find((f) => f.kind === "human" && f.allowed);
    if (human && state.answer?.standpoint?.stance === "embodied-human") { state.acting = HUMAN_ACTOR; return; }
    const first = list.find((f) => f.kind === "resident" && f.allowed) ?? null;
    state.acting = first ? first.handle : (human ? HUMAN_ACTOR : null);
    if (state.acting && state.acting !== HUMAN_ACTOR) state.seat = state.acting;
  }

  function drawRoster() {
    const list = faces();
    const residents = list.filter((f) => f.kind === "resident");
    const humans = list.filter((f) => f.kind === "human");
    const face = (f) => {
      const id = f.kind === "human" ? HUMAN_ACTOR : f.handle;
      const on = state.acting === id;
      // EVERY FACE IS A PICTURE NOW (founder, 2026-08-29: "there needs to be
      // profiles of tokens loaded into the act as bar"). The human's token and
      // a resident's own avatar come through ONE call — faceImageFor — so the
      // dock cannot resolve the two by different rules and end up with a photo
      // beside a letter for no reason a reader could name. The initial-letter
      // tile is still what a face with no picture gets, which is the state
      // every resident face was in until tonight and is nobody's failure.
      //
      // ⚑ AND A BROKEN PICTURE FALLS BACK TO THE LETTER. The avatar url is
      // derived from a basename the door reports and a repo path; a resident
      // whose file has since been renamed would otherwise leave a torn-image
      // glyph in the dock forever. So the letter is ALWAYS drawn, underneath,
      // and the picture lies over it — an image that fails to load is removed
      // (see the delegated error listener below) and the tile is simply
      // revealed. No fetch, no state, and no second appearance to design.
      const token = faceImageFor(f, state.profiles);
      const mono = esc(token?.monogram ?? (f.label ?? "?").slice(0, 1).toUpperCase());
      const inner = token?.src
        ? `<span class="pmc-mono">${mono}</span><img src="${esc(token.src)}" alt="" loading="lazy">`
        : mono;
      // ⚑ THE SMALL NAME BOX IS GONE (founder, 2026-08-29): the dock's hover
      // "should show the orange-rimmed LARGER card, not the small nameplate."
      // Both used to appear at once on a face hover — the box from the face and
      // the plate from the dock — which is the doubling he was looking at.
      //
      // NOTHING THE BOX CARRIED IS ORPHANED. It held three things and the plate
      // now holds all three: the label (its heading), the door's sentence about
      // why a human may stand here (`humanWords`, in the stat row), and the
      // REASON a refused face is refused — the last of which was the important
      // one, because "a greyed circle that will not say why is the surface
      // refusing to explain the law it is enforcing".
      //
      // ⚑ AND A REFUSED FACE IS `aria-disabled`, NOT `disabled`, which is what
      // makes that possible: a truly disabled button fires no pointer events, so
      // a face nobody can hover is a face that cannot explain itself. Exactly the
      // trade the gated SEATS made for exactly the same reason — see slotHtml.
      // The press is refused in onClick instead.
      const label = f.allowed
        ? (f.kind === "human" ? `${f.label} · yourself — ${humanWords(f)}` : f.label)
        : `${f.label} — ${f.reason ?? "not here"}`;
      return `<button type="button" class="pmc-face${f.allowed ? "" : " refused"}" data-actor="${esc(id)}"
        aria-pressed="${on}" aria-disabled="${!f.allowed}"
        aria-label="${esc(label)}">${inner}</button>`;
    };
    // DOCKED, not floating (2026-08-28): the roster is the bar's leftmost cell —
    // who-acts beside what-they-do. The law line rides as the dock's own title
    // now that a horizontal strip has no room for a paragraph.
    // The standpoint plate hangs off THIS box (2026-08-28 ruling) — a hover
    // reveal on the dock (the faces have no name boxes of their own any more;
    // see "THE SMALL NAME BOX IS GONE" above).
    // NO `title` HERE ANY MORE. It was a THIRD card on the same hover: the
    // browser's own tooltip, drawn on its own clock over whichever of ours the
    // reader was already reading. The line it carried is law worth keeping, so
    // it moved onto the standpoint plate rather than being deleted.
    return `<div class="pmc-plate pmc-roster pmc-dock" role="group" aria-label="act as">
      <div class="pmc-cap">ACT AS</div>
      ${drawHere()}
      ${residents.map(face).join("")}
      ${humans.length ? `<div class="pmc-rule"></div>${humans.map(face).join("")}` : ""}
    </div>`;
  }

  // ── the bar ───────────────────────────────────────────────────────────────
  /** The card's CONTENTS. The `.pmc-card` box itself is a single host element in
   *  the overlay, filled on hover — see showCard. */
  function cardHtml(card, { why = null } = {}) {
    if (!card) return "";
    // WHY THIS SEAT IS COLD, first, above everything the act would cost if it
    // were warm. A reader hovering a greyed seat has exactly one question and
    // the numbers are not the answer to it. The sentence is the door's where
    // the clock refused, and the ruling's where the room holds nothing this act
    // may be aimed at (`narrowAim`) — never written here either way.
    const cold = why ? `<p class="pmc-row pmc-why">${esc(why)}</p>` : "";
    // ⚑ THE CARD LEADS WITH THE NUMBERS NOW (founder, 2026-08-29: "the 'terms'
    // in the hover and click for the actions is NOT helpful to a human … bare
    // fields … re-write to be concise, and just give info like it would in a
    // game, not a debug panel").
    //
    // IT SUPERSEDES a card that opened with the blurb and then printed `fields`,
    // `dials`, `reached you` and every term key as labelled rows — kept named
    // here rather than silently replaced, because the rows were not decoration:
    // each one was answering a real question about the grammar, and a reader who
    // wants them should be able to tell a deliberate move from a regression.
    //
    // NOTHING IS DROPPED. Every row that led the card is still rendered, on the
    // act's own panel, behind one disclosure — see fineHtml below and the note
    // at the end of this function for why it moved off the card rather than
    // collapsing on it. What changed is the ORDER, which is the whole of the
    // ruling: a player mid-fight reads the throw and the number to beat, and a
    // caller learning the grammar opens the fine print.
    const speak = dialSpeak(card, { weapon: heldWeapon() });
    const line = speak
      ? `<p class="pmc-row pmc-speak"><b>${esc(card.action.toUpperCase())}</b> ${esc(speak)}</p>`
      // AND NOT AN EMPTY CAPTION. "if a dial is missing, say nothing rather
      // than showing a bare field name" — an act whose class states no dials
      // has no costs to state, and a row saying so is the debug panel again.
      : "";
    const blurb = card.blurb
      ? `<p class="pmc-blurb">“${esc(card.blurb)}”</p>`
      : `<p class="pmc-blurb none">the class mark that defines this act carries no blurb</p>`;
    // THE WEAPON'S OWN WORDS, where the record carries them. `says` comes off
    // the held grant — the lighter's is "a flame that has never once gone out
    // on the way over" — and it is the one line on this card with a voice in
    // it: the dials are arithmetic and the blurb is the class speaking about
    // acts in general, while this is the thing in your hand speaking about
    // itself. Quoted, like every other piece of the record's prose here, and
    // omitted entirely where the record kept none.
    const w = heldWeapon();
    const voice = w?.says && w.for === card.action
      ? `<p class="pmc-blurb pmc-voice-line">“${esc(w.says)}”<span> — ${esc(w.label)}</span></p>`
      : "";
    // WHERE THE TERMS WENT, and why the hover no longer waits on a read. The
    // bare standpoint answer carries no terms; the act's SHADOW does —
    // `read: <action>` returns the act's full card with the terms that would
    // bind it and performs nothing ("A read never performs", the apex's own
    // law). The card used to print them, and the night before this it printed
    // them clipped after the founder called the full text unhelpful. Now it
    // prints none of them and the act's own panel prints them all: the shadow
    // read is still warmed on hover (`askTerms`, from showCard) so the panel
    // opens with them already in hand, and the delivery happens at the door
    // where the act binds rather than on a tooltip beside it.
    // ⚑ AND THE FINE PRINT IS NOT PUT BEHIND A DISCLOSURE *HERE*, which was the
    // first shape of this and would have been unpressable. `.pmc-card` is
    // `pointer-events: none` on purpose — a 24em card hangs across four of its
    // neighbours and with a pointer on it the hover never reaches the seat
    // underneath (the card's own note, and the QA shot that caught it). A
    // <details> inside a surface that takes no clicks is law behind a control
    // nobody can press, which is worse than the dump it replaced.
    //
    // So the split is by GESTURE rather than by disclosure. A hover is a
    // glance and gets the glance: what this act throws, and the one sentence
    // saying what it is. The fine print lives on the seat's own panel, which
    // is a surface a hand has already committed to and can actually open — see
    // fineHtml, called from formHtml. The terms still arrive before the act
    // binds, at the door where it binds.
    //
    // ⚑ AND THE CARD'S LAST LINE, WHICH TOLD THE READER TO PRESS FOR THE TERMS,
    // IS DELETED (founder, 2026-08-29). It was an instruction to do the thing a
    // reader was already doing, printed under every seat on every hover — and
    // the sentence is deliberately not quoted here, because the falsifier for
    // this asserts it appears nowhere in the file and a comment naming it would
    // be prose that reads as the rule. The terms do not
    // need announcing, because they do not depend on being announced: they
    // arrive at the press whether or not the hover mentioned them. The
    // consent-at-the-door law belongs to the press, not to the tooltip.
    // Deleted rather than reworded; there is nothing for a replacement sentence
    // to be about. A REFUSED seat still explains itself, which is a different
    // sentence answering a question the reader actually has.
    return `${cold}${line}${blurb}${voice}${why ? `<p class="pmc-from">the seat lights when it can be taken</p>` : ""}`;
  }

  /**
   * The rows the card used to lead with, on the surface that can be pressed.
   *
   * Everything here was on the face of the hover card until 2026-08-29 and none
   * of it is gone — the grammar (what the act takes, what it costs, how it
   * reached you, who defines it) and the terms that would bind it, one press
   * away on the act's own panel. Closed by default, because the ruling is that
   * a player mid-fight should not have to read past it.
   */
  function fineHtml(card) {
    if (!card) return "";
    const fields = card.fields.length
      ? `<p class="pmc-row"><b>fields</b> ${card.fields.map((f) => esc(f.name) + (f.required ? "*" : "")).join(" · ")}</p>`
      : `<p class="pmc-row"><b>fields</b> none — this act takes no arguments</p>`;
    const dials = card.dials
      ? `<p class="pmc-row"><b>dials</b> ${esc(Object.entries(card.dials).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · "))}</p>`
      : "";
    const from = card.blurbFrom
      ? `<p class="pmc-from">quoted from the class mark that defines it — ${esc(card.blurbFrom)}${card.grantedBy && card.grantedBy !== card.blurbFrom ? `<br>granted here by ${esc(card.grantedBy)}` : ""}</p>`
      : "";
    const via = card.via || card.grant
      ? `<p class="pmc-row"><b>reached you</b> ${esc([card.via, card.grant === "here" ? "granted by the ground" : card.grant === "yours" ? "travels with what you are" : null].filter(Boolean).join(" · "))}</p>`
      : "";
    return `<details class="pmc-fine"><summary>the fine print</summary>${from}${dials}${fields}${via}</details>`;
  }

  /** One row per key, whatever keys the door sent. */
  function termsHtml(terms) {
    return termsRows(terms).map((r) => `<p class="pmc-row"><b>${esc(r.key)}</b> ${esc(r.value)}</p>`).join("");
  }

  /**
   * ⚑ `termsBriefHtml` STOOD HERE and is gone (2026-08-29). It was the 08-28
   * answer to "the FULL MCP TEXT when I click actions is NOT helping": every
   * term key named on the face of the plate with its VALUE clipped to sixty-odd
   * characters, and the whole of it one disclosure away.
   *
   * `consentHtml` replaces it and keeps the part that could not be traded away —
   * nothing hidden, nothing dropped, the whole text one press away in the same
   * panel. What changed is WHAT gets clipped. Clipping every value to a fixed
   * head made the short terms (the ones a player actually needs — what binds,
   * what it means, the hit points) look exactly like the truncated heads of the
   * documents, so the panel read as uniformly cut off and the reader could not
   * tell which lines were whole. Splitting on length instead leaves the short
   * ones intact and folds only the ones that are genuinely documents, which is
   * the 08-29 ruling: "only the few terms a player needs".
   */

  /**
   * A GLYPH PER SEAT (founder's ruling, 2026-08-29: "some icons on the
   * different actions to make them distinct").
   *
   * ⚑ THIS IS THE NEAREST THING TO A VERB LIST ON THIS SURFACE, and it is worth
   * saying out loud rather than letting the next reader discover it. The bar's
   * standing law is that it has no list — what it offers is whatever the door
   * listed, and world-cockpit.mjs is held to that by a falsifier that greps it
   * for verb names. A picture cannot be derived from a card, so drawing one
   * costs a lookup keyed by name, and the ruling asked for the pictures.
   *
   * What keeps it from BECOMING a verb list is the default. Nothing here
   * decides whether a slot exists, what it is called, or whether it can be
   * pressed — a name this map has never heard of draws the neutral mark and the
   * seat works exactly as it always did. A door that grows a verb tomorrow gets
   * a bar with one plain glyph on it, never a missing seat and never a throw.
   *
   * Drawn rather than lettered: inline, one stroke weight, currentColor, so
   * they take the seat's own state (dim, gold when afforded, gold when open)
   * with no second palette and no asset to fetch.
   */
  const ICONS = {
    // going places
    walk: "M4 19q5-13 16-13 M15 4h5v5",
    enter: "M10 12h9 M15 8l4 4-4 4 M5 4v16",
    exit: "M14 12H5 M9 8l-4 4 4 4 M19 4v16",
    // the town's own hands
    say: "M4 5h16v10H9l-5 4z",
    mark: "M12 21s6-6.5 6-11a6 6 0 10-12 0c0 4.5 6 11 6 11z M12 9v2",
    note: "M6 3h9l4 4v14H6z M9 12h7 M9 16h5",
    give: "M4 12h12 M12 8l4 4-4 4 M4 6v12",
    take: "M12 4v10 M8 10l4 4 4-4 M4 19h16",
    drop: "M12 4v12 M8 12l4 4 4-4",
    // the fight
    strike: "M4 20L19 5 M14 4h6v6 M4 16l4 4",
    guard: "M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z",
    cast: "M12 3v5 M12 16v5 M3 12h5 M16 12h5 M8 8l2 2 M16 16l-2-2",
    lift: "M12 20V8 M8 12l4-4 4 4 M4 4h16",
    loot: "M4 9h16v11H4z M4 9l2-4h12l2 4 M12 9v11",
    // the ledger
    stake: "M6 3v18 M6 4h12l-3 4 3 4H6",
    unstake: "M6 3v18 M6 4h12l-3 4 3 4H6 M4 12l16-8",
    withdraw: "M12 15V4 M8 8l4-4 4 4 M4 14v6h16v-6",
  };
  /** The neutral mark. A verb this map has never heard of is still a verb. */
  const ICON_DEFAULT = "M12 6a6 6 0 100 12 6 6 0 100-12";
  /**
   * WHAT IS IN A HAND — a hilt, gripped: a blade above, a guard across, the fist
   * around it. It is NOT in the ICONS table on purpose; that table is keyed on
   * act names and this is not an act, it is a thing being held.
   *
   * ONE GLYPH FOR BOTH ANSWERS, carrying nothing and carrying something, with
   * the row's own class dimming it for the empty hand. Two different glyphs
   * would make a reader compare pictures to learn a yes/no the words beside
   * them already say.
   */
  const ICON_HAND =
    `<svg class="pmc-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v10 M8 13h8 M10 13v7h4v-7"/></svg>`;

  /**
   * ACTS THAT ARE AIMED AT NOBODY, by name, because the door cannot say it.
   *
   * FOUNDER, live-testing 2026-08-29: "guard asks you to pick a target on the
   * map... should just be a confirm button."
   *
   * ⚑ AND THE CARD CANNOT TELL ME, which is the whole reason this list exists
   * rather than a derivation. The office hands ALL FIVE arena verbs the SAME
   * field object — one `object` with one description — so guarding and striking
   * are identical on the wire. The description even says so out loud: it names
   * which acts find their own target, in prose, inside a field shared by the
   * ones that do not. There is nothing in the shape to read.
   *
   * So this is a ruling in the same drawer as the other name-keyed ones, and it
   * carries the same debt: the honest fix is the office giving a self-directed
   * act a field of its own (or none at all), and then this list is deleted and
   * `aimKind` answers "none" on the card's own evidence. Asked for. Until then a
   * reader should know that "guard takes no target" is the SITE saying so.
   *
   * `loot` and `pass` ride along on the founder's own parenthesis — they are
   * self-directed by the same reading, and neither should ever open a crosshair.
   */
  // ⚑ `exit` JOINS THEM (founder, 2026-08-29). Its one field is the room to step
  // out of, the door's own description says to omit it and it will use the
  // innermost, and there is exactly one room you can be leaving — so the panel
  // was asking a question with one answer that it was then forbidden to send.
  // Being flow-shaped is what stops the optional field being drawn at all, which
  // is the whole of "exit takes no input".
  const SELF_DIRECTED = ["guard", "loot", "pass", "exit"];
  /**
   * ACTS THAT MAY ONLY BE AIMED AT PARTICULAR KINDS OF TARGET, by name, for
   * exactly the reason SELF_DIRECTED is by name.
   *
   * FOUNDER, live at the board 2026-08-29: "you can only select the unlit cake
   * using the LIFT action." The act's whole law is spending your entire turn
   * getting a downed ALLY back on their feet — the office's own sentence — so
   * the creature is the one thing in the room it can never be aimed at, and it
   * was the only thing being offered.
   *
   * WHY IT COULD NOT BE DERIVED, and this is the same wall as SELF_DIRECTED: the
   * office hands all five arena acts ONE shared `object` field with ONE shared
   * description, whose prose names which act takes a handle and which takes a
   * mark id. Every aimed act therefore has an identical shape on the wire and
   * an identical aim set followed from it. The honest fix is the office
   * describing each act's own field — then `role` is read off the door's
   * sentence and this table is deleted. Asked for, alongside SELF_DIRECTED's.
   *
   * `roles` are `actCandidates`' — what the answer says a thing is standing as.
   * `idle` is what the seat says when the room holds none of them: a seat that
   * armed a crosshair over an empty set would be a dead end wearing a
   * crosshair, and one that armed the WRONG target is what he actually hit.
   * An act absent from this table is offered every candidate, unchanged.
   */
  const AIM_ROLES = {
    lift: { roles: ["downed"], idle: "nobody is down" },
  };
  /** The roles a named act may be aimed at, or null for "anything the answer
   *  names". One reader, so the crosshair, the datalist, the prefill and the
   *  seat's own greying cannot come to disagree about what an act is for. */
  const aimRoles = (action) => AIM_ROLES[action]?.roles ?? null;
  /** …and the same question asked of the live answer: what it may be aimed at
   *  HERE, narrowed. */
  const targetsFor = (action) => aimTargets(state.answer, { only: aimRoles(action) });
  /**
   * THE THREE RULINGS THAT ARE ABOUT PARTICULAR ACTS — `BAR_KEEP`,
   * `DUNGEON_HIDE` and `PHASE_GATE`, just below — kept with the other
   * name-keyed lists (`ICONS`, above; `SELF_DIRECTED` and `AIM_ROLES`, just
   * before).
   *
   * ⚑ THESE ARE MORE NAME TABLES ON THIS SURFACE and they are here for exactly
   * the reason `ICONS` is. `world-cockpit.mjs` holds no verb names and a
   * falsifier greps it to keep that true; a ruling ABOUT a named act therefore
   * cannot live in the arithmetic, and `barFold` takes these as arguments so it
   * never learns one. Called with none of them it is a pure channel split.
   *
   * KEEP — founder, 2026-08-29: the room's acts plus "WALK/SAY/EXIT". The first
   * of those needs no naming: `barFold` keeps every act the door opened on the
   * ground's own channel, which IS the room's acts, whatever they are called
   * tomorrow. These are the ambient ones that hold a seat anyway — going
   * somewhere, speaking, and the way through a door are what you do in a room
   * besides fight.
   *
   * ⚑ ENTER WAS ADDED AFTER THE FIRST BUILD (conductor's ruling, 2026-08-29,
   * flagged for the founder's veto). His list named three and this is four, and
   * the reasoning for the fourth is that the list was DECLUTTERING rather than
   * hiding: the crossing act is the party's first gesture, it and the way out
   * are one pair in the record (same class, same blurb — "An entry is one
   * passage written … exit writes the next"), and folding one of a pair while
   * seating the other put the way IN behind a tray in the antechamber, which is
   * the room where it is the only thing anyone wants. Shipped as built, then
   * reversed on the reading of the shot.
   *
   * ⚑ GIVE AND TAKE JOINED THEM ON THE FOUNDER'S OWN WORD, live-testing the
   * dungeon: "give and take need to be main bar action buttons due to the item
   * you can pick up to help with the fight." That SUPERSEDED the earlier reading
   * of his keep-list, and the earlier reading is kept here rather than replaced
   * because it was not arbitrary — the original three were the acts you take
   * BESIDES fighting, and give/take were folded as things you carry everywhere.
   * What that reading missed is that in this room they are not ambient at all:
   * the good lighter is the fight's own mechanic, so picking it up and handing
   * it over are arena gestures wearing ambient verbs. A fold keyed on the
   * door's channel could not see that, because the channel is right and the
   * MEANING is what changed. That made six seats, and the row still measured
   * clear at 1280 (see the shot runner, which fails the run on overflow). THEY
   * HAVE SINCE LEFT AGAIN — see the reversal just below; `BAR_KEEP` is four
   * names today.
   *
   * HIDE — "hide the mark and note UI buttons in the dungeon grounds", and UI
   * hiding is the whole of it: the acts are untouched, the door still affords
   * them, the MCP still takes them, and stepping back out of portal ground
   * brings the seats back. Leaving a claim on a boss room and writing yourself
   * a private note mid-fight are not what the room is for.
   *
   * GATE — the one act whose whole precondition is the phase. The office's own
   * words for it, read 2026-08-29: "Take what is left when the encounter is
   * spent. Refused while anything is still standing — the … verb's own
   * precondition is the phase." So the seat appears when the room reaches that
   * phase and not before, which is the surface agreeing with a refusal the door
   * was already going to give. `PHASES` is the office's list (encounter.mjs):
   * afoot, spent, wiped.
   */
  // ⚑ GIVE AND TAKE ARE OFF THE ROW AGAIN (founder, live: "let's also just
  // remove the give and take buttons as it's confusing; we can just rely on the
  // agents to pick up the weapon/upgrade").
  //
  // THIS REVERSES HIS OWN EARLIER RULING and the reversal is kept visible rather
  // than tidied away, because a keep-list that quietly loses two names reads as
  // drift. Earlier tonight: "give and take need to be main bar action buttons
  // due to the item you can pick up to help with the fight." What changed is not
  // the mechanic but WHOSE HANDS it belongs in — the party's agents lift the
  // weapon through their own doors, so a human at this bar never needed the
  // verbs, and two seats that only ever confused him are gone.
  //
  // NOTHING IS ORPHANED BY IT. This list decides which AMBIENT acts hold a seat
  // and nothing else: the door still affords give and take, the MCP still takes
  // them, they are still reachable in the overflow tray, and an agent acting
  // through its own door never consulted this file. Removing a seat removes a
  // button, not an act.
  const BAR_KEEP = ["walk", "say", "enter", "exit"];
  const DUNGEON_HIDE = ["leave-mark", "note-to-self"];
  const PHASE_GATE = { loot: "spent" };
  /**
   * ⚑ `WEAPON_HELPS` STOOD HERE AND IS GONE (2026-08-29). It was one line —
   * the name of the act a weapon's bonus augments — and for a few hours it was
   * load-bearing: the first shape of `hands[<handle>].weapon` carried
   * `{ thing, bonus, says? }` and no word for WHICH act, so the site had to
   * assert one, and the act the bonus appeared on was this file's claim rather
   * than the record's.
   *
   * The office now sends `for` (lane bday-law, 7ba1148), read off the held
   * grant's own entry rather than hardcoded — so a thing that grants a
   * different act moves the bonus with no edit here. It is deleted rather than
   * kept as a fallback ON PURPOSE: a weapon whose grant names no act should
   * show no clause at all, because "the record did not say" and "the site
   * guessed" must not look the same on this surface. `weaponFor` answers null
   * for that case and nothing is said, which is the rule every other unknown
   * here already follows.
   */
  function iconFor(action) {
    const d = ICONS[String(action ?? "").toLowerCase()] ?? ICON_DEFAULT;
    return `<svg class="pmc-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  }

  /**
   * WHERE THE WAY OUT GOES, on the seat that is the way out.
   *
   * FOUNDER'S RULING 2026-08-29: "if the exit button is IN the action bar, we
   * don't need another redundant button." The viewer's standalone step-outside
   * pill stands down while this dock is mounted (the rule lives in the site's
   * own stylesheet, keyed on data-pmc-dock, the same way the time-travel pill
   * already does) — and the pill carried one thing the bar's seat did not: the
   * NAME of what you step out into. So the seat takes it over rather than
   * losing it.
   *
   * WHICH SEAT, decided by the door and not by a name kept here: the act whose
   * own field description says you are stepping OUT of something. Same sentence
   * `prefillFor` reads to know a place from a target, read once more.
   *
   * WHERE IT LEADS is the containment the door already published. `within` runs
   * outermost-first, so whatever sits one step before the ground you are in is
   * what you come out into. Absent — a standpoint with no portal, a chain of
   * one — this answers null and the seat keeps its ordinary dial line.
   */
  function leadsTo(s) {
    const leaves = (s.card?.fields ?? []).some((f) => /\bout of\b/i.test(f.description ?? ""));
    if (!leaves) return null;
    const here = portalOf(state.answer)?.id;
    const within = Array.isArray(state.answer?.within) ? state.answer.within : [];
    const i = within.findIndex((w) => w?.id === here);
    const parent = i > 0 ? within[i - 1]?.id : null;
    if (!parent) return null;
    return `→ ${String(parent).split("/").pop().replace(/-/g, " ")}`;
  }

  function slotHtml(s, extraClass) {
    // Three states, and they are three different sentences. Not afforded here is
    // the ground's answer; blocked is the clock's; enabled is neither. A slot that
    // collapsed the last two would tell a waiting player their act had gone away.
    const label = s.afforded
      ? `${s.label}${s.blocked ? " — " + s.blocked : ""}`
      : `${s.label} — not afforded where you stand`;
    const open = state.open === s.action ? " open" : "";
    // ARMED is not OPEN. An armed seat has no panel under it — the question it
    // is asking is being asked on the map — so it needs a state of its own or
    // the row says nothing about why the cursor turned into a crosshair.
    const armed = state.aiming?.action === s.action ? " armed" : "";
    const gated = s.blocked ? " gated" : "";
    // GATED IS aria-disabled, NOT disabled, and that is the founder's ruling
    // working rather than a nicety. A `disabled` button fires no pointer events at
    // all, so hovering it shows no card — the slot stayed visible and its LAW went
    // unreadable at exactly the moment a waiting player has time to read it.
    // Caught in the gated-card QA shot, which came back with an empty screen.
    // Not-afforded keeps real `disabled`: there is no card behind it to read.
    const stop = s.afforded ? `aria-disabled="${!s.enabled}"` : "disabled";
    return `<button type="button" class="pmc-slot${extraClass ? " " + extraClass : ""}${open}${armed}${gated}" data-action="${esc(s.action)}"
      aria-expanded="${state.open === s.action}"
      ${stop} aria-label="${esc(label)}"
      ${s.afforded ? 'aria-describedby="pmc-card"' : ""}>
      ${s.key ? `<span class="pmc-key">${s.key}</span>` : ""}
      ${iconFor(s.action)}
      <span class="pmc-name">${esc(s.label)}</span>
      <span class="pmc-dial">${esc(s.afforded ? (leadsTo(s) ?? dialSpeak(s.card, { brief: true, weapon: heldWeapon() })) : "not here")}</span>
    </button>`;
  }

  /** Which acts the door opened on the ground's own channel — the room's, as
   *  opposed to what you carry everywhere. The same reading `barFold` makes,
   *  needed here for the divider and the seat's dressing. */
  const isGround = (s) => s.card?.channel === "ground" || s.card?.via === "ground";

  /** What the hand holding this bar is carrying, if the door says. One reading,
   *  used by every surface that says what an act costs — the seat, the card and
   *  the panel — so the three cannot come to disagree about a number. */
  function heldWeapon() {
    // The door's own word for which act it helps, and nothing of ours — see the
    // note above for what stood here and why it is not kept as a fallback.
    return weaponFor(state.answer, state.acting);
  }

  /**
   * A CHOOSY ACT WITH NOTHING TO AIM AT IS GREYED, WITH ITS REASON.
   *
   * Founder's own shape for it, and it is the shape the clock already uses:
   * "the button sits disabled with its reason, not armed with a wrong target."
   * So this dresses the seat exactly as a turn-gate does — `blocked` carries the
   * sentence, `enabled` goes false — and every surface that already reads those
   * two fields (the seat's grey, its label, the tray's line, the card, and
   * `openSeat`'s own refusal to arm a disabled seat) tells the same story with
   * no edit of its own.
   *
   * IT TOUCHES ONLY THE ACTS `AIM_ROLES` NAMES. An act nobody has ruled on has
   * no roles, and this returns its slot untouched — including the acts whose
   * targets are simply absent tonight, which stay a panel the way they always
   * did. And an act the DOOR has already blocked keeps the door's reason: the
   * clock's refusal is the more urgent fact and it is not overwritten here.
   */
  function narrowAim(s) {
    const roles = aimRoles(s.action);
    if (!roles || !s.afforded || !s.enabled || !s.card) return s;
    // The door gave it nowhere to aim, so there is no aim set to be empty. A
    // ruling about targets has nothing to say about an act that takes none.
    if (!aimField(s.card)) return s;
    if (aimTargets(state.answer, { only: roles }).length) return s;
    return { ...s, enabled: false, blocked: AIM_ROLES[s.action].idle };
  }

  /** The bar, folded. One reading, used by drawBar and by the keyboard — a
   *  second one is how a number key came to open a seat that was not on the row. */
  function foldedBar() {
    const bar = barSlots(state.answer, { acting: state.acting });
    const fold = barFold(bar, {
      keep: BAR_KEEP,
      // UI HIDING ONLY, and only inside portal ground — the door's own word for
      // being in the dungeon at all. Step back out and the seats come back.
      hide: portalOf(state.answer) ? DUNGEON_HIDE : [],
      gate: PHASE_GATE,
      phase: state.answer?.encounter_detail?.phase ?? null,
    });
    return {
      shown: fold.shown.map(narrowAim),
      folded: fold.folded.map(narrowAim),
      blocked: bar.blocked,
    };
  }

  function drawBar() {
    const { shown, folded, blocked } = foldedBar();
    // THE HERE DIVIDER STILL MARKS THE SAME BOUNDARY it always did — what
    // travels with you, then what this ground grants — it is just that the
    // right-hand side is now the whole reason the left-hand side is short.
    let dividerDone = false;
    const seats = shown.map((s) => {
      const ground = isGround(s);
      const gap = ground && !dividerDone ? ((dividerDone = true), `<div class="pmc-gap"><span>HERE</span></div>`) : "";
      return gap + slotHtml(s, ground ? "afford" : "");
    }).join("");
    // The dock rides INSIDE the row but OUTSIDE the bar's scrollport — siblings,
    // so the scroll clips verbs and never the faces or the standpoint plate
    // that hangs off the dock.
    return `<div class="pmc-barrow">${drawRoster()}<div class="pmc-bar" role="toolbar" aria-label="what can be done from here">
      ${seats}
      ${folded.length ? foldButtonHtml(folded) : ""}
    </div></div>
    ${blocked ? `<p class="pmc-gate" role="status">${esc(gateWords(blocked, shown, folded))}</p>` : ""}
    <span class="pmc-more" data-more="left" aria-hidden="true" hidden>‹</span>
    <span class="pmc-more" data-more="right" aria-hidden="true" hidden>›</span>
    <div class="pmc-card" id="pmc-card" role="tooltip" hidden></div>
    ${state.tray ? trayHtml(folded) : ""}
    ${state.aiming ? aimHtml() : state.open ? (opensAsChat(state.open) ? chatHtml(state.open) : formHtml(state.open)) : ""}`;
  }

  /**
   * THE ONE LINE ABOVE THE BAR, and what changed about it (2026-08-29).
   *
   * It printed the door's reason alone, which was the whole truth while a block
   * meant every act. It no longer does: the door now narrows a refusal to the
   * acts it is about, so the reason on its own read as a flat "you may not act"
   * over a row where most of the seats were live — the same misreading, one
   * layer up, that greyed the bar in the first place.
   *
   * So where the door narrowed, the line NAMES WHAT IS WAITING, in the seats'
   * own words. Nothing here is written by the site: the reason is the door's
   * sentence and the names are the labels the bar already draws for those acts.
   * Where the door narrowed nothing, the line is exactly what it always was.
   */
  function gateWords(blocked, shown, folded) {
    if (!blocked?.gates?.length) return blocked.reason;
    const cold = [...shown, ...folded]
      .filter((s) => s.afforded && blocked.gates.includes(s.action))
      .map((s) => s.label.toLowerCase());
    return cold.length ? `${blocked.reason} — ${cold.join(", ")} wait for it` : blocked.reason;
  }

  /** The overflow seat. A seat like any other so the row's measuring, its
   *  scroll cue and its hover all keep working without learning a special case. */
  function foldButtonHtml(folded) {
    return `<button type="button" class="pmc-slot pmc-fold-btn${state.tray ? " open" : ""}" data-fold
      aria-expanded="${Boolean(state.tray)}"
      aria-label="${esc(`${folded.length} more act${folded.length === 1 ? "" : "s"} — what you carry everywhere`)}">
      <span class="pmc-name">···</span>
      <span class="pmc-dial">${folded.length} more</span>
    </button>`;
  }

  /**
   * What folded, listed.
   *
   * A LIST RATHER THAN A SECOND ROW, because a second row of seats is the thing
   * the ruling was against — and because these are the acts a reader goes
   * looking for by name rather than reaches for by muscle memory, which is a
   * list's shape and not a row's. The three states a seat can be in are kept:
   * afforded, gated with the clock's reason, or not afforded here at all.
   */
  function trayHtml(folded) {
    const rows = folded.map((s) => {
      const why = s.afforded ? (s.blocked ?? dialSpeak(s.card, { weapon: heldWeapon() }) ?? "") : "not afforded where you stand";
      return `<button type="button" data-action="${esc(s.action)}"
        ${s.afforded && s.enabled ? "" : "disabled"}
        aria-label="${esc(s.label + (why ? " — " + why : ""))}">
        ${iconFor(s.action)}<span>${esc(s.label)}</span>${why ? `<small>${esc(why)}</small>` : ""}
      </button>`;
    }).join("");
    return `<div class="pmc-plate pmc-tray" role="menu" aria-label="more acts">
      <div class="pmc-cap">WHAT YOU CARRY</div>${rows}
    </div>`;
  }

  /**
   * WHERE THE BAR IS ALLOWED TO SIT.
   *
   * The viewer already owns the bottom edge: `.wv-spectator-coordinate` is pinned
   * bottom-centre (z-index 6) and `.wv-walkdesk` bottom-right (z-index 8), and
   * this overlay sits at 7000 — so a bar pinned to the bottom wins every time and
   * covers a resident's coordinate readout and the left edge of the desk they
   * confirm a departure in. That is the mistake this page has already been
   * scolded for once, in the founder's own words about the time-travel panel:
   * "Time Travel sits ON TOP of walking."
   *
   * So the bar is MEASURED into the free space above them rather than guessed
   * into a corner — the same move the time-travel panel's own `place()` makes,
   * and for the same reason: those elements' sizes are the viewer's business and
   * a number copied here would be a second one to drift. With neither present
   * (the harness, a viewer that moved them) it falls back to the bottom, which is
   * exactly where it sat before this existed.
   */
  let berthKey = null, berthLo = null, berthHi = null;
  function placeBar() {
    // the whole row (dock + bar) moves as one; the bar alone is the fallback
    // shape for a harness that mounted pieces
    const bar = root.querySelector(".pmc-barrow") ?? root.querySelector(".pmc-bar");
    if (!bar) return;
    const h = doc.defaultView?.innerHeight ?? 0;
    let clear = 18;
    // THE WAY OUT IS ON THIS LIST TOO (founder-caught 2026-08-28: "step outside"
    // and the room's own name printed on top of each other at the dock's end of
    // the row). `.wv-scene-exit` is the viewer's exit pill, pinned into the
    // painting's bottom-left at bottom:58px — and it is NEWER than this fence,
    // so it was simply never measured. The arithmetic that made it collide:
    // `.wv-walkdesk` ships hidden and only appears while a walk is armed, so on
    // an ordinary frame the tallest thing here is the coordinate chip (bottom 8,
    // ~26 tall) and the row lands at about 46px — a band that runs straight
    // through the pill's 58-to-86. The dock is the row's leftmost cell and the
    // pill is at the painting's left edge, which is why it read as the DOCK's
    // collision rather than the bar's.
    //
    // Measured, not moved: the pill is the viewer's element and restyling it
    // from here would be the second writer this fence exists to avoid. The row
    // lifts over it exactly as it lifts over the walk desk.
    // FENCED TO THE PAINTING (2026-08-28, seen the moment the dock landed): a
    // viewport-centered row runs its left end under the nav and card columns —
    // the dock's ACT AS faces sat on the nav's own text, and the verb slots
    // have quietly overlapped the card column since the bar shipped. The map
    // pane is the ground these verbs act ON, and the cockpit already holds its
    // svg; the row centers over that pane and never leaves it. The 50%-of-
    // viewport fallback is the harness's (no svg mounted).
    const paint = liveSvg()?.getBoundingClientRect?.();
    const wide = paint && paint.width > 300;
    const vw = doc.defaultView?.innerWidth ?? 0;
    const full = wide ? paint.width - 20 : Math.max(280, vw - 28);
    let lo = wide ? paint.left + 10 : 14;
    let hi = wide ? paint.right - 10 : vw - 14;

    // ⚑ STAND BESIDE IT BEFORE CLIMBING OVER IT (founder-caught 2026-08-28:
    // "the action buttons somehow floated vertically upwards").
    //
    // The fence below used to answer every piece of bottom furniture the same
    // way — lift the WHOLE row above the tallest of them. `.wv-walkdesk` is
    // 194px tall and lives in the painting's bottom-RIGHT corner, so arming a
    // walk launched the entire row 216px up the map, clear of nothing it was
    // actually colliding with along nine tenths of its length. Measured on the
    // founder's screen at the moment he reported it: walkdesk top 689 of an
    // 893px window, row bottom 215.938px, row spanning x 222–1910 against a
    // desk spanning 1606–1910.
    //
    // A corner is something you go AROUND. So each piece is asked, in the order
    // a reader would: can the row simply end before this thing (or begin after
    // it) and still be worth calling a row? If yes it steps aside and stays on
    // the bottom edge where the hand expects it. Only what cannot be stepped
    // around — something spanning the middle, or a dodge that would leave a
    // stub — is climbed over, and the lift is then measured off that piece
    // alone rather than off the tallest thing anywhere along the edge.
    //
    // KEEP_FRACTION is a judgement and is written as one. Measured on the
    // founder's 1920x893 screen against a 1708px painting: dodging the exit
    // pill alone keeps 86%, and dodging the walk desk as well keeps 67% — which
    // is 1129px, still wider than the 1241px of content the bar had at its
    // fullest and far better than the 216px climb the alternative costs. So the
    // floor sits below that pair rather than between them. What it still
    // refuses is furniture across the MIDDLE, where both sides come back small
    // and going around genuinely leaves a stub; there, climbing is right.
    const KEEP_FRACTION = 0.55;
    const rowH = bar.getBoundingClientRect().height || 72;
    const climb = [];
    // ⚑ THE PINNED BUBBLE JOINS THE FENCE — the one piece here the reader
    // OPENED (2026-08-29, found by the seam review's own hypothesis in the
    // course of falsifying it). A pinned bubble is `pointer-events:auto` at
    // z-index 7 inside the map; this overlay is fixed at 7000. So the dock does
    // not merely sit over it, it EATS ITS CLICKS: the reader sees their bubble,
    // presses its close button or a relation in the covered strip, and nothing
    // happens. Measured before the fix — bubble 826..886, dock 788..834, and
    // elementFromPoint in the overlap answering `pmc-plate pmc-roster pmc-dock`.
    //
    // It joins this fence rather than getting a cure of its own, and both halves
    // of that are deliberate. Standing the viewer's bubbles down would suppress
    // a panel somebody deliberately opened; a z-index game would bury the dock
    // under a 32rem sheet and hide the bar instead. Stepping aside is what this
    // fence already does for every other piece of the viewer's bottom edge, and
    // it writes nothing of the viewer's.
    //
    // The step-aside-before-climbing rule earns its keep here: a bubble is up to
    // 32rem tall, so answering it by lifting would fling the row halfway up the
    // map. Beside it, the row keeps the bottom edge. One that genuinely spans
    // the middle is climbed — the same judgement made for everything else — and
    // the existing cap keeps the row on screen either way.
    //
    // ONE selector, not a list: the viewer reuses a single element for the
    // pinned bubble (`bubbleEls.pinned`, guarded by `pinnedBuiltId`), so there
    // is never a second one to fence.
    for (const sel of [".wv .wv-walkdesk", ".wv .wv-spectator-coordinate", ".wv .wv-paint-tallies", ".wv .wv-scene-exit", ".wv .wv-bubble.is-pinned"]) {
      const el = doc.querySelector(sel);
      if (!el || !el.getClientRects().length) continue;
      const box = el.getBoundingClientRect();
      if (!box.height) continue;
      // does it reach the band a bottom-sitting row would occupy at all?
      if (box.bottom < h - 18 - rowH) continue;
      if (box.right <= lo || box.left >= hi) continue;        // already beside it
      const endBefore = box.left - 12, beginAfter = box.right + 12;
      const keepLeft = endBefore - lo, keepRight = hi - beginAfter;
      // step toward whichever side keeps more row, and only if that is enough
      if (keepLeft >= keepRight && keepLeft >= full * KEEP_FRACTION) hi = endBefore;
      else if (keepRight > keepLeft && keepRight >= full * KEEP_FRACTION) lo = beginAfter;
      else climb.push(box);
    }
    for (const box of climb) clear = Math.max(clear, h - box.top + 12);
    // never push the bar off the top of a short window
    bar.style.bottom = `${Math.min(clear, Math.max(18, h - 120))}px`;
    // ⚑ A BERTH ONCE GIVEN IS KEPT, and this is the cost of having made the row
    // re-measure promptly. The furniture is transient: the exit pill comes and
    // goes with what the viewer thinks you can step into, so the row stepped
    // aside for it, stepped back when it left, and stepped aside again — and a
    // dock whose faces move a hundred pixels while you are reaching for one is
    // a dock you misclick. Caught the way it would catch anyone: aiming at rei
    // and hitting the illuminator, twice, because the row slid left between
    // looking and pressing.
    //
    // So while you are standing in one place the row only ever gives ground,
    // never takes it back. Arriving somewhere else is a new room and a fresh
    // measurement — which is the same key frameScene arrives on, and for the
    // same reason: the thing that legitimately changes the furniture is moving.
    const here = sceneKey() ?? "";
    if (here !== berthKey) { berthKey = here; berthLo = null; berthHi = null; }
    // THE HAND IS WHAT IT HOLDS STILL FOR, and only that. A first pass here
    // never gave the berth back at all, which stopped the dancing and left the
    // row permanently squeezed by furniture that had long since gone — one
    // armed walk and the bar stayed at two thirds width for the rest of the
    // standpoint. That trades a misclick for a papercut and keeps the papercut.
    //
    // The harm was only ever moving under a pointer that was aiming at it, so
    // that is the whole of the condition: while the row is hovered it does not
    // move, in either direction, and the instant the pointer leaves it measures
    // itself honestly again. A moment of overlap nobody is reaching into costs
    // less than a face that slides out from under a click.
    const held = berthLo != null && (root.querySelector(".pmc-barrow")?.matches?.(":hover") ?? false);
    if (!held) { berthLo = lo; berthHi = hi; }
    if (wide || vw) {
      bar.style.left = `${(berthLo + berthHi) / 2}px`;
      bar.style.maxWidth = `${Math.max(280, berthHi - berthLo)}px`;
    }
    // THE HERE-PLATE NEEDS NO FENCE ANY MORE, and its absence here is the point
    // rather than an omission. It rode this same rect until 2026-08-28 — the
    // second element caught sitting on the site's rail — and the fence held for
    // parcels and failed in the open world, where the map svg is full-bleed so
    // this rect's left edge IS the viewport's. The founder's ruling moved the
    // plate onto the dock instead, where it hangs off a box already inside the
    // painting and there is nothing left to clamp. A third fence would have been
    // the third instance of one bug.
  }

  /** Measured, never assumed: the arrows and the edge fade come and go with the
   *  bar's real scroll position. */
  function markOverflow() {
    const bar = root.querySelector(".pmc-bar");
    if (!bar) return;
    // ⚑ THE ROW SHEDS ITS SECOND LINE BEFORE IT SHEDS ITS SEATS.
    //
    // GIVE and TAKE joined the row on the founder's word (they are the fight's
    // own mechanic here, whatever channel the door opened them on), and nine
    // seats want about 870px against the 771 the row has at 1280 with the walk
    // desk up. Measured, in the shot runner, which fails the run on overflow.
    //
    // What goes is the DIAL LINE, not a seat. It is the only thing on a seat
    // that is said again elsewhere — the hover card carries the same sentence
    // whole and unclipped — so it is the one part of the row whose absence
    // costs a reader nothing they cannot get by pointing at the thing they were
    // already pointing at. A dropped SEAT would be an act made unreachable, and
    // a scrolling row is what the fold exists to prevent.
    //
    // MEASURED WITH THE LINE BACK ON, every time, so this cannot oscillate: the
    // question asked is always "does the row fit at its full size", and the
    // answer decides the class rather than being decided by it. One reflow.
    bar.classList.remove("tight");
    if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add("tight");
    const left = bar.scrollLeft > 2;
    const right = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
    bar.classList.toggle("more-left", left);
    bar.classList.toggle("more-right", right);
    const box = bar.getBoundingClientRect();
    const h = doc.defaultView?.innerHeight ?? 0;
    for (const el of root.querySelectorAll(".pmc-more")) {
      const isRight = el.getAttribute("data-more") === "right";
      el.hidden = isRight ? !right : !left;
      el.style.bottom = `${Math.max(4, h - box.bottom + box.height / 2 - 8)}px`;
      el.style.left = isRight ? `${box.right - 16}px` : `${box.left + 4}px`;
    }
  }

  /** Put a fixed-position panel above the bar, clamped into the viewport. Reading
   *  the bar's own box rather than assuming its height, because a row that can
   *  scroll may or may not be showing a scrollbar. */
  function placeAbove(el, anchor) {
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const w = doc.defaultView?.innerWidth ?? 0;
    el.style.bottom = `${Math.max(8, (doc.defaultView?.innerHeight ?? 0) - a.top + 10)}px`;
    if (el.classList.contains("pmc-card")) {
      const box = el.getBoundingClientRect();
      const want = a.left + a.width / 2 - box.width / 2;
      // FENCED TO THE PAINTING, like the bar (placeBar, f68de054f): the card's
      // old floor was the VIEWPORT's left edge, so a seat near the painting's
      // left side slid the card onto the site rail (founder-caught 2026-08-28,
      // the roots card over CONVERSATIONS/sign-out). The painting's own rect is
      // the card's world; the viewport clamp stays only as the outer bound.
      const paint = liveSvg()?.getBoundingClientRect?.();
      const lo = Math.max(12, (paint?.left ?? 0) + 8);
      const hi = Math.max(lo, Math.min(w - box.width - 12, (paint ? paint.right : w) - box.width - 8));
      el.style.left = `${Math.min(Math.max(lo, want), hi)}px`;
      el.style.transform = "none";
    }
  }

  /** action → terms | null (asked and the door had none, or the read failed).
   *  `undefined` means not asked yet, which is what the card's "reading…" line
   *  is showing. One request per act, for the life of the mount. */
  const termsCache = new Map();

  function askTerms(action) {
    if (termsCache.has(action) || !o.readTerms) return;
    termsCache.set(action, undefined);
    // A SHADOW NEEDS A RESIDENT NAMED. The office's read path builds its fields
    // as `{ ...envelope, ...(args.handle ? { handle } : {}) }` with the comment
    // that "a multi-resident key that named its handle must not meet the
    // which-resident bounce on a read" — so a key holding more than one resident
    // bounces without it, and this key usually does. The terms are a property of
    // the CLASS rather than of the asker, so acting as the human simply asks in
    // the name of a resident on the same key; the answer is the same either way.
    // ONE RESOLUTION OF "WHOSE STANDING", shared with the act (see `seat`). It
    // had its own first-handle fallback, and the reasoning above is why that was
    // survivable here where it was not survivable there — the terms belong to
    // the class, so the asker's name does not change the answer. Routed through
    // the same function anyway: two spellings of one question is how the read
    // and the act came to disagree in the first place, and being harmless today
    // is not the same as being right.
    const asking = seat();
    o.readTerms(action, asking).then((body) => {
      termsCache.set(action, termsFromRead(body));
      // ⚑ THE PANEL HAS TO BE TOLD TOO, and until 2026-08-29 only the card was.
      // The shadow read was asked for from `showCard` alone, so an act reached
      // WITHOUT hovering its seat — through the overflow tray, or by its number
      // key — opened its panel with no terms in the cache and none on the way.
      // Caught by the shot runner going through the tray for the crossing act,
      // which is the one act on this surface whose panel is mostly terms: it
      // came back a bare form. A consent sheet that is only a consent sheet when
      // you happened to hover first is not a consent sheet.
      if (state.open === action) paint();
      // Re-render the card only if this act is still the one under the pointer —
      // a card that repaints for an act the reader has already moved off is a
      // flicker.
      const still = root.querySelector(".pmc-slot:hover, .pmc-slot:focus-visible");
      if (still?.getAttribute("data-action") === action) showCard(still);
    }).catch(() => { termsCache.set(action, null); });
  }

  function showCard(slotEl) {
    const host = root.querySelector("#pmc-card");
    if (!host || !slotEl) return;
    // A card behind an open form says the act's blurb twice, in two panels that
    // overlap — seen in QA. The form IS the card, opened: while one is up, the
    // tooltip stands down.
    //
    // ⚑ AND AN ARMED ACT IS THE SAME CASE, which the first pass missed because
    // arming leaves `state.open` null. Seen in the shot: pressing a seat left
    // the pointer on it, so the card stayed up and the aim strip opened across
    // it — two panels, one of them explaining an act the reader had already
    // chosen. An armed act's panel is the strip; the card has said its piece.
    if (state.open || state.aiming) return;
    // ⚑ THE SAME SLOTS THE ROW WAS DRAWN FROM, which is a fix as much as a
    // rewiring: this read `barSlots` raw, so a seat the row had greyed hovered
    // as though it were live. A grey seat is the one a reader hovers to find
    // out WHY, and the card was the one surface that could not say.
    const { shown, folded } = foldedBar();
    const s = [...shown, ...folded].find((x) => x.action === slotEl.getAttribute("data-action"));
    if (!s?.card) return;
    askTerms(s.action);
    host.innerHTML = cardHtml(s.card, { why: s.blocked });
    host.hidden = false;
    placeAbove(host, slotEl);
  }

  function hideCard() {
    const host = root.querySelector("#pmc-card");
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  // ── the act form ──────────────────────────────────────────────────────────
  function formHtml(action) {
    const all = barSlots(state.answer, { acting: state.acting });
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    if (!slot?.card) return "";
    const c = slot.card;
    // WHAT THE ANSWER CAN FILL IN FOR YOU (2026-08-28 ruling). `prefillFor` is
    // deliberately narrow — one open slot and one named value, or nothing — and
    // the candidates it declined to choose between are offered as a datalist
    // instead, so the reader gets one keystroke rather than a guess.
    // …and both of them read the act's OWN aim set, narrowed where it is choosy
    // (`AIM_ROLES`). The datalist is the typed half of the same question the
    // crosshair asks, so a name the map would refuse must not be offered in the
    // box either — the founder found the two disagreeing from the map's side.
    const filled = prefillFor(c, state.answer, { only: aimRoles(action) });
    const candidates = targetsFor(action);
    const listId = candidates.length ? `pmc-cand-${esc(action)}` : null;
    // ⚑ AND IT IS ONLY EMITTED WHERE A FIELD COULD USE IT (see the render below).
    // A datalist is invisible chrome that belongs to an input; with exit's field
    // gone, the panel was still carrying a list of aim candidates — "the unlit
    // cake — what stands against you here" — attached to nothing. Invisible on
    // screen and very much there in the text, which is how the shot found it:
    // the exit card was still naming the creature after the fix that took the
    // creature off it.
    const datalist = listId
      ? `<datalist id="${listId}">${candidates.map((k) =>
          `<option value="${esc(k.value)}">${esc(k.label)}${k.why ? " — " + esc(k.why) : ""}</option>`).join("")}</datalist>`
      : "";
    // ── IS THIS A FORM, OR IS IT A TRIGGER? ──────────────────────────────────
    //
    // RULED 2026-08-28, mid-fight: the arena's acts "must feel like a game —
    // one tight line, prefilled, ENTER sends."
    //
    // NO VERB LIST AND NO NEW WIRE, exactly as the chat line's own note argues:
    // which acts get this chrome is decided by the SHAPE of the card the door
    // sent, never by their names. An act is a TRIGGER when the door has already
    // answered everything it needs — nothing required is still empty — and
    // nothing it holds is prose. That is a description of the fight's verbs
    // (STRIKE finds its own target, GUARD takes no argument at all) without
    // naming one of them, so a door that grows a sixth arena verb gets this for
    // free, and one that adds a required field to STRIKE gets the full form
    // back with no edit here.
    //
    // The controls are still the same controls and still editable — a trigger
    // is the form with its explanations moved, not a different act. What comes
    // off the face of the plate is the per-field prose: `f.description` is
    // written for a caption with room, and five of them stacked over one
    // prefilled box is the wall the founder hit. It stays reachable on the
    // control itself and whole on the hover card, which is where the card's own
    // note already says detail belongs.
    const readyToSend = c.fields.every((f) => !f.required || filled[f.name] != null);
    const trigger = readyToSend && !c.fields.some((f) => wantsTextarea(f));
    // Resolved BEFORE the inputs, because a sheet's fields keep their captions
    // and a fight plate's do not — see the note on `desc` below.
    const shown = state.said?.terms ?? termsCache.get(action) ?? null;
    const sheet = shown ? " pmc-sheet" : "";

    // ⚑ THE PANEL DOES NOT ASK AGAIN FOR WHAT THE FLOW ALREADY ANSWERED.
    //
    // Seen in the shot the moment the flow worked: the walk panel showed a
    // clean WHO / FROM / TO and then, underneath it, three empty boxes named
    // `mark_id`, `to_x` and `to_y` — the very question the reader had just
    // answered by clicking the map, asked a second time in the form language
    // the founder has objected to twice ("I have to type it in like filling an
    // mcp form"; "FILLED with irrelevant information I don't care about").
    //
    // So on a FLOW-SHAPED act — one aimed at a thing, at a point, or at nobody
    // — the panel renders only the fields the door REQUIRES and the flow has
    // not already filled. Everything else was either answered on the map or is
    // the door's own to default, and the TO row above says what it is.
    //
    // AN ORDINARY FORM ACT IS UNTOUCHED. Outside the fight there are acts whose
    // whole substance is typed (a mark's slug and body), and they still get
    // every field, because for those the form IS the act rather than a second
    // asking of a settled question.
    const answered = state.act?.action === action ? Object.keys(state.act.args ?? {}) : [];
    const flowShaped = SELF_DIRECTED.includes(action) || aimKind(c) !== "none" || answered.length > 0;
    const asked = flowShaped
      ? c.fields.filter((f) => f.required && !answered.includes(f.name) && filled[f.name] == null)
      : c.fields;

    const inputs = asked.map((f) => {
      const id = `pmc-f-${esc(f.name)}`;
      const req = f.required ? ` <span class="req" title="required">*</span>` : "";
      const pre = filled[f.name] != null ? ` value="${esc(filled[f.name])}"` : "";
      let control;
      if (f.enum && f.enum.length) {
        control = `<select id="${id}" data-field="${esc(f.name)}">${f.enum.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select>`;
      } else if (f.type === "boolean") {
        control = `<select id="${id}" data-field="${esc(f.name)}"><option value="">—</option><option value="true">true</option><option value="false">false</option></select>`;
      } else if (f.type === "number") {
        control = `<input id="${id}" data-field="${esc(f.name)}" type="number" inputmode="decimal">`;
      } else {
        // The door states its own limits in the field's own words; the control
        // honours them rather than guessing at a shape.
        const cap = statedLimit(f.description);
        const max = cap ? ` maxlength="${cap}"` : "";
        // The candidate list rides on the free-text fields only — a field the
        // door gave an enum for already has the door's own answer, and one
        // holding prose is not a thing you aim at.
        const list = listId && !wantsTextarea(f) ? ` list="${listId}"` : "";
        control = wantsTextarea(f)
          ? `<textarea id="${id}" data-field="${esc(f.name)}"${max}></textarea>`
          : `<input id="${id}" data-field="${esc(f.name)}" type="text"${max}${list}${pre}>`;
      }
      // The door's own description under the field, whole. It is where the door
      // tells a caller what the act will do with the value, and shortening it
      // here would be the site editing law to fit a box. On a TRIGGER it moves
      // onto the control instead of standing under it — same words, same door,
      // one hover or one focus away rather than five paragraphs deep.
      // ⚑ A SHEET KEEPS ITS CAPTIONS EVEN WHEN IT IS A TRIGGER. Moving the per-
      // field prose onto the control is the fight plate's whole economy — five
      // captions over one prefilled box was the wall the founder hit mid-swing.
      // A consent sheet is the opposite surface: the field descriptions are
      // where the door says what agreeing to this does, and hiding them behind
      // a hover on a panel whose entire job is being read would be trading away
      // the thing the sheet exists for. Seen in the shot — the crossing's own
      // `accept` field, whose description says when the word is demanded, was
      // reachable only by hovering it.
      const captioned = !trigger || Boolean(sheet);
      const desc = f.description && captioned ? `<p class="pmc-desc">${esc(f.description)}</p>` : "";
      const more = f.enumCount && !f.enum ? `<p class="pmc-desc">${f.enumCount} values — read the card at the door</p>` : "";
      return `<label for="${id}"${!captioned && f.description ? ` title="${esc(f.description)}"` : ""}>${esc(f.name)}${req}${control}</label>${desc}${more}`;
    }).join("");

    const said = state.said
      ? `<p class="pmc-said${state.said.ok ? "" : " bad"}">${esc(state.said.text)}${state.said.hint ? `<span class="hint">${esc(state.said.hint)}</span>` : ""}</p>`
      : "";
    // The terms the door has stated for this act — from the shadow read if the
    // card already asked for them, and replaced by whatever the door hands back
    // at the act itself, which is the authoritative delivery. (Both `shown` and
    // `sheet` are resolved above the inputs, which need them.)
    //
    // ⚑ TERMS MAKE A SHEET, TRIGGER OR NOT, and the first pass had this wrong in
    // the one place it mattered. A trigger is the tight fight plate — every
    // field optional, nothing prose, ENTER sends — and the CROSSING act fits
    // that shape exactly (its two fields are both optional), so keying the sheet
    // on "not a trigger" excluded the very panel the ruling was about. Caught by
    // the shot runner, which went looking for a flavor line on the crossing and
    // found none.
    //
    // Tightness is the right priority for an act that throws a die between two
    // swings. It is the wrong priority for an act that is asking you to agree to
    // something: where the door has sent terms, being read is what the panel is
    // for. So terms decide the dress, and the fight plates are unaffected —
    // their classes send none.
    // ⚑ AN ACT WITH NOTHING TO FILL IN IS A DIFFERENT SHAPE OF CARD, and this is
    // the flag that says so. The founder's exit confirm was a page of reading in
    // front of a single unavoidable press: a threshold's prose, a from/to pair, a
    // field, and four term rows, for an act whose whole content is "leave". His
    // shape: WHO, one plain line, confirm — with the terms an expander away.
    // Same test the panel already uses to know there is nothing to type.
    const bare = c.fields.every((f) => !f.required && filled[f.name] == null);
    const terms = shown ? consentHtml(shown, c, { fold: bare }) : "";
    const actorWords = state.acting === HUMAN_ACTOR ? "as yourself" : `as ${esc(state.acting ?? "—")}`;
    // NOTHING LEFT TO TYPE is a state worth saying out loud. Where the door made
    // every field optional and found its own target — which is most of the
    // fight's acts — the form opens with nothing to fill and ENTER sends it, and
    // a reader looking at an empty panel deserves to be told that is the whole
    // of it rather than left hunting for the field they missed.
    //
    // ON A TRIGGER IT IS THE WHOLE INSTRUCTION, so it says the keys rather than
    // a sentence, in the same words and the same corner the chat line already
    // uses. One surface, one way of saying "press this".
    // the same reading as `bare` above — one test, so the two cannot disagree
    // about whether this panel has anything in it to fill
    const nothingToType = bare;
    const ready = trigger
      ? `<span class="keys">↵ send · esc close</span>`
      : c.fields.length && nothingToType
        ? `<p class="pmc-desc">Every field here is the door's to fill — press ENTER to send it as it stands.</p>`
        : "";
    // A trigger keeps the blurb — one line, and it is the only sentence saying
    // what the act DOES — and drops the buttons for the keys, because a plate
    // you send with ENTER does not need a mouse target restating it.
    // (A PANEL DELIVERING TERMS IS A CONSENT SHEET, whatever act it belongs to.
    // No verb decides it: terms arrive on the acts that declare a counter-edge,
    // and the door is the one that says which those are. `sheet` is resolved up
    // beside `shown`, because the inputs read it too.)
    return `<form class="pmc-plate pmc-form${trigger ? " pmc-trigger" : ""}${sheet}" data-form="${esc(action)}">
      <h3>${esc(action.toUpperCase())} <span style="color:var(--pmc-dim);letter-spacing:0">${actorWords}</span></h3>
      ${sheet && !bare ? flavorHtml(c) : ""}
      ${flowRowsHtml(c)}
      ${inputs}
      ${sheet ? ready : ""}${inputs ? datalist : ""}
      ${terms}${said}
      <div class="pmc-actions">
        <button type="submit" class="pmc-btn go">confirm</button>
        <button type="button" class="pmc-btn" data-close>cancel</button>
      </div>
      ${trigger && !sheet ? "" : fineHtml(c)}
    </form>`;
  }

  /**
   * THE ROOM'S OWN SENTENCE, first and large.
   *
   * RULED 2026-08-29: the crossing sheet "dumps every field, vague and verbose"
   * — render the door's flavor line prominently, then only the few terms a
   * player needs.
   *
   * WHOSE SENTENCE IT IS, in the order a reader would want it: the ground the
   * door says you are standing at the threshold of speaks first (a portal's
   * `body` is the room describing itself), and the act's own class blurb stands
   * in where there is no such ground. Both are the record's prose, quoted — the
   * site writes no flavor of its own here, for the same reason it writes no
   * blurb: prose claiming to be law is the one thing this surface must not do.
   */
  function flavorHtml(card) {
    // ⚑ THE ROOM'S ENTRY PROSE RENDERS ON ENTER, AND ON NOTHING ELSE (founder,
    // 2026-08-29, from the live surface). A portal's `body` is the room telling
    // you what it is like to come IN — "Past the inner door the candles go up in
    // tiers until you cannot see the top of them" — and this line handed it to
    // every act whose door sent terms. So the founder read the cellar door's
    // welcome on his EXIT confirm, and again on a LIFT: a room describing its
    // threshold to somebody who is already inside and leaving, or kneeling over
    // a fallen ally. Correct prose, wrong act, twice.
    //
    // ONE COMPOSER WAS GLUING IT ON, which is why the bug arrived on two
    // unrelated acts at once and why the fix belongs here rather than in exit's
    // card. Every other act falls through to its OWN blurb, which is the
    // sentence saying what that act does.
    const entering = ENTER_ACTS.has(card?.action);
    const said = (entering ? portalOf(state.answer)?.body : null) || card?.blurb || null;
    return said ? `<p class="flavor">${esc(said)}</p>` : "";
  }
  /** The acts a threshold's own welcome belongs to. A set rather than a string
   *  compare, because the door has named this act two ways across the rename and
   *  a page built either side of it must read the room the same. */
  const ENTER_ACTS = new Set(["enter"]);

  /**
   * WHO · FROM · TO — the three rows the founder named, and only the ones that
   * mean anything for this act.
   *
   *   "the right side panel popup that has the WHO, the FROM, and the TO (FROM
   *    only if appropriate, so for walk), and the CONFIRM button"
   *
   * WHO is the dock's own selection, so the panel and the faces cannot disagree
   * about whose act this is. FROM and TO belong to an act that goes somewhere:
   * a point-aimed act is walking FROM here, and TO is whatever the target
   * contributed.
   *
   * ⚑ AN EXIT HAS NEITHER, AND SAYS A SENTENCE INSTEAD (founder, 2026-08-29).
   * It had both and both were wrong: FROM named a creature (see leavingName,
   * where the source was fixed), and TO printed a DIRECTION rather than a place
   * — which was in any case the same single fact as FROM, said a second time.
   * A no-choice act does not have a from and a to; it has a thing it does.
   *
   * ⚑ THE ROOM IS STILL SHOWN AND STILL NEVER SENT. The founder's earlier
   * complaint was that exit "requires you to select a slug… considering you have
   * ONE option", and the obvious fix — fill the field in — was tried live and
   * REFUSED by the door: its `within` for stepping back out is the entry it
   * holds, not the extent you are standing inside. The door's own field says to
   * omit it and it will use the innermost. So the sentence names the room for
   * the reader and the act goes out with the field absent, which is what the
   * door asked for and what actually works.
   */
  function flowRowsHtml(card) {
    const rows = [];
    const who = state.acting === HUMAN_ACTOR ? "yourself" : (state.acting ?? "—");
    rows.push(["who", esc(who)]);

    const point = pointFields(card);
    const leaving = (card?.fields ?? []).some((f) => /\bout of\b/i.test(f.description ?? ""))
      ? leavingName(state.answer) : null;

    if (point) {
      const sp = state.answer?.standpoint;
      if (Number.isFinite(Number(sp?.x)) && Number.isFinite(Number(sp?.y))) {
        rows.push(["from", esc(`${Number(sp.x).toLocaleString()}, ${Number(sp.y).toLocaleString()}`)]);
      }
    }

    // the target, where one has been taken
    const to = state.act?.action === card?.action ? state.act.label : null;
    if (to) rows.push(["to", `<b>${esc(to)}</b>`]);

    // ⚑ THE FROM/TO PAIR IS GONE FROM A LEAVING ACT (founder, 2026-08-29, on the
    // live card — he called the pair random text that makes no sense). Both
    // halves were wrong in different ways, and the reasons are in the doc block
    // above. Neither sentence is quoted here on purpose: the falsifier for this
    // asserts the old destination string appears nowhere in the file, and a
    // comment naming it would be prose that reads as the rule.
    //
    // ONE PLAIN LINE REPLACES BOTH, because there is only one fact here and a
    // reader wants it as a sentence: you are stepping out of this room.
    const line = leaving ? `step out of <b>${esc(leaving.label)}</b>` : "";

    return `<div class="pmc-flow">${rows
      .map(([k, v]) => `<div class="pmc-flow-row"><span class="k">${k}</span><span class="v">${v}</span></div>`)
      .join("")}${line ? `<p class="pmc-doing">${line}</p>` : ""}</div>`;
  }

  /**
   * The terms, as a player reads them at the door.
   *
   * `consentSplit` keeps what fits on a line and folds what does not — the
   * door's `articles` and `quoted` come back as whole mark bodies, and those
   * are the forty lines the founder was reading past to reach the button.
   * NOTHING IS DROPPED: the long half is one press away in the same panel, and
   * the sentence that makes this non-negotiable is written on the disclosure
   * itself so the next editor cannot trade it away by accident.
   */
  function consentHtml(terms, card, { fold = false } = {}) {
    const { brief, fine } = consentSplit(terms);
    if (!brief.length && !fine.length) return "";
    // ⚑ ON A NO-CHOICE ACT EVERY ROW FOLDS, and the dial facts are what is left
    // standing (founder, 2026-08-29). His shape for exit was "WHO + one plain
    // line + confirm", with the terms reachable through the expander — and the
    // register he named GOOD was "lifts to 8 · ends turn", which is the dial
    // line rather than the term rows. So on an act with nothing to fill in, the
    // card says what the act does and what it costs, and everything the door
    // sent is one press away instead of four lines of it being read past.
    //
    // NOTHING IS DROPPED, and that is not a nicety: "you cannot be bound by law
    // you were not shown at the door" is the sentence written on the disclosure
    // itself, and folding is showing — refusing to render is not. The summary
    // still says so, and it is still on the panel the hand has committed to.
    const shownRows = fold ? [] : brief;
    const hidden = fold ? termsRows(terms) : fine;
    const rows = shownRows.map((r) =>
      `<span class="pmc-term"><b>${esc(r.key)}</b> ${esc(r.value)}</span>`).join("");
    const speak = dialSpeak(card, { weapon: heldWeapon() });
    return `<div class="pmc-terms${fold ? " is-folded" : ""}">
      ${fold ? "" : `<b class="lede">what you are agreeing to</b>`}
      ${speak ? `<span class="pmc-term"><b>this act</b> ${esc(speak)}</span>` : ""}
      ${rows}
      ${hidden.length ? `<details><summary>${fold ? "what you are agreeing to" : "read them whole"} — you cannot be bound by law you were not shown at the door</summary>${termsHtml(terms)}</details>` : ""}
    </div>`;
  }

  // ── the chat line ─────────────────────────────────────────────────────────
  /**
   * A chat-shaped act, as a chat line rather than a form.
   *
   * RULED 2026-08-28: "everything I can do via the ui buttons, I have to type in
   * like filling an mcp form" — the speaking act should feel like speaking.
   *
   * NO NEW VERB AND NO NEW WIRE. Which act gets this chrome is decided by the
   * SHAPE of the card the door sent (chatShaped: one prose field, nothing else
   * required), the field it writes into is that card's own prose field by the
   * door's own name for it, and what leaves goes out through the same
   * dispatchEnvelope as the form's. A door that renames the field, or grows a
   * second required one, gets the ordinary form back with no edit here.
   */
  function chatHtml(action) {
    const all = barSlots(state.answer, { acting: state.acting });
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    const f = chatField(slot?.card);
    if (!f) return "";
    const cap = statedLimit(f.description);
    const who = state.acting === HUMAN_ACTOR ? "yourself" : (state.acting ?? "—");
    // THE PROMPT IS THE HEAD OF THE DOOR'S OWN SENTENCE, not the whole of it.
    // A field description is written for a form's caption, where there is room
    // for the limit and the caveats; in a one-line box it ran off the end and
    // read as "what you say, at most 500 charac" — seen in the shot. The first
    // clause is still the door's words, just the part that fits. The full
    // sentence is not lost: the act's card still quotes it whole on hover.
    const prompt = String(f.description ?? f.name).split(/\s*[,—–]\s*/)[0];
    const said = state.said
      ? `<p class="pmc-said${state.said.ok ? "" : " bad"}">${esc(state.said.text)}</p>`
      : "";
    return `<form class="pmc-plate pmc-chat" data-form="${esc(action)}" data-chat="${esc(f.name)}">
      <span class="who">${esc(action.toUpperCase())} · ${esc(who)}</span>
      <input type="text" data-field="${esc(f.name)}" autocomplete="off"
        ${cap ? `maxlength="${cap}"` : ""}
        aria-label="${esc(f.name)}" placeholder="${esc(prompt)}">
      <span class="keys">↵ send · esc close</span>
      ${said}
    </form>`;
  }

  /**
   * THE ACT IS ARMED AND THE MAP IS THE QUESTION.
   *
   * ⚑ IT SUPERSEDES THE OBJECT-FIRST MENU (`contextHtml`/`contextActs`, ruled in
   * on 2026-08-28 and ruled out on 2026-08-29), and the old shape is named here
   * rather than quietly deleted so the next reader can tell a reversal from a
   * regression. That menu opened on a click on a thing and offered every act the
   * ground affords with the thing seeded into a field. The founder, playing:
   * that behaviour is nonsensical. It was, and the reason is structural rather
   * than cosmetic — a surface with no verb list cannot know which pairings mean
   * anything, so it offered all of them, and the menu's own note admitted as
   * much while defending it ("a neutral pairing, not a sentence … written as
   * '<act> <thing>' the menu read 'walk the unlit cake'").
   *
   * VERB-FIRST NEVER HAS TO KNOW. The reader names the act, so the only question
   * left is which of the things the ANSWER placed it is pointed at — and that is
   * a question the door's own words can answer (`aimField`, `aimTargets`).
   *
   * This strip is the act form for an armed act: one line saying what is armed,
   * the targets the map could not place as chips, and the keys. The placed ones
   * are on the painting and are pressed there.
   */
  function aimHtml() {
    const { action } = state.aiming;
    const targets = targetsFor(action);
    const loose = targets.filter((t) => !t.at);
    const placed = targets.length - loose.length;
    const tell = placed
      ? `pick a target on the map${loose.length ? " — or here" : ""}`
      : "pick a target";
    const chips = loose.map((t) =>
      `<button type="button" data-aim-at="${esc(t.value)}" title="${esc(t.why ?? "")}">${esc(t.label)}</button>`).join("");
    const said = state.said
      ? `<p class="pmc-said${state.said.ok ? "" : " bad"}">${esc(state.said.text)}${state.said.hint ? `<span class="hint">${esc(state.said.hint)}</span>` : ""}</p>`
      : "";
    return `<div class="pmc-plate pmc-aim" role="group" aria-label="${esc(action + " — pick a target")}">
      <span class="arm">${esc(action.toUpperCase())} ▸</span>
      <span class="tell">${esc(tell)}</span>
      ${chips}
      <span class="keys">esc cancels</span>
      ${said}
    </div>`;
  }

  /** Which chrome this act opens in. The card decides; nothing here is a name. */
  function opensAsChat(action) {
    const all = barSlots(state.answer, { acting: state.acting });
    const slot = [...all.fixed, ...all.tray].find((s) => s.action === action);
    return chatShaped(slot?.card);
  }

  // ── the initiative wheel ──────────────────────────────────────────────────
  function drawWheel() {
    const enc = encounterOf(state.answer);
    if (!enc) return "";
    const faces = actorsFor(state.answer, o.me, { acting: state.acting });
    // THE ADVERSARY'S HP IS IN THE OTHER BLOCK, and the wheel has to make the
    // same join the map does. The office builds each wheel row's `hp` out of
    // `state.hands`, which holds the JOINERS — the hostile is not one of them —
    // so the boss's row arrives with no hp at all while `encounter_detail`
    // states it plainly. Left alone the wheel showed the cake with an empty rail
    // beside a map ring reading 41 of 60: one number, two surfaces, disagreeing.
    // Seen in the shot, which is the only place it could have been seen.
    const adv = adversaryOf(state.answer);
    const rows = enc.order.map((a) =>
      (!a.hp && adv && a.id === adv.id && Number.isFinite(adv.hp) && Number.isFinite(adv.of) && adv.of > 0)
        ? { ...a, hp: { now: adv.hp, max: adv.of } }
        : a);
    // THE WHEEL WEARS THE SAME FACES THE DOCK DOES (2026-08-29). It read
    // tokenFor, which answers for the human and nobody else, so the one surface
    // a player watches for their turn showed one photograph and a row of
    // letters. Now both surfaces resolve a picture through faceImageFor, off
    // the same roster and the same profile bubbles — a resident cannot have a
    // face in the dock and a letter on the wheel.
    // ⚑ AND FOR EVERY HAND IN THE ROOM, not only the ones on this key. The
    // roster holds the residents this reader can ACT AS; the wheel holds
    // everyone in the fight. Resolving only through the roster gave the
    // founder's own two residents portraits and left every other player in the
    // room wearing a letter — the same inconsistency this change exists to end,
    // reproduced one surface further along. A wheel row IS a resident row for
    // this purpose: the id is the handle.
    const pictureFor = (a) => {
      if (a.kind === "creature") return null;
      const row = a.kind === "human"
        ? faces.find((f) => f.kind === "human")
        : (faces.find((f) => f.kind === "resident" && f.handle === a.id)
          ?? (a.id ? { kind: "resident", handle: a.id, label: a.label } : null));
      return row ? faceImageFor(row, state.profiles) : null;
    };
    const seat = (a) => {
      const token = pictureFor(a);
      const inner = token?.src
        ? `<span class="pmc-mono">${esc(token.monogram ?? (a.label || "?").slice(0, 1).toUpperCase())}</span><img src="${esc(token.src)}" alt="" loading="lazy">`
        : esc((a.label || "?").slice(0, 1).toUpperCase());
      const hp = a.hp
        // A bar that reads 0% is indistinguishable from a bar that failed to
        // render, so a downed actor's rail is shown empty by an explicit width.
        ? `<span class="hp"><i style="width:${Math.max(0, Math.min(100, Math.round((a.hp.now / a.hp.max) * 100)))}%"></i></span>`
        : "";
      const cls = ["pmc-turn",
        a.current ? "is-current" : "",
        a.down ? "is-down" : "",
        a.you ? "is-you" : "",
        a.kind === "creature" ? "is-creature" : ""].filter(Boolean).join(" ");
      const label = `${a.label}${a.down ? " — down" : ""}${a.current ? " — acting now" : ""}${a.joinedRound ? `, joined at round ${a.joinedRound}` : ""}`;
      return `<li class="${cls}" aria-label="${esc(label)}"${a.current ? ' aria-current="true"' : ""}>
        ${a.joinedRound ? `<span class="late" title="joined at round ${a.joinedRound}">+${a.joinedRound}</span>` : ""}
        <span class="pip">${inner}</span>
        <span class="nm">${esc(a.label)}</span>
        <span class="init">${a.initiative == null ? "" : esc(String(a.initiative))}</span>
        ${hp}
      </li>`;
    };
    const whose = rows.find((a) => a.current);
    // ⚑ A WHEEL THAT IS NOT TURNING MUST SAY SO (founder, 2026-08-28: "I also
    // tried striking and it's just stuck now? like when does the cake take its
    // turn?"). He was in an encounter the door was answering `live: false` for:
    // the cake had never taken its slot, so the wheel held one row, the turn
    // gate was never engaged, and his strikes landed on a fight that had not
    // opened. The office no longer produces that state — the open is asked on
    // every door touch — but the state is REPRESENTABLE, and while it was on
    // screen this plate showed a tidy round counter and told him nothing.
    //
    // So the cap reads the door's own `live` rather than inferring liveness
    // from the presence of an encounter. A player who is stuck should be able
    // to see that they are stuck, and see it here, on the thing they are
    // watching for their turn.
    const d = state.answer?.encounter_detail;
    const dead = d && d.live === false;
    const cap = dead
      ? `no fight is open here — nothing has taken the other slot, so no turn is owed`
      : `${enc.round == null ? "" : `round ${esc(String(enc.round))} · `}${whose ? esc(whose.label) + " is acting" : "waiting"}`;
    return `<div class="pmc-plate pmc-wheel${dead ? " is-quiet" : ""}">
      <div class="pmc-wheel-cap">
        <b>INITIATIVE</b>
        <span>${cap}</span>
      </div>
      <ol class="pmc-wheel-row">${rows.map(seat).join("")}</ol>
    </div>`;
  }

  // ── the throw ─────────────────────────────────────────────────────────────
  /**
   * Show a roll the door sent back. Nothing here decides what a throw MEANS —
   * `crit` is read, never computed, because a crit is a rule of the encounter and
   * a client comparing value to faces would be inventing law.
   */
  function showThrow(rolls) {
    if (!rolls.length) return;
    const host = doc.createElement("div");
    host.className = "pmc-throw";
    host.setAttribute("role", "status");
    host.innerHTML = rolls.slice(0, 4).map((r, i) => {
      const cls = ["pmc-die", r.crit ? "is-crit" : "", !r.crit && r.atMax ? "at-max" : ""].filter(Boolean).join(" ");
      const sum = r.modifier
        ? `${r.value} ${r.modifier > 0 ? "+" : "−"} ${Math.abs(r.modifier)} = ${r.total}`
        : String(r.total);
      const said = r.crit ? "CRIT" : r.for ? r.for.toUpperCase() : "";
      return `<div class="${cls}" style="animation-delay:${i * 90}ms">
        <div class="face">${esc(String(r.value))}</div>
        ${said ? `<span class="whose">${esc(said)}</span>` : ""}
        <span class="sum">${esc(r.die ? r.die + " · " : "")}${esc(sum)}${r.against ? " → " + esc(r.against) : ""}</span>
      </div>`;
    }).join("");
    throwLayer.appendChild(host);
    // It leaves on its own. A result the reader has already watched land should
    // not wait to be dismissed, and a crit is given longer because it is the
    // thing people will look up for.
    const stay = rolls.some((r) => r.crit) ? 4200 : 2600;
    doc.defaultView?.setTimeout(() => host.remove(), stay);
  }

  // ── the fighter's plate ───────────────────────────────────────────────────
  /**
   * THE CARD THAT HANGS OFF THE DOCK, and what it says now.
   *
   * ⚑ IT SUPERSEDES THE STANDPOINT RECITATION (founder, 2026-08-29): the plate
   * printed which seat the read rooted at and the whole containment chain, and
   * his verdict on it was "useless for the human to see". The ruling: "replace
   * the info in the larger card with their inventory (aka whether they are
   * carrying the weapon, with an icon!) as well as their HP bar with numbers
   * and whatever other stats".
   *
   * The old content is NAMED rather than silently swapped, because a plate that
   * quietly changes what it is about reads as drift. What it said — the acting
   * seat, the portal it roots in, the `within` chain — was answering a
   * developer's question about where the read came from, on a surface a player
   * uses to decide who swings next. Nothing is orphaned: the chain is still in
   * the answer, and the standpoint is still drawn on the map itself.
   *
   * WHOSE STATE, and this is the other half of the ask ("the ACT AS bar's HOVER
   * should show the larger card"): whichever face the pointer or the keyboard is
   * on (`state.peek`), falling back to whoever is acting. So the dock became a
   * way to LOOK at the party without changing who you are, which is what a
   * roster of faces was always shaped like.
   *
   * ITS ANCHOR AND ITS CHROME ARE UNCHANGED — same box, same 3.2em clearance
   * measured off the faces, same hover reveal. Only the words inside it moved.
   */
  function drawHere() {
    const who = state.peek ?? state.acting;
    const f = faces().find((x) => (x.kind === "human" ? HUMAN_ACTOR : x.handle) === who) ?? null;
    const s = fighterState(state.answer, who);
    // The name is the WHEEL's where the wheel has them, and the roster's where
    // it does not — one person, two records, and the wheel is the one the rest
    // of this plate is quoting.
    const name = s.label ?? f?.label ?? (who === HUMAN_ACTOR ? "yourself" : who ?? "a spectator");
    const mine = who === HUMAN_ACTOR ? `<span class="tag you">yourself</span>` : "";
    // A REFUSED FACE EXPLAINS ITSELF HERE NOW. It was the small name box's one
    // job — "a greyed circle that will not say why is the surface refusing to
    // explain the law it is enforcing" — and that box is gone, so the plate
    // takes the sentence over rather than letting it fall on the floor.
    if (f && !f.allowed) {
      return `<div class="pmc-plate pmc-here" role="tooltip">
        <div class="who">${esc(name)} <span class="tag cold">cannot act here</span></div>
        <div class="spine">${esc(f.reason ?? "not here")}</div>
      </div>`;
    }
    return `<div class="pmc-plate pmc-here" role="tooltip">
      <div class="who">${esc(name)}${mine}${s.down ? `<span class="tag down">down</span>` : ""}${s.current ? `<span class="tag turn">acting now</span>` : ""}</div>
      ${hpRowHtml(s)}
      ${statRowHtml(s)}
      ${kitHtml(s)}
      ${journalLine(who)}
    </div>`;
  }

  /**
   * THE ONE LINE ON THIS PLATE THAT IS NOT ABOUT THE FIGHTER — the standing
   * disclosure that the hand writes down what it does.
   *
   * ⚑ IT WAS ORPHANED AND IS BEING PUT BACK. It began as the dock's `title`,
   * moved onto the plate when that native tooltip became a third card on one
   * hover, and then went out with the standpoint recitation when the plate was
   * emptied — not by a ruling, but by a rewrite. Nothing else on this surface
   * says it now, and the rail's own shot runner is still asserting that the
   * plate does, which is how the drop was found. A disclosure about what the
   * surface RECORDS is not the kind of sentence to lose by accident.
   *
   * ONLY OVER YOUR OWN SEAT, and the narrowing is the honest half of putting it
   * back. The plate's own rule now is that it is about the fighter you are
   * pointing at — the ground's sentence was taken off it for exactly that reason
   * — and this line is about the SURFACE, not about them. Over an ally's hit
   * points it would read as a claim about that ally, which is both untrue and
   * the noise this card was cleared of. Over the seat you are acting as, it is
   * about your own hand, which is whose recording it discloses.
   */
  function journalLine(who) {
    if (who !== state.acting) return "";
    return `<div class="spine">the hand journals on every act — recorded, never gated</div>`;
  }

  /**
   * THE HIT POINTS, AS A BAR WITH THE NUMBERS ON IT — the founder's own words,
   * and the same reading the rail over their figure is drawn from, so the plate
   * and the map cannot disagree about how hurt somebody is.
   *
   * A FIGHTER WHO IS NOT ON THE WHEEL GETS NO BAR, and says so. Standing in the
   * room and not being in the fight is a real state; an empty bar would read as
   * a fighter at zero, which is the opposite of the truth.
   */
  function hpRowHtml(s) {
    if (!s.onWheel) return `<div class="spine">not in this fight</div>`;
    if (!s.hp) return `<div class="spine">on the wheel — the door states no hit points</div>`;
    const frac = Math.max(0, Math.min(1, s.hp.now / s.hp.max));
    return `<div class="pmc-hp${s.down ? " out" : ""}" role="img"
      aria-label="${esc(`${s.hp.now} of ${s.hp.max} hit points`)}">
      <span class="fill" style="width:${(frac * 100).toFixed(1)}%"></span>
      <span class="num">${s.hp.now}/${s.hp.max}</span>
    </div>`;
  }

  /**
   * THE OTHER STATS WORTH THE ROOM: when they act, and who is acting instead.
   * Each clause is dropped where the door did not answer it, rather than printed
   * with a dash — a plate of em-dashes is the debug panel again.
   *
   * ⚑ AND THE DOOR'S SENTENCE ABOUT WHY A HUMAN MAY STAND HERE IS NOT ON IT.
   * The first draft put `humanWords` in this row, reasoning that a line the
   * deleted name box used to carry should not be orphaned. The shot showed what
   * that reasoning missed: it rendered "inside the-town/the-candle-vault — a
   * portal's ground seats a human", wrapped over two lines, and it is a fact
   * about the GROUND wearing a fighter's plate — which is the recitation this
   * whole card was replaced for. It is still on the face's own accessible name,
   * where a reader who wants it can get it and a player mid-fight does not have
   * to read past it.
   */
  function statRowHtml(s) {
    const bits = [];
    if (s.initiative != null) bits.push(`initiative ${s.initiative}`);
    if (s.joinedRound != null) bits.push(`joined round ${s.joinedRound}`);
    if (s.onWheel && !s.current && s.turnOf) bits.push(`waiting on ${s.turnOf}`);
    return bits.length ? `<div class="spine">${esc(bits.join(" · "))}</div>` : "";
  }

  /**
   * WHAT IS IN THEIR HAND, WITH AN ICON — the ask, verbatim on the icon.
   *
   * AND EMPTY-HANDED IS ALSO AN ANSWER. The question he asked is "are they
   * carrying the weapon", which is a yes/no; a plate that renders the row only
   * when there IS one makes the reader guess whether the absence means nothing
   * held or nothing known. Both are said.
   *
   * THE CLAUSE IS THE RECORD'S. `weaponFor` names which act the bonus augments
   * off the held grant's own entry, and where the record does not say, no clause
   * is printed — the standing rule on this surface that "the record did not say"
   * and "the site guessed" must never look alike.
   */
  function kitHtml(s) {
    const w = s.weapon;
    if (!w) return `<div class="kit none">${ICON_HAND}<span>empty-handed</span></div>`;
    const clause = w.for ? `+${w.bonus} to ${esc(w.for)}` : `+${w.bonus}`;
    return `<div class="kit">${ICON_HAND}<span>${esc(w.label)}</span><b>${clause}</b></div>`;
  }

  // ── the token on the map ──────────────────────────────────────────────────
  /** Map units per CSS pixel, right now. The viewBox IS the camera on this map
   *  (the viewer's own words), so its width against the element's width is the
   *  whole of the zoom — no viewer internal is reached for. */
  function unitsPerPx() {
    const svg = liveSvg();
    if (!svg) return 1;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    const w = svg.getBoundingClientRect?.().width || svg.clientWidth || 0;
    if (vb.length !== 4 || !isFinite(vb[2]) || vb[2] <= 0 || !w) return 1;
    return vb[2] / w;
  }

  // ── the camera, on the room you are standing in ────────────────────────────
  /**
   * PUT THE ROOM IN FRAME.
   *
   * The founder, 2026-08-28: "the cake ring doesn't even appear on the screen,
   * it's clipped off the bottom of the candle vault." Standing inside a three
   * by two metre room, the painting was still framed on the town — so the fight
   * was a handful of pixels at the bottom edge of a map of the county, and the
   * one thing he was fighting was off the end of it.
   *
   * ⚑ WHOSE COORDINATES THESE ARE, because on this ground it is the whole
   * question. The scene is framed on the DOOR's numbers — the standpoint, the
   * adversary's `at`, whatever is loose on the floor — and NOT on the painting's.
   * Those two disagree right now and the disagreement is not a bug in either:
   * the painting is built from the pinned world package, and the dungeon's props
   * were re-sited in a stage clone the site's build has never seen. Read live
   * 2026-08-28: the door puts the cake at (1083, -791.7), inside the vault; the
   * staged record still has it at (1097, -783.5), which is outside. The cockpit
   * already draws the ring, the token and the loose things from the door, so
   * framing on the door is what makes the camera agree with the things it is
   * pointed at. The room drawn underneath is the painting's business.
   *
   * ⚑ AND IT IS A RAW viewBox WRITE, disclosed rather than tidied away. The
   * viewer HAS a camera — `mapCtx.frameOn`, `mapCtx.setView`, `mapCtx.lockOn`,
   * every one of them better than this — but `mapCtx` is a module-local in the
   * viewer's closure and is published on nothing: not the window, not the root
   * element, not an event. There is no seam to call. So this writes the
   * attribute the viewer's own `applyView` writes, which is the same mechanism
   * one layer lower, and it accepts the cost that comes with it: a later pan,
   * zoom, follow or refit runs through `applyView` and simply wins. That is why
   * this fires on ARRIVAL rather than continuously — a camera that reasserted
   * itself every frame would fight the reader's hand for the map, and the hand
   * must win. THE CLEAN FIX IS ONE LINE IN THE VIEWER (publish mapCtx, or listen
   * for an event and call frameOn); it belongs in the world repo and a pin bump,
   * which is not this lane's to spend.
   */
  let framedKey = null;
  function sceneKey() {
    const d = state.answer?.encounter_detail;
    const p = state.answer?.standpoint;
    if (!d?.ground) return null;
    return `${d.ground}|${p?.x}|${p?.y}`;
  }
  /**
   * THE CAMERA IS ASKED FOR, NOT TAKEN (2026-08-29, the night the founder
   * zoomed once and left the room). The raw viewBox write this replaces moved
   * the attribute and left the viewer's own `view` object standing — so one
   * wheel notch wrote the stale view straight back over the room ("the moment
   * I try to zoom, it just kicks me out to the parent level view"), and every
   * decoration sized off the stale zoomK sprawled across the map, one panel
   * burying three verbs of the action bar. The viewer now listens for
   * `pm:frame-on` (world repo 9265544f, "the camera is asked for, not taken")
   * and frames through its OWN applyView — view and attribute never disagree,
   * and the reader's zoom composes with the frame instead of ejecting it.
   *
   * The detail is world METRES on the door's own coordinates: this island
   * knows nothing of the painting's units, which is the point of asking. Asked
   * once per scene (ground + standpoint); the hand needs no bookkeeping here
   * any more, because pan and zoom ride the same camera and simply move it.
   */
  function frameScene() {
    const key = sceneKey();
    if (!key || key === framedKey) return;
    const pts = [];
    const push = (pt) => { if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) pts.push(pt); };
    push({ x: Number(state.answer?.standpoint?.x), y: Number(state.answer?.standpoint?.y) });
    const advId = adversaryOf(state.answer)?.id;
    const nearby = Array.isArray(state.answer?.nearby) ? state.answer.nearby : [];
    push(nearby.find((m) => m?.id === advId)?.at);
    for (const t of looseThings(state.answer)) push(t.at);
    if (!pts.length) return;
    const xs = pts.map((pt) => pt.x), ys = pts.map((pt) => pt.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    // The floor is the innermost ground's own stated extent — a lone standpoint
    // still frames the room around it rather than a point. All metres, the
    // door's units end to end: nothing here reads the camera it is replacing.
    const within = Array.isArray(state.answer?.within) ? state.answer.within : [];
    const roomM = Number(within[within.length - 1]?.extentM);
    const floorM = Number.isFinite(roomM) && roomM > 0 ? roomM : 8;
    const pad = Math.max(floorM * 0.75, spanX * 0.25, spanY * 0.25, 2);
    const extent = Math.max(spanX + pad * 2, spanY + pad * 2, floorM * 1.6);
    const w = doc.defaultView ?? globalThis;
    try { w.dispatchEvent(new w.CustomEvent("pm:frame-on", { detail: { at: { x: cx, y: cy }, extent_m: extent } })); } catch {}
    framedKey = key;
  }

  /**
   * What is lying on the floor, drawn where it fell.
   *
   * A downed actor's weapon drops loose and becomes takeable by whoever is
   * standing there — the founder called it the dramatic moment, so it is drawn on
   * the ground rather than listed in a panel. Screen-sized like the token and the
   * walkers, for the same reason: a thing that changed size relative to the people
   * around it would be saying something about the thing.
   */
  function drawLoose() {
    if (!tokenLayer || !gridNow()) return "";
    const u = unitsPerPx();
    return looseThings(state.answer).map((t) => {
      const at = worldToPx(gridNow(), t.at);
      if (!at) return "";
      const r = 9 * u;
      const who = t.dropped_by ? ` — dropped by ${t.dropped_by}` : "";
      return `<g class="pmc-loose" transform="translate(${at.x} ${at.y})">
        <circle cx="0" cy="0" r="${r * 1.9}" fill="#e0894e" fill-opacity="0.12"/>
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="#e0894e" stroke-width="${r * 0.2}" stroke-dasharray="${r * 0.5} ${r * 0.34}"/>
        <path d="M ${-r * 0.62} ${r * 0.62} L ${r * 0.62} ${-r * 0.62}" stroke="#e0894e" stroke-width="${r * 0.26}" stroke-linecap="round"/>
        <title>${esc(t.label)} — on the ground${esc(who)}</title>
      </g>`;
    }).join("");
  }

  /**
   * WHAT STANDS AGAINST YOU, drawn where it stands.
   *
   * THE PROBLEM THIS SOLVES, and it is worth stating because the map looks
   * broken rather than incomplete without it: the painting is derived from the
   * settled fold, and the fold carries the dungeon's rooms but the FIGHT is not
   * a fact of the fold at all — so a reader in the candle vault sees a floor
   * with nothing on it while the bar beside them says they are three rounds into
   * a fight with something. The cake is invisible. The answer already holds
   * everything needed to draw it; it just holds it in two pieces
   * (`adversaryPlacement` joins them, and its own note says why there is no
   * fallback coordinate here).
   *
   * SIZED IN SCREEN PIXELS, like the token and the walkers and the loose things,
   * and for the same measured reason: a figure that changed size relative to the
   * people around it would be saying something about the figure. Bigger than a
   * person because it is — the ring is the room's ninth tier of candles, not a
   * head — but bigger by a constant, so the whole scene zooms together.
   *
   * The hp bar is the door's arithmetic shown, never the site's: `hp` and `of`
   * are the numbers `publicState` sent, and a bar with either missing simply is
   * not drawn rather than guessing a full one.
   */
  /**
   * HOW BIG THE THING YOU ARE FIGHTING IS, in screen pixels.
   *
   * ⚑ TRIPLED ON THE FOUNDER'S WORD (2026-08-29, live in the vault): the cake
   * "reads too small". It was 20, sized when the ring was one figure among
   * several on a town map; in a three-metre room it is the room's whole subject
   * and the only thing anyone is looking at.
   *
   * ONE CONSTANT, THREE READERS, and that is the point of naming it. The
   * drawing, the hit-test that decides whether a click landed on it, and the
   * reticle that lights it while an act is armed all measured it separately
   * before — so tripling the picture alone would have left a click landing on
   * empty floor a third of the way in, and a crosshair sitting inside the
   * figure it was supposed to frame. Everything the group draws is a multiple
   * of this, the hp bar included, so the bar grows with it exactly as the
   * founder asked.
   */
  const ADVERSARY_R = 60;
  /** …and a thing on the floor, which did not change. */
  const LOOSE_R = 9;

  function drawAdversary() {
    if (!tokenLayer || !gridNow()) return "";
    const placed = adversaryPlacement(state.answer, gridNow());
    if (!placed) return "";
    const { at, adversary: a } = placed;
    const u = unitsPerPx();
    const r = ADVERSARY_R * u;
    const hasBar = Number.isFinite(a.hp) && Number.isFinite(a.of) && a.of > 0;
    const frac = hasBar ? Math.max(0, Math.min(1, a.hp / a.of)) : 0;
    const bw = r * 2.6;
    const by = r * 1.5;
    // THE EMBER PALETTE IS THE ARENA'S OWN (--pmc-accent, #e2603f) — but this is
    // svg inside the viewer's painting, not inside the .pmc overlay, so the
    // custom property does not reach it and the value is written out. Kept the
    // same two hex values the stylesheet's arena block holds; if that block
    // moves, this is the second place to move.
    const ember = "#e2603f";
    // ── AT REST: THE RING AND THE BAR. ON HOVER: THE WORDS. ──────────────────
    //
    // FOUNDER-RULED 2026-08-29, the same sitting that put the name there: take
    // the name text off the figure, and move the numbers INTO the bar, revealed
    // on hover — "to keep the map clean". So the standing picture is a ring and
    // a rail, and both sentences about the creature arrive together when a
    // reader asks for them by pointing.
    //
    // ⚑ THE NAME IS HIDDEN, NOT DELETED, and that is the one place I did not
    // do exactly as asked. The ask assumed the name would still be on "the
    // hover plate/title where it always was" — but `<title>` on this layer
    // cannot fire: the whole token layer is `pointer-events: none` (see
    // ensureTokenLayer), so no browser tooltip has ever appeared over this
    // figure and none would appear over it now. Deleting the plate outright
    // would have left the map with an orange ring and no way at all to learn
    // what it is, which is the exact complaint the plate was built to answer.
    // So hover reveals the plate AND the numbers, and the plate is the hover
    // plate the ruling names. The wheel up top still carries the name always.
    //
    // WHAT COUNTS AS HOVER IS THE HIT-TEST, NOT `:hover`, for the same reason —
    // a layer that takes no pointer events has no CSS hover state either. The
    // pointer's position is run through `thingAt`, the SAME reader the click
    // uses, so what lights under the cursor and what a press would resolve to
    // are one answer by construction rather than two that agree today.
    const hot = state.hover === a.id;
    // ⚑ THE RAIL TAKES THE ROOM THE NUMBERS NEED, rather than the numbers being
    // shrunk to fit the rail — measured, and the measurement is why. The resting
    // rail is thirteen screen pixels; digits sized to sit inside that render at
    // ten, which is the size the first hp rails shipped at and could not be read
    // on a night map. So the rail thickens while it is being read and goes back
    // to a slim mark when it is not, which is also the reveal saying it happened.
    const bh = hot ? r * 0.42 : r * 0.26;
    const numbers = hasBar && hot
      // INSIDE THE RAIL, not beside it: the bar is 2.6 radii wide and the
      // numbers are seven characters, so they fit with room to spare. Painted
      // with a dark halo under a pale fill (`paint-order`) because the text
      // crosses BOTH of the rail's grounds — the lit ember on the left of the
      // fill line and the dark ground on its right — and one flat colour is
      // unreadable over one of them whichever colour is chosen.
      ? `<text x="0" y="${by + bh / 2}" text-anchor="middle" dominant-baseline="central"
           font-size="${r * 0.3}" font-family="ui-monospace, Consolas, monospace"
           paint-order="stroke" stroke="#0d1015" stroke-width="${r * 0.07}" stroke-linejoin="round"
           fill="#fdf1ea">${a.hp}/${a.of}</text>`
      : "";
    return `<g class="pmc-adversary${hot ? " hot" : ""}" transform="translate(${at.x} ${at.y})">
      <defs><radialGradient id="pmc-adv-glow">
        <stop offset="45%" stop-color="${ember}" stop-opacity="0.34"/>
        <stop offset="100%" stop-color="${ember}" stop-opacity="0"/>
      </radialGradient></defs>
      <circle cx="0" cy="0" r="${r * 2.4}" fill="url(#pmc-adv-glow)"/>
      <circle cx="0" cy="0" r="${r * 1.34}" fill="none" stroke="${ember}" stroke-width="${r * 0.06}" stroke-opacity="0.5"/>
      <circle cx="0" cy="0" r="${r}" fill="none" stroke="${ember}" stroke-width="${r * 0.16}"
        stroke-dasharray="${r * 0.9} ${r * 0.42}"/>
      <circle cx="0" cy="0" r="${r * 0.52}" fill="${ember}" fill-opacity="0.22"/>
      ${hasBar ? `<g class="pmc-adv-hp">
        <rect x="${-bw / 2}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}"
          fill="#0d1015" fill-opacity="0.8" stroke="${ember}" stroke-width="${r * 0.03}" stroke-opacity="0.55"/>
        <rect x="${-bw / 2}" y="${by}" width="${bw * frac}" height="${bh}" rx="${bh / 2}" fill="${ember}"/>
        ${numbers}
      </g>` : ""}
      ${/* ⚑ THE NAME PLATE (.pmc-adv-name) STOOD HERE AND IS GONE (founder,
           2026-08-29, superseding the same day's keep-it-hidden call).

           IT WAS BUILT for a real complaint — "it's not clear at ALL that the
           Unlit Cake mark has ANYTHING to do with the unlit cake enemy, the
           orange ring is so random" — and then kept on hover rather than
           deleted, on the reasoning that a ring with no words at all would be
           unnameable. THE FOUNDER OVERRULES THAT REASONING with the fact it
           missed: "the unlit cake is BOTH A MARK AND AN ENTITY, which makes
           things very redundant." The cake is not a nameless ring. It is a MARK
           standing on this floor, whose own hover card names it, and a fighter
           on the wheel, whose seat names it. A third plate under the same
           pointer was a second answer to a question already answered twice.

           SO HOVER IS THE NUMBERS AND ONLY THE NUMBERS: the rail thickens and
           its hp/of appears inside it, which is the one thing about this
           creature neither of the other two surfaces states in the moment. The
           reasoning is recorded rather than the code silently shrinking, so a
           later reader does not re-derive the hidden-plate compromise from the
           same premise the founder has already answered. */""}
      <title>${esc(a.label)}${hasBar ? ` — ${a.hp} of ${a.of}` : ""}${a.body ? ` — ${esc(a.body)}` : ""}</title>
    </g>`;
  }

  /**
   * WHAT WAS JUST SAID, drawn where it was said.
   *
   * The other half of the chat ruling: a line you type should appear somewhere,
   * and the somewhere that means anything on this surface is beside whoever said
   * it. Each voice carries its own coordinates — where the speaker STOOD when
   * they spoke, which is not where they are standing now, and a line that
   * followed its speaker around would be saying something untrue about a sound.
   *
   * It fades on the door's own clock (`recentVoices` reads `fade_minutes` off the
   * answer), so a line goes quiet exactly when the world says the sound has. That
   * is also why nothing here has to clean up: the list simply stops containing it.
   *
   * Screen-sized like everything else the cockpit puts on this map.
   */
  function drawVoices() {
    if (!tokenLayer || !gridNow() || !state.voices.length) return "";
    const u = unitsPerPx();
    return state.voices.map((v) => {
      const at = worldToPx(gridNow(), v.at);
      if (!at) return "";
      // A line has to be readable over a night map whatever it lands on, so it
      // carries its own ground — the same reason the die's caption does.
      //
      // SIZED BY LOOKING AT IT. The first pass used 11, which put the said text
      // at about nine screen pixels and the speaker's name at seven — present in
      // the DOM, correct in every measurement, and not actually readable in the
      // shot. This is the whole reason the shot runner exists beside the unit
      // tests on this surface.
      const size = 15 * u;
      // FITTED TO THE PAINTING, not to a character count. SVG text does not
      // wrap, so a long line is one long box — and at 390 a ninety-character cap
      // drew a bubble wider than the phone it was on. The budget is a share of
      // the visible map rather than a number of letters, so the same sentence
      // fits differently on a phone and on a desktop, which is correct: it is
      // the painting that ran out of room, not the sentence that got longer.
      const view = Number((o.svg?.getAttribute("viewBox") ?? "").split(/[\s,]+/)[2]);
      const room = isFinite(view) && view > 0 ? view * 0.62 : 96 * size * 0.52;
      const fits = Math.max(12, Math.floor((room - size * 1.2) / (size * 0.52)));
      const said = v.said.length > fits ? v.said.slice(0, fits - 1) + "…" : v.said;
      const w = (said.length * size * 0.52) + size * 1.2;
      const h = size * 2.6;
      const lift = 16 * u;
      return `<g class="pmc-voice" opacity="${(0.25 + 0.75 * v.freshness).toFixed(3)}"
        transform="translate(${at.x} ${at.y - lift})">
        <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="${size * 0.9}"
          fill="#0d1015" fill-opacity="0.86" stroke="#d9a860" stroke-opacity="0.5" stroke-width="${size * 0.07}"/>
        <path d="M ${-size * 0.42} ${-h * 0.02} L 0 ${size * 0.66} L ${size * 0.42} ${-h * 0.02} Z"
          fill="#0d1015" fill-opacity="0.86"/>
        <text x="0" y="${-h * 0.52}" text-anchor="middle" font-size="${size * 0.62}"
          fill="#9aa1ad" font-family="ui-monospace,Consolas,monospace">${esc(v.handle)}</text>
        <text x="0" y="${-h * 0.14}" text-anchor="middle" font-size="${size * 0.86}"
          fill="#e8e4da" font-family="Georgia, serif">${esc(said)}</text>
      </g>`;
    }).join("");
  }

  /**
   * THE THINGS AN ARMED ACT MAY BE AIMED AT, lit.
   *
   * RULED 2026-08-29: press the act, and "the cake should be highlighted and
   * clickable". This is the highlight; the clickable half is `onMapClick`,
   * which hit-tests the same figures through `thingAt`.
   *
   * ⚑ IT TAKES NO POINTER, DELIBERATELY, and that is the living-references law
   * being obeyed rather than worked around. A ring with `pointer-events: auto`
   * would need a listener, and a listener on an svg child dies silently the
   * next time the viewer rebuilds its painting — which is the seam that cost
   * six bugs in one night and is why `onMapClick` lives on the document and
   * resolves its geometry at use time. The rings are paint. The clicks are the
   * document's, hit-tested against the answer, and nothing is held.
   *
   * A target the answer could not place draws nothing here and is offered as a
   * chip on the strip instead (`aimHtml`) — nothing is drawn at a coordinate
   * this file does not hold, which is the rule the token and the ring already
   * follow.
   */
  function drawAim() {
    if (!state.aiming || !tokenLayer || !gridNow()) return "";
    const u = unitsPerPx();
    return targetsFor(state.aiming.action).map((t) => {
      if (!t.at) return "";
      const at = worldToPx(gridNow(), t.at);
      if (!at) return "";
      // ⚑ LOUD, BECAUSE HIS EYES ARE THE SPEC. The first version was a thin
      // dashed ring in the panel's own parchment gold over a night map, and the
      // founder's verdict was "too subtle and hard to see" — which is the only
      // measurement that counts for a highlight. What it gets now: a filled
      // halo, a heavy solid ring, a second ring outside it, corner brackets
      // that read as a reticle rather than as decoration, and a slow pulse so
      // it moves against a still painting. White-hot rather than gold, because
      // gold is what every other panel on this surface already is.
      // THE RETICLE FRAMES WHAT IT IS AIMED AT, so it takes the figure's own
      // size: the adversary is now three times what it was and a fixed ring
      // would sit inside it rather than around it. A thing on the floor keeps
      // the smaller frame it always had.
      const advId = adversaryOf(state.answer)?.id ?? null;
      const r = (t.value === advId ? ADVERSARY_R * 1.25 : 26) * u;
      return `<g class="pmc-aim-ring" transform="translate(${at.x} ${at.y})">
        <circle cx="0" cy="0" r="${r * 1.85}" fill="#fff6d8" fill-opacity="0.16"/>
        <circle cx="0" cy="0" r="${r * 1.32}" fill="none" stroke="#fff6d8"
          stroke-width="${r * 0.07}" stroke-opacity="0.75"/>
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="#ffffff" stroke-width="${r * 0.2}"/>
        <path d="M ${-r * 1.9} ${-r * 1.9} h ${r * 0.72} M ${-r * 1.9} ${-r * 1.9} v ${r * 0.72}
                 M ${r * 1.9} ${-r * 1.9} h ${-r * 0.72} M ${r * 1.9} ${-r * 1.9} v ${r * 0.72}
                 M ${-r * 1.9} ${r * 1.9} h ${r * 0.72} M ${-r * 1.9} ${r * 1.9} v ${-r * 0.72}
                 M ${r * 1.9} ${r * 1.9} h ${-r * 0.72} M ${r * 1.9} ${r * 1.9} v ${-r * 0.72}"
          stroke="#ffffff" stroke-width="${r * 0.16}" stroke-linecap="round" fill="none"/>
        <title>${esc(t.label)} — ${esc(state.aiming.action)}</title>
      </g>`;
    }).join("");
  }

  /**
   * A HIT-POINT RAIL OVER EVERY FIGHTER (founder-ruled 2026-08-29, at the board).
   *
   * The adversary has carried one since the fight shipped, and he asked for the
   * same thing over everyone else on the wheel — "the cake's style, small". So
   * this is that bar at a person's scale: same ember, same rounded rail, same
   * arithmetic (`now / max`, both the door's numbers), a fifth of the size.
   *
   * WHOSE FIGURE IT SITS OVER IS NOT MINE TO DRAW. The residents on this map are
   * the VIEWER's walkers and the human is the cockpit's own token — two owners,
   * one row of numbers — so this layer draws only the RAIL, at the coordinates
   * the answer places each fighter at, and lets whatever figure is already there
   * be the figure. That also means a fighter the answer cannot place gets no bar
   * rather than a bar somewhere plausible.
   *
   * A DOWNED FIGHTER'S RAIL IS DRAWN EMPTY AND STILL DRAWN, the same ruling the
   * wheel already keeps: being at zero is a state to watch, and a rail that
   * vanished would read as the person having left.
   */
  function drawCombatants() {
    if (!tokenLayer || !gridNow()) return "";
    const u = unitsPerPx();
    return combatantBars(state.answer).map((c) => {
      const at = worldToPx(gridNow(), c.at);
      if (!at) return "";
      // SIZED BY LOOKING AT IT, twice. The first pass was thirteen screen pixels
      // wide and two tall — "small", as asked, and invisible: at vault zoom the
      // rails vanished under the speech plates and inside the adversary's glow,
      // present in the DOM and unreadable on the screen. That is the same
      // mistake the speech layer made when it shipped at nine pixels, recorded
      // in its own note, and the same cure: look at the shot rather than at the
      // number. Still small against the cake's own rail, which is what the
      // ruling asked for — a person is not the boss.
      const w = 44 * u, h = 5.5 * u, y = -30 * u;
      const frac = Math.max(0, Math.min(1, c.hp.now / c.hp.max));
      // ⚑ A PERSON'S RAIL IS NOT THE BOSS'S COLOUR, and the first pass learned
      // that the hard way: drawn in the adversary's ember, over the adversary's
      // ember ring, three rails were present in the DOM and invisible on the
      // screen — the founder would have reported them missing. The cake owns
      // ember on this map. A fighter gets the cockpit's own pale gold, with a
      // dark ground and a light rim so it reads over the ring, over the floor
      // and over the glow alike.
      const gold = "#f0d5a8";
      return `<g class="pmc-combatant-hp" transform="translate(${at.x} ${at.y})"${c.down ? ' opacity="0.55"' : ""}>
        <rect x="${-w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"
          fill="#0d1015" fill-opacity="0.92" stroke="${gold}" stroke-opacity="0.75" stroke-width="${h * 0.16}"/>
        ${frac > 0 ? `<rect x="${-w / 2}" y="${y}" width="${w * frac}" height="${h}" rx="${h / 2}" fill="${gold}"/>` : ""}
        <title>${esc(c.label)} — ${c.hp.now} of ${c.hp.max}${c.down ? " — down" : ""}</title>
      </g>`;
    }).join("");
  }

  function drawToken() {
    if (!ensureTokenLayer()) return;
    tokenLayer.textContent = "";
    // The aim rings draw FIRST, under every figure — they are about the things,
    // not instead of them, and a highlight painted over a face would hide the
    // thing it is pointing at.
    const aiming = drawAim();
    if (aiming) {
      const g = doc.createElementNS(NS, "g");
      g.setAttribute("class", "pmc-aim-layer");
      g.innerHTML = aiming;
      tokenLayer.appendChild(g);
    }
    advRing();
    // whatever is on the floor draws next, so a face always paints over an object
    const loose = drawLoose();
    if (loose) {
      const g = doc.createElementNS(NS, "g");
      g.setAttribute("class", "pmc-loose-layer");
      g.innerHTML = loose;
      tokenLayer.appendChild(g);
    }
    const human = faces().find((f) => f.kind === "human");
    // SEATED = this ground gives the human feet and the reader has taken them.
    // `allowed` is the door's own answer for `for: human` at this standpoint
    // (the roster is built from it), and the portal is what makes the welcome a
    // portal's rather than a parcel's. Both, or the token is not drawn — the
    // ruling is about entering a zone where it is human-allowed, not about
    // drawing a second figure on every square of the world.
    const seated = !!(human?.allowed && portalOf(state.answer) && state.acting === HUMAN_ACTOR);
    // ⚑ THE RAILS ARE DRAWN BY A FUNCTION OF THEIR OWN, called on both exits.
    // They belong to every fighter on the wheel — residents included, whose
    // figures are the VIEWER's walkers — so hanging them off the human token's
    // early return would have deleted everyone else's hit points on every
    // standpoint where the human is not drawn, which is most of them.
    const place = tokenPlacement(state.answer, gridNow(), human, { seated });
    if (!place) { rails(); speech(); return; }
    const { at, token, beside } = place;
    // THE TOKEN IS SIZED IN SCREEN PIXELS, NOT MAP UNITS — measured, after the
    // first shot drew it two hundred metres across. A fixed map size is invisible
    // at journey width and swallows the town at close zoom, and the walkers this
    // figure stands beside are already screen-constant (`r = 11 / markerScale(k)`
    // in the viewer's drawWalkers). A face that changed size relative to the
    // people around it would be saying something about the person.
    const r = 26 * unitsPerPx();
    const g = doc.createElementNS(NS, "g");
    g.setAttribute("class", "pmc-token");
    // THE SLIGHT OFFSET, and it is measured in SCREEN pixels like the figure
    // itself — a pair that read as standing together at vault zoom would drift
    // to opposite ends of the county at town zoom if this were map units, and
    // the whole content of the ruling is that they read as standing TOGETHER.
    // Just over one radius, down and to the right: far enough that neither
    // figure is hidden, near enough to read as one pair rather than two people
    // in different places. Zero when the human has feet of their own — then the
    // standpoint IS theirs and nudging it would be a small lie about where they
    // are.
    const off = beside ? r * 1.15 : 0;
    g.setAttribute("transform", `translate(${at.x + off} ${at.y + off * 0.62})`);
    const clipId = "pmc-token-clip";
    // A steady gold ring and one soft radiance. Distinct from a resident's dot
    // without shouting: the map's motion language (green still / pink moving) is
    // the walkers', and borrowing it would say something untrue about this figure.
    g.innerHTML =
      `<defs><clipPath id="${clipId}"><circle cx="0" cy="0" r="${r}"/></clipPath>` +
      `<radialGradient id="pmc-token-glow"><stop offset="55%" stop-color="#d9a860" stop-opacity="0.34"/><stop offset="100%" stop-color="#d9a860" stop-opacity="0"/></radialGradient></defs>` +
      `<circle cx="0" cy="0" r="${r * 2.1}" fill="url(#pmc-token-glow)"/>` +
      (token.src
        ? `<image href="${esc(token.src)}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="0" cy="0" r="${r}" fill="#1b2230"/><text x="0" y="${r * 0.34}" text-anchor="middle" font-size="${r}" fill="#d9a860" font-family="ui-monospace,Consolas,monospace">${esc(token.monogram ?? "")}</text>`) +
      `<circle cx="0" cy="0" r="${r}" fill="none" stroke="#d9a860" stroke-width="${r * 0.11}"/>` +
      `<circle cx="0" cy="0" r="${r * 1.22}" fill="none" stroke="#d9a860" stroke-width="${r * 0.045}" stroke-opacity="0.55"/>` +
      // the star off his own cap, set above the ring — a mark of whose figure this
      // is, drawn small enough that the face stays the thing you read
      `<path transform="translate(0 ${-r * 1.62}) scale(${r * 0.030})" fill="#d9a860"
         d="M0,-10 L2.2,-2.6 L10,0 L2.2,2.6 L0,10 L-2.2,2.6 L-10,0 L-2.2,-2.6 Z"/>` +
      `<title>${esc(token.label)} — standing here</title>`;
    tokenLayer.appendChild(g);
    rails();
    speech();
  }

  /**
   * THE HIT-POINT RAILS, APPENDED LAST OF THE FIGURES.
   *
   * Ordering settled by looking at a magnified crop, which is the only way it
   * could have been: drawn under the token, the human's own portrait sat on top
   * of their own rail; drawn under the speech layer, all three were behind a
   * bubble, because in a three-metre room everyone stands inside one plate's
   * width of everyone else. Nothing this layer paints may cover a number a
   * player is watching to decide their next act — speech fades on the door's
   * clock, and hit points do not.
   */
  /**
   * WHAT STANDS AGAINST YOU, DRAWN FIRST — under everything else on the floor.
   * It is the biggest thing in the room and the one people walk over to; a ring
   * painted last would put its glow across the faces of everyone fighting it,
   * which is the opposite of what the ring is for.
   *
   * A LAYER OF ITS OWN, LIKE THE RAILS, because hovering it now changes what it
   * says. Repainting the whole token layer to reveal two lines of text would
   * rebuild every figure on the map on every pointer move; this rebuilds one
   * ring, and only when the answer to "is the pointer on it" actually changes.
   */
  function advRing() {
    if (!tokenLayer) return;
    tokenLayer.querySelector(".pmc-adversary-layer")?.remove();
    const html = drawAdversary();
    if (!html) return;
    const g = doc.createElementNS(NS, "g");
    g.setAttribute("class", "pmc-adversary-layer");
    g.innerHTML = html;
    // ITS PLACE IN THE STACK IS KEPT BY NAME, not by being appended at the right
    // moment — a repaint triggered by a pointer arrives long after the figures
    // it must stay beneath. Everything the cockpit draws after the ring is
    // listed here; only the aim rings go under it, and they are not.
    const above = tokenLayer.querySelector(".pmc-loose-layer, .pmc-token, .pmc-combatant-layer, .pmc-voice-layer");
    if (above) tokenLayer.insertBefore(g, above); else tokenLayer.appendChild(g);
  }

  function rails() {
    if (!tokenLayer) return;
    tokenLayer.querySelector(".pmc-combatant-layer")?.remove();
    const bars = drawCombatants();
    if (!bars) return;
    const bg = doc.createElementNS(NS, "g");
    bg.setAttribute("class", "pmc-combatant-layer");
    bg.setAttribute("pointer-events", "none");
    bg.innerHTML = bars;
    tokenLayer.appendChild(bg);
  }

  /** The voices ride ABOVE every figure, because a line nobody can read is not a
   *  line. Appended last, and separately, so a repaint of the token does not have
   *  to rebuild them and vice versa. */
  function speech() {
    if (!tokenLayer) return;
    tokenLayer.querySelector(".pmc-voice-layer")?.remove();
    const voices = drawVoices();
    if (!voices) return;
    const g = doc.createElementNS(NS, "g");
    g.setAttribute("class", "pmc-voice-layer");
    g.setAttribute("pointer-events", "none");
    g.innerHTML = voices;
    // ⚑ AND IT GOES UNDER THE HIT-POINT RAILS, which is the one ordering in this
    // layer decided by what the marks MEAN rather than by what they are. Found
    // by measuring rather than by looking: all three rails were on screen at
    // 28x4 pixels and all three were behind a speech plate, because everyone in
    // a three-metre room stands inside one bubble's width of everyone else.
    //
    // Speech is transient and fades on the door's own clock; hit points are the
    // state a player is watching to decide their next act. A line that covers a
    // number for five minutes costs more than a number that clips a line.
    const rails = tokenLayer.querySelector(".pmc-combatant-layer");
    if (rails) tokenLayer.insertBefore(g, rails); else tokenLayer.appendChild(g);
  }

  // ── the rail's feed ───────────────────────────────────────────────────────
  //
  // THE FOUNDER'S RULING, 2026-08-29: "the action log can just replace the
  // Lately section in the side rail instead of needing a whole separate panel
  // ... tweak the 'lately' section so it's a newest-at-the-bottom chat-like
  // feed, that you can scroll UP to see older things (and we should use this
  // same thing for the log in combat)."
  //
  // ONE COMPONENT, AND IT IS THE VIEWER'S OWN SECTION. The rail belongs to the
  // viewer: it writes the Lately rows and rewrites them on every re-fold. So
  // this does not replace the section, it JOINS it — the section becomes the
  // scrollport (CSS), the viewer's list is flipped to read oldest-at-top (CSS),
  // and the cockpit appends ONE element of its own after it for the fight and
  // the talk. Nothing of the viewer's is written: not its list, not its hidden
  // attribute, not its state. Remove data-pmc-feed and the rail is exactly the
  // rail it was, which is what destroy() does.
  //
  // ⚑ THE HOST IS RESOLVED AT USE TIME, never held from mount — the same law
  // that governs the svg two hundred lines up. The viewer injects its markup
  // once today, but "the element I found at mount is the element that is there
  // now" is precisely the assumption that cost this file four bugs in one
  // evening, and a feed appended to a detached rail would answer every
  // measurement with zeros while looking perfectly correct in the source.
  let feedList = null;
  let feedNew = null;
  /** The section the viewer draws Lately into, right now, or null off the rail
   *  (a phone hides it below 720px, and a harness has no viewer at all). */
  const feedSection = () => doc.querySelector(".wv .wv-activity");
  function ensureFeed() {
    // ⚑ NO WHEEL, NO FEED, and this guard is the one that makes the rule hold
    // rather than merely start out true. The reshape is stood down on every
    // paint, but a beat arriving from an act answer calls straight through to
    // here — so without this, one line ingested outside a fight would build the
    // list back into the viewer's rail and leave it there.
    if (!inCombat()) return null;
    const host = feedSection();
    if (!host) return null;
    watchFeedHost(host);
    if (feedList?.isConnected && feedList.parentElement === host) return feedList;
    feedList = doc.createElement("ol");
    feedList.className = "pmc-feed";
    feedList.setAttribute("data-pmc-feed-list", "");
    host.appendChild(feedList);
    feedNew = doc.createElement("button");
    feedNew.type = "button";
    feedNew.className = "pmc-feed-new";
    feedNew.hidden = true;
    feedNew.textContent = "new ↓";
    feedNew.addEventListener("click", () => {
      followBottom = true;
      feedPending = false;
      pinFeed();
    });
    host.appendChild(feedNew);
    return feedList;
  }

  // ── the pin, and why it is a WATCH rather than a line of code ─────────────
  //
  // ⚑ THE FOUNDER, LIVE ON DEV 2026-08-29: "lately isn't scrolled down
  // correctly". The harness had caught the flex-shrink case; this is a
  // different failure and the harness could not have caught it, because the
  // harness's Lately rows are STATIC and the real page's are not.
  //
  // THE REAL PAGE LOADS ITS RECORD IN WAVES. The viewer calls renderActivity
  // from three separate async loads — loadWalkLedger().then(renderActivity),
  // loadSettlements().then(... renderActivity), loadStakeEvents().then(
  // renderActivity) — each of which rewrites .wv-acts's innerHTML and re-sets
  // the section's hidden attribute, at whatever moment its fetch lands. Every
  // one of those rewrites grows the content ABOVE our feed while the section
  // keeps its scrollTop, which silently walks the reader off the bottom. A pin
  // that runs once, at draw time, is pinning to a page that has not finished
  // arriving — and the later a wave lands, the further from the bottom it
  // leaves us. On a hard reload all three land after we mount, which is exactly
  // the condition he was testing under.
  //
  // So the pin follows the CONTENT, not our own writes: a mutation observer for
  // the viewer's rewrites, a resize observer for reflow that changes no nodes
  // (fonts settling, a picture arriving, a row rewrapping), and the reader's own
  // scroll as the one thing that can switch following off.
  //
  // `followBottom` is the reader's INTENT and is deliberately not re-derived
  // from the geometry on every tick: once content has grown above us we are no
  // longer at the bottom by measurement, and re-deriving would read that as "the
  // reader scrolled up" and stop following for good. It changes only when a
  // scroll event says the reader moved.
  let followBottom = true;
  let feedPending = false;
  let feedWatched = null;
  let feedSize = null;
  let feedMutations = null;
  let pinQueued = false;

  /** Is this node one of ours? The pin must not react to its own writes. */
  const ourNode = (n) => Boolean(n && (n === feedList || n === feedNew
    || feedList?.contains?.(n) || feedNew?.contains?.(n)));

  /** The pill, written only when it actually changes — belt to the observer's
   *  braces, and cheaper than a mutation record nobody wants. */
  const showPill = (on) => { if (feedNew && feedNew.hidden === on) feedNew.hidden = !on; };

  const onFeedScroll = () => {
    const box = feedSection();
    if (!box) return;
    followBottom = atBottom(box);
    if (followBottom) { feedPending = false; showPill(false); }
  };

  function pinFeed() {
    const box = feedSection();
    if (!box) return;
    if (!followBottom) {
      showPill(feedPending);
      return;
    }
    // ON THE NEXT FRAME, because a pin measured in the same tick as the write
    // that caused it is measured against a layout the browser has not performed
    // yet — scrollHeight still answers for the old content. Coalesced, because
    // three waves landing together should cost one pin.
    if (pinQueued) return;
    pinQueued = true;
    const raf = (doc.defaultView ?? globalThis).requestAnimationFrame;
    const run = () => {
      pinQueued = false;
      const el = feedSection();
      if (!el || !followBottom) return;
      el.scrollTop = el.scrollHeight;
      feedPending = false;
      showPill(false);
    };
    if (typeof raf === "function") raf(run); else run();
  }

  /** Watch whichever section is live now — re-pointed when the viewer rebuilds
   *  its rail, for the same reason the camera watch is. */
  function watchFeedHost(host) {
    if (feedWatched === host) return;
    feedWatched?.removeEventListener?.("scroll", onFeedScroll);
    feedSize?.disconnect();
    feedMutations?.disconnect();
    feedWatched = host;
    host.addEventListener("scroll", onFeedScroll, { passive: true });
    if (typeof ResizeObserver === "function") {
      // The HOST's own box never changes — it is capped by max-height — so the
      // thing to measure is its children, which is where the record grows.
      feedSize = new ResizeObserver(pinFeed);
      for (const child of host.children) feedSize.observe(child);
    }
    if (typeof MutationObserver === "function") {
      feedMutations = new MutationObserver((records) => {
        // ⚑ OUR OWN WRITES ARE NOT NEWS, and without this line the watch eats
        // the page. Found by the shot runner hanging: pinFeed hides the
        // new-below pill, the pill lives INSIDE the section, its hidden
        // attribute is one this observer watches — so every pin caused a
        // mutation that caused a pin. A tight infinite loop with no stack to
        // show for it; the browser simply stopped answering.
        //
        // The feed's own list is excluded for the same reason and one more:
        // drawFeed already calls pinFeed itself, so a second pin fired by
        // watching our own innerHTML would be redundant even when it was safe.
        if (!records.some((r) => !ourNode(r.target))) return;
        // A rewrite can replace the children we were measuring, so the size
        // watch is re-pointed before the pin rather than after it.
        if (feedSize) { feedSize.disconnect(); for (const child of host.children) feedSize.observe(child); }
        pinFeed();
      });
      feedMutations.observe(host, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["hidden"],
      });
    }
  }

  function feedLineHtml(e) {
    const tone = ` is-${e.tone ?? "plain"}`;
    if (e.kind === "say") {
      return `<li class="pmc-fline is-say${e.who ? "" : " is-anon"}">`
        + (e.who ? `<span class="who">${esc(e.who)}</span>` : "")
        + `<span class="said">${esc(e.text)}</span></li>`;
    }
    return `<li class="pmc-fline${tone}">${esc(e.text)}</li>`;
  }

  /**
   * DRAW IT, KEEPING THE CHAT CONTRACT.
   *
   * At the bottom, the feed follows; scrolled up, it holds exactly where the
   * reader left it and says there is something new below. That is the whole of
   * what makes this a chat feed rather than a list that jumps — and it is
   * measured BEFORE the rewrite, because after it the scrollHeight has already
   * moved and every answer is about a box that no longer exists.
   */
  function drawFeed() {
    const list = ensureFeed();
    if (!list) return;
    const html = state.feed.map(feedLineHtml).join("");
    if (list.innerHTML === html) return;
    list.innerHTML = html;
    if (!followBottom) feedPending = true;
    pinFeed();
  }

  /** New entries in, feed redrawn. Everything that can add a line goes through
   *  here, so the merge rule (newest last, deduped by id, capped) has exactly
   *  one caller-visible shape. */
  function ingest(entries) {
    if (!entries?.length) return;
    const before = state.feed;
    state.feed = mergeFeed(state.feed, entries);
    if (state.feed !== before) drawFeed();
  }

  /**
   * EVERYBODY ELSE'S TURNS — by the tail where the door sends one, by the delta
   * where it does not.
   *
   * ① THE TAIL. `encounter_detail.beats_tail` is the fold's own beats, so every
   * hand in the room gets the same whole, attributed sentence your own acts
   * already got. `state.beatSeq` is the watermark: the highest seq this page has
   * turned into a line FROM A TAIL.
   *
   * ⚑ THE WATERMARK IS ADVANCED BY THE TAIL AND BY NOTHING ELSE, and that is a
   * correctness rule rather than tidiness. Your own act answer arrives with your
   * beat AND the hostile turns it drove — seqs above anything a tail has yet
   * shown us. Letting those advance the watermark would step over somebody
   * else's beat that was sitting lower in the window and had not been read yet:
   * it would be skipped, permanently, and nothing would say so. So the act
   * answer draws its lines and leaves the watermark alone; when those same beats
   * come round in the next tail, `mergeFeed` drops them by their seq-derived id.
   * Two roads, one line, no coordination needed.
   *
   * A FIRST SIGHT IS SEEDED, NEVER NARRATED — the same law the delta baseline
   * keeps. A reader arriving mid-fight must not be handed thirty lines of
   * somebody else's fight as things that just happened. An EMPTY first tail
   * seeds to -1 rather than staying unseeded, so the opening beats of a fight
   * that starts after we arrive are not the ones that get swallowed.
   *
   * ② THE DELTA, unchanged, where there is no tail. The snapshot is taken on
   * every absorb, including the one right after your own act — so your beat,
   * which already arrived whole through the act answer, is inside the baseline
   * and is never told twice.
   */
  /**
   * WHERE A WATERMARK STARTS, and the three answers are three different facts.
   *
   *   a window with beats  → its top; everything above it is new
   *   a window with none   → -1; the door HAS a tail and it is empty, so the
   *                          next beat written is genuinely the first
   *   no window at all     → null; this door does not carry beats, and the
   *                          first tail that ever arrives must be seeded rather
   *                          than narrated
   *
   * Collapsing the middle two — treating an empty tail as no tail — is how the
   * opening beats of a fight that starts after the reader arrives would be the
   * ones swallowed by the seed.
   */
  const seedBeatSeq = (detail) =>
    Array.isArray(detail?.beats_tail) ? (tailWatermark(detail) ?? -1) : null;

  function absorbEncounter(answer) {
    const next = answer?.encounter_detail ?? null;
    const prev = state.encSnap;
    state.encSnap = next;

    const adversary = adversaryOf(answer)?.id ?? null;
    const tail = beatsFromTail(next, { since: state.beatSeq, adversary });
    if (tail) {
      if (state.beatSeq == null) { state.beatSeq = seedBeatSeq(next); return; }
      if (tail.watermark != null) state.beatSeq = Math.max(state.beatSeq, tail.watermark);
      ingest(tail.entries);
      return;
    }

    if (!prev || !next) return;
    const { entries, unseen } = beatsFromDelta(prev, next);
    if (unseen > 0) {
      entries.push({
        id: `u:${next.acts}`,
        seq: null,
        at: Date.now(),
        kind: "beat",
        tone: "unseen",
        who: null,
        text: unseen === 1
          ? "one turn went by that this page has no door to read."
          : `${unseen} turns went by that this page has no door to read.`,
      });
    }
    ingest(entries);
  }

  /**
   * AUTO-SELECT ON THE TURN (founder, 2026-08-29: "the act as bar should
   * auto-select the token whose turn it is (if possible) when it becomes their
   * turn").
   *
   * ⚑ ON THE CHANGE, AND ONLY ON THE CHANGE — which is also the whole of "never
   * fight a manual selection mid-turn". A reader who picks a different face
   * after an auto-select keeps it, because the turn has not changed since, and
   * nothing re-fires until it does. There is no separate manual flag to keep in
   * step; the guard IS the protection, and a flag beside it would be a second
   * answer to one question.
   *
   * IT SPEAKS pm:act-as, exactly as a face click does — through speakActAs, the
   * same path, so the viewer's walk desk and enter buttons follow the same
   * selection. Nothing here writes the viewer's own choice.
   *
   * The first read counts as a change: a reader who opens the page on their own
   * turn has made no selection for this to override, and "it is your turn" is
   * the one thing the dock should be saying at that moment.
   */
  function autoSelectOnTurn() {
    const enc = encounterOf(state.answer);
    const turn = enc?.turn ?? null;
    if (turn === state.lastTurn) return;
    state.lastTurn = turn;
    if (!turn) return;
    const handles = Array.isArray(o.me?.handles) ? o.me.handles : [];
    if (!handles.includes(turn) || state.acting === turn) return;
    state.acting = turn;
    state.seat = turn;
    state.said = null;
    speakActAs();
  }

  // ── the dock's pictures ───────────────────────────────────────────────────
  //
  // ONE READ PER HANDLE FOR THE LIFE OF THE MOUNT, cached the way the terms are.
  // A key holds a handful of residents, the profile bubble is small, and a face
  // that has already answered is never asked again — including one that
  // answered with no avatar, which is why the cache holds null rather than
  // treating a resident with no picture as unread and re-asking every paint.
  const profilesAsked = new Set();
  function pullProfiles() {
    if (!o.readResident) return;
    // THE DOCK'S FACES AND THE WHEEL'S — the residents this key can act as, and
    // everyone else in the fight. Bounded by the party in the room, asked once
    // each, and a stranger's card is the same public read as your own.
    const wanted = [
      ...faces().filter((f) => f.kind === "resident").map((f) => ({ kind: "resident", handle: f.handle })),
      ...(encounterOf(state.answer)?.order ?? [])
        .filter((a) => a.kind === "resident" && a.id)
        .map((a) => ({ kind: "resident", handle: a.id })),
    ];
    for (const f of wanted) {
      if (f.kind !== "resident" || !f.handle || profilesAsked.has(f.handle)) continue;
      profilesAsked.add(f.handle);
      Promise.resolve(o.readResident(f.handle)).then((card) => {
        const profile = card?.profile ?? null;
        state.profiles[f.handle] = profile;
        // Repaint only when a picture actually arrived. A resident with no
        // profile changes nothing on screen, and a repaint for nothing would
        // rebuild the bar under the reader's cursor once per face at boot.
        if (profile && (profile.avatar || profile.avatar_url)) paint();
      }).catch(() => { state.profiles[f.handle] = null; });
    }
  }

  // ── painting ──────────────────────────────────────────────────────────────
  function paint() {
    resolveActing();
    // the wheel can arrive or end between two paints, and the rail follows it —
    // asked here rather than at mount, which is where it went wrong
    syncFeedPresence();
    const active = doc.activeElement;
    const keepAction = active?.closest?.("[data-form]") ? active.getAttribute?.("data-field") : null;
    const values = readForm();
    root.setAttribute("data-space", spaceOf(state.answer));
    // the roster rides inside drawBar's row, and the standpoint plate inside the
    // roster — one row owns the bottom edge and everything hangs off it
    root.innerHTML = drawWheel() + drawBar();
    // THE BAR MOVES FIRST. Everything below is positioned against the bar's real
    // box, and the bar's own placement lifts it clear of the viewer's bottom-edge
    // furniture — so measuring before that lift put the gate pill straight across
    // the middle of the slots it was explaining. Seen in the combat QA shot.
    placeBar();
    const form = root.querySelector("[data-form]");
    if (form) placeAbove(form, root.querySelector(".pmc-bar"));
    // The gate rides above whichever panel is actually the top of the stack. A
    // form cannot normally be open while gated — a gated slot is disabled, so it
    // cannot be clicked — but a turn can pass while one is already open, and then
    // both are on screen.
    const gate = root.querySelector(".pmc-gate");
    if (gate) placeAbove(gate, form ?? root.querySelector(".pmc-bar"));
    // The aim strip stands where a panel stands, because it IS the panel for an
    // armed act — one question, asked on the map instead of in a box.
    const aim = root.querySelector(".pmc-aim");
    if (aim) placeAbove(aim, root.querySelector(".pmc-bar"));
    // The overflow tray opens above its own seat, clamped into the painting the
    // same way the card is — it belongs to that seat and the hand is already there.
    const ctx = root.querySelector(".pmc-tray");
    const a = root.querySelector("[data-fold]")?.getBoundingClientRect?.();
    if (ctx && a) {
      const box = ctx.getBoundingClientRect();
      const w = doc.defaultView?.innerWidth ?? 0;
      const hgt = doc.defaultView?.innerHeight ?? 0;
      const paint = liveSvg()?.getBoundingClientRect?.();
      const lo = Math.max(12, (paint?.left ?? 0) + 8);
      const hi = Math.max(lo, Math.min(w - box.width - 12, (paint ? paint.right : w) - box.width - 8));
      ctx.style.left = `${Math.min(Math.max(lo, a.left + a.width / 2 - box.width / 2), hi)}px`;
      ctx.style.bottom = `${Math.max(8, hgt - a.top + 10)}px`;
    }
    root.querySelector(".pmc-bar")?.addEventListener("scroll", markOverflow, { passive: true });
    markOverflow();
    if (state.open && values) writeForm(values);
    if (keepAction) root.querySelector(`[data-field="${CSS.escape ? CSS.escape(keepAction) : keepAction}"]`)?.focus();
    // THE CAMERA BEFORE THE TOKEN, because the token is sized against the
    // viewBox (unitsPerPx) and drawing it first would size it for the frame we
    // are about to leave. frameScene answers once per arrival, so this costs
    // nothing on the paints where the reader has not moved.
    frameScene();
    watchCamera();
    drawToken();
    // THE FEED IS NOT INSIDE root, so a repaint never touches it — this call is
    // here for the other direction: the viewer rebuilding its rail would take
    // our list with it, and without a redraw on the ordinary paint the feed
    // would stay empty until the next line happened to arrive. ensureFeed
    // re-homes it; drawFeed writes nothing when the html has not changed.
    drawFeed();
  }

  let formValues = null;
  function readForm() {
    const form = root.querySelector("[data-form]");
    if (!form) return formValues;
    const v = {};
    form.querySelectorAll("[data-field]").forEach((el) => { v[el.getAttribute("data-field")] = el.value; });
    formValues = v;
    return v;
  }
  function writeForm(v) {
    const form = root.querySelector("[data-form]");
    if (!form) return;
    form.querySelectorAll("[data-field]").forEach((el) => {
      const name = el.getAttribute("data-field");
      if (v[name] != null) el.value = v[name];
    });
  }

  // ── the wiring ────────────────────────────────────────────────────────────
  function onClick(ev) {
    // THE TRAY CLOSES THE MOMENT YOU LOOK ELSEWHERE. Handled first, and without
    // returning, so the click it was dismissed by still does whatever it was
    // going to do — a tray should never cost a reader a click.
    if (state.tray && !ev.target.closest?.(".pmc-tray, [data-fold]")) { state.tray = false; paint(); }
    const faceBtn = ev.target.closest?.(".pmc-face");
    if (faceBtn && root.contains(faceBtn)) {
      // A REFUSED FACE IS PRESSABLE AND DOES NOTHING, which is the other half of
      // aria-disabled: the browser no longer refuses the click for us, so the
      // refusal is stated here. Swallowed rather than fallen through — the press
      // was aimed at this face and should not become a click on the map.
      if (faceBtn.getAttribute("aria-disabled") === "true") return;
      state.acting = faceBtn.getAttribute("data-actor");
      // a resident selection IS the seat; the human keeps the one it borrowed
      if (state.acting !== HUMAN_ACTOR) state.seat = state.acting;
      state.said = null;
      paint();
      // ONE SELECTION, TWO SURFACES (2026-08-28): the viewer's walk desk and
      // enter buttons act as ITS actAs, which used to be a second control the
      // founder had to keep agreeing with this one. The dock speaks; the viewer
      // listens (pm:act-as, resident handles only — the human hand is this
      // cockpit's own grammar and the viewer keeps its last resident for walks).
      speakActAs();
      return;
    }
    // A TARGET THE MAP COULD NOT PLACE, pressed on the strip instead. Same
    // route as pressing it on the painting — see takeAim.
    const aimBtn = ev.target.closest?.("[data-aim-at]");
    if (aimBtn && root.contains(aimBtn)) {
      takeAim({ [state.aiming.field.name]: aimBtn.getAttribute("data-aim-at") },
        aimBtn.textContent.trim());
      return;
    }
    // THE OVERFLOW SEAT. It is a seat, so it is caught before the seat handler
    // below — which would otherwise read its absent data-action as an act.
    const foldBtn = ev.target.closest?.("[data-fold]");
    if (foldBtn && root.contains(foldBtn)) {
      state.tray = !state.tray;
      paint();
      return;
    }
    const trayBtn = ev.target.closest?.(".pmc-tray button");
    if (trayBtn && root.contains(trayBtn) && !trayBtn.disabled) {
      state.tray = false;
      openSeat(trayBtn.getAttribute("data-action"));
      return;
    }
    const closeBtn = ev.target.closest?.("[data-close]");
    if (closeBtn && root.contains(closeBtn)) { state.open = null; state.act = null; state.said = null; formValues = null; paint(); return; }
    const slot = ev.target.closest?.(".pmc-slot");
    // A gated seat is aria-disabled so it can still be hovered for its card, so
    // the CLICK is what has to refuse — the browser will not refuse it for us.
    if (slot && root.contains(slot) && !slot.disabled && slot.getAttribute("aria-disabled") !== "true") {
      openSeat(slot.getAttribute("data-action"));
    }
  }

  /**
   * PRESSING A SEAT — one route, three callers.
   *
   * Clicking a seat, pressing it in the overflow tray, and typing its number all
   * end here. They diverged once already (the keyboard path was reading a bar
   * the fold had changed) and one function is how they cannot again.
   *
   * WHICH OF TWO THINGS A PRESS DOES is decided by the CARD, never by a name: an
   * act the door gave somewhere to aim, on a ground where the answer names
   * something to aim at, ARMS — and the reader points at the target. Everything
   * else opens its panel exactly as it did. So an act that becomes aimable
   * because someone went down starts arming on its own, and one whose only
   * target has been dealt with goes back to being a panel, with no edit here.
   */
  function openSeat(action, { focus = true } = {}) {
    if (!action) return;
    // pressing the armed seat again puts it down — the same toggle an open
    // panel has always had, on the other of the two states a seat can be in
    if (state.aiming?.action === action) { disarm(); return; }
    const { shown, folded } = foldedBar();
    const s = [...shown, ...folded].find((x) => x.action === action);
    if (!s || !s.afforded || !s.enabled) return;
    // ── ONE FLOW, THREE SHAPES (founder-ruled 2026-08-29) ──
    //
    // "Every button that NEEDS a target selection lets you click button → click
    // target. Every button that DOESN'T (guard, exit) just needs you click
    // button. In both cases, the next step IS the right side panel."
    //
    // The shape is the CARD's, never a name: aimed at a thing, aimed at a point
    // on the ground, or aimed at nothing (`aimKind`). The third case is the
    // founder's own complaint — "guard asks you to pick a target on the map…
    // should just be a confirm button" — and it is answered by falling straight
    // through to the panel.
    //
    // A THING-AIMED ACT WITH NOTHING TO AIM AT also falls through, because a
    // targeting mode over an empty room is the same dead end wearing a
    // crosshair.
    // A SELF-DIRECTED ACT NEVER OPENS A CROSSHAIR, whatever its card looks
    // like — see SELF_DIRECTED for why that has to be a name here and not a
    // reading of the field.
    const kind = SELF_DIRECTED.includes(action) ? "none" : aimKind(s.card);
    if (kind === "point") { arm(action, "point", pointFields(s.card)); return; }
    if (kind === "thing" && aimable(s, state.answer, { only: aimRoles(action) })) { arm(action, "thing", aimField(s.card)); return; }
    disarm(false);
    state.act = null;
    state.open = state.open === action ? null : action;
    state.said = null;
    formValues = null;
    // THE ACT'S SHADOW IS ASKED FOR BY OPENING IT, not only by hovering it. The
    // terms are what the panel is for on any act that declares a counter-edge,
    // and a reader who reached the seat through the tray or by its number never
    // hovered anything. Cached per act for the life of the mount, so this is one
    // request whichever gesture got here first.
    if (state.open) askTerms(state.open);
    paint();
    // Bring the SEAT into view, not the panel. On a narrow screen the row can
    // still scroll, so a seat opened by a late key can be off the right edge
    // while its panel fills the screen — the bar then shows a different seat
    // lit and says nothing about where the panel came from. Seen at 390.
    root.querySelector(".pmc-slot.open")?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    markOverflow();
    if (focus) focusFirstOpen();
  }

  /**
   * WHERE THE CURSOR LANDS in a form that may already be filled in.
   *
   * The first empty field the reader MUST answer — and the word required is
   * doing real work there, caught in QA. Keyed on merely empty, the cursor
   * dropped into an optional field on a panel that had just said "press ENTER to
   * send it as it stands": the sentence and the cursor disagreed, and the cursor
   * is the one a hand believes. An optional field is one tab away, which is the
   * right cost for a value the door will supply if you say nothing.
   *
   * A prefilled field is never landed in either: it is already answered, so the
   * first keystroke would either land inside a value the reader wanted or have
   * to be preceded by clearing it.
   *
   * With nothing left that must be answered, the cursor goes to the send button
   * — so ENTER is the very next thing a hand can do, which is the whole of the
   * ruling for the acts whose fields the door fills itself.
   */
  function focusFirstOpen() {
    const form = root.querySelector("[data-form]");
    if (!form) return;
    const fields = [...form.querySelectorAll("[data-field]")];
    const all = barSlots(state.answer, { acting: state.acting });
    const card = [...all.fixed, ...all.tray].find((s) => s.action === form.getAttribute("data-form"))?.card;
    const required = new Set((card?.fields ?? []).filter((f) => f.required).map((f) => f.name));
    const must = fields.find((el) => !el.value && required.has(el.getAttribute("data-field")));
    (must ?? form.querySelector(".pmc-btn.go") ?? fields.find((el) => !el.value) ?? fields[0])?.focus();
  }

  async function onSubmit(ev) {
    const form = ev.target.closest?.("[data-form]");
    if (!form || !root.contains(form)) return;
    ev.preventDefault();
    const action = form.getAttribute("data-form");
    const args = {};
    form.querySelectorAll("[data-field]").forEach((el) => {
      const name = el.getAttribute("data-field");
      const raw = el.value;
      if (raw === "" || raw == null) return;
      if (el.type === "number") { const n = Number(raw); if (isFinite(n)) args[name] = n; return; }
      if (raw === "true" || raw === "false") { args[name] = raw === "true"; return; }
      args[name] = raw;
    });
    // ⚑ WHAT THE TARGET CONTRIBUTED RIDES ALONG. The panel is the one place any
    // act is confirmed now, and an aimed act's target was chosen on the map
    // rather than typed — so its fields live on `state.act` until this moment.
    // The typed fields win where both somehow name the same key: a reader who
    // edited the box in front of them meant the thing in the box.
    const aimed = state.act?.action === action ? state.act.args : null;
    const whole = { ...(aimed ?? {}), ...args };
    // ── SPEAKING CLOSES ON ENTER (founder, live: there is "a small lag between
    // hitting Enter and the panel going away" that reads as "did that send?") ──
    //
    // THE CLOSE IS THE CONFIRMATION, and it is cheap because it is honest about
    // what it confirms: the line LEFT. It does not claim the door took it — that
    // is a fact from the future, and waiting for it is exactly the pause he
    // felt. Every other act still waits, because a swing's answer is the throw
    // and a crossing's is the terms; a spoken line has no answer worth a pause.
    //
    // NOTHING IS SWALLOWED AND NOTHING IS LOST. The text is held here before the
    // panel goes, and a failure re-opens the line with the words still in it and
    // the door's own defect underneath — so a say that did not land is louder
    // than one that did, which is the right way round.
    if (form.hasAttribute("data-chat")) {
      const said = whole[form.getAttribute("data-chat")] ?? "";
      state.open = null; state.act = null; state.said = null; formValues = null;
      paint();
      sendAct(action, whole).then(() => {
        if (state.said && state.said.ok === false) reopenChat(action, said);
      });
      return;
    }
    const go = form.querySelector(".pmc-btn.go");
    if (go) { go.disabled = true; go.textContent = "…"; }
    await sendAct(action, whole, form);
  }

  /**
   * A SPOKEN LINE THAT DID NOT LAND COMES BACK, with the words still in it.
   *
   * The close-on-enter ruling trades the round trip for immediacy, and this is
   * the half that keeps the trade honest: the reader gets their sentence back
   * rather than retyping it, and the door's own defect is under it. Called only
   * on failure, so a line that landed leaves nothing behind.
   */
  function reopenChat(action, text) {
    state.open = action;
    formValues = null;
    paint();
    const box = root.querySelector(".pmc-chat [data-field]");
    if (box) { box.value = text; box.focus(); box.setSelectionRange?.(text.length, text.length); }
  }

  /**
   * ONE WAY OUT, and the aimed acts use it too.
   *
   * Extracted from `onSubmit` when the map became a way to finish an act
   * (2026-08-29). A click on a target is the same dispatch as pressing the
   * panel's button — same envelope, same actor, same seat, same reading of the
   * throw and of the bounce — and the surest way for those to have drifted
   * apart would have been to write the aimed one a second time.
   *
   * `form` is optional: an act finished on the map has no panel to clear or to
   * re-enable, which is the only difference between the two callers.
   */
  /**
   * THE ONE WORD THIS SURFACE SAYS TO THE PANE BEHIND IT when an exit lands.
   *
   * Same shape as the dock and feed seams: a window CustomEvent, guarded, and
   * dead wire on any page whose viewer does not listen. It carries the room that
   * was left so a viewer showing somebody ELSE's standpoint can ignore it.
   */
  function announceStoodOut(left) {
    const w = doc.defaultView;
    if (!w || typeof w.CustomEvent !== "function") return;
    try { w.dispatchEvent(new w.CustomEvent("pm:stood-out", { detail: { left } })); } catch { /* the clock will */ }
  }

  async function sendAct(action, args, form = null) {
    // READ BEFORE THE ACT, because after it the answer is the new standpoint and
    // the room we left is no longer in it. `leavingName` is the same reader the
    // panel printed — so the pane is told the room the reader was told, and the
    // two cannot name different places.
    const leftRoom = action === "exit" ? leavingName(state.answer)?.id ?? null : null;
    try {
      // The resident the door was READ as travels with every act, the human's
      // included: `as` says who acts, `handle` says whose standing the key is
      // oriented from, and on a multi-resident key an act naming neither is
      // refused at orient before the human seam is reached.
      const res = await o.dispatch(dispatchEnvelope({ action, args, acting: state.acting, handle: seat() }));
      // THE THROW IS SHOWN WHETHER THE ACT LANDED OR NOT. A blow that misses still
      // threw the die, and a bounce can carry the roll that caused it — hiding the
      // number on a refusal would make the one moment a player most wants to see
      // the one moment they cannot.
      const rolls = rollsFrom(res.body);
      if (rolls.length) showThrow(rolls);
      const chat = Boolean(form?.hasAttribute?.("data-chat"));
      // YOUR OWN BEAT GOES INTO THE FEED IMMEDIATELY, and it is the one beat
      // that arrives whole: the act answer carries your row, the hostile turns
      // your act drove (`then`), and the join or the open if this act was one.
      // Waiting for the poll to derive them from a state delta would cost the
      // reader the two seconds in which their own swing is the only thing they
      // are looking at — and would derive a worse sentence than the one the
      // door already handed us.
      //
      // ON A BOUNCE TOO, deliberately: a refused act can still carry the roll
      // that refused it, and the same reasoning that shows the die on a miss
      // shows the line beside it.
      ingest(beatsFromAct(res.body, { acting: seat(), adversary: adversaryOf(state.answer)?.id ?? null }));
      // ⚑ A 200 CARRYING A DEFECT IS A REFUSAL WEARING AN OK, and until now this
      // surface could not tell the two apart. `res.ok` is the HTTP layer's word;
      // the DOOR's word is in the body. The founder exited the vault, the office
      // refused it — an arena gates movement to whoever the wheel is on, and the
      // refusal names the turn — and this branch said "done — the door took it",
      // swallowed the sentence he needed to read, AND moved his camera out of a
      // room he was still standing in. Every later exit card then honestly
      // offered the vault again, which reads as stuck.
      //
      // The refusal path below already knows how to render a defect; all that was
      // missing was arriving at it.
      const defect = typeof res.body?.defect === "string" && res.body.defect ? res.body.defect : null;
      if (res.ok && !defect) {
        state.said = { ok: true, text: chat ? "sent." : "done — the door took it." };
        formValues = null;
        // AN AIMED ACT PUTS ITSELF DOWN once the door has taken it. A swing does
        // not stay armed: the reader chose an act, chose a target, and the act
        // happened, so the next click on the map is a fresh gesture rather than
        // a second swing nobody asked for.
        state.aiming = null;
        state.act = null;
        // A CHAT LINE EMPTIES ITSELF AND STAYS OPEN. Cleared in the live DOM
        // rather than by trusting formValues, because paint() re-reads the form
        // before it repaints — so a line nulled only in that variable comes
        // straight back out of the element it was just sent from, and the reader
        // sends the same sentence twice.
        if (chat) {
          form.querySelectorAll("[data-field]").forEach((el) => { el.value = ""; });
        }
        if (o.refresh) {
          const fresh = await o.refresh().catch(() => null);
          if (fresh) {
            state.answer = fresh;
            // THE SNAPSHOT MOVES WITH THE ANSWER, and this is the line that
            // stops your own swing being told twice. Your beat is already in
            // the feed from the act answer above; re-snapping here puts its
            // effects into the baseline the next poll compares against, so the
            // delta derives nothing for it.
            state.encSnap = fresh.encounter_detail ?? state.encSnap;
            autoSelectOnTurn();
          }
        }
        // NOR SHOULD THE CAMERA. The viewer mounts the interior off occupancy,
        // which it folds out of the enter-exit ledger on a clock — so the founder
        // stepped out of the vault, the door took it, and he went on looking at
        // the inside of the vault until a later read caught up. This is the one
        // moment we KNOW the record changed and we know which way, so the pane is
        // told now rather than left to find out.
        //
        // ⚑ AND ONLY ON A RECEIPT, never on having asked. The first version fired
        // on the ok branch, which a refused-with-200 reached — so the camera left
        // a room the record still had him inside of. The strongest receipt
        // available is the refreshed standpoint itself: if the door took the
        // exit, its portal is no longer the room we left. That is a fact that
        // could not exist unless the act landed.
        //
        // WHERE THERE IS NO REFRESH, THERE IS NO MOVE. A viewer that could not
        // re-read stays where it is and waits for the ledger's own clock, which
        // is the behaviour this replaced and a perfectly safe place to fall back
        // to. Silence is the right failure here; a camera that guesses is not.
        const stillInside = portalOf(state.answer)?.id === leftRoom;
        if (leftRoom && !stillInside) announceStoodOut(leftRoom);
        pullVoices();
      } else {
        const b = readBounce(res.body, res.status);
        state.said = { ok: false, text: b.defect, hint: b.hint, terms: b.terms };
      }
    } catch (err) {
      state.said = { ok: false, text: "the door could not be reached", hint: String(err?.message ?? err).slice(0, 200) };
    }
    paint();
  }

  /**
   * A KEY THIS SURFACE CONSUMED DOES NOT REACH THE VIEWER'S.
   *
   * Both bind `keydown` on the document, and the viewer's Escape clears ITS own
   * armed state — so one press was putting down the cockpit's panel and the
   * viewer's selection together, and a reader who pressed Escape to cancel an
   * aim also lost whatever the map had selected underneath. Stopping the
   * propagation of a key we acted on is the whole fix; a key we ignore is left
   * entirely alone, so the viewer keeps every Escape the cockpit had no use for.
   */
  const eatKey = (ev) => { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); };

  function onKey(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const t = ev.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
      if (ev.key === "Escape" && state.open) { eatKey(ev); state.open = null; state.said = null; formValues = null; paint(); }
      return;
    }
    // ESCAPE PUTS DOWN WHATEVER IS UP, innermost first. An armed act is the
    // innermost of the three now: it is the state where the whole map has
    // become a control, so it should be the first thing one press gives back.
    if (ev.key === "Escape" && state.aiming) { eatKey(ev); disarm(); return; }
    if (ev.key === "Escape" && state.tray) { eatKey(ev); state.tray = false; paint(); return; }
    if (ev.key === "Escape" && state.open) { eatKey(ev); state.open = null; state.act = null; state.said = null; formValues = null; paint(); return; }
    if (!/^[1-9]$/.test(ev.key)) return;
    const n = Number(ev.key);
    // ⚑ THE NUMBERS FOLLOW THE ROW, not the door's whole list. `barSlots` keys
    // every act the answer carried, folded or not — so with the fold in place
    // the key printed on the fourth seat and the act the fourth key opened were
    // two different acts. The row is what a reader is counting along, so the row
    // is what the digit means: the seats that are on it, in the order they sit,
    // and the overflow tray's contents are reached by name rather than by count.
    const slot = foldedBar().shown[n - 1];
    if (!slot || !slot.enabled) return;
    ev.preventDefault();
    // DELIBERATELY NO FOCUS INTO THE FORM on the keyboard path, which is why
    // this one caller passes `focus: false`. Focus belongs in the field only
    // when the reader has committed to filling it, and a digit typed into a
    // focused text box must type a digit — so auto-focusing here killed the
    // numbered bar the moment it was used: measured, pressing 1 then 2 then 9
    // left slot 1 open the whole time and put "29" in its first field. Clicking
    // a seat is the committing gesture and still dives in; the numbers stay the
    // bar's own navigation, which is what makes them worth having.
    openSeat(slot.action, { focus: false });
  }

  /**
   * WHOSE STATE THE PLATE IS SHOWING — the face under the pointer, or the
   * keyboard's, or nobody's, in which case it falls back to whoever is acting.
   *
   * ⚑ IT REPAINTS THE PLATE ALONE, and that is not an optimisation. `paint()`
   * replaces the whole overlay's innerHTML, so a full repaint on a face hover
   * would destroy the very button the pointer is resting on and hand the reader
   * a flickering dock — the surface rebuilding itself under a hand that has not
   * moved. Only the plate's words change, so only the plate is rewritten.
   *
   * IT FOLLOWS THE KEYBOARD TOO, through the same handler the hover card is
   * driven by, for the same reason stated there: a dock a reader can tab into
   * must tell a tabbing reader what it tells a pointing one.
   */
  function peekAt(target) {
    const face = target?.closest?.(".pmc-face");
    const who = face && root.contains(face) ? face.getAttribute("data-actor") : null;
    if (who === state.peek) return;
    state.peek = who;
    const host = root.querySelector(".pmc-here");
    if (!host) return;
    // The plate draws its own box, so what is swapped in is that box's INSIDES —
    // replacing the element would drop the chrome and the hover rule with it.
    const next = doc.createElement("div");
    next.innerHTML = drawHere();
    const fresh = next.firstElementChild;
    if (fresh) { host.innerHTML = fresh.innerHTML; host.className = fresh.className; }
  }

  // The card follows the pointer AND the keyboard, because a bar with numbered
  // slots is a keyboard surface first: tabbing to a seat must show the same card
  // hovering it does, or the law is readable only with a mouse.
  const onOver = (ev) => {
    const slot = ev.target.closest?.(".pmc-slot");
    if (slot && root.contains(slot) && !slot.disabled) showCard(slot); else hideCard();
    peekAt(ev.target);
  };
  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerleave", (ev) => { hideCard(); peekAt(null); });
  root.addEventListener("focusin", onOver);
  root.addEventListener("focusout", hideCard);

  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  doc.addEventListener("keydown", onKey);

  // ENTER SENDS THE CHAT LINE, said explicitly rather than left to the browser.
  // A single-input form with no submit button does implicitly submit on ENTER in
  // every engine that matters — but "in every engine that matters" is the kind of
  // sentence this file has been wrong about before, and the send is the whole
  // gesture of a chat line. requestSubmit fires the submit event the ordinary way,
  // so onSubmit above is still the one path out.
  root.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.shiftKey) return;
    const chat = ev.target?.closest?.("[data-chat]");
    if (!chat || !root.contains(chat)) return;
    ev.preventDefault();
    (chat.requestSubmit ? chat.requestSubmit() : chat.dispatchEvent(new doc.defaultView.Event("submit", { bubbles: true, cancelable: true })));
  });
  // The receipt clears when the reader types the next thing. Removed from the
  // DOM directly, never by repainting: a repaint here would rebuild the input
  // the reader is mid-sentence in.
  root.addEventListener("input", (ev) => {
    if (!ev.target?.closest?.("[data-chat]")) return;
    if (state.said) { state.said = null; root.querySelector(".pmc-chat .pmc-said")?.remove(); }
  });

  // The camera moves without anything of ours firing — the viewer pans and zooms
  // by writing the viewBox, and a screen-sized token has to be re-drawn when it
  // does. Watching the attribute is the seam that needs no viewer internal.
  // ⚑ AND IT FOLLOWS THE LIVING SVG, which is the third time tonight this same
  // seam has bitten — the token layer, then the framing, now the watch itself.
  // The viewer REBUILDS its painting on a view change, and this observer was
  // pointed at the element that existed at mount. Once the viewer swapped it,
  // the watch was on a detached node and never fired again: the token kept
  // whatever size and offset it had at its last draw, both of which are screen
  // constants derived from the viewBox.
  //
  // Seen in the founder's own tab and caught by reading the transform rather
  // than the picture: the human's token sat at standpoint + 0.0288 units with
  // the viewBox 240 units wide — exactly the offset that was correct back when
  // the view was 1.6 units across, drawn once and then abandoned. On screen
  // that is a portrait several times too large sitting on top of the ring it is
  // supposed to stand beside.
  //
  // So the watch is re-pointed whenever the painting under it changes. Cheap:
  // it compares the element and does nothing on the paints where it is the same
  // one, which is nearly all of them.
  let camera = null;
  let watched = null;
  function watchCamera() {
    if (typeof MutationObserver !== "function") return;
    const svg = liveSvg();
    if (!svg || svg === watched) return;
    camera?.disconnect();
    camera = new MutationObserver(() => drawToken());
    camera.observe(svg, { attributes: true, attributeFilter: ["viewBox"] });
    watched = svg;
    // the painting we were watching is gone, so whatever was drawn on it was
    // sized for a view that no longer exists
    drawToken();
  }
  watchCamera();
  // (The hand-on-camera bookkeeping that lived here is gone with the raw
  // viewBox writes: the reader's pan and zoom now go through the same camera
  // the frame request does — the viewer's own — so there is nothing of ours
  // left to protect from them.)
  const onResize = () => { drawToken(); placeBar(); markOverflow(); };
  (doc.defaultView ?? globalThis).addEventListener?.("resize", onResize);

  // ⚑ THE FURNITURE COMES AND GOES WITHOUT US, and until this existed the row
  // only re-measured when the cockpit repainted or the window resized. Both of
  // the pieces placeBar fences against are TRANSIENT — `.wv-walkdesk` appears
  // when a walk is armed, `.wv-scene-exit` when the viewer has somewhere to step
  // out to — so the row was placed against whichever of them happened to be up
  // at the last paint and then simply sat there while they changed underneath
  // it. Seen live 2026-08-28: selecting a resident raised the exit pill, and the
  // dock stayed exactly where it was, on top of it.
  //
  // A ResizeObserver is the tool that fits: an element going from hidden to
  // shown is a size change from zero, which is precisely the event that matters
  // here, and it says nothing at all during the map's ordinary redraws. The
  // frame throttle is because several pieces can appear in the same beat and
  // the row only needs placing once for all of them.
  let placePending = false;
  const replace = () => {
    if (placePending) return;
    placePending = true;
    (doc.defaultView ?? globalThis).requestAnimationFrame?.(() => {
      placePending = false;
      placeBar();
      markOverflow();
    });
  };
  let furniture = null;
  if (typeof ResizeObserver === "function") {
    furniture = new ResizeObserver(replace);
    for (const sel of [".wv .wv-walkdesk", ".wv .wv-spectator-coordinate", ".wv .wv-paint-tallies", ".wv .wv-scene-exit"]) {
      const el = doc.querySelector(sel);
      if (el) furniture.observe(el);
    }
  }

  // ⚑ THE PINNED BUBBLE IS NOT ON THAT LIST, AND CANNOT BE. Every other piece of
  // the viewer's bottom furniture is in its markup from the start, so observing
  // it at mount works. The bubble is not: `bubbleEl` CREATES it lazily, the first
  // time anything is pinned, and appends it to `.wv-bubbles`. A `querySelector`
  // at mount finds nothing and would silently observe nothing — the row would
  // fence against the bubble only on the paints that happened to run for some
  // other reason, which is the same class of quiet miss the living-references
  // law is about.
  //
  // So the HOST is watched instead, for the element arriving, for its hidden
  // flag turning, and for the transform that moves it. `replace()` is already
  // frame-throttled, so a bubble being dragged around costs one placement per
  // frame at worst.
  let bubbles = null;
  const bubbleHost = () => doc.querySelector(".wv .wv-bubbles");
  if (typeof MutationObserver === "function" && bubbleHost()) {
    bubbles = new MutationObserver(replace);
    bubbles.observe(bubbleHost(), {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ["hidden", "style", "class"],
    });
  }

  // ⚑ THE MAP-CLICK WALK HAND-OFF STOOD HERE AND IS GONE (2026-08-29).
  //
  // WHAT IT WAS. The 08-28 ruling was "clicking a point on the map while acting
  // as a walker should prefill/dispatch the walk to that point", and because the
  // viewer owned walking — the wall check, the zero-length refusal, the preview,
  // the desk's confirm — this handed bare-ground clicks to the viewer's own
  // walk-arming path rather than re-implementing any of it. It did so through a
  // hook with no elements behind it (`.stand`), minting one and clicking it, and
  // it VERIFIED the result by watching for the desk to appear rather than
  // trusting a vestigial class.
  //
  // WHY IT IS GONE. The founder's governing ruling makes walking an ordinary act
  // of the one flow — button, then target, then the panel with WHO/FROM/TO and a
  // confirm — and stands the viewer's desk down so there is one way to walk
  // instead of two. A hand-off into a panel that is now hidden would arm a walk
  // a reader could never confirm, which is worse than the two-flow overlap it
  // was written to bridge.
  //
  // ⚑ AND ONE THING GOES WITH IT, NAMED RATHER THAN LOST: the viewer's INTERIOR
  // WALL CHECK. `chooseWalkPoint` refused a destination through a wall at click
  // time, in the reader's own words, and this flow does not. The door remains
  // the authority on where a walk may land and will refuse what it refuses, so
  // nothing illegal becomes possible — but the refusal now arrives after the
  // confirm rather than before the arming, and a client-side check that told a
  // reader sooner has been traded for one flow. Worth a follow-up if the founder
  // walks into a wall and dislikes where he is told.

  /** Where a pointer landed, in the map's own units. `getScreenCTM` is the
   *  browser's own answer for that and it already carries the viewer's pan and
   *  zoom, so nothing here reads a camera the viewer owns. */
  function pointAt(ev) {
    const svg = liveSvg(); // the SIXTH site of the living-svg seam: a dead svg's CTM maps clicks into a ghost's coordinates
    if (!svg?.createSVGPoint || !svg.getScreenCTM) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    const local = p.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  /**
   * WHICH OF THE THINGS THIS COCKPIT DREW is under that point, if any.
   *
   * Only the cockpit's OWN figures are hit-tested — what stands against you and
   * what is lying on the floor. The viewer's marks are the viewer's to answer
   * for, and a second hit-test over them would be this overlay quietly taking
   * clicks that belong to the surface underneath it.
   */
  function thingAt(local) {
    if (!local || !gridNow()) return null;
    const u = unitsPerPx();
    const near = (at, r) => at && Math.hypot(local.x - at.x, local.y - at.y) <= r;
    const placed = adversaryPlacement(state.answer, gridNow());
    if (placed && near(placed.at, ADVERSARY_R * u * 1.34)) {
      // `adversary: true` is what makes the entity reading win over the mark
      // reading on this ground — see onMapClick.
      return { id: placed.adversary.id, label: placed.adversary.label, adversary: true };
    }
    for (const t of looseThings(state.answer)) {
      const at = worldToPx(gridNow(), t.at);
      if (near(at, LOOSE_R * u * 1.9)) return { id: t.id, label: t.label, loose: true };
    }
    return null;
  }

  /**
   * The seat that picks a thing up off the floor.
   *
   * RULED 2026-08-29: a loose thing is "click-to-take directly — that replaces
   * the take button for floor items and is how the party picks up the weapon."
   *
   * ⚑ THE RULING NAMES THE SEAT, so this reads it by name and does not pretend
   * otherwise. It could not be derived: several afforded acts take a mark id and
   * choosing between them would be this surface deciding what an act means,
   * which is the whole thing verb-first targeting exists to stop doing. The name
   * lives in the arithmetic already — it is one of the six fixed seats — and the
   * ruling is literally about that seat, so nothing new is being learned here.
   *
   * Null when the ground does not afford it or the clock will not allow it, and
   * then a loose thing is not click-to-take: it stays a thing on the floor, and
   * the reader is not offered a gesture the door would refuse.
   */
  function pickUpSeat() {
    const { shown, folded } = foldedBar();
    const s = [...shown, ...folded].find((x) => x.action === "take");
    return s?.afforded && s.enabled && s.card ? s : null;
  }

  /** Arm an act. The seat lights, the map takes the next click, and no panel
   *  opens — the question is being asked on the painting. */
  function arm(action, kind, field) {
    state.aiming = { action, kind, field };
    state.act = null;
    state.open = null;
    state.said = null;
    formValues = null;
    aimingSignal(true);
    paint();
  }
  /** `repaint: false` for a caller that is about to paint anyway — two paints
   *  in one gesture rebuild the row under a hand that is still on it. */
  function disarm(repaint = true) {
    if (!state.aiming) return;
    state.aiming = null;
    state.said = null;
    aimingSignal(false);
    if (repaint) paint();
  }
  /**
   * THE CROSSHAIR, and why it is on the documentElement rather than on us.
   *
   * The cursor has to change over the PAINTING, and the painting is the
   * viewer's element outside this overlay — so a class on `.pmc` reaches
   * nothing. This is the same signal shape the dock already uses
   * (`data-pmc-dock`), on our own class name, and it writes no attribute of the
   * viewer's: the rule that reads it is ours, in COCKPIT_CSS, and the viewer
   * never learns the class exists. Given back at destroy, like the dock's.
   */
  function aimingSignal(on) {
    try { doc.documentElement.classList[on ? "add" : "remove"]("pmc-aiming"); } catch {}
  }
  /**
   * A TARGET, TAKEN — AND THEN THE PANEL, NOT THE DOOR.
   *
   * ⚑ THIS USED TO DISPATCH, and the founder's governing ruling is what changed
   * it: "in both cases, the next step IS the right side panel popup that has
   * the WHO, the FROM, and the TO … and the CONFIRM button to actually do the
   * action." An aimed act that fired the instant you clicked was one gesture
   * shorter and gave a reader nowhere to notice they had aimed at the wrong
   * thing. The panel is now the one place every act is confirmed, whether it
   * was aimed at a thing, at a point, or at nothing at all.
   *
   * `args` is what the target contributed, in the door's own field names — one
   * id for a thing, two coordinates for a point — and it is held on `state.act`
   * until the reader presses confirm.
   */
  function takeAim(args, label) {
    const { action } = state.aiming ?? {};
    if (!action) return;
    state.act = { action, args, label };
    state.aiming = null;
    state.said = null;
    formValues = null;
    aimingSignal(false);
    state.open = action;
    askTerms(action);
    paint();
  }

  /**
   * A THING ON THE FLOOR IS PICKED UP BY CLICKING IT (2026-08-29 ruling).
   *
   * One gesture, no menu and no panel: the ruling is that this "replaces the
   * take button for floor items and is how the party picks up the weapon", and
   * a panel in between would be the form the ruling was written against. Where
   * the ground does not afford it the click does nothing rather than opening
   * something — see `pickUpSeat`.
   */
  function takeFromFloor(thing) {
    const seatFor = pickUpSeat();
    const field = seatFor ? aimField(seatFor.card) : null;
    if (!field) return;
    sendAct(seatFor.action, { [field.name]: thing.id });
  }

  /**
   * WHAT THE POINTER IS RESTING ON, out on the painting.
   *
   * The hover half of the ruling that took the creature's name off the map: the
   * ring is bare until you point at it, and pointing at it is what asks for its
   * name and its numbers.
   *
   * IT IS THE CLICK'S OWN READER, `thingAt`, and that is the point rather than a
   * convenience — the figure that LIGHTS under the cursor and the figure a press
   * would land on are then one answer, and cannot drift into two that happen to
   * agree. It is also the only reader available: the token layer takes no
   * pointer events, so neither `:hover` nor `<title>` can fire on anything drawn
   * there, and a coordinate is all there is to go on.
   *
   * IT DOES ALMOST NOTHING, ALMOST ALWAYS. No creature on this ground and it
   * returns on the first line; the answer unchanged and it returns on the third.
   * Only the pointer actually passing the ring's edge repaints, and it repaints
   * one layer.
   */
  const onMapHover = (ev) => {
    const cool = () => { if (state.hover !== null) { state.hover = null; advRing(); } };
    if (!adversaryOf(state.answer)) { cool(); return; }
    const svg = liveSvg();
    // Over the cockpit's own furniture is not over the map, even where the two
    // overlap — the bar hangs across the bottom of the painting, and a pointer
    // resting on a seat is not resting on whatever is behind it.
    if (!svg || !svg.contains?.(ev.target) || ev.target?.closest?.("[data-pmc]")) { cool(); return; }
    const thing = thingAt(pointAt(ev));
    const id = thing?.adversary ? thing.id : null;
    if (id === state.hover) return;
    state.hover = id;
    advRing();
  };

  // The map's clicks, in the CAPTURE phase — so a click on one of our own
  // figures can be taken before the viewer sees it, and every other click is
  // left entirely alone. We stop propagation ONLY for a figure this cockpit
  // drew (and for any click at all while an act is armed, which is the reader
  // having said the map is a targeting surface right now); bare ground is a
  // click the viewer does nothing with today, and a mark of the viewer's own is
  // never intercepted at all.
  const onMapClick = (ev) => {
    // THE LISTENER LIVES ON THE DOCUMENT, the figures live on whichever svg is
    // alive — the FIFTH sighting of the living-svg seam tonight, and the literal
    // reason the founder could not click the cake: the handler was bound to the
    // mount-time svg, which the viewer had long since rebuilt, so every click
    // landed on a painting nobody was listening to.
    const svg = liveSvg();
    if (!svg || !svg.contains?.(ev.target) || state.open) return;
    if (ev.target?.closest?.("[data-pmc]") || ev.target?.closest?.("[data-pmc-throws]")) return;
    const local = pointAt(ev);
    if (!local) return;
    const thing = thingAt(local);

    // ── AN ARMED ACT OWNS THE NEXT CLICK ──
    // On a target it finishes the act; anywhere else it disarms, which is the
    // ruling's own escape hatch ("Escape or clicking elsewhere disarms"). Either
    // way the viewer does not also act on it: a click meant as a target must not
    // additionally arm a walk to the spot the target is standing on.
    if (state.aiming) {
      ev.preventDefault();
      ev.stopPropagation();
      // ── AIMED AT A POINT ── walking, and anything else the door describes as
      // taking grid metres. The ground itself is the target, so ANY click on
      // the painting is a valid one — snapped to the ground's own stride, which
      // is where that dial belongs now that walking is an act of this flow
      // rather than a hand-off to a second desk.
      if (state.aiming.kind === "point") {
        const m = snapPoint(pxToWorld(gridNow(), local), walkStep(state.answer));
        if (!m) { disarm(); return; }
        const f = state.aiming.field;
        takeAim({ [f.x]: m.x, [f.y]: m.y },
          `${m.x.toLocaleString()}, ${m.y.toLocaleString()}`);
        return;
      }
      // ── AIMED AT A THING ── only the things the answer placed are targets;
      // a click on anything else disarms, which is the ruling's own escape
      // hatch ("Escape or clicking elsewhere disarms").
      // ⚑ AND THE NARROWED SET IS WHAT A CLICK RESOLVES AGAINST, not the wide
      // one. The ring is drawn from `targetsFor` and this is the gesture that
      // answers the ring — reading a wider list here would let a click land on
      // a figure the crosshair never lit, which is the founder's own bug with
      // the aim strip telling the truth and the map lying.
      const target = thing ? targetsFor(state.aiming.action).find((t) => t.value === thing.id) : null;
      if (target) takeAim({ [state.aiming.field.name]: target.value }, target.label);
      else disarm();
      return;
    }

    if (thing) {
      ev.preventDefault();
      ev.stopPropagation();
      if (thing.loose) takeFromFloor(thing);
      // ⚑ AND THE ADVERSARY OPENS NOTHING (founder, 2026-08-29). The cake is one
      // node wearing two readings — a mark of the world and the thing you are
      // fighting — and in a fight the entity reading wins. Its acts are on the
      // bar, where they are armed and then aimed; a menu here would be the
      // object-first order the ruling reversed, offered a second time from the
      // one place it read worst. The click is still swallowed, so it does not
      // fall through and arm a walk into whatever you were aiming at.
      return;
    }
    // A MARK OF THE VIEWER'S IS THE VIEWER'S. Its overlay shapes carry data-id,
    // and taking those clicks would mean this overlay silently replacing the
    // viewer's own selection behaviour with a walk.
    if (ev.target?.closest?.("#wv-overlay [data-id], .wv-card, .ctl, button, a")) return;
    // ── AND BARE GROUND WITH NOTHING ARMED DOES NOTHING ──
    // Under the one flow a walk begins at its BUTTON: press it, and the map
    // becomes a targeting surface for a point (the aiming branch above, where
    // the ground's stride is applied). A click with nothing armed is not a
    // half-begun act any more, so it is left entirely alone — the viewer keeps
    // whatever it does with it, and this overlay takes nothing it was not asked
    // for.
  };
  doc.addEventListener("click", onMapClick, true);
  // On the DOCUMENT for the same reason the click is, and passive because it
  // never answers a gesture — it only decides what a figure says about itself.
  doc.addEventListener("pointermove", onMapHover, { passive: true });

  // ── the voices, on their own clock ────────────────────────────────────────
  //
  // A SECOND DOOR, POLLED, and both halves of that are deliberate. Speech is not
  // in the apex answer at all — it lives at the conversations door, keyless,
  // because "speech is public the way street conversation is" — so it cannot ride
  // the standpoint read. And it changes on its own: somebody else speaking is an
  // event no act of the reader's would refresh, so the only honest shape is a
  // poll. Seven seconds is the cadence the site's own conversations page already
  // uses against this door; a second number here would be a second thing to tune.
  //
  // Absent `readVoices`, this whole half is simply off — the map draws no speech
  // and nothing is fetched, which is what a harness and an unwired host get.
  let voiceTimer = null;
  async function pullVoices() {
    if (!o.readVoices) return;
    const body = await o.readVoices().catch(() => null);
    if (!body) return;
    // ⚑ ONE CLOCK READING FOR THE WHOLE POLL, and it is a correctness rule.
    //
    // `recentVoices` turns each voice's timestamp into an AGE against the now it
    // is given; `voiceEntries` turns that age back into an instant against the
    // now IT is given, and that instant is the line's id. Two separate
    // `Date.now()` calls are two different nows, so the round trip does not land
    // on the timestamp it started from — it lands a millisecond or two later,
    // every poll, and every poll therefore mints a NEW id for a line already on
    // screen. Every said line appeared again on the next tick.
    //
    // It hid for a while because the two calls usually fell inside the same
    // millisecond; it surfaced the moment there was more work between them.
    // Shared, the round trip is exact — now − (now − at) === at — so a line's id
    // is its own timestamp, whatever poll observes it.
    const now = Date.now();
    const next = recentVoices(body, { now });
    // Repaint only when something actually changed. The fade is continuous, so a
    // naive redraw every tick would rebuild the whole layer to move an opacity a
    // few thousandths — and it would do it under a reader's cursor.
    const sig = (list) => list.map((v) => `${v.handle}|${v.said}|${v.ageMs > 0 ? Math.round(v.ageMs / 4000) : 0}`).join(" ");
    // THE FEED IS FED BEFORE THE EARLY RETURN, and the order is the fix rather
    // than a tidiness. The guard below exists so the MAP's bubbles are not
    // rebuilt for a fade that moved an opacity a few thousandths — but the feed
    // dedupes by id and drops what it has already drawn, so the same guard
    // applied to it could only ever throw lines away. It does not need
    // protecting; the bubbles do.
    //
    // WHICH IS ALSO WHY A LINE OUTLIVES ITS BUBBLE. The bubble is a sound and
    // fades on the door's own clock; the feed is the record of one, and a chat
    // you can scroll up through does not un-say things.
    ingest(voiceEntries(next, { now }));
    if (sig(next) === sig(state.voices)) return;
    state.voices = next;
    speech();
  }
  if (o.readVoices) {
    pullVoices();
    voiceTimer = (doc.defaultView ?? globalThis).setInterval?.(pullVoices, 7000) ?? null;
  }

  // ── the fight, on its own clock ───────────────────────────────────────────
  //
  // A SECOND POLL, AND IT IS A SECOND ONE ON PURPOSE. The voices poll reads the
  // conversations door every seven seconds, which is the right cadence for
  // speech and much too slow for a turn: a player watching for their own go
  // would learn it was theirs up to seven seconds late, and the wheel is the
  // one thing on this page a hand is waiting on. So the encounter is re-read
  // every two and a half seconds — the founder's own window, "every 2–3 s while
  // an encounter ground is the standpoint".
  //
  // IT RUNS ONLY INSIDE PORTAL GROUND. Outside it the timer does nothing at
  // all; on a town map the feed is the rail's record and the talk, and neither
  // of those wants a two-second poll.
  //
  // PORTAL GROUND RATHER THAN "AN ENCOUNTER IS LIVE", deliberately — the
  // antechamber is portal ground with no fight in it, and it is where the
  // lighter is picked up, where the party gathers, and where the first crossing
  // into the vault has to become visible. Gating on a live encounter would mean
  // the one room whose whole job is waiting for people to arrive was the one
  // room that could not see them arrive.
  //
  // ⚑ AND IT REPAINTS ONLY WHEN SOMETHING VISIBLE MOVED. A repaint replaces the
  // bar's whole innerHTML, so a naive tick would rebuild the row under the
  // reader's cursor twenty-four times a minute and take the hover card with it.
  // The signature is the parts a paint can show: the wheel, the fight's own
  // block, the standpoint, and which acts the ground is granting.
  let encTimer = null;
  const answerSig = (a) => {
    try {
      return JSON.stringify([
        a?.encounter, a?.encounter_detail, a?.standpoint,
        (a?.actions ?? []).map((e) => [e?.action, e?.granted, e?.enabled]),
        a?.actors,
      ]);
    } catch { return String(Date.now()); } // an answer that will not serialise is treated as new
  };
  async function pullEncounter() {
    if (!o.refresh || !portalOf(state.answer)) return;
    const fresh = await o.refresh().catch(() => null);
    if (!fresh) return;
    // WALKING OUT TAKES THE COCKPIT DOWN, on this road as on the caller's. The
    // reader can leave the portal by any door — the viewer's own exit, a walk,
    // somebody else's act — and this poll is now the fastest thing to notice.
    if (!cockpitShows(fresh)) { state.answer = fresh; teardown(); return; }
    const moved = answerSig(fresh) !== answerSig(state.answer);
    // The feed is derived FIRST and from the old snapshot, then the answer is
    // adopted — the delta is the whole reason this poll exists, and adopting
    // the answer before deriving would compare a state against itself.
    absorbEncounter(fresh);
    state.answer = fresh;
    autoSelectOnTurn();
    if (moved) paint();
  }
  if (o.refresh) encTimer = (doc.defaultView ?? globalThis).setInterval?.(pullEncounter, 2500) ?? null;

  // ── the dock's handshake with the viewer ──────────────────────────────────
  // Two signals, belt and suspenders for boot order: the attribute is readable
  // by a viewer that booted after us; the event reaches one that booted before.
  // The viewer's renderIdentity checks the attribute and stands its own Act As
  // row down while this dock holds the question.
  /** The key the viewer persists its own actor under (spectator/viewer.mjs:42,
   *  `ACT_AS_KEY = "pm.world.act_as"`). It is the only readable signal for who
   *  the viewer currently thinks is acting — `state.actAs` is a closure. */
  const VIEWER_ACT_AS = "pm.world.act_as";
  const viewerActor = () => {
    try { return (doc.defaultView ?? globalThis).localStorage?.getItem(VIEWER_ACT_AS) ?? null; }
    catch { return null; }
  };

  /**
   * TELL THE VIEWER WHO IS ACTING — and the event alone does not do it.
   *
   * THE EVENT IS DEAD WIRE AT THIS PIN, measured rather than assumed: the string
   * "pm:" does not occur anywhere in spectator/viewer.mjs at the pinned build
   * (package.json holds ceeca087), and no listener for it exists anywhere in
   * src/ either. The listeners DO exist on the world's proto/birthday branch
   * (2cf10d0f, 3d1fbfe0) — this pin is simply behind them. So the event is kept,
   * because it is the seam both sides agreed on and it starts working the moment
   * the pin is bumped; it is just not load-bearing today.
   *
   * WHAT IS LOAD-BEARING is the viewer's own delegated control:
   *     const actor = e.target.closest("[data-act-as]");
   *     if (actor) { selectActor(actor.dataset.actAs); return; }   // viewer.mjs:7681
   * minted and clicked, the same move the page's arrival island makes. This is
   * not belt-and-braces decoration — without it the dock's selection never
   * reaches the viewer, and `confirmSelectedWalk` posts `state.handle`, so a
   * reader who picked a face here and then clicked the map would arm a walk for
   * WHOEVER THE VIEWER STILL THOUGHT WAS ACTING. Silently, and for the wrong
   * resident.
   *
   * GUARDED, because selectActor is not free to call twice. It runs
   * `clearSelectionAndDestination()` and recenters the camera (viewer.mjs:8060,
   * 8064) — so a redundant call throws away an armed walk and moves the map out
   * from under the reader. It fires only when the viewer's actor actually
   * differs from ours, read off the key the viewer persists it under.
   */
  const speakActAs = () => {
    const w = doc.defaultView ?? globalThis;
    const actor = state.acting;
    // The human hand stays this cockpit's own grammar — never spoken at the
    // viewer, which keeps its last resident for walks.
    if (!actor || actor === HUMAN_ACTOR) return;
    if (viewerActor() !== actor) {
      const wv = doc.querySelector(".wv");
      if (wv) {
        const b = doc.createElement("button");
        b.setAttribute("data-act-as", actor);
        b.style.display = "none";
        wv.appendChild(b);
        b.click();
        b.remove();
      }
    }
    if (typeof w.CustomEvent !== "function") return;
    try { w.dispatchEvent(new w.CustomEvent("pm:act-as", { detail: { actor } })); } catch {}
  };
  const dockSignal = (present) => {
    const w = doc.defaultView ?? globalThis;
    try {
      if (present) doc.documentElement.setAttribute("data-pmc-dock", "1");
      else doc.documentElement.removeAttribute("data-pmc-dock");
      if (typeof w.CustomEvent === "function")
        w.dispatchEvent(new w.CustomEvent("pm:cockpit-dock", { detail: { present } }));
    } catch {}
  };
  /**
   * THE FEED'S OWN HANDSHAKE, and it is the dock's shape exactly: an attribute
   * a viewer that booted after us can read, and an event for one that booted
   * before. The attribute is what the CSS reshape hangs on, so it is
   * load-bearing HERE even though pm:cockpit-feed is dead wire at this pin —
   * the same standing the dock's event has, and kept for the same reason.
   *
   * Standing it down is one attribute removal: the section stops being a
   * scrollport, the viewer's list un-flips, and the rail is the rail it was.
   */
  const feedSignal = (present) => {
    const w = doc.defaultView ?? globalThis;
    try {
      if (present) doc.documentElement.setAttribute("data-pmc-feed", "1");
      else doc.documentElement.removeAttribute("data-pmc-feed");
      if (typeof w.CustomEvent === "function")
        w.dispatchEvent(new w.CustomEvent("pm:cockpit-feed", { detail: { present } }));
    } catch {}
  };
  dockSignal(true);

  /**
   * THE COMBAT RAIL IS ONLY THERE WHEN YOU ARE IN THE COMBAT — the founder's own
   * words, on prod, live.
   *
   * ⚑ THE RESHAPE WAS RIDING THE MOUNT. `feedSignal(true)` fired here, once, on
   * mounting — and the cockpit mounts on any portal ground at all, so a resident
   * standing in the POST OFFICE turned the viewer's Lately section into a
   * combat feed: flipped to newest-at-the-bottom, capped to a scrollport, with
   * fourteen town says in it and not one beat. The chip said the world root and
   * the rail said a fight was happening.
   *
   * A FIGHT IS A LIVE WHEEL, not a mounted cockpit. `encounterOf` already answers
   * exactly that question — null with no encounter, and null with an encounter
   * carrying nobody — so the reshape is hung on it and re-asked on every paint.
   * With no wheel the Lately section is wholly the viewer's own, which is the
   * state a reader outside a fight has always been entitled to.
   */
  let feedPresent = false;
  const inCombat = () => Boolean(encounterOf(state.answer));
  function syncFeedPresence() {
    const live = inCombat();
    if (live === feedPresent) return;
    feedPresent = live;
    feedSignal(live);
    // and the cockpit's OWN list goes with the reshape. Leaving an empty <ol> in
    // the viewer's section would be a fight's furniture standing in a rail that
    // is no longer a feed — invisible today and a bug the day it is not.
    if (!live) {
      feedList?.remove(); feedList = null;
      feedNew?.remove(); feedNew = null;
    }
  }
  syncFeedPresence();

  // A PICTURE THAT WILL NOT LOAD UNCOVERS ITS LETTER. Delegated and in the
  // CAPTURE phase because `error` does not bubble — the one listener survives
  // every repaint, where an inline handler would have to be re-minted into
  // every face on every paint and would need a CSP exception besides.
  const onImgError = (ev) => {
    const img = ev.target;
    if (img?.tagName === "IMG" && img.closest?.(".pmc-face, .pmc-turn")) img.remove();
  };
  root.addEventListener("error", onImgError, true);

  paint();
  speakActAs();
  // The feed's first draw and the dock's first pictures. Both after paint():
  // ensureFeed needs the rail as it is now, and pullProfiles reads the faces
  // the first paint resolved.
  drawFeed();
  pullProfiles();
  // Seed BOTH baselines without narrating either. The state at mount is not an
  // event — a reader arriving mid-fight should not be handed the whole fight as
  // things that just happened — so the snapshot and the watermark are taken and
  // nothing is said. A mount with no tail leaves the watermark null, which is
  // what sends the first tail that does arrive down the seed-and-say-nothing
  // path rather than dumping its whole window.
  state.encSnap = o.answer?.encounter_detail ?? null;
  state.beatSeq = seedBeatSeq(state.encSnap);
  autoSelectOnTurn();

  let dead = false;
  const teardown = () => {
    if (dead) return;
    dead = true;
    doc.removeEventListener("keydown", onKey);
    (doc.defaultView ?? globalThis).removeEventListener?.("resize", onResize);
    if (voiceTimer != null) (doc.defaultView ?? globalThis).clearInterval?.(voiceTimer);
    if (encTimer != null) (doc.defaultView ?? globalThis).clearInterval?.(encTimer);
    doc.removeEventListener("click", onMapClick, true);
    doc.removeEventListener("pointermove", onMapHover);
    root.removeEventListener("error", onImgError, true);
    camera?.disconnect();
    furniture?.disconnect();
    bubbles?.disconnect();
    dockSignal(false); // hand the Act As question back to the viewer's own row
    aimingSignal(false); // and the map's cursor back to the viewer's
    feedSignal(false); // and Lately back to being Lately
    feedWatched?.removeEventListener?.("scroll", onFeedScroll);
    feedSize?.disconnect();
    feedMutations?.disconnect();
    feedWatched = null;
    feedList?.remove();
    feedNew?.remove();
    feedList = feedNew = null;
    root.remove();
    throwLayer.remove();
    tokenLayer?.remove();
  };

  // ⚑ A TORN-DOWN COCKPIT STAYS TORN DOWN. `update` destroys itself when the
  // answer says this standpoint is no longer inside portal ground — but the
  // CALLER still holds the handle, and a later update on it ran `paint()` over
  // a detached root and re-appended a token layer to the living svg: map
  // figures with no bar under them, owned by nothing, cleaned up by nobody.
  //
  // Guarded here rather than only at the call site, because every caller has
  // the same hazard and only one of them would have remembered.
  return {
    update(answer) {
      if (dead) return;
      if (!cockpitShows(answer)) { state.answer = answer; teardown(); return; }
      // The feed is derived from the OLD snapshot against the new answer before
      // the answer is adopted, for the same reason the poll does it in that
      // order: a delta taken after the swap compares a state against itself.
      absorbEncounter(answer);
      state.answer = answer;
      autoSelectOnTurn();
      paint();
      drawFeed();
      pullProfiles();
    },
    destroy: teardown,
  };
}

export { worldToPx };
