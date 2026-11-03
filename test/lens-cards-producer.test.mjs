// lens-cards-producer.test.mjs — a posting's `status` survives the site's own
// producer and then drives the lens band (Site UX campaign, POS-855).
//
//   node --test test/lens-cards-producer.test.mjs
//
// The path under test, end to end, on invented input only:
//   the office's /bulletin answers (stubbed here; no network, no town data)
//     -> buildOfficeData (tools/lib/fetch-town-data.mjs), the real producer
//        of bulletin.json
//     -> lensPostings (src/lib/bulletin-cards.mjs), the real selector.
// The producer does not map or rename `data.status`: it passes each entry the
// office serves through (sorted by slug). That pass-through is the thing pinned
// here, since the band's rule reads `data.status` and nothing upstream of it
// is allowed to drop or reshape it. Every slug and word below is invented.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildOfficeData, jsonText } from "../tools/lib/fetch-town-data.mjs";
import { lensPostings } from "../src/lib/bulletin-cards.mjs";

// The office's whole bulletin, in the shape its full read serves: invented.
const OFFICE_BULLETIN = [
  { slug: "sample-open-notice", data: { title: "Sample open notice", kind: "notice", status: "open", posted: "2026-10-20" }, body: "# Sample open notice\n\nInvented.", path: "TOWN_BULLETIN/sample-open-notice.md" },
  { slug: "sample-past-happening", data: { title: "Sample past happening", kind: "happening", status: "past", posted: "2026-10-30" }, body: "# Sample past happening\n\nInvented.", path: "TOWN_BULLETIN/sample-past-happening.md" },
];

function stubOffice() {
  const ok = (body) => ({
    ok: true, status: 200, statusText: "OK",
    headers: { get: (name) => (name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null) },
    json: async () => JSON.parse(JSON.stringify(body)),
  });
  const routes = new Map([
    ["/town", { as_of: "abc123", counts: { residents: 0, letters: 0, threads: 0, ledger: 0, bulletin: OFFICE_BULLETIN.length }, offices: [] }],
    ["/residents", []],
    ["/metrics/mail", { as_of: "2026-10-31", days: [], totals: { deliveries: 0, bounces: 0, letters: 0, threads: 0, residents: 0 }, active_threads: 0 }],
    ["/bulletin", OFFICE_BULLETIN.map((b) => ({ slug: b.slug, title: b.data.title, first_line: `# ${b.data.title}` }))],
    ["/bulletin?full=1", OFFICE_BULLETIN],
    ["/letters", { total: 0, shown: 0, count: 0, limit: 200, offset: 0, complete: true, full: true, letters: [] }],
    ["/calendar", { as_of: "2026-10-31T00:00:00.000Z", now: [], coming: [], ended: [], total: 0 }],
    ["/posts", { as_of: "2026-10-31T00:00:00.000Z", class: "quest", finished: ["closed"], total: 0, posts: [] }],
    ["/posts?class=idea", { as_of: "2026-10-31T00:00:00.000Z", class: "idea", finished: ["shipped", "declined", "duplicate"], total: 0, posts: [] }],
  ]);
  return async (url) => {
    const u = new URL(url);
    const body = routes.get(`${u.pathname}${u.search}`) ?? routes.get(u.pathname);
    if (!body) return { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    return ok(body);
  };
}

function emptySnapshot() {
  const root = mkdtempSync(join(tmpdir(), "postmark-lens-producer-"));
  const data = join(root, "data");
  mkdirSync(data, { recursive: true });
  for (const [name, value] of [["ledger.json", []], ["docs.json", {}], ["meeps.json", []], ["stats.json", {}], ["residents.json", []]]) {
    writeFileSync(join(data, name), jsonText(value));
  }
  const town = join(root, "town");
  mkdirSync(join(town, "MEEPS", "SKILLS"), { recursive: true });
  mkdirSync(join(town, "WHITE_PAGES"), { recursive: true });
  return { data, town };
}

test("a `status: past` posting survives the producer and is dropped from the lens band; an `open` one stays", async () => {
  const { data, town } = emptySnapshot();
  const built = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: stubOffice(), retries: 1 });
  const bulletin = built.files["bulletin.json"];

  // the producer kept both postings and their status, untouched
  assert.deepEqual(bulletin.map((b) => [b.slug, b.data.status]),
    [["sample-open-notice", "open"], ["sample-past-happening", "past"]]);

  // and the selector reads that product: the newer past happening is gone, the open notice stays
  assert.deepEqual(lensPostings(bulletin).map((b) => b.slug), ["sample-open-notice"]);
});
