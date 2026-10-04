// fund-ref.mjs — the payment reference the fund page mints (POS-317, Keemin 2026-10-02).
//
// A payment is credited to the payer's HOUSEHOLD, and nobody types anything:
// the page writes the signed-in account into each rail's own reference, and the
// office's watchers read it back (postmark-office src/fund-holder.mjs §
// parseFundRef, which resolves the account to its household and to the one
// resident who holds its stamps).
//
//   card    Stripe client_reference_id   `<pot>_g<id>`   (bare `<pot>` signed out)
//   PayPal  the order's custom_id        `<pot>|g<id>`   (`<pot>|` signed out)
//   USDC    the /fund form's household   `g<id>`
//
// The account, never a slug: four household slugs carry a dot (Stripe's
// reference takes only letters, digits, `-` and `_`) and one is 858 characters
// (Stripe allows 200, PayPal 127). THE SPELLING IS SHARED with the office, and
// both repos' tests pin the same literal cases, so a change on one side reds
// the other's.

export const REF_SEP = Object.freeze({ stripe: "_", paypal: "|" });
export const accountRef = (ghId) => `g${String(ghId)}`;

/** A rail's reference for a pot and, when signed in, the account. Bare `<pot>` with no account. */
export function fundRefFor(pot, ghId, rail) {
  const sep = REF_SEP[rail];
  if (!sep) throw new Error(`no reference shape for rail "${rail}"`);
  return ghId == null || ghId === "" ? String(pot) : `${pot}${sep}${accountRef(ghId)}`;
}

/** The card button's href: the Payment Link with the pot, and the account when signed in. */
export function cardHref(link, pot, ghId) {
  return `${link}?client_reference_id=${encodeURIComponent(fundRefFor(pot, ghId, "stripe"))}`;
}
