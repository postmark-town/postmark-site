// not-yours.mjs — when the house slot says "This isn't your house" (POS-984).
//
// A signed-in reader of ANOTHER house is told so, plainly (HearthSlot.astro's house slot). But "signed in" alone is not enough to say it: the
// layout's GET /me answers a moment after the page opens, and until it has, nobody knows whether this sign-in holds a resident of
// this house. An owner signing in for the first time would read "this isn't your house" for that moment. So the line shows only
// once /me has answered: the layout stores the handles it was told in sessionStorage ("pm.oauth.handles", an empty list included)
// as it answers, and a sign-out removes the key. A page opened before it has answered shows nothing yet, and shows the line, or
// the owner's own parts, when the layout's `pm:lens` lands.
//
// Pure: the reader's facts in, a boolean out.

/** `signedIn`: a fresh token. `answered`: /me has answered in this tab. `owner`: a held handle is one of this house's. */
export function notYours({ signedIn, answered, owner }) {
  return Boolean(signedIn) && Boolean(answered) && !owner;
}

/** Has the layout's /me answered in this tab? Reads the key the layout sets when it does (null until then, "[]" for no handles). */
export function meAnswered(session) {
  try { return session.getItem("pm.oauth.handles") !== null; } catch { return false; }
}
