// join-after.mjs — WHAT THE JOIN DOES ONCE THE OFFICE HAS ADMITTED THE RESIDENT (CORE-188).
//
// The join writes nothing to a resident before there is one. Once the office has admitted the resident (an add-resident's answer, or a new
// house's co-sign on the office's own page, read from /me with its berth key: join-berth.mjs), the page sets the pieces the act's card did not
// carry through the resident's OWN EXISTING DOORS, exactly as Edit profile and the sheet setter on the resident page do (POS-1237 Rivet: "upload
// media, then PATCH /profile/<handle> with image or sheet"; one sheet URL per write, never a list), with the credential that now acts for it:
//   · the profile door's fields an older card did not take: PATCH /profile/<handle>        (profile-edit.mjs § profileRequest)
//   · the picture, framed in this browser:                    PATCH /profile/<handle>/avatar (the editor's own request, Household.astro)
//   · the one reference sheet:                                POST /media, then PATCH /profile/<handle> { sheet } (sheet-upload.mjs)
// First it asks /me whether this sign-in acts for the new handle (sheet-upload.mjs § ownerGate); if not yet, it writes nothing and says where
// each piece is set instead. Each part answers for itself: one that fails says so with the office's words, and never undoes the admission.
// The human's own profile and the likeness are NOT here: they are the human's, given on the office's co-sign page under its GitHub-bound pair,
// never written with an agent's or a berth's bearer (CORE-188, POS-1237).
//
// Pure apart from the `send` and `fetchFn` it is handed: the page passes fetch; the tests pass a fake office.

import { profileRequest, officeRefusal } from "./profile-edit.mjs";
import { siteWriteHeaders } from "./office-write.mjs";
import { ownerGate, setSheetFlow, uploadFileRequest } from "./sheet-upload.mjs";

/** The largest side the picture travels at, as Edit profile renders it (Household.astro § renderFramed). */
export const PICTURE_OUT_MAX = 512;

/**
 * The square of the source a framing shows, in source pixels: the picture is cover-fitted into the square, then scaled by `zoom` about its
 * centre and moved by `x`/`y` percent of the square (the CSS transform the join's preview uses). Returns `{sx, sy, side, out}`, `out` the side
 * it is rendered at (at most 512, as Edit profile does).
 */
export function cropOf({ w, h }, { zoom = 1, x = 0, y = 0 } = {}) {
  const z = zoom > 0 ? zoom : 1;
  const m = Math.min(w, h);
  const side = m / z;
  // in square units (0..1): the visible square's top-left, back through the transform
  const left = 0.5 - (0.5 + x / 100) / z;
  const top = 0.5 - (0.5 + y / 100) / z;
  const sx = Math.max(0, Math.min(w - side, (w - m) / 2 + left * m));
  const sy = Math.max(0, Math.min(h - side, (h - m) / 2 + top * m));
  return { sx, sy, side, out: Math.max(1, Math.min(PICTURE_OUT_MAX, Math.round(side))) };
}

const ok = (n) => n >= 200 && n < 300;
const refusal = (r) => (r.status === 0 ? "the office couldn't be reached" : officeRefusal(r.status, r.data));
const SET_LATER = Object.freeze({
  profile: "Set it on Edit profile, on your agent's page.",
  picture: "Put it up on Edit profile, on your agent's page.",
  sheet: "Set it on your agent's appearance page.",
});

/**
 * Run the writes `argsFrom` named, for `handle`, after admission. `send(req)` answers `{status, data}` (status 0: unreachable). `picture` is an
 * async function answering `{blob, type, base64}` for the framed picture (the page renders it), `sheet` the chosen File. Returns one result per
 * part asked: `{id, ok, words}`.
 */
export async function afterAdmission({ handle, base, tok, writes, picture = null, sheet = null, send, fetchFn }) {
  const asked = ["profile", "picture", "sheet"].filter((k) => (k === "profile" ? writes?.profile : writes?.[k]));
  if (!asked.length) return [];
  const gate = await ownerGate({ handle, tok, base, fetchFn });
  if (!gate.show)
    return asked.map((id) => ({ id, ok: false, words: `Not set yet: your sign-in doesn't act for ${handle} yet. ${SET_LATER[id]}` }));
  const out = [];
  if (writes.profile) {
    const r = await send(profileRequest(base, handle, writes.profile, tok.access_token));
    out.push(ok(r.status) ? { id: "profile", ok: true, words: "Set on your agent's profile." }
      : { id: "profile", ok: false, words: `Not set: ${refusal(r)}. ${SET_LATER.profile}` });
  }
  if (writes.picture && picture) {
    let framed = null;
    try { framed = await picture(); } catch { framed = null; }
    if (!framed) out.push({ id: "picture", ok: false, words: `Not put up: the browser couldn't prepare the picture. ${SET_LATER.picture}` });
    else {
      const r = await send({ url: `${base}/profile/${encodeURIComponent(handle)}/avatar`,
        init: { method: "PATCH", headers: siteWriteHeaders(tok.access_token), body: JSON.stringify({ image: framed.base64, type: framed.type }) } });
      out.push(ok(r.status) ? { id: "picture", ok: true, words: "Put up as your agent's picture." }
        : { id: "picture", ok: false, words: `Not put up: ${refusal(r)}. ${SET_LATER.picture}` });
    }
  }
  if (writes.sheet && sheet) {
    const r = await setSheetFlow({ handle, base, tok, makeUpload: (token) => uploadFileRequest(base, handle, sheet, token), send });
    out.push(r.ok ? { id: "sheet", ok: true, words: "Set as your agent's reference sheet." } : { id: "sheet", ok: false, words: `Not set: ${r.words} ${SET_LATER.sheet}` });
  }
  return out;
}
