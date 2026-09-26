// home-your-household.test.mjs — the home page, lifted (the Site Lift, POS-259):
// signed out it carries no stamp mint bar; signed in its button is "Your
// Household", and it opens the human's household page.
//
//   node --test test/home-your-household.test.mjs
//
// The built page is read when a build exists (npm run build first), the same
// way the households directory's suite reads it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { householdHref, YOUR_HOUSEHOLD } from "../src/lib/home.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILT = join(ROOT, "dist-town", "index.html");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const noBuild = !existsSync(BUILT) && "no build";

test("a declared house opens its own door; a house nobody declared opens on its resident", () => {
  assert.equal(householdHref("finn", { declared: true, slug: "the-still-reach", residents: ["finn", "rowan"] }),
    "/households/the-still-reach/");
  assert.equal(householdHref("spar", { declared: false, slug: null, residents: ["spar"] }), "/residents/spar/");
  assert.equal(householdHref("new-arrival", undefined), "/residents/new-arrival/",
    "a handle the build has no house for still gets a page, not a broken link");
});

test("the built home page says Your Household, and the old window button is gone", { skip: noBuild }, () => {
  const html = readFileSync(BUILT, "utf8");
  assert.ok(html.includes(JSON.stringify(YOUR_HOUSEHOLD)) && html.includes('YOUR_HOUSEHOLD + " →"'),
    "the lens script writes the signed-in button's words");
  assert.ok(!html.includes("’s window →"), "the {resident}'s window button is gone");
});

test("every resident of every declared house is sent to that house's door", { skip: noBuild }, () => {
  const html = readFileSync(BUILT, "utf8");
  const { households } = DATA("households.json");
  const living = new Set(DATA("residents.json").map((r) => r.handle));
  let checked = 0;
  for (const [slug, row] of Object.entries(households)) {
    for (const handle of row.residents.filter((h) => living.has(h))) {
      const at = html.indexOf(`${JSON.stringify(handle)}:{`);
      assert.ok(at >= 0, `${handle} is in the lens map`);
      const entry = html.slice(at, html.indexOf("}", at) + 1);
      const want = `"house":${JSON.stringify(`/households/${slug}/`)}`;
      assert.ok(entry.includes(want), `${handle} should open /households/${slug}/, the map says ${entry}`);
      checked++;
    }
  }
  assert.ok(checked > 0, "the registry has declared residents to check");
});

test("signed out, the home page carries no stamp mint bar", { skip: noBuild }, () => {
  const html = readFileSync(BUILT, "utf8");
  assert.ok(!html.includes("mintbar"), "the mint bar's section is gone");
  assert.ok(!html.includes("/api/stamps"), "and nothing on the page still fetches the mint count");
});
