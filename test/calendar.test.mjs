// calendar.test.mjs — the calendar page and the event pages (POS-211, 2026-09-24).
//
//   node --test test/calendar.test.mjs
//
// Two halves, for the reason anchor-links.test.mjs gives: CI runs `npm test`
// WITHOUT a build, so a built-page arm never runs on a push. The rules the
// pages follow live in src/lib/calendar.mjs and are judged here against the
// office's sample (test/fixtures/calendar.sample.json, copied from the office
// branch pos-207/the-calendar with the Snug Harbour moved to its true point).
// The built-page arms then read dist-town/ when a build is there and SKIP when
// it is not: they are judged against the committed calendar.json, whatever it
// holds. That is the EMPTY calendar until the office's door lands, because a
// committed sample would be published (the invented Grand Opening, with its
// RSVPs, on the live site); the sample lives only in test/fixtures, and the
// fixture's rendered proof is the lane's variant build.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  GROUPS, groupsOf, eventsOf, eventParams, eventHref, placeOf, residentHref, whenLine, durationWords, utcText,
  dayKey, monthKey, monthsOf, monthGrid, monthHref, referenceInstant, shiftMonth, utcClock,
} from "../src/lib/calendar.mjs";

const ROOT = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const SAMPLE = JSON.parse(read("test", "fixtures", "calendar.sample.json"));
const COMMITTED = JSON.parse(read("src", "data", "postmark", "calendar.json"));
const clone = (v) => JSON.parse(JSON.stringify(v));

// ── the rules ────────────────────────────────────────────────────────────────

test("three groups in page order: Now, Coming, Lately", () => {
  assert.deepEqual(GROUPS.map((g) => g.label), ["Now", "Coming", "Lately"]);
  const g = groupsOf(SAMPLE);
  assert.deepEqual(g.map((x) => x.key), ["now", "coming", "ended"]);
  assert.deepEqual(g[0].events.map((e) => e.id), ["current-the-reader/the-snug-harbour-grand-opening"]);
  assert.deepEqual(g[1].events.map((e) => e.id), ["wright/reading-by-the-lamp"]);
  assert.deepEqual(g[2].events, [], "the sample has nothing in Lately, and the group must still be there to say so");
  assert.ok(g[2].empty.length > 10, "an empty group needs its one line");
});

test("order: Now and Coming earliest start first, Lately newest end first, whatever order the list arrived in", () => {
  const ev = (id, starts, ends) => ({ id: `h/${id}`, starts, ends });
  const g = groupsOf({
    now: [ev("b", "2026-09-26T22:00:00Z", "x"), ev("a", "2026-09-26T21:00:00Z", "x")],
    coming: [ev("d", "2026-10-02T00:00:00Z", "x"), ev("c", "2026-09-30T00:00:00Z", "x")],
    ended: [ev("e", "x", "2026-09-20T00:00:00Z"), ev("f", "x", "2026-09-24T00:00:00Z")],
  });
  assert.deepEqual(g.map((x) => x.events.map((e) => e.id.slice(2)).join("")), ["ab", "cd", "fe"]);
});

test("a cancelled event stays in the group its interval puts it in", () => {
  const cal = clone(SAMPLE);
  cal.now[0].cancelled = true;
  const g = groupsOf(cal);
  assert.equal(g[0].events[0].cancelled, true);
  assert.equal(g[0].events.length, 1);
});

test("a mark links to the World at the mark's point; a bare point reads (x, y) and links the same way", () => {
  const harbour = placeOf(SAMPLE.now[0].place);
  assert.equal(harbour.label, "The Snug Harbour");
  assert.equal(harbour.href, "/world/?at=-350,4978");
  assert.equal(harbour.bare, false);
  const lamp = placeOf(SAMPLE.coming[0].place);
  assert.equal(lamp.label, "(120, 64)");
  assert.equal(lamp.href, "/world/?at=120,64");
  assert.equal(lamp.bare, true);
  assert.equal(placeOf({ mark: null, name: null }).href, null, "no point, no link into the World");
});

test("the Snug Harbour stands at its true point wherever it is carried, not the sample's (412, -188)", () => {
  assert.ok(JSON.stringify(SAMPLE).includes("the-snug-harbour"), "the fixture stopped carrying the harbour, so this checks nothing");
  for (const [name, cal] of [["the test fixture", SAMPLE], ["src/data/postmark/calendar.json", COMMITTED]]) {
    const text = JSON.stringify(cal);
    if (!text.includes("the-snug-harbour")) continue;
    assert.equal(text.includes('"x":412'), false, `${name} still carries the wrong point`);
    const e = eventsOf(cal).find((x) => x.place?.mark === "current-the-reader/the-snug-harbour");
    assert.deepEqual([e.place.x, e.place.y], [-350, 4978], name);
  }
});

test("the committed calendar never carries the sample's invented events: they would be published", () => {
  const invented = new Set(eventsOf(SAMPLE).map((e) => e.id));
  const leaked = eventsOf(COMMITTED).filter((e) => invented.has(e.id)).map((e) => e.id);
  assert.deepEqual(leaked, [], "src/data/postmark/calendar.json carries the office's sample, which the next release would publish");
  const pub = JSON.parse(read("public", "atelier", "postmark", "data", "calendar.json"));
  assert.deepEqual(eventsOf(pub).filter((e) => invented.has(e.id)).map((e) => e.id), [], "and so does the public copy");
});

test("every event has a page address, and an id that is not <host>/<slug> has none", () => {
  for (const e of eventsOf(SAMPLE)) assert.ok(eventHref(e.id), e.id);
  assert.equal(eventHref("current-the-reader/the-snug-harbour-grand-opening"),
    "/calendar/current-the-reader/the-snug-harbour-grand-opening/");
  assert.equal(eventParams("no-slash"), null);
  assert.equal(eventParams("a/b/c"), null);
});

test("a handle links to its resident page only when the roll has one", () => {
  const roll = new Set(["wright"]);
  assert.equal(residentHref("wright", roll), "/residents/wright/");
  assert.equal(residentHref("errant", roll), null, "a handle with no page would be a link to a 404");
});

test("the when-line: until the start while announced or doors-open, how long is left once under way, how long ago once ended", () => {
  assert.equal(SAMPLE.now[0].phase, "doors-open", "the sample's Now event is the doors-open case this line judges");
  assert.equal(whenLine(SAMPLE.now[0]), "starts in 20 min");
  assert.equal(whenLine({ ...SAMPLE.now[0], phase: "underway", starts_in_s: -600, ends_in_s: 13800 }), "ends in 3 h 50 min");
  assert.equal(whenLine(SAMPLE.coming[0]), "starts in 1 d 2 h");
  assert.equal(whenLine({ phase: "ended", ends_in_s: -7200 }), "ended 2 h ago");
  assert.equal(durationWords(null), null, "a missing count is no words, not 'under a minute'");
  assert.equal(durationWords(1200), "20 min");
});

test("the baked time is the UTC reading and says so; the reader's zone is the island's", () => {
  assert.equal(utcText("2026-09-26T21:30:00.000Z"), "Sat 26 Sep, 21:30 UTC");
  assert.equal(utcText("not a time"), "not a time");
});

test("resident words render as text: no calendar page or card writes set:html", () => {
  // Astro escapes {expr}; the one way a title or invitation reaches the page
  // as markup is set:html. This is the arm CI can run; the built-page arm below
  // reads what the build actually wrote.
  for (const f of ["town/pages/calendar/index.astro", "town/pages/calendar/[host]/[slug].astro", "town/pages/calendar/[month].astro",
    "src/components/CalendarCard.astro", "src/components/CalendarMonth.astro"]) {
    // The attribute, not the word: a comment naming it is not a use of it.
    assert.equal(/\sset:html\s*=/.test(read(f)), false, `${f} writes set:html`);
  }
});

// ── the built pages ──────────────────────────────────────────────────────────
// Guarded on the page each arm reads (POS-177): not built, SKIP; built and
// wrong, RED.

const DIST = join(ROOT, "dist-town");
const pageFile = (...segs) => join(DIST, ...segs, "index.html");
const CAL_PAGE = pageFile("calendar");
const calBuilt = existsSync(CAL_PAGE);
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sectionOf = (html, key) => {
  const at = html.indexOf(`data-group="${key}"`);
  assert.ok(at >= 0, `the ${key} group is not on the page`);
  const end = html.indexOf("</section>", at);
  return html.slice(at, end);
};

test("BUILT /calendar/: each event sits in its group, in order, and an empty group says so", { skip: !calBuilt && "dist-town/calendar/ is not built" }, () => {
  const html = readFileSync(CAL_PAGE, "utf8");
  for (const g of groupsOf(COMMITTED)) {
    const sec = sectionOf(html, g.key);
    const at = g.events.map((e) => sec.indexOf(`data-event="${escapeHtml(e.id)}"`));
    assert.equal(at.includes(-1), false, `${g.key}: an event is missing from its group`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `${g.key}: the events are out of order`);
    if (!g.events.length) assert.match(sec, /data-empty/, `${g.key} is empty and says nothing`);
    for (const e of g.events) {
      const card = sec.slice(sec.indexOf(`data-event="${escapeHtml(e.id)}"`));
      const cardHtml = card.slice(0, card.indexOf("</article>"));
      assert.equal(/data-cancelled/.test(cardHtml), Boolean(e.cancelled), `${e.id}: the cancelled mark does not match the record`);
      assert.ok(cardHtml.includes(`href="${placeOf(e.place).href}"`), `${e.id}: the place is not linked into the World at its point`);
    }
  }
});

test("BUILT: resident words arrive escaped on the calendar and on the event pages", { skip: !calBuilt && "dist-town/calendar/ is not built" }, () => {
  const calendarHtml = readFileSync(CAL_PAGE, "utf8");
  for (const e of eventsOf(COMMITTED)) {
    const p = eventParams(e.id);
    const eventFile = pageFile("calendar", p.host, p.slug);
    const pages = [["/calendar/", calendarHtml], [eventHref(e.id), existsSync(eventFile) ? readFileSync(eventFile, "utf8") : ""]];
    for (const [where, html] of pages) {
      // Astro also escapes quotes; compare on the angle brackets, which are
      // the markup that matters.
      const plain = html.replace(/&#39;|&quot;|&#34;/g, (m) => (m === "&#39;" ? "'" : '"'));
      for (const words of [e.title, e.invitation].filter(Boolean)) {
        assert.ok(plain.includes(escapeHtml(words)), `${where}: "${words.slice(0, 40)}" is not on the page as text`);
        // Outside attribute values: inside a quoted attribute (the layout's
        // og:title carries the event's title) a "<" is text, and only the
        // quote could end it, which Astro escapes.
        const outsideAttributes = html.replace(/="[^"]*"/g, '=""');
        if (/[<>]/.test(words)) assert.equal(outsideAttributes.includes(words), false, `${where}: resident words reached the page as markup`);
      }
    }
  }
});

test("BUILT: every event has its page, with the RSVP block quoting the door call for that event", { skip: !calBuilt && "dist-town/calendar/ is not built" }, () => {
  const built = readdirSync(join(DIST, "calendar"), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  assert.ok(built >= new Set(eventsOf(COMMITTED).map((e) => eventParams(e.id)?.host)).size);
  for (const e of eventsOf(COMMITTED)) {
    const p = eventParams(e.id);
    const f = pageFile("calendar", p.host, p.slug);
    assert.ok(existsSync(f), `${e.id} has no page`);
    const html = readFileSync(f, "utf8");
    assert.match(html, /data-rsvp-how/);
    // Both quotes name the resident who is coming: the office refuses by name
    // when a key holds several residents and none is named.
    const quoted = html.replace(/&quot;|&#34;/g, '"');
    assert.ok(quoted.includes(`do: "rsvp", args: { event: "${escapeHtml(e.id)}", handle: "&lt;your resident&gt;" }`),
      `${e.id}: the MCP quote does not carry this event and a handle`);
    assert.ok(quoted.includes(`{ "do": "rsvp", "args": { "event": "${escapeHtml(e.id)}", "handle": "&lt;your resident&gt;" } }`),
      `${e.id}: the plain-API quote does not carry this event and a handle`);
    for (const h of e.rsvps?.residents ?? []) assert.ok(html.includes(`>${escapeHtml(h)}<`), `${e.id}: ${h} is missing from who is coming`);
  }
});

// ── the month grid (POS-229, 2026-09-25) ─────────────────────────────────────
// The rules over the office's sample, where CI can run them; then the built
// pages, judged against whatever calendar.json the build read (the empty
// calendar as committed; the lane's variant build swaps the sample in).

test("the month pages run from the earliest event's month to the later of next month and the last event's month", () => {
  const ref = referenceInstant(SAMPLE);
  assert.equal(ref, SAMPLE.as_of, "the reference is the office's as_of when it has one");
  assert.deepEqual(monthsOf(SAMPLE, ref), ["2026-09", "2026-10"]);
  const far = clone(SAMPLE);
  far.coming[0].starts = "2027-01-03T18:00:00.000Z";
  far.ended = [{ ...SAMPLE.coming[0], id: "wright/old", starts: "2026-08-30T18:00:00.000Z", ends: "2026-08-30T19:00:00.000Z" }];
  assert.deepEqual(monthsOf(far, ref), ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]);
  const empty = { as_of: null, now: [], coming: [], ended: [] };
  const builtAt = new Date("2026-12-14T03:00:00Z");
  assert.equal(referenceInstant(empty, builtAt), builtAt.toISOString(), "no as_of: the build's clock");
  assert.deepEqual(monthsOf(empty, referenceInstant(empty, builtAt)), ["2026-12", "2027-01"], "and the year turns");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(monthHref("2026-10"), "/calendar/2026-10/");
});

test("the grid: whole weeks, Sunday first, today marked, each sample event on the UTC day it starts", () => {
  const ref = referenceInstant(SAMPLE);
  const g = monthGrid(SAMPLE, "2026-09", ref);
  assert.equal(g.label, "September 2026");
  assert.ok(g.weeks.every((w) => w.length === 7));
  assert.deepEqual(g.weeks.map((w) => w[0].weekday), g.weeks.map(() => "Sun"));
  assert.equal(g.weeks[0][0].date, "2026-08-30", "September 2026 opens on a Tuesday: the row starts with the Sunday before");
  assert.equal(g.weeks.at(-1).at(-1).date, "2026-10-03");
  const days = g.weeks.flat();
  assert.deepEqual(days.filter((d) => d.today).map((d) => d.date), ["2026-09-26"], "today is the as_of's day, and only it");
  assert.equal(days.filter((d) => d.inMonth).length, 30);
  for (const e of eventsOf(SAMPLE)) {
    const on = days.filter((d) => d.events.some((x) => x.id === e.id)).map((d) => d.date);
    assert.deepEqual(on, [dayKey(e.starts)], `${e.id} is not on its day alone`);
  }
  assert.equal(dayKey(SAMPLE.coming[0].starts), "2026-09-28", "the lamp starts at 00:00 UTC on the 28th, which is the floor's day");
  assert.equal(g.count, 2);
  assert.deepEqual([g.prev, g.next], [null, "2026-10"], "no page before the first month, a link to the next");
  assert.equal(utcClock(SAMPLE.now[0].starts), "22:00");
  assert.throws(() => monthGrid(SAMPLE, "2026-13", ref));
});

test("a day's events are in start order, and the edge days carry their events without counting them to the month", () => {
  const cal = clone(SAMPLE);
  cal.coming.push({ ...SAMPLE.coming[0], id: "wright/earlier", starts: "2026-09-26T09:00:00.000Z" });
  const g = monthGrid(cal, "2026-09", referenceInstant(cal));
  const sat = g.weeks.flat().find((d) => d.date === "2026-09-26");
  assert.deepEqual(sat.events.map((e) => e.id), ["wright/earlier", "current-the-reader/the-snug-harbour-grand-opening"]);
  const oct = monthGrid(cal, "2026-10", referenceInstant(cal));
  const edge = oct.weeks[0].find((d) => d.date === "2026-09-28");
  assert.equal(edge.inMonth, false);
  assert.deepEqual(edge.events.map((e) => e.id), ["wright/reading-by-the-lamp"]);
  assert.equal(oct.count, 0, "an edge day's event belongs to its own month");
});

test("an empty month says so plainly", () => {
  const g = monthGrid(SAMPLE, "2026-10", referenceInstant(SAMPLE));
  assert.equal(g.count, 0);
  assert.deepEqual(g.events, []);
  assert.equal(g.empty, "Nothing is on the calendar in October 2026.");
  assert.deepEqual([g.prev, g.next], ["2026-09", null]);
});

// Built arms: guarded on the page each reads (POS-177).
const builtPage = (...segs) => (existsSync(pageFile(...segs)) ? readFileSync(pageFile(...segs), "utf8") : null);
const cellOf = (html, date) => {
  const at = html.indexOf(`data-date="${date}"`);
  assert.ok(at >= 0, `no cell for ${date}`);
  return html.slice(at, html.indexOf("</td>", at));
};
const refMonthOf = (html) => /data-cal-month="(\d{4}-\d{2})"/.exec(html)?.[1];
// With no as_of the build read its own clock; any instant inside the drawn month stands in for it.
const refFor = (key) => COMMITTED.as_of ?? `${key}-15T12:00:00.000Z`;

test("BUILT /calendar/: the month grid is in the HTML itself, a table of whole weeks, readable with JavaScript off", { skip: !calBuilt && "dist-town/calendar/ is not built" }, () => {
  const html = readFileSync(CAL_PAGE, "utf8");
  const key = refMonthOf(html);
  assert.ok(key, "no month is drawn on /calendar/");
  if (COMMITTED.as_of) assert.equal(key, monthKey(COMMITTED.as_of), "the page drew a month other than the office's as_of");
  const start = html.indexOf("data-cal-grid");
  assert.ok(start >= 0, "no grid table");
  const grid = html.slice(start, html.indexOf("</table>", start));
  // Written by the build, not by a script: outside every <script> and <template>.
  const scripted = [...html.matchAll(/<(script|template)\b[\s\S]*?<\/\1>/g)].map((m) => m[0]).join("");
  assert.equal(scripted.includes("data-cal-grid"), false, "the grid lives inside a script or template");
  const g = monthGrid(COMMITTED, key, refFor(key));
  for (const d of g.weeks.flat()) assert.ok(grid.includes(`data-date="${d.date}"`), `${d.date} is not on the grid`);
  assert.equal((grid.match(/<tr\b/g) ?? []).length, g.weeks.length + 1, "one row per week, plus the weekday row");
  if (COMMITTED.as_of) assert.match(cellOf(html, dayKey(COMMITTED.as_of)), /aria-current="date"/, "today is not marked");
  assert.match(html, /data-cal-agenda/, "no agenda for a phone");
});

test("BUILT: each event sits on its day, on its month's page, as its time and title linking to its page", { skip: !calBuilt && "dist-town/calendar/ is not built" }, () => {
  for (const e of eventsOf(COMMITTED)) {
    const html = builtPage("calendar", monthKey(e.starts));
    assert.ok(html, `${e.id}: its month has no page`);
    const cell = cellOf(html, dayKey(e.starts));
    const at = cell.indexOf(`data-cal-item="${escapeHtml(e.id)}"`);
    assert.ok(at >= 0, `${e.id} is not on ${dayKey(e.starts)}`);
    const item = cell.slice(at, cell.indexOf("</li>", at));
    assert.ok(item.includes(`href="${eventHref(e.id)}"`), `${e.id}: not linked to its page`);
    assert.ok(item.includes(`>${utcClock(e.starts)}</time>`), `${e.id}: its start time is not the floor's`);
    assert.ok(item.replace(/&#39;/g, "'").replace(/&quot;|&#34;/g, '"').includes(escapeHtml(e.title)), `${e.id}: its title is not there as text`);
  }
});

test("BUILT: every month has its page, previous and next link only to pages that exist, and an empty month says so", { skip: !calBuilt && "dist-town/calendar/ is not built" }, () => {
  const key = refMonthOf(readFileSync(CAL_PAGE, "utf8"));
  const months = monthsOf(COMMITTED, refFor(key));
  assert.ok(months.includes(key));
  for (const m of months) {
    const html = builtPage("calendar", m);
    assert.ok(html, `/calendar/${m}/ is not built`);
    const steps = [...html.matchAll(/<a\b[^>]*\bdata-month-(?:prev|next)\b[^>]*>/g)].map((x) => /href="([^"]+)"/.exec(x[0])?.[1]);
    assert.equal(steps.length, (m !== months[0]) + (m !== months.at(-1)), `/calendar/${m}/: the previous and next links do not match the months built`);
    for (const href of steps) {
      assert.ok(existsSync(join(DIST, ...href.split("/").filter(Boolean), "index.html")), `/calendar/${m}/ links to ${href}, which is not built`);
    }
    const inMonth = eventsOf(COMMITTED).filter((e) => monthKey(e.starts) === m).length;
    assert.equal(/data-empty-month/.test(html), inMonth === 0, `/calendar/${m}/: the empty line does not match its ${inMonth} events`);
    if (!inMonth) assert.ok(html.includes(monthGrid(COMMITTED, m, refFor(key), months).empty), `/calendar/${m}/ does not say it is empty`);
  }
});
