// conversations-reading.test.mjs — CORE-156: how the Conversations page puts a room's lines under one another, and what its one button counts.
//
// Emily, a Core Team human, 2026-11-22: "I see at most one unfinished line of everyone's chat … I have to click on "view replies" for every level of reply
// to read them. It's a lot of clicking to read one conversation." Darko, 17:38 EST: "Let's keep the circles and replies in, but try to keep the individual
// messages displayed similarly"; 17:47 EST, of three versions: "Let's go with B". B, in the mock-up's words: "Every opening message in full. Its replies
// wait behind one button, and that button opens the whole circle in place, every level at once."
//
// The rule is in the page's own inline script (town/pages/conversations/index.astro, between ROOM-SHAPE:BEGIN and ROOM-SHAPE:END). This suite reads that
// block out of the page, the way conversations-poll.test.mjs reads its scheduler, and runs THAT text over invented lines (test/fixtures/circles.sample.json,
// "invented speech", in the shape the office serves a thread's `voices`). No browser, no network, one process. What the page DRAWS from it, in a real
// browser, is test/conversations-circles.test.mjs ("B ·").
//
//   node --test test/conversations-reading.test.mjs
//
// FALSIFIERS: a count of direct replies only; a reply placed under anything but the line its own `reply_to` names; a reply whose parent is not in the read
// given another parent, or dropped; a line placed twice or not at all; a served loop that hangs; and, as labelled text pins at the end, a clamp on a
// message's words, a fetch inside the room's drawing, or the per-card reader mount coming back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CORE156_PAGE (a file path) points a run at a COPY of the page: a flip is made on a copy, never in the tree (conversations-circles reads the same variable)
const PAGE = process.env.CORE156_PAGE || new URL("../town/pages/conversations/index.astro", import.meta.url);
const page = readFileSync(PAGE, "utf8").replace(/\r\n/g, "\n");
const FX = JSON.parse(readFileSync(new URL("./fixtures/circles.sample.json", import.meta.url), "utf8"));
const between = (a, b) => { const i = page.indexOf(a), j = page.indexOf(b); assert.ok(i > -1 && j > i, `the page still carries ${a} … ${b}`); return page.slice(i + a.length, j); };
const shapeSrc = between("// ROOM-SHAPE:BEGIN", "// ROOM-SHAPE:END");
const drawSrc = between("// ROOM-DRAW:BEGIN", "// ROOM-DRAW:END");
const { roomShape, repliesWords } = new Function(`${shapeSrc}\nreturn { roomShape: roomShape, repliesWords: repliesWords };`)();

// a thread's `voices` as the office serves them (office src/circles.mjs `sayLine`): the flat line, plus each line's own id, the reply_to it answers, its circle
const FLAT = FX.views.flat_lines;
const voices = (lines = FLAT) => lines.map((l) => ({ handle: l.handle, standing: l.standing, said: l.said, at: l.at, at_ms: l.at_ms, ...(l.id ? { id: l.id } : {}), ...(l.reply_to ? { reply_to: l.reply_to } : {}), ...(l.circle ? { circle: l.circle } : {}) }));
const SERVED = Object.fromEntries(FLAT.map((l) => [l.id, l.reply_to ?? null]));
const topOfServed = (id) => { let at = id; while (SERVED[at] != null) at = SERVED[at]; return at; };
const say = (n) => Number(n.v.id);
const flatten = (nodes) => nodes.flatMap((n) => [n, ...flatten(n.kids)]);

test("the count on a message's one button is its WHOLE circle: every reply under it at every level, not the replies that answer it directly", () => {
  const shape = roomShape(voices());
  // derived from the served lines: everything whose chain of reply_to ends at each opening message
  const want = {};
  for (const l of FLAT) if (l.reply_to) want[topOfServed(l.id)] = (want[topOfServed(l.id)] ?? 0) + 1;
  assert.deepEqual(want, { 50101: 9, 50107: 2 }, "control: the fixture holds a circle of 9 replies and one of 2");
  assert.deepEqual(shape.tops.map((n) => [say(n), n.total]), [[50101, 9], [50107, 2], [50114, 0]],
    "B: \"Its replies wait behind one button\": the opening messages in the order they were said, each with the count of its whole circle");
  assert.equal(shape.tops[0].kids.length, 3, "and it is NOT the direct replies: only 3 of pica's 9 answer her opening message itself");
  // every level carries its own whole count too (the walk that sums them is the same one)
  const totals = Object.fromEntries(flatten(shape.tops).map((n) => [say(n), n.total]));
  assert.deepEqual(totals, { 50101: 9, 50102: 2, 50103: 1, 50104: 0, 50105: 3, 50106: 2, 50110: 1, 50111: 0, 50112: 1, 50113: 0, 50107: 2, 50108: 1, 50109: 0, 50114: 0 });
  assert.equal(repliesWords(1), "1 reply");
  assert.equal(repliesWords(9), "9 replies");
});

test("a line sits under another ONLY because the office served that reply_to on it; every line served is placed exactly once, in the order it was said", () => {
  const shape = roomShape(voices());
  const all = flatten(shape.tops);
  assert.equal(all.length, FLAT.length, "every line placed");
  assert.equal(new Set(all.map(say)).size, FLAT.length, "none twice");
  assert.deepEqual(shape.nodes.map(say), FLAT.map((l) => l.id), "and the read's own order is kept");
  for (const n of all) assert.equal(n.parent ? say(n.parent) : null, SERVED[say(n)], `say ${say(n)} sits under exactly what its reply_to names`);
  for (const n of all) assert.deepEqual(n.kids.map(say), FLAT.filter((l) => l.reply_to === say(n)).map((l) => l.id), `the replies to ${say(n)}, in the order they were said`);
  assert.equal(all.some((n) => n.loose), false, "nothing is loose in a room the read holds whole");
  // CONTROL: the same lines with their reply_to withheld are one flat list (so the nesting above comes from reply_to and from nothing else: not names, not time)
  const bare = roomShape(voices().map(({ reply_to, ...v }) => v));
  assert.deepEqual(bare.tops.map(say), FLAT.map((l) => l.id), "no reply_to served: no line is put under another");
  assert.equal(bare.tops.every((n) => n.total === 0 && n.kids.length === 0), true);
  // and the words are never read: a line that NAMES someone, with no reply_to, is an opening message
  const named = roomShape([...voices().slice(0, 1), { handle: "seth", said: "pica, replying to you about the sorbet", at: "2026-11-14T20:02:00.000Z", at_ms: 1794686520000, id: 60001 }]);
  assert.deepEqual(named.tops.map(say), [50101, 60001], "a name in the words places nothing");
});

test("a reply whose parent this read does not hold is drawn as itself, in its own place, and says so: never given another parent, never dropped", () => {
  // the read's window starts after pica's opening message (a room longer than its read): seth's reply to it, and everything under that reply, are still here
  const window_ = voices().filter((v) => v.id !== 50101);
  const shape = roomShape(window_);
  const loose = shape.tops.filter((n) => n.loose).map(say);
  assert.deepEqual(loose, [50102, 50105, 50112], "the three replies to the missing message stand alone, marked");
  assert.deepEqual(shape.tops.map(say), [50102, 50105, 50107, 50112, 50114], "each in its own place in time, among the opening messages");
  assert.deepEqual(shape.tops.find((n) => say(n) === 50102).kids.map(say), [50103], "and what answers THEM is still under them");
  assert.equal(flatten(shape.tops).length, window_.length, "nothing dropped");
  assert.equal(shape.tops.find((n) => say(n) === 50107).loose, false, "an opening message is not loose");
});

test("a broken record places nothing wrongly and never hangs: a reply to a later line, to itself, or a served loop; and old talk with no id is a plain line", () => {
  const at = (n) => ({ at: `2026-11-14T20:0${n}:00.000Z`, at_ms: 1794686460000 + n * 60000 });
  const forward = roomShape([{ handle: "a", said: "answers what comes after", id: 1, reply_to: 2, ...at(1) }, { handle: "b", said: "later", id: 2, ...at(2) }]);
  assert.deepEqual(forward.tops.map((n) => [say(n), n.loose, n.total]), [[1, true, 0], [2, false, 0]], "a parent must be EARLIER in the read (the office's own rule): a forward edge is a loose line");
  const self = roomShape([{ handle: "a", said: "answers itself", id: 5, reply_to: 5, ...at(1) }]);
  assert.deepEqual(self.tops.map((n) => [say(n), n.loose]), [[5, true]]);
  const loop = roomShape([{ handle: "a", said: "x", id: 7, reply_to: 8, ...at(1) }, { handle: "b", said: "y", id: 8, reply_to: 7, ...at(2) }]);
  assert.deepEqual(loop.tops.map(say), [7], "a served loop: the first stands alone");
  assert.deepEqual(loop.tops[0].kids.map(say), [8], "and the second, which answers an EARLIER line, sits under it");
  assert.equal(flatten(loop.tops).length, 2);
  // old talk (before circles): no id, so nothing can answer it and it answers nothing
  const old = roomShape([{ handle: "pica", said: "an old line", ...at(1) }, { handle: "seth", said: "another", ...at(2) }, { handle: "pica", said: "and a third", ...at(3) }]);
  assert.deepEqual(old.tops.map((n) => n.v.said), ["an old line", "another", "and a third"], "plain lines, in order");
  assert.ok(old.tops.every((n) => n.id === null && n.kids.length === 0 && !n.loose && n.total === 0));
  assert.equal(new Set(old.tops.map((n) => n.key)).size, old.tops.length, "each still has a key a redraw can find it by");
  for (const none of [undefined, null, "not a list", 5, {}]) assert.deepEqual(roomShape(none).tops, [], "no lines: an empty room, no throw");
});

// ── labelled TEXT PINS (the weakest instrument: they read the page's source, not its behaviour; the behaviour is the browser file's "B ·" tests) ──

test("text pins: a message's words are never clamped or cut; the room's drawing asks the office nothing; the per-card reader mount is gone", () => {
  const css = page.match(/\.convo \.c-said \{([^}]*)\}/)?.[1] ?? "";
  assert.match(css, /white-space: pre-wrap/, "the words wrap and keep their own line breaks");
  assert.equal(/nowrap|text-overflow|line-clamp|max-height|overflow:\s*hidden/.test(css), false, "no clamp, no ellipsis, no cut on the words");
  assert.match(drawSrc, /el\("span", "c-said", v\.said\)/, "the whole of what was said goes on the page");
  const code = (s) => s.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(code(drawSrc).length > 2000 && code(drawSrc).length < drawSrc.length, "control: the strip took comments and left code");
  assert.equal(/\bfetch\s*\(|XMLHttpRequest/.test(code(drawSrc)), false, "drawing, opening and folding a room make no request of their own");
  assert.equal((code(drawSrc).match(/ensureReader\(/g) ?? []).length, 1, "the World's reader is reached from ONE place in the room's drawing: the long room's 'earlier' press");
  for (const gone of [["wire", "Readers"], ["Intersection", "Observer"], ["fill", "Voices"], ["show", "Flat"]]) {
    assert.equal(page.includes(gone.join("")), false, `${gone.join("")} is gone (every card mounted the reader with it until CORE-156)`);
  }
});
