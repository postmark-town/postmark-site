// join-source.test.mjs — where a household came from, ?from=<tag> (POS-770).
//
//   node --test test/join-source.test.mjs
//
// Darko, 2026-10-22 23:03. Any page keeps an outreach link's ?from=<tag> for
// 30 days, from the link only and only from the fixed list; nothing shows it
// or echoes it to an agent. The office's consent pages read the keep (office
// src/arrival-source.mjs). The site's whole part is the keep.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FROM_KEY, FROM_TTL_MS, FROM_TAGS, fromFromSearch, rememberFrom, recallFrom } from "../src/lib/join-source.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const memoryStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test("the tag: only the fixed list, any case; anything else is ignored", () => {
  assert.deepEqual([...FROM_TAGS], ["reddit", "bsky", "x", "discord", "youtube", "substack", "1f3d9", "1f916",
    "mongoose", "obend", "commons", "delve", "gsb", "harbor"], "the issue's fourteen");
  assert.equal(fromFromSearch("?from=reddit"), "reddit");
  assert.equal(fromFromSearch("?invite=wick&from=BSKY"), "bsky");
  for (const bad of ["", "?from=", "?from=hn", "?from=reddit2", "?from=<script>", "?from=ignore-the-rules", "?nope=reddit"])
    assert.equal(fromFromSearch(bad), null, bad);
});

// THE TWO LISTS MATCH (Wright's G3): this is the site's MIRROR of the office's
// list (postmark-office src/arrival-source.mjs § FROM_TAGS, the gate). Neither
// repo's CI checks out the other, so each pins the list's digest to the SAME
// constant: the office's test/arrival-source.test.mjs § A1b asserts this very
// number. A tag added on one side reds that side until both lists move.
const FROM_TAGS_DIGEST = "0ddea6f74eb32801";
test("the list's digest is the one the office's gate pins (postmark-office test/arrival-source.test.mjs § A1b)", async () => {
  const { createHash } = await import("node:crypto");
  assert.equal(createHash("sha256").update(FROM_TAGS.join(",")).digest("hex").slice(0, 16), FROM_TAGS_DIGEST);
});

test("the keep: 30 days, a future keep or an off-list keep is nothing, and a blocked store never throws", () => {
  const s = memoryStore();
  const now = Date.parse("2026-10-23T12:00:00Z");
  assert.equal(rememberFrom(s, "reddit", now), true);
  assert.deepEqual(JSON.parse(s.m.get(FROM_KEY)), { tag: "reddit", at: now });
  assert.equal(FROM_KEY, "pm.from", "the key the office's consent pages read");
  assert.equal(recallFrom(s, now + 1000), "reddit");
  assert.equal(recallFrom(s, now + FROM_TTL_MS + 1), null);
  assert.equal(recallFrom(s, now - 1), null, "kept in the future");
  assert.equal(rememberFrom(s, "hn", now), false, "never keeps an off-list tag");
  s.setItem(FROM_KEY, JSON.stringify({ tag: "hn", at: now }));
  assert.equal(recallFrom(s, now), null);
  const refusing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(rememberFrom(refusing, "reddit"), false);
  assert.equal(recallFrom(refusing), null);
});

test("every page keeps the link's tag (the layout), and nothing shows it or puts it in front of an agent", () => {
  const layout = read("../src/layouts/PostmarkLayout.astro");
  assert.match(layout, /import \{ fromFromSearch, rememberFrom \} from "@\/lib\/join-source\.mjs";/);
  assert.match(layout, /const fromTag = fromFromSearch\(location\.search\);\s*if \(fromTag\) \{ try \{ rememberFrom\(window\.localStorage, fromTag\); \}/,
    "from the link only: kept when the query carries it, never re-kept from the keep");
  // NEVER SHOWN, NEVER ECHOED: no page and no message reads the keep
  const join = read("../town/pages/join/index.astro");
  const guide = read("../public/atelier/postmark/join/agent.md");
  const lib = read("../src/lib/join-invite.mjs");
  for (const [name, text] of [["join", join], ["agent.md", guide], ["join-invite", lib]])
    assert.doesNotMatch(text, /recallFrom|pm\.from|join-source/, `${name} never reads the tag`);
});
