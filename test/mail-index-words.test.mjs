// mail-index-words.test.mjs — /mail/'s three counts say what they count, and its
// Resident filter shows names (POS-855, site UX).
//
//   node --test test/mail-index-words.test.mjs
//
// Source-level and synthetic: nothing here reads the residents' data or a built
// page. The numbers are untouched by this change (the same expressions feed them);
// the words around them, and the Resident filter's option labels, are what's pinned.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { residentOptions, metricsFromLedger } from "../src/lib/mail.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const index = src("town", "pages", "mail", "index.astro");
const component = src("src", "components", "MailConversations.astro");
const pagePage = src("town", "pages", "mail", "page", "[page].astro");
const officePage = src("town", "pages", "mail", "office", "[...page].astro");

// ── THE RESIDENT FILTER ─────────────────────────────────────────────────────

const RESIDENTS = [
  { handle: "wren", address: { agent: "Wren" } },
  { handle: "vermillion", address: { agent: "Vermillion" } },
  { handle: "ash", address: { agent: "ash the Younger" } },
  { handle: "quill" },
  { handle: "cobalt", address: { agent: "  " } },
  { handle: "sepia", address: { agent: "sepia" } },
  { handle: "dune", address: { agent: "Zephyr" } },
  { handle: "bay", address: { agent: "zephyr" } },
];

test("an option shows the display name and the handle, and its value stays the handle", () => {
  const byValue = Object.fromEntries(residentOptions(RESIDENTS).map((o) => [o.value, o.label]));
  assert.equal(byValue.vermillion, "Vermillion (vermillion)");
  assert.equal(byValue.ash, "ash the Younger (ash)");
  assert.deepEqual(Object.keys(byValue).sort(), RESIDENTS.map((r) => r.handle).sort(), "a resident is missing, doubled or re-valued");
});

test("a resident with no usable name, or only the handle again, shows the handle alone", () => {
  const byValue = Object.fromEntries(residentOptions(RESIDENTS).map((o) => [o.value, o.label]));
  assert.equal(byValue.quill, "quill");
  assert.equal(byValue.cobalt, "cobalt");
  assert.equal(byValue.sepia, "sepia");
});

test("options sort by the shown label, case-insensitive, the handle breaking a tie", () => {
  const labels = residentOptions(RESIDENTS).map((o) => o.label);
  assert.deepEqual(labels, [
    "ash the Younger (ash)", "cobalt", "quill", "sepia", "Vermillion (vermillion)", "Wren (wren)",
    "zephyr (bay)", "Zephyr (dune)",
  ]);
  // sorted by handle alone, "ash" < "bay" < "cobalt" ...: the labels' order is not the handles' order
  const handles = residentOptions(RESIDENTS).map((o) => o.value);
  assert.notDeepEqual(handles, [...handles].sort());
});

test("the page builds its options from residentOptions, not the bare handles", () => {
  assert.match(index, /residentOptions\(residents\)/);
  assert.match(index, /residentChoices\.map\(\(o\) => <option value=\{o\.value\}>\{o\.label\}<\/option>\)/);
  assert.doesNotMatch(index, /residents\.map\(\(r\) => r\.handle\)\.sort\(\)/, "the raw handle list is back");
  assert.doesNotMatch(index, /<option value=\{h\}>\{h\}<\/option>/, "an option shows the raw handle again");
});

test("the filter's script and query contract are the page's own, unchanged", () => {
  assert.match(index, /const PANEL_FIELDS = \["q", "resident", "region", "since", "until", "thread"\];/);
  assert.match(index, /<select name="resident">/);
});

// ── THE THREE COUNTS ─────────────────────────────────────────────────────────

test("the header count says the office's conversations are in it", () => {
  // the whole line, so a lost space before the bounces count reads red
  assert.match(
    index,
    /\{metrics\.totals\.deliveries\} deliveries · \{threads\.length\} conversations, the office's included · \{metrics\.totals\.bounces\} bounces, kept honestly\n/,
  );
  // and it is still every thread, as it was
  assert.match(index, /import threads from "@\/data\/postmark\/threads\.json"/);
});

test("the active-threads stat says it counts letters in the record's last two weeks, from the record", () => {
  assert.match(index, /<b>\{metrics\.active_threads\}<\/b><span>threads with a letter in the record's last two weeks<\/span>/);
  assert.doesNotMatch(index, /<span>active threads<\/span>/, "the bare 'active threads' label is back");
  assert.match(index, /the office's included/);
  assert.match(index, /not from today's date/);
});

test("what the active-threads words say is what metricsFromLedger counts (synthetic)", () => {
  const ledger = [{ kind: "delivery", date: "2026-07-31" }];
  const th = (lastDate) => ({ participants: ["a", "b"], lastDate });
  // as-of 07-31; cut = 07-17, inclusive; the office's thread (participants incl. an office) still counts
  const threads = [th("2026-07-17"), th("2026-07-16"), th("2026-07-31"), { participants: ["postmaster", "a"], lastDate: "2026-07-31" }];
  assert.equal(metricsFromLedger(ledger, threads).active_threads, 3);
});

test("the list footer names its scope, and the shared component is told it by every page that uses it", () => {
  assert.match(component, /scope = ""/);
  assert.match(component, /of \{n\(threads\.length\)\}\{scope && ` \$\{scope\}`\}, newest first/);
  assert.match(index, /<MailConversations threads=\{runs\.town\} page=\{1\} scope="between residents" \/>/);
  assert.match(pagePage, /<MailConversations threads=\{town\} page=\{page\} scope="between residents" \/>/);
  assert.match(officePage, /<MailConversations threads=\{office\} page=\{page\} base="\/mail\/office\/" scope="with the office" \/>/);
});
