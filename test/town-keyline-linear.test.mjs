// town-keyline-linear.test.mjs — POS-876: the town reader reads a crafted line in linear time.
//
// THE DEFECT. Four regexes in tools/lib/town.mjs took time quadratic (one of them cubic) in the
// length of a line a resident or the ledger can hold: parseFrontmatter's key line, the salvage
// path's key line and its comment strip, and parseLedger's bounce line. A 64,000-character line
// held the reader for 2.5 to 16 seconds, and the office reads this file at request time.
//
// THE BOUND, AND WHY IT IS TIME. Nothing counts a regex's backtracking steps from JavaScript, so
// each case bounds wall time: 500 ms for one read of about 64,000 characters. The fixed reader
// takes under 10 ms on each case here; main's takes 2.5 s or more on each. Each case is its own
// test, asserts the time first and then the answer, by equality. Each door has a control: the same
// input with the one character that makes the old regex slow replaced, which is fast on either
// reader, so it stays green on main while the cases beside it red.
//
// Every input here is invented. The temp towns are left in the OS temp dir, as town-profile.test.mjs
// leaves its own.
//   node --test test/town-keyline-linear.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseFrontmatter, parseLedger, readResidentProfile, readTown } from "../tools/lib/town.mjs";

// LAW (POS-876, done when): "linear key-line regexes, with the same answers".
const LAW = 'POS-876: "linear key-line regexes, with the same answers"';
const SIZE = 64_000;
const BOUND_MS = 500;
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const NBSP = String.fromCharCode(0xa0);
const BREAKS = { "a lone CR": "\r", "a lone U+2028": LS, "a lone U+2029": PS };

/** `head` + `fill` repeated + `tail`, exactly SIZE characters long. */
function sized(head, fill, tail, pad = "y") {
  const room = SIZE - head.length - tail.length;
  const text = head + fill.repeat(Math.floor(room / fill.length)) + pad.repeat(room % fill.length) + tail;
  assert.equal(text.length, SIZE, "the input is exactly SIZE characters");
  return text;
}

function timed(fn) {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

function townWith(files) {
  const root = mkdtempSync(join(tmpdir(), "pos876-keyline-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, ...path.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(join(root, ...path.split("/")), text);
  }
  return root;
}

// ── parseFrontmatter: a key line of whitespace, then text, then a line break the split keeps ──
const frontmatter = (fill, end) => sized("---\nnote:", fill, `x${end}y\npronouns: they/them\n---\nbody`);
const FM_SKIPPED = { data: { pronouns: "they/them" }, body: "body", hasFrontmatter: true };

for (const [name, end] of Object.entries(BREAKS)) {
  test(`parseFrontmatter: a key line of about 64,000 spaces, text, then ${name} reads in under ${BOUND_MS} ms, and is skipped as before`, () => {
    const { value, ms } = timed(() => parseFrontmatter(frontmatter(" ", end)));
    assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
    assert.deepEqual(value, FM_SKIPPED);
  });
}

test(`parseFrontmatter: no-break spaces, text, then a lone CR reads in under ${BOUND_MS} ms`, () => {
  const { value, ms } = timed(() => parseFrontmatter(frontmatter(NBSP, "\r")));
  assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, FM_SKIPPED);
});

test(`readTown: an ADDRESS.md holding that key line reads in under ${BOUND_MS} ms, and the pronouns after it still read`, () => {
  const root = townWith({ "WHITE_PAGES/a/ADDRESS.md": frontmatter(" ", "\r") });
  const { value, ms } = timed(() => readTown(root));
  assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value.residents[0].address, { data: { pronouns: "they/them" }, body: "body" });
});

test("CONTROL parseFrontmatter: the same line with a letter where the break was reads fast on either reader, and the note reads", () => {
  const { value, ms } = timed(() => parseFrontmatter(frontmatter(" ", "z")));
  assert.ok(ms < BOUND_MS, `the control took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, { data: { note: "xzy", pronouns: "they/them" }, body: "body", hasFrontmatter: true });
});

// ── the salvage path (a PROFILE.md the YAML parser rejects): its key line ──────────────────────
// `runtime: "open` is an unclosed quote, so the parser rejects the block and the salvage pass runs.
const profileKeyLine = (end) => sized("---\nbio:", " ", `${end}x\nruntime: "open\npronouns: they/them\n---\n`);

for (const [name, end] of Object.entries(BREAKS)) {
  test(`salvage: a PROFILE.md key line of about 64,000 spaces then ${name} reads in under ${BOUND_MS} ms, and the lines after it still read`, () => {
    const problems = [];
    const root = townWith({ "WHITE_PAGES/a/PROFILE.md": profileKeyLine(end) });
    const { value, ms } = timed(() => readResidentProfile(root, "a", problems));
    assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
    assert.deepEqual(value, { runtime: '"open', pronouns: "they/them" });
    assert.match(problems.join("\n"), /salvaged what parsed/);
  });
}

test("CONTROL salvage: the same key line with letters where the break was reads fast on either reader, and the bio reads", () => {
  const root = townWith({ "WHITE_PAGES/a/PROFILE.md": profileKeyLine("z") });
  const { value, ms } = timed(() => readResidentProfile(root, "a", []));
  assert.ok(ms < BOUND_MS, `the control took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, { bio: "zx", runtime: '"open', pronouns: "they/them" });
});

// ── the salvage path: the comment strip on a value the YAML parser also rejects ──────────────
const profileValue = (tail) => sized('---\nbio: "a', " ", `${tail}\npronouns: they/them\n---\n`);

test(`salvage: an unclosed quoted value holding about 64,000 spaces then a letter reads in under ${BOUND_MS} ms, and is kept whole`, () => {
  const text = profileValue("b");
  const root = townWith({ "WHITE_PAGES/a/PROFILE.md": text });
  const { value, ms } = timed(() => readResidentProfile(root, "a", []));
  assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
  // The whole value, quote and spaces and all, as the old reader kept it: no comment to cut.
  const bio = text.slice("---\nbio: ".length, text.indexOf("\npronouns"));
  assert.deepEqual(value, { bio, pronouns: "they/them" });
});

test("CONTROL salvage: the same value with a comment after the spaces reads fast on either reader, and the comment is cut", () => {
  const root = townWith({ "WHITE_PAGES/a/PROFILE.md": profileValue("#c") });
  const { value, ms } = timed(() => readResidentProfile(root, "a", []));
  assert.ok(ms < BOUND_MS, `the control took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, { bio: '"a', pronouns: "they/them" });
});

// ── parseLedger: a bounce line ───────────────────────────────────────────────────────────────
const HEAD = "- 2026-11-03 · BOUNCE ·";

test(`parseLedger: a bounce line whose path holds about 64,000 spaces reads in under ${BOUND_MS} ms, as no entry`, () => {
  const { value, ms } = timed(() => parseLedger(sized(`${HEAD} a`, " ", "b")));
  assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, []);
});

test(`parseLedger: a bounce defect of about 64,000 spaces, text, then a lone CR reads in under ${BOUND_MS} ms, as no entry`, () => {
  const { value, ms } = timed(() => parseLedger(sized(`${HEAD} p (from x):`, " ", "y\rz")));
  assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, []);
});

// The old regex was cubic in the whitespace after the second "·", so this ledger's bounce line
// holds 3,000 spaces there (about 5 s on main; 64,000 would take hours), and ordinary delivery
// lines fill the rest of its 64,000 characters.
test(`parseLedger: a 64,000-character ledger whose bounce line holds 3,000 spaces before "(from" reads in under ${BOUND_MS} ms, deliveries only`, () => {
  const delivery = "\n- 2026-11-03 · 2026-11-03-hello · a → b";
  const text = sized(`${HEAD}${" ".repeat(3000)}(from a`, delivery, "", " ");
  const deliveries = text.split("\n").length - 1;
  const { value, ms } = timed(() => parseLedger(text));
  assert.ok(ms < BOUND_MS, `${LAW}; this read took ${ms.toFixed(0)} ms`);
  const one = { kind: "delivery", date: "2026-11-03", id: "2026-11-03-hello", from: "a", to: "b", thread: null };
  assert.deepEqual(value, Array.from({ length: deliveries }, () => one));
});

test("CONTROL parseLedger: a 64,000-character bounce line with a long defect reads fast on either reader, and reads whole", () => {
  const line = sized(`${HEAD} WHITE_PAGES/a/outbox/x.md (from a): no`, " frontmatter", ".");
  const { value, ms } = timed(() => parseLedger(line));
  assert.ok(ms < BOUND_MS, `the control took ${ms.toFixed(0)} ms`);
  assert.deepEqual(value, [{ kind: "bounce", date: "2026-11-03", path: "WHITE_PAGES/a/outbox/x.md", from: "a", defect: line.slice(line.indexOf("): ") + 3) }]);
});
