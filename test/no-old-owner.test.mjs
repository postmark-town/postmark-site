// no-old-owner.test.mjs — no postmark-* repo under the old owner (POS-499).
//
//   node --test test/no-old-owner.test.mjs
//
// The office, the world and the site moved to the postmark-town org (POS-115),
// and GitHub's redirect from the old keeminlee names lasts only while nobody
// creates a repo at an old name. So no tracked file here may spell a postmark-*
// repo under the old owner, either as one string (`<old>/postmark-world`) or split
// into an owner field. The exceptions are named below, each with its reason
// (Wright's Rung 0 verdict, 2026-10-10).
//
// The old owner is assembled, never spelled whole, so this file is not a hit.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OLD = ["keemin", "lee"].join("");

// Generated resident data, not ours to re-spell: the vendored town pages and
// the baked town reads (bulletin, docs, letters) quote what residents wrote.
const GENERATED = ["public/atelier/", "src/data/"];

// path → the exact text that may stay there, and why.
const LEGACY = "older release tags carry the old spelling, and a hold reads the tag's own floor: the named legacy-parser fixture";
const KEEPS = [
  { path: "test/world-pin-publish.test.mjs", text: `github:${OLD}/postmark-world#`, why: LEGACY },
  { path: "test/world-pin-publish.test.mjs", text: `github.com/${OLD}/postmark-world.git#`, why: LEGACY },
  { path: "test/world-pin.test.mjs", text: `github:${OLD}/postmark-world#`, why: LEGACY },
];

const PATTERN = `${OLD}/postmark-|owner["']?[[:space:]]*:[[:space:]]*["']${OLD}["'][[:space:]]*,[[:space:]]*name["']?[[:space:]]*:[[:space:]]*["']postmark`;

function hits() {
  let out = "";
  try {
    out = execFileSync("git", ["-C", ROOT, "grep", "-n", "-I", "-E", PATTERN, "--", ".", ...GENERATED.map((p) => `:!${p}`)], { encoding: "utf8" });
  } catch (e) {
    if (e.status === 1) return [];   // git grep: no match
    throw e;
  }
  return out.split("\n").filter(Boolean).map((line) => {
    const [path, n, ...rest] = line.split(":");
    return { path, line: Number(n), text: rest.join(":") };
  });
}

test("no tracked file spells a postmark-* repo under the old owner, apart from the named keeps", () => {
  const offenders = hits().filter((h) => !KEEPS.some((k) => k.path === h.path && h.text.includes(k.text)));
  assert.deepEqual(offenders.map((h) => `${h.path}:${h.line}: ${h.text.trim()}`), [],
    "re-spell these to postmark-town (or name a keep here, with its reason)");
});

test("every named keep is still there, so the list cannot go stale silently", () => {
  const found = hits();
  for (const k of KEEPS) {
    assert.ok(found.some((h) => h.path === k.path && h.text.includes(k.text)), `${k.path} no longer carries ${k.text}: drop the keep`);
  }
});

test("the floor itself is spelled postmark-town, in package.json and its lock", () => {
  const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
  const lock = readFileSync(join(ROOT, "package-lock.json"), "utf8");
  assert.match(JSON.parse(pkg).dependencies["postmark-world"], /^github:postmark-town\/postmark-world#[0-9a-f]{40}$/);
  assert.match(JSON.parse(lock).packages["node_modules/postmark-world"].resolved, /github\.com\/postmark-town\/postmark-world\.git#[0-9a-f]{40}$/);
});
