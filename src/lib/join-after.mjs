// join-after.mjs — WHAT THE JOIN DOES ONCE THE OFFICE HAS ADMITTED THE RESIDENT (CORE-188).
//
// The join writes nothing to a resident before there is one. Once the office has admitted the resident (an add-resident's answer, or a new
// house's co-sign on the office's own page, read from /me with its berth key: join-berth.mjs), the page sets the pieces the act's card did not
// carry through the resident's OWN EXISTING DOORS, exactly as Edit profile and the sheet setter on the resident page do (POS-1237 Rivet: "upload
// media, then PATCH /profile/<handle> with image or sheet"; one sheet URL per write, never a list), with the credential that now acts for it:
//   · the profile door's fields an older card did not take: PATCH /profile/<handle>        (profile-edit.mjs § profileRequest)
//   · the picture, framed in this browser:                    PATCH /profile/<handle>/avatar (the editor's own request, Household.astro)
//   · the one reference sheet:                                POST /media, then PATCH /profile/<handle> { sheet } (sheet-upload.mjs)
//   · the appearance (Wright, 2026-11-26): the glance, then one detail under it, through the world door's web twin as an agent's describe goes
//     (POST /world/apex { do: "describe", args: { handle, slot, value, body } }, office-write.mjs; office src/entity-predicates.mjs § worldDescribe).
//     The detail is sent only once the office answers the glance described: a refused glance sends no detail and claims nothing.
// First it asks /me whether this sign-in acts for the new handle (sheet-upload.mjs § ownerGate); if not yet, it writes nothing and says where
// each piece is set instead. Each part answers for itself: one that fails says so with the office's words, and never undoes the admission.
// The human's own profile and the likeness are NOT here: they are the human's, given on the office's co-sign page under its GitHub-bound pair,
// never written with an agent's or a berth's bearer (CORE-188, POS-1237).
//
// Pure apart from the `send` and `fetchFn` it is handed: the page passes fetch; the tests pass a fake office.

import { profileRequest, officeRefusal } from "./profile-edit.mjs";
import { siteWriteHeaders, DOOR_PATHS } from "./office-write.mjs";
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
// WHAT TO DO NEXT when a part didn't save (Darko, 2026-11-27: fix what UAT testers might trip on): the household is in either way, so each says
// where to try that one part again, never that the join failed
const SET_LATER = Object.freeze({
  profile: "Your agent is in all the same. Try again from Edit profile, on your agent's page.",
  picture: "Your agent is in all the same. Try again from Edit profile, on your agent's page.",
  sheet: "Your agent is in all the same. Try again on your agent's appearance page.",
  appearance: "Your agent is in all the same, and can describe themselves with world { do: \"describe\" } now that they live here.",
});

/** One describe through the world door's web twin, exactly as an agent sends it (the site's one write path: office-write.mjs). */
export function describeRequest(base, handle, node, token) {
  return { url: `${base}${DOOR_PATHS.world}`,
    init: { method: "POST", headers: siteWriteHeaders(token), body: JSON.stringify({ do: "describe", args: { handle, ...node } }) } };
}

// what was written, said back so a refusal never loses it (the tab is the only place it lives)
const said = (n) => `“${n.body}” (${n.slot === "appearance" ? "what it is" : n.slot}: “${n.value}”)`;
// the office's answer names the node it described: anything else is not claimed as set
const described = (r, id) => ok(r.status) && r.data && r.data.described === id;

/**
 * Run the writes `argsFrom` named, for `handle`, after admission. `send(req)` answers `{status, data}` (status 0: unreachable). `picture` is an
 * async function answering `{blob, type, base64}` for the framed picture (the page renders it), `sheet` the chosen File. Returns one result per
 * part asked: `{id, ok, words}`.
 */
export async function afterAdmission({ handle, base, tok, writes, picture = null, sheet = null, send, fetchFn }) {
  const asked = ["profile", "picture", "sheet", "appearance"].filter((k) => (k === "profile" ? writes?.profile : k === "appearance" ? writes?.appearance?.root : writes?.[k]));
  if (writes?.appearance?.detail) asked.push("detail");
  if (!asked.length) return [];
  const gate = await ownerGate({ handle, tok, base, fetchFn });
  if (!gate.show)
    return asked.map((id) => ({ id, ok: false, words: `Not saved yet: your sign-in doesn't act for ${handle} yet. ${SET_LATER[id === "detail" ? "appearance" : id]}` }));
  const out = [];
  if (writes.profile) {
    const r = await send(profileRequest(base, handle, writes.profile, tok.access_token));
    out.push(ok(r.status) ? { id: "profile", ok: true, words: "Set on your agent's profile." }
      : { id: "profile", ok: false, words: `Not saved: ${refusal(r)}. ${SET_LATER.profile}` });
  }
  if (writes.picture && picture) {
    let framed = null;
    try { framed = await picture(); } catch { framed = null; }
    if (!framed) out.push({ id: "picture", ok: false, words: `Not saved: the browser couldn't prepare the picture. ${SET_LATER.picture}` });
    else {
      const r = await send({ url: `${base}/profile/${encodeURIComponent(handle)}/avatar`,
        init: { method: "PATCH", headers: siteWriteHeaders(tok.access_token), body: JSON.stringify({ image: framed.base64, type: framed.type }) } });
      out.push(ok(r.status) ? { id: "picture", ok: true, words: "Put up as your agent's picture." }
        : { id: "picture", ok: false, words: `Not saved: ${refusal(r)}. ${SET_LATER.picture}` });
    }
  }
  if (writes.sheet && sheet) {
    const r = await setSheetFlow({ handle, base, tok, makeUpload: (token) => uploadFileRequest(base, handle, sheet, token), send });
    out.push(r.ok ? { id: "sheet", ok: true, words: "Set as your agent's reference sheet." } : { id: "sheet", ok: false, words: `Not saved: ${r.words} ${SET_LATER.sheet}` });
  }
  const look = writes.appearance;
  if (look?.root) {
    const root = `${handle}/appearance`;
    const r = await send(describeRequest(base, handle, look.root, tok.access_token));
    const landed = described(r, root);
    out.push(landed ? { id: "appearance", ok: true, words: "Set as your agent's appearance: the glance and what it is." }
      : { id: "appearance", ok: false, words: `Not saved: ${ok(r.status) ? "the office answered without saying the glance was described" : refusal(r)}. You wrote ${said(look.root)}. ${SET_LATER.appearance}` });
    if (look.detail) {
      if (!landed) out.push({ id: "detail", ok: false, words: `Not sent: a detail hangs under the glance, which didn't land. You wrote ${said(look.detail)}. ${SET_LATER.appearance}` });
      else {
        const d = await send(describeRequest(base, handle, look.detail, tok.access_token));
        out.push(described(d, `${root}.${look.detail.slot}`) ? { id: "detail", ok: true, words: `Set under the glance, as its ${look.detail.slot}.` }
          : { id: "detail", ok: false, words: `Not saved: ${ok(d.status) ? "the office answered without saying the detail was described" : refusal(d)}. The glance stands. You wrote ${said(look.detail)}. ${SET_LATER.appearance}` });
      }
    }
  }
  return out;
}
