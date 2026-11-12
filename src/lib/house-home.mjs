// house-home.mjs — where "your household" goes, from what GET /me says (POS-984).
//
// Darko, 2026-10-19: "household is your sign-in". Signed in, the header's household link goes to the household's
// own page, /households/<slug>/, where the Hearth draws the house and is the whole page (what only the signed-in human
// sees is drawn by the design's own private slots). A resident's window is no longer the way in.
//
// The office's /me answers `households: { <handle>: { key, slug, residents } }` (postmark-office src/households.mjs,
// householdLookupOf), a garnish: it may be absent, and `slug` is null for a house nobody declared. A house with no
// declared slug has no page to go to, so this answers "" and the caller keeps its link per resident.
//
// Pure: no DOM, no storage. The page's page-path comes from houses.mjs's housePath (a long key's directory name is
// not its key), the same function the build names the page with.

import { housePath } from "./houses.mjs";

/** The household page's path for a /me answer and the handles it holds, or "" when no held handle's house is declared. */
export function householdHome(me, handles = []) {
  const blocks = me && typeof me === "object" ? me.households : null;
  if (!blocks || typeof blocks !== "object") return "";
  for (const h of handles) {
    const slug = blocks[h]?.slug;
    if (typeof slug === "string" && slug) return `/households/${housePath(slug)}/`;
  }
  return "";
}
