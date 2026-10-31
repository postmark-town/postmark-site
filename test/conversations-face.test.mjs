// The conversations page copies its avatar guard from postmark-world's
// spectator/viewer.mjs, and says so where it does. postmark#2950 taught the
// original to admit the town's media door. The copy never learned it, so a
// resident whose picture is at the door draws a letter on this page and a
// picture on the World.
//
// The guard lives in an inline script, so this suite reads it out of the page.
// Each test carries the sentence it falsifies.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../town/pages/conversations/index.astro", import.meta.url), "utf8");
const start = page.indexOf("var AVATAR_PATH");
const fn = page.indexOf("function safeAvatarUrl", start);
const end = page.indexOf("function safeHexColor", fn);
assert.ok(start > -1 && fn > -1 && end > -1, "the guard is where this suite expects it");
const decls = page.slice(start, fn).replace(/var HEX[^\n]*\n/, "").replace(/var DEFAULT_FACE_COLOR[^\n]*\n/, "");
const safeAvatarUrl = new Function(`${decls}\n${page.slice(fn, end)}\nreturn safeAvatarUrl;`)();

// A real value, read off /world-engine/residents-meta.json on 2026-10-31.
const AT_THE_DOOR = "https://media.postmark.town/media/foundoutanyway/fcd8192c33b7e760b573fe2199afd847a9736542ceea993c1c7d00f200f86bb1.jpg";

test("#2950: a picture at the town's media door is a face, not a letter", () => {
  assert.equal(safeAvatarUrl(AT_THE_DOOR), AT_THE_DOOR);
});

test("the rooted same-origin path is unchanged", () => {
  assert.equal(safeAvatarUrl("/media/little-bird-avatar-card.jpg"), "/media/little-bird-avatar-card.jpg");
});

test("a face nobody can vouch for still does not render", () => {
  for (const bad of [
    "",
    null,
    undefined,
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//media.postmark.town/media/a/b.jpg",
    "http://media.postmark.town/media/a/b.jpg",
    "https://example.test/media/a/b.jpg",
    "https://media.postmark.town.example.test/media/a/b.jpg",
    "https://media.postmark.town@example.test/media/a/b.jpg",
    "https://media.postmark.town:443/media/a/b.jpg",
    "https://media.postmark.town/other/a/b.jpg",
    "https://media.postmark.town/media/",
    "https://media.postmark.town/media/a/b.jpg?x=1",
    "https://media.postmark.town/media/a/b.jpg#x",
    "https://media.postmark.town/media/a/%2e%2e/b.jpg",
    "https://media.postmark.town/media/a/../b.jpg",
    "https://media.postmark.town/media/a\\b.jpg",
    "/media/../secret.jpg",
    `https://media.postmark.town/media/${"a".repeat(300)}.jpg`,
  ]) {
    assert.equal(safeAvatarUrl(bad), null, `refused: ${bad}`);
  }
});
