// key-mint.mjs — who the household-key mint stands for (POS-323, Keemin
// 2026-10-02: "re-add the api key mint to the join page if you're already
// signed in… in the household page it's very hidden at the bottom").
//
// The mint (src/components/KeysCard.astro) mints the SIGNED-IN human's
// household key, POST /keys with their sign-in. So the card stands only for a
// reader whose sign-in is fresh AND whose GET /me names at least one resident:
// a sign-in that holds a household. Signed out, or signed in with no house,
// the card stays hidden and /join/ reads exactly as it does for everyone.
//
// Pure, so test/key-mint.test.mjs drives it with a stub section, storage and
// fetch; the component's script only wires the browser's own into it.

import { KEYS, tokenIsFresh } from "./auth.mjs";

/**
 * The residents GET /me names, in either shape the office has answered with
 * (`handles`, or the older `residents`), strings only.
 * @param {object|null} me
 * @returns {string[]}
 */
export function householdHandles(me) {
  if (!me || typeof me !== "object") return [];
  const list = Array.isArray(me.handles) ? me.handles : Array.isArray(me.residents) ? me.residents : [];
  return list.filter((h) => typeof h === "string" && h);
}

/**
 * Does the mint stand for this reader? A fresh sign-in that holds a household.
 * @param {object|null} tok  the stored sign-in token
 * @param {object|null} me   GET /me's answer for that token
 * @param {number} [nowMs]
 */
export function mintStandsFor(tok, me, nowMs = Date.now()) {
  return tokenIsFresh(tok, nowMs) && householdHandles(me).length > 0;
}

/**
 * Read the sign-in, ask /me with it, and show or hide the card. Any failure
 * (no token, an expired one, /me refusing or unreachable, no residents) leaves
 * the card hidden: never a mint button for a reader the office would not mint
 * a household key for.
 * @param {{hidden: boolean}} section  the card's root
 * @param {{storage: Storage, fetchImpl: typeof fetch, base: string, nowMs?: number}} io
 * @returns {Promise<boolean>} whether the card now stands
 */
export async function revealMintFor(section, { storage, fetchImpl, base, nowMs = Date.now() }) {
  let tok = null;
  try { tok = JSON.parse(storage.getItem(KEYS.token) || "null"); } catch { tok = null; }
  let me = null;
  if (tokenIsFresh(tok, nowMs)) {
    try {
      const res = await fetchImpl(base + "/me", {
        headers: { accept: "application/json", authorization: "Bearer " + tok.access_token },
      });
      if (res.ok) me = await res.json();
    } catch { me = null; }
  }
  const stands = mintStandsFor(tok, me, nowMs);
  section.hidden = !stands;
  return stands;
}
