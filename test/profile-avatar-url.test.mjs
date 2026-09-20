// profile-avatar-url.test.mjs — the baker reads the field the office writes.
//
// postmark-town/postmark#2950. Solin Sunraven's and Mari's PROFILE.md carry
// only `avatar_url` — the complete town-media URL the settled office profile
// road writes — and their public pages rendered the fallback monogram, because
// `town/components/Household.astro` derived its picture from the older
// file-local `avatar` alone. Producer and consumer had forked on the field
// name, and nothing failed.
//
// WHY THIS SUITE RUNS THE COMPONENT'S OWN LINES INSTEAD OF ASSERTING ITS BYTES.
// The claim under test is a VALUE ("avatarUrl is that URL"), not a shape, and a
// source assertion cannot fail for that reason — it can only say the text is
// still there. But `Household.astro` is an Astro component: its frontmatter is
// not importable, and no suite in this repo renders one. So the two lines that
// do the derivation are READ OUT of the component and evaluated here. The rule
// is not copied into this file; if the component's expression changes, this
// suite evaluates the changed expression. Both lines are asserted present
// first, so a rename reds the suite rather than quietly passing.
//
//   node --test test/profile-avatar-url.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readResidentProfile } from "../tools/lib/town.mjs";

const HANDLE = "test-resident";
const DOOR = "https://media.postmark.town/media/sozlin/7037bcfb63718579a618e7bfc31eef790dd067d7f17d66b00fa07e726ca1fe21.webp";

function read(frontmatter) {
  const root = mkdtempSync(join(tmpdir(), "postmark-avatar-url-test-"));
  const dir = join(root, "WHITE_PAGES", HANDLE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "PROFILE.md"), `---\n${frontmatter}\n---\n`);
  const problems = [];
  return { profile: readResidentProfile(root, HANDLE, problems), problems };
}

// ── the component's own derivation, lifted verbatim ────────────────────────
const SOURCE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");
const KEY_LINE = /^\s*(const avatarKey = .+;)\s*$/m.exec(SOURCE);
const URL_EXPR = /^\s*avatarUrl:\s*(.+),\s*$/m.exec(SOURCE);
assert.ok(KEY_LINE, "Household.astro still derives an avatarKey on one line");
assert.ok(URL_EXPR, "Household.astro still derives avatarUrl on one line");

// eslint-disable-next-line no-new-func -- the point is to run the component's line, not a copy of it
const derive = new Function("r", "profile", "media", `${KEY_LINE[1]}\nreturn (${URL_EXPR[1]});`);

// What the page shows. The component renders the monogram exactly when this is
// falsy (`t.avatarUrl ? <img …> : <span>{t.monogram}</span>`).
const avatarUrlFor = (profile, media = {}) => derive({ handle: HANDLE }, profile, media);

test("1. a profile carrying only a valid avatar_url bakes that image, not the monogram", () => {
  // The brief: "a profile with only a valid `avatar_url` → `avatarUrl` is that
  // URL". This is Solin's and Mari's exact shape — no local avatar, nothing
  // claimed, one complete town-media URL.
  const { profile, problems } = read(`avatar_url: "${DOOR}"\ncolor: "#dbb662"`);
  assert.equal(profile.avatar_url, DOOR, "the town reader admits the office's field");
  assert.deepEqual(problems, [], "a settled office URL is not a problem");
  assert.equal(avatarUrlFor(profile), DOOR);
});

test("2. an avatar_url on another host is dropped with one problem line, and the page falls to the monogram", () => {
  // The brief: "an `avatar_url` on another host → dropped, one problem line,
  // monogram". It is the only profile field printed as a URL the site never
  // processed, so the town's own media door is the whole of what makes it safe.
  const { profile, problems } = read('avatar_url: "https://example.test/not-the-door.png"\ncolor: "#dbb662"');
  assert.equal(profile.avatar_url, undefined, "a foreign host never reaches the page");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /invalid resident profile avatar_url \(not the town media door\)/);
  assert.match(problems[0], new RegExp(`WHITE_PAGES/${HANDLE}/PROFILE\\.md`), "the problem line names the profile");
  assert.equal(profile.color, "#dbb662", "the rest of the profile survives");
  assert.equal(avatarUrlFor(profile), null, "monogram");
});

test("3. a claimed local avatar beside an avatar_url still wins, so today's three masked profiles do not move", () => {
  // The brief: "a profile with both a claimed local `avatar` and `avatar_url` →
  // the local file wins". alex-rowan, kai and vespertine carry both today and
  // render the local file; this fix must not change a pixel of their pages.
  const { profile, problems } = read(`avatar: "avatar.jpg"\navatar_url: "${DOOR}"`);
  assert.equal(profile.avatar, "avatar.jpg");
  assert.equal(profile.avatar_url, DOOR, "both fields survive the read");
  assert.deepEqual(problems, []);
  const claimed = { [`WHITE_PAGES/${HANDLE}/avatar.jpg`]: { card: "/media/local-card.webp" } };
  assert.equal(avatarUrlFor(profile, claimed), "/media/local-card.webp");
});

test("4. a profile with no picture at all still falls soft to the monogram", () => {
  // The brief: "no picture → monogram (unchanged)". The 80 profiles carrying a
  // local avatar and the ones carrying none are the rest of the town; an absent
  // picture is an ordinary state and stays one.
  const { profile, problems } = read('color: "#dbb662"\nbio: "no picture here"');
  assert.deepEqual(problems, []);
  assert.equal(avatarUrlFor(profile), null, "monogram");
  // and a local avatar whose file was never claimed is the same ordinary state
  const named = read('avatar: "avatar.jpg"').profile;
  assert.equal(avatarUrlFor(named, {}), null, "an unclaimed local file is still a monogram");
});
