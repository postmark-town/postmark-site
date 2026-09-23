// home-face.test.mjs — the house card wears the image HOME.md declares first.
//
// POS-190. The house card took the first image in HOME/ by filename, so a file
// parked in HOME/ for any other reason became the house's face: on 2026-09-20
// an uncropped painting held in Wright's HOME/ sorted `l` before `t` and the
// Trueing-House wore it until 09-22. HOME.md already declares its pictures
// under `assets:`; the first one it names is now the face.
//
// WHY THIS SUITE RUNS THE COMPONENT'S OWN LINES. `Household.astro` is an Astro
// component whose frontmatter cannot be imported, and no suite here renders
// one (the same reason as profile-avatar-url.test.mjs). So the lines that
// derive the gallery and the face are READ OUT of the component and evaluated
// with the real helper. The rule is not copied here: if the component or
// home-face.mjs changes, this suite evaluates the change. Every lifted line is
// asserted present first, so a rename reds the suite instead of passing it.
//
//   node --test test/home-face.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { homeFaceOf } from "../src/lib/home-face.mjs";

const SOURCE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");

// From `const regionAssets` through `const homeFace = …;` — the region routing,
// the gallery list and the face, in the component's own order.
const BLOCK = /^(\s*const regionAssets = [\s\S]*?^\s*const homeFace = [^\n]+;)\s*$/m.exec(SOURCE);
const THUMB = /^\s*homeThumb:\s*(.+),\s*$/m.exec(SOURCE);
assert.ok(BLOCK, "Household.astro still derives regionAssets … homeFace as one block");
assert.ok(THUMB, "Household.astro still derives homeThumb on one line");
assert.match(BLOCK[1], /const images = /, "the lifted block still builds the gallery list");

// eslint-disable-next-line no-new-func -- the point is to run the component's lines, not a copy of them
const derive = new Function("r", "media", "homeFaceOf",
  `${BLOCK[1]}\nreturn { images, homeThumb: (${THUMB[1]}) };`);

const HANDLE = "fixture-house";
const key = (f) => `WHITE_PAGES/${HANDLE}/HOME/${f}`;
// Both files are real images under HOME/ and claimed in media. listDir sorts
// by filename, so the extractor hands them over as a.png, then b.png.
const MEDIA = {
  [key("a.png")]: { card: "/media/a-card.png", full: "/media/a-full.png" },
  [key("b.png")]: { card: "/media/b-card.png", full: "/media/b-full.png" },
};
const HOME_IMAGES = [key("a.png"), key("b.png")];

const house = (home) => derive({ handle: HANDLE, home, region: null, homeImages: HOME_IMAGES }, MEDIA, homeFaceOf);

test("1. assets: [b.png] with a.png and b.png in HOME/ → the face is b.png", () => {
  const t = house({ assets: ["b.png"], body: "# the house" });
  assert.equal(t.homeThumb, "/media/b-card.png", "the declared image is the face, not the first filename");
  assert.deepEqual(t.images, HOME_IMAGES, "the gallery keeps every image in filename order");
});

test("2. no assets → the face is a.png, the first by filename (today's rule)", () => {
  const t = house({ body: "# the house" });
  assert.equal(t.homeThumb, "/media/a-card.png");
  assert.deepEqual(t.images, HOME_IMAGES, "the gallery order is unchanged");
});

test("3. assets: [missing.png] → falls back to a.png and the card still has a face", () => {
  const t = house({ assets: ["missing.png"], body: "# the house" });
  assert.equal(t.homeThumb, "/media/a-card.png", "an asset naming no file falls back, never blanks the card");
  assert.deepEqual(t.images, HOME_IMAGES, "the gallery order is unchanged");
});

// Edges of the same rule, run against the helper directly.
test("4. only the FIRST declared asset is honoured; a bad first entry falls back to filename order", () => {
  const r = (assets) => ({ handle: HANDLE, home: { assets } });
  assert.equal(homeFaceOf(r(["missing.png", "b.png"]), HOME_IMAGES), key("a.png"));
  assert.equal(homeFaceOf(r("b.png"), HOME_IMAGES), key("b.png"), "a scalar is read as a one-item list, as region.assets is");
  assert.equal(homeFaceOf(r(["b.png"]), [key("a.png")]), key("a.png"), "a declared file media never claimed falls back");
  assert.equal(homeFaceOf(r(["b.png"]), []), null, "no showable images → no face");
  assert.equal(homeFaceOf({ handle: HANDLE, home: null }, HOME_IMAGES), key("a.png"), "no HOME.md → today's rule");
});

test("5. a declared asset the Region card claimed is not the house's face", () => {
  // region.assets routes an image to the Region card and out of `images`, so
  // naming it under home.assets too cannot pull it back onto the house.
  const t = derive({
    handle: HANDLE,
    home: { assets: ["b.png"] },
    region: { assets: ["b.png"] },
    homeImages: HOME_IMAGES,
  }, MEDIA, homeFaceOf);
  assert.equal(t.homeThumb, "/media/a-card.png");
  assert.deepEqual(t.images, [key("a.png")]);
});
