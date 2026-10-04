// announcements.test.mjs — an event's announcements on its page, and on the
// conversations page's pins (POS-281, 2026-09-28).
//
//   node --test test/announcements.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newestFirst, eventReadUrl, fetchAnnouncements } from "../src/lib/announcements.mjs";

const ROOT = join(import.meta.dirname, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

const OLDEST_FIRST = [
  { at: "2026-10-03T22:05:00.000Z", text: "the band is on" },
  { at: "2026-10-03T22:40:00.000Z", text: "last call" },
];

test("the office's announcements, oldest first, are shown newest first", () => {
  assert.deepEqual(newestFirst(OLDEST_FIRST).map((a) => a.text), ["last call", "the band is on"]);
  assert.deepEqual(OLDEST_FIRST.map((a) => a.text), ["the band is on", "last call"], "and the calendar's own list is not reordered in place");
});

test("an entry without a time or without text is left out, and no list is an empty list", () => {
  assert.deepEqual(newestFirst([{ at: "not a time", text: "x" }, { at: "2026-10-03T22:05:00Z", text: "  " }, null, { at: "2026-10-03T22:05:00Z" }]), []);
  assert.deepEqual(newestFirst(undefined), []);
  assert.deepEqual(newestFirst([{ at: "2026-10-03T22:05:00Z", text: "hi" }]), [{ at: "2026-10-03T22:05:00.000Z", text: "hi" }]);
});

test("the page asks the office's one-event read: GET <base>/calendar/<host>/<slug>", () => {
  assert.equal(eventReadUrl("/api", "current-the-reader/the-snug-harbour-grand-opening"), "/api/calendar/current-the-reader/the-snug-harbour-grand-opening");
  assert.equal(eventReadUrl("https://office.example/", "a/b"), "https://office.example/calendar/a/b");
  assert.equal(eventReadUrl("/api", "no-slug"), null);
  assert.equal(eventReadUrl("/api", "a/b/c"), null);
});

test("the island's read: the office's answer newest first, and null for anything it cannot use", async () => {
  const asked = [];
  const ok = async (url, init) => { asked.push([url, init.headers.accept]); return { ok: true, json: async () => ({ as_of: "x", event: { id: "a/b", announcements: OLDEST_FIRST } }) }; };
  assert.deepEqual((await fetchAnnouncements("a/b", { base: "/api", fetchImpl: ok })).map((a) => a.text), ["last call", "the band is on"]);
  assert.deepEqual(asked, [["/api/calendar/a/b", "application/json"]]);

  const refused = async () => ({ ok: false, json: async () => ({ error: "no event" }) });
  assert.equal(await fetchAnnouncements("a/b", { fetchImpl: refused }), null, "a 404 keeps what the build baked");
  const down = async () => { throw new Error("offline"); };
  assert.equal(await fetchAnnouncements("a/b", { fetchImpl: down }), null, "so does the network");
  const shapeless = async () => ({ ok: true, json: async () => ({ event: { id: "a/b" } }) });
  assert.equal(await fetchAnnouncements("a/b", { fetchImpl: shapeless }), null, "an office that carries no announcements is not 'none'");
  assert.equal(await fetchAnnouncements("bad", { fetchImpl: ok }), null);
});

test("the event page shows the host's announcements, baked and then read live, as text", () => {
  const page = read("town", "pages", "calendar", "[host]", "[slug].astro");
  assert.match(page, /const announcements = newestFirst\(event\.announcements\)/, "baked newest first from calendar.json");
  assert.match(page, /data-announcements data-event=\{event\.id\}/);
  assert.match(page, /fetchAnnouncements\(annBox\.dataset\.event, \{ base: officeBase\(\) \}\)/, "and repainted from the office's one-event read");
  assert.match(page, /p\.textContent = a\.text/, "the host's words are painted as text");
  assert.doesNotMatch(page, /innerHTML/);
});

test("the conversations page paints a pin's announcements as text", () => {
  const page = read("town", "pages", "conversations", "index.astro");
  assert.match(page, /Array\.isArray\(n\.announcements\)/);
  assert.match(page, /el\("span", "c-pin-ann-text", " " \+ String\(a\.text \|\| ""\)\)/, "through el(), which sets textContent");
});
