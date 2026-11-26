// event-attendance.test.mjs — who was there, by name, in the event card under its RSVPs (CORE-177 ruling 2).
//
//   node --test test/event-attendance.test.mjs
//
// The office's evidence names the actors of the public acts at an event: `participants`, `{ handle, household, human? }`, sorted by handle
// (office #1224 @ 93dea263, POS-1217). WHAT THIS HOLDS (pure: no browser, no build):
//   (1) the state is DISTINCT (calendar.mjs § participantsOf): an absent or unreadable list is unknown, `[]` is known none, never read from
//       `present` (households), the RSVPs, a household's members or a companion; a resident keeps its handle, a human its public presentation;
//   (2) the words are the bounded group, and the household wording is not used for an actor list;
//   (3) each person is the site's one mention (CORE-178): the island's model (event-attendance.mjs) is the build's (resident-mention-roll.mjs
//       mentionOf) for a resident, a renamed resident (an alias), a human with a public name and one without, and a handle with no resident;
//   (4) the refresh: the office's existing one-event read, as the page already asks it, repaints a roster the bake did not have.
// EVERY IDENTITY HERE IS INVENTED.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENT_WORDS, eventSections, participantsOf } from "../src/lib/calendar.mjs";
import { attendanceNote, attendeeLabel, attendeeModel, paintAttendance, unplacedLine } from "../src/lib/event-attendance.mjs";
import { mentionRoll } from "../src/lib/resident-mention-roll.mjs";
import { mentionHtml } from "../src/lib/resident-mention.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PAGE = read("town/pages/events/[host]/[slug].astro");

const ended = (evidence) => ({ id: "host-test/supper-test", phase: "ended", cancelled: false, rsvps: { total: 2, residents: ["rsvponly-test", "wren-test"] }, evidence });
const base = { rooms: [], room_history: "complete", present: ["hh:wren-test-house", "solo:guest-test"], gallery: { rooms: [], sparks: [] } };

// ── (1) a distinct state ──────────────────────────────────────────────────

test("absent, null or a non-list is UNKNOWN, `[]` is KNOWN none; neither is read from the households, and a cancelled or not-yet event claims nothing", () => {
  for (const [name, over] of [["absent", {}], ["null", { participants: null }], ["an object", { participants: { wren: true } }], ["a string", { participants: "wren-test" }]]) {
    const s = eventSections(ended({ ...base, ...over }));
    assert.equal(s.participants.state, "unknown", `${name} is unknown`);
    assert.equal(s.present.state, "known", "control: the households are known, and are NOT turned into people");
    assert.equal("people" in s.participants, false);
  }
  const none = eventSections(ended({ ...base, participants: [] }));
  assert.deepEqual([none.participants.state, none.participants.people], ["known", []], "an empty list is known none");
  assert.deepEqual(none.present.households, base.present, "`present` is unchanged beside it");
  assert.equal(eventSections({ ...ended({ ...base, participants: [{ handle: "wren-test" }] }), cancelled: true }).participants.state, "unknown", "cancelled");
  const before = eventSections({ id: "h/s", phase: "announced", cancelled: false });
  assert.deepEqual([before.participants.state, before.participants.before], ["unknown", true], "before the doors open");
  assert.equal(eventSections({ id: "h/s", phase: "ended", cancelled: false }).participants.state, "unknown", "no evidence after the event: unknown, never none");
});

test("NO INFLATION: only the listed actors, each once, in the office's order; never a member, an RSVP or a companion; a resident is its handle alone", () => {
  const s = eventSections(ended({
    ...base,
    participants: [
      { handle: "guest-test", household: "solo:guest-test" },
      { handle: "human-of-wren-test-house", household: "hh:wren-test-house", human: true, speaker: " Ada Test ", house: "Wren Test House", house_slug: "wren-test-house", town_name: "Ada", pronouns: "she/her", human_registry: { email: "x@example.test" }, beside: "wren-test" },
      { handle: "guest-test", household: "hh:other-test" },
      { handle: "wren-test", household: "hh:wren-test-house", speaker: "NOT FOR A RESIDENT", members: ["moss-test"], stood_with: "x", human: "yes" },
      null, "loose-string-test", { handle: "" }, { household: "hh:no-actor-test" },
    ],
    participants_basis: "the actors of those same acts",
    unplaced_says: 3,
  }));
  const p = s.participants;
  assert.equal(p.state, "known");
  assert.deepEqual(p.people.map((x) => x.handle), ["guest-test", "human-of-wren-test-house", "wren-test"], "each actor once, first seen kept, nothing re-sorted; an act with no actor names no one");
  assert.deepEqual(p.people[0], { handle: "guest-test", household: "solo:guest-test" });
  assert.deepEqual(p.people[1], { handle: "human-of-wren-test-house", household: "hh:wren-test-house", human: true, speaker: "Ada Test", house: "Wren Test House", house_slug: "wren-test-house", town_name: "Ada", pronouns: "she/her" }, "a human's public presentation only: no registry, no shoulder");
  assert.deepEqual(p.people[2], { handle: "wren-test", household: "hh:wren-test-house" }, "a resident is its handle and household: no presentation, members, companion or a non-true human flag");
  for (const never of ["rsvponly-test", "moss-test", "hh:no-actor-test", "x@example.test"]) assert.equal(JSON.stringify(p).includes(never), false, `${never} is not an attendee`);
  assert.equal(p.unplaced, 3); assert.equal(p.basis, "the actors of those same acts");
});

// ── (2) the words ─────────────────────────────────────────────────────────

test("the bounded words: the title, the lead, none and unknown; the households' 'no public act' wording is not an actor list's", () => {
  assert.deepEqual({ ...EVENT_WORDS.attendance }, {
    title: "Who was there",
    lead: "Recorded attendees, from public acts at the event. An RSVP alone does not count.",
    none: "No individual attendees are recorded.",
    unknown: "Individual attendance isn't available here.",
  });
  assert.notEqual(EVENT_WORDS.attendance.none, EVENT_WORDS.present.none);
  assert.equal(attendanceNote({ state: "unknown" }), "unknown"); assert.equal(attendanceNote(undefined), "unknown");
  assert.equal(attendanceNote({ state: "known", people: [] }), "none"); assert.equal(attendanceNote({ state: "known", people: [{ handle: "a" }] }), null);
  assert.equal(unplacedLine(1), "1 public say could not be placed at the event, so they are not counted here.");
});

// ── (3) the one mention, built and live alike ─────────────────────────────

const RESIDENTS = [
  { handle: "wren-test", address: { agent: "Wren" }, profile: { color: "#2f5aa8" } },
  { handle: "moss-test", address: { agent: "Moss" }, profile: {} },
];
const RENAMES = { "old-wren-test": "wren-test", "gone-test": "nobody-built-test" };
const roll = mentionRoll(RESIDENTS, RENAMES, {});
// the page carries resident-mentions.mjs § publicFaces (this projection of the roll's faces) and § mentionAliases (the roll's aliases)
const FACES = Object.fromEntries(RESIDENTS.map((r) => [r.handle, roll.faceOf(r.handle)]).map(([h, f]) => [h, { name: f.name, accent: f.accent, avatar: f.avatar, monogram: f.monogram }]));
const ALIASES = roll.aliases();

test("PIN the faces and renames the page carries are the build's own projection (resident-mentions.mjs), not a second one", () => {
  const SRC = read("src/lib/resident-mentions.mjs");
  assert.match(SRC, /\[h, \{ name: f\.name, accent: f\.accent, avatar: f\.avatar, monogram: f\.monogram \}\]/, "publicFaces' projection is the one this test carries");
  assert.match(SRC, /export const mentionAliases = roll\.aliases\(\);/);
  assert.match(PAGE, /^import \{ mentionAliases, publicFaces \} from "@\/lib\/resident-mentions\.mjs";$/m);
  // (the union of #491 into #488: the same projection rides whenever the section can mount a reader, CORE-178's F1 rule, whose case includes the
  // roster repaint's own attendRefresh, so the repaint still has it)
  assert.match(PAGE, /const liveFaces = carriesSpeakerFaces\(sections\) \? publicFaces\(residents\.map\(\(r\) => r\.handle\)\) : null;/);
  assert.match(PAGE, /const attendRefresh = !sections\.cancelled && /, "the repaint's case is inside F1's (not cancelled)");
});

test("the island's mention is the build's, for a resident, a RENAMED resident (an alias), a public human, an unshown human and a handle with no resident", () => {
  const people = [
    { handle: "wren-test", household: "hh:w" },
    { handle: "old-wren-test", household: "hh:w" },
    { handle: "human-of-wren-test-house", household: "hh:w", human: true, speaker: "Ada Test" },
    { handle: "human-of-quiet-test", household: "hh:q", human: true },
    { handle: "stranger-test", household: "solo:stranger-test" },
    { handle: "gone-test", household: "solo:gone-test" },
  ];
  for (const p of people) {
    const live = attendeeModel(p, { faces: FACES, aliases: ALIASES });
    const built = roll.mentionOf(p.handle, { label: attendeeLabel(p) });
    assert.deepEqual(live, built, `${p.handle}: the island's model is the build's`);
    assert.equal(mentionHtml(live), mentionHtml(built));
  }
  const alias = attendeeModel(people[1], { faces: FACES, aliases: ALIASES });
  assert.deepEqual([alias.kind, alias.name, alias.href, alias.handle], ["resident", "Wren", "/residents/wren-test/", "old-wren-test"], "a renamed resident wears the current face, name and page; the record's handle is kept");
  assert.deepEqual(attendeeModel(people[2], { faces: FACES }), { kind: "text", handle: "human-of-wren-test-house", text: "Ada Test" }, "a human by its public name, never a resident's face");
  assert.deepEqual(attendeeModel(people[3], { faces: FACES }), { kind: "text", handle: "human-of-quiet-test", text: "human-of-quiet-test" }, "an unshown human is its exact handle");
  assert.deepEqual(attendeeModel(people[4], { faces: FACES }), { kind: "text", handle: "stranger-test", text: "stranger-test" }, "no resident: the exact handle, no invented portrait");
  assert.equal(attendeeLabel({ handle: "wren-test", speaker: "Not a resident's" }), undefined, "a resident never takes a label");
  assert.equal(attendeeModel(people[0], { faces: null, aliases: null }).kind, "text", "with no faces carried, a resident is still only its handle, never guessed");
  // the build draws the same: ResidentMention with the person's handle and the human's public name
  assert.match(PAGE, /<ResidentMention handle=\{p\.handle\} label=\{attendeeLabel\(p\)\} \/>/);
});

// ── (4) the refresh ───────────────────────────────────────────────────────

function fakeDom() {
  const node = (tag) => ({
    tag, attrs: {}, children: [], dataset: {}, hidden: false, _text: "",
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...c) { this.children = c; },
    get textContent() { return this._text || this.children.map((c) => c.textContent).join(""); },
    set textContent(v) { this._text = String(v); this.children = []; },
  });
  const doc = { createElement: node, createTextNode: (t) => ({ textContent: String(t) }) };
  // the card's block as the page bakes it for a running event or an unknown roster: hidden, unknown, no list
  const list = node("ul"); list.hidden = true;
  const note = node("p"); note.dataset.evAttendNote = "unknown"; note.textContent = EVENT_WORDS.attendance.unknown;
  const unplaced = node("p"); unplaced.hidden = true;
  const parts = { "[data-ev-attend-list]": list, "[data-ev-attend-note]": note, "[data-ev-attend-unplaced]": unplaced };
  const box = { dataset: { state: "unknown" }, hidden: true, querySelector: (q) => parts[q] ?? null };
  return { doc, box, list, note, unplaced };
}

test("REFRESH ARRIVAL: the office's one-event read, as the page already asks it, paints a roster the bake did not have; none and unknown are said, not drawn empty", () => {
  const { doc, box, list, note, unplaced } = fakeDom();
  const body = { event: ended({ ...base, participants: [{ handle: "old-wren-test", household: "hh:w" }, { handle: "human-of-wren-test-house", household: "hh:w", human: true, speaker: "Ada Test" }], unplaced_says: 1 }) };
  const s = eventSections(body.event);
  assert.equal(paintAttendance(box, s.participants, { doc, faces: FACES, aliases: ALIASES }), true);
  assert.equal(list.hidden, false); assert.equal(note.hidden, true); assert.equal(box.dataset.state, "known");
  assert.deepEqual(list.children.map((li) => li.textContent), ["WWren", "Ada Test"], "the renamed resident as the current resident (its initial, its name); the human by name");
  assert.equal(list.children[0].children[0].tag, "a"); assert.equal(list.children[0].children[0].attrs.href, "/residents/wren-test/");
  assert.equal(list.children[1].children[0].textContent, "Ada Test"); assert.equal(list.children[1].children[0].tag, undefined, "a human is text, no link, no portrait");
  assert.deepEqual([unplaced.hidden, unplaced.textContent], [false, unplacedLine(1)]);
  // a known empty roster says none; an unknown one says unknown; a box without its parts is left alone
  paintAttendance(box, participantsOf({ participants: [] }), { doc });
  assert.deepEqual([list.hidden, note.hidden, note.textContent, note.dataset.evAttendNote], [true, false, EVENT_WORDS.attendance.none, "none"]);
  paintAttendance(box, participantsOf({}), { doc });
  assert.deepEqual([note.textContent, box.dataset.state], [EVENT_WORDS.attendance.unknown, "unknown"]);
  assert.equal(paintAttendance({ querySelector: () => null }, s.participants, { doc }), false);
});

test("PIN the island repaints from the read it already makes (no new fetch), only a KNOWN answer, only where the bake asked for it, with the carried faces", () => {
  const island = PAGE.slice(PAGE.indexOf("<script>"), PAGE.indexOf("</script>"));
  assert.equal((island.match(/eventReadUrl\(/g) ?? []).length, 1, "one one-event read on the page");
  const start = island.slice(island.indexOf("const start = async"), island.indexOf("start();"));
  assert.match(start, /const s = body\?\.event \? eventSections\(body\.event\) : null;[\s\S]*?querySelector\("\[data-ev-attend\]\[data-ev-attend-refresh\]"\)[\s\S]*?s\?\.participants\.state === "known"[\s\S]*?paintAttendance\(attend, s\.participants, \{ doc: document, faces: json\("data-faces"\), aliases: json\("data-aliases"\) \}\)/);
  // the bake: the block lives in the card's one slot, under the RSVPs; it is drawn as before (after the event, or a known roster), refreshed where it could still change
  assert.match(read("src/components/CalendarCard.astro"), /<\/section>\n  \)\}\n[^\n]*\n  <slot name="attendance" \/>\n<\/article>/, "the card's slot is under its RSVPs, at the card's end");
  assert.match(PAGE, /const attendShown = sections\.after \|\| attendance\.state === "known";/);
  assert.match(PAGE, /const attendRefresh = !sections\.cancelled && \(!sections\.after \|\| attendance\.state !== "known"\);/);
  assert.equal(/data-ev-present|householdLine|EVENT_WORDS\.present/.test(PAGE), false, "the households' list is retired from the page");
});
