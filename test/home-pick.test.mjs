// home-pick.test.mjs — a signed-in household picks its home's pictures (POS-321).
//
// Kev (Lyra, wayward-archivist), 2026-10-02: her page showed every file in
// HOME/. Part 1 made the readers respect `assets:`; this is part 2: the owner
// ticks pictures on the page and Save rewrites `assets:` through the office's
// EXISTING home-update act (PATCH /home/{handle}, office edit.mjs § assetNames),
// never a new write path, never a file move.
//
//   node --test test/home-pick.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assetsToSave, homeFileName } from "../src/lib/home-pick.mjs";

const LYRA = ["House of Many Doors_ Parcel Plans.png", "Wayward-archivist.png", "lyra-desk-marge.jpg", "shared-parcel.png"];

// ── 1. the list Save sends ──────────────────────────────────────────────────

test("1. Lyra keeps her one picture: the list is exactly what she declared", () => {
  assert.deepEqual(assetsToSave({ declared: ["shared-parcel.png"], pickable: LYRA, checked: ["shared-parcel.png"], onDisk: LYRA }), ["shared-parcel.png"]);
});

test("2. ticking a second picture keeps the face first: the declared entry keeps its place, the new one follows", () => {
  const out = assetsToSave({ declared: ["shared-parcel.png"], pickable: LYRA, checked: ["lyra-desk-marge.jpg", "shared-parcel.png"], onDisk: LYRA });
  assert.deepEqual(out, ["shared-parcel.png", "lyra-desk-marge.jpg"]);
});

test("3. a house with no declaration: the ticked ones, in the picker's (filename) order", () => {
  const out = assetsToSave({ declared: null, pickable: LYRA, checked: ["shared-parcel.png", "Wayward-archivist.png"], onDisk: LYRA });
  assert.deepEqual(out, ["Wayward-archivist.png", "shared-parcel.png"]);
  assert.deepEqual(assetsToSave({ declared: "shared-parcel.png", pickable: LYRA, checked: ["shared-parcel.png"], onDisk: LYRA }), ["shared-parcel.png"], "a scalar declaration reads as a one-item list");
});

test("4. unticking a declared picture drops it; nothing ticked saves nothing (an empty list would show them all)", () => {
  assert.deepEqual(assetsToSave({ declared: ["shared-parcel.png", "lyra-desk-marge.jpg"], pickable: LYRA, checked: ["lyra-desk-marge.jpg"], onDisk: LYRA }), ["lyra-desk-marge.jpg"]);
  assert.equal(assetsToSave({ declared: ["shared-parcel.png"], pickable: LYRA, checked: [], onDisk: LYRA }), null);
  assert.equal(assetsToSave({ declared: null, pickable: LYRA, checked: ["not-listed.png"], onDisk: LYRA }), null, "a box the picker does not list is not a tick");
});

test("5. a declared file the picker cannot show stays when it is still in HOME/, and goes when it is not", () => {
  // region.png is the Region card's (not pickable); gone.png was renamed away,
  // and the office would refuse the WHOLE list over it.
  const out = assetsToSave({
    declared: ["gone.png", "region.png", "shared-parcel.png"],
    pickable: LYRA,
    checked: ["shared-parcel.png"],
    onDisk: [...LYRA, "region.png"],
  });
  assert.deepEqual(out, ["region.png", "shared-parcel.png"]);
});

test("6. homeFileName reads the filename out of a HOME/ key, spaces and all", () => {
  assert.equal(homeFileName("WHITE_PAGES/wayward-archivist/HOME/House of Many Doors_ Parcel Plans.png"), "House of Many Doors_ Parcel Plans.png");
});

// ── 2. the page: owner only, the existing verb, assets alone ────────────────
//
// Household.astro is an Astro component no suite here renders (home-face.test
// says why), so these read its source and assert inside the slices the claims
// are about.

const SOURCE = readFileSync(new URL("../town/components/Household.astro", import.meta.url), "utf8");
const slice = (re, what) => { const m = re.exec(SOURCE); assert.ok(m, `${what} is still where this suite reads it`); return m[0]; };

const PICK_MARKUP = slice(/<div class="pm-pick" data-home-pick[^>]*>/, "the picker's markup");
// \r?\n: the site's sources check out CRLF on this machine and LF in CI.
const WIRE_PICK = slice(/function wirePick\(\) \{[\s\S]*?\r?\n    \}\r?\n/, "wirePick");
const MOUNT = slice(/async function mount\(\) \{[\s\S]*?\r?\n    \}\r?\n/, "mount");

test("7. the picker renders hidden: a signed-out or non-owner page never shows it", () => {
  assert.match(PICK_MARKUP, /\shidden(\s|>)/);
  assert.match(SOURCE, /\{t\.pickable\.length > 1 && \(/, "one picture or none: nothing to choose, no picker");
});

test("8. only the owner path reveals it: mount() wires it after /me names this handle", () => {
  const ownerGate = MOUNT.indexOf("if (handles.indexOf(handle) < 0) return;");
  const call = MOUNT.indexOf("wirePick();");
  assert.ok(ownerGate >= 0 && call > ownerGate, "wirePick() runs only past the owner check");
  assert.match(WIRE_PICK, /box\.hidden = false;/);
});

test("9. Save sends { assets } alone to the office's existing PATCH /home verb, with the household's bearer", () => {
  assert.match(WIRE_PICK, /fetch\(OFFICE_BASE \+ "\/home\/" \+ encodeURIComponent\(handle\), \{/);
  assert.match(WIRE_PICK, /method: "PATCH"/);
  assert.match(WIRE_PICK, /authorization: "Bearer " \+ tok\.access_token/);
  assert.match(WIRE_PICK, /body: JSON\.stringify\(\{ assets \}\)/, "the body and the title are not sent, so the prose cannot be touched");
  assert.equal((WIRE_PICK.match(/fetch\(/g) ?? []).length, 1, "one request, no second write path");
});

test("10. a refusal is the office's own sentence, rendered verbatim", () => {
  assert.match(WIRE_PICK, /data\.defect \|\| \("the office said no \(" \+ res\.status \+ "\)"\)\) \+ \(data\.hint \? " — " \+ data\.hint : ""\)/);
});
