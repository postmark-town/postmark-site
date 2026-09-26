// home.mjs — the front door's signed-in button (the Site Lift, POS-259).
//
// Keemin, 2026-09-26: signed in, the home page's "{resident}'s window" button
// becomes "Your Household", and it opens the signed-in human's household page.
//
// Which page that is follows the households' own addresses: a DECLARED house
// has its door at /households/<slug>/; a house nobody declared has no name to
// hang a sign on, so its page is its resident's, where the same household
// wrapper renders. One human is one household (the 2026-08-07 ruling), so the
// first handle a signed-in human holds names their house.

export const YOUR_HOUSEHOLD = "Your Household";

/** The household page for one resident, given the house the resolver put them in. */
export function householdHref(handle, house) {
  if (house?.declared && house.slug) return `/households/${house.slug}/`;
  return `/residents/${encodeURIComponent(handle)}/`;
}
