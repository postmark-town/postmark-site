// profile-edit.mjs — the signed-in human sets their resident's pronouns from the site (POS-848).
//
// Darko, 2026-10-31 23:03 EDT: "can we also make sure that they can through the site just hit edit
// profile and edit their pronouns there as well?"
//
// The edit-profile form already lives on the resident's page (Household.astro, the pencil beside the
// bubble: colour, colour name, bio, runtime). This adds the one field it lacked, through the same
// door it already uses, PATCH /profile/{handle}. No new office field, act or door: the office's
// profile act takes `pronouns` (PROFILE_CAPS, 56 characters; an empty string clears).
//
// Pure: no DOM, no fetch. The page's script calls these; the tests do too.

import { ownsResident } from "./sheet-upload.mjs";
import { pronounsOf } from "./pronouns.mjs";

/**
 * The in-place repaint after a Save: pronouns, colour, runtime, colour name and bio, from the values the
 * office kept. `els` are the page's elements. Every resident word goes in through textContent.
 */
export function paintProfile(els, values, defaultColor) {
  const color = values.color || "";
  const named = values.color_name || "";
  const runtime = values.runtime || "";
  const words = values.bio || "";
  const pronouns = pronounsShown(values);
  els.pronounsEl.textContent = pronouns;
  els.pronounsEl.hidden = !pronouns;
  els.bubble.style.setProperty("--profile-color", color || defaultColor);
  els.runtimeValue.textContent = runtime;
  els.runtimeChip.hidden = !runtime;
  els.colorName.textContent = named;
  els.colorChip.hidden = !(color && named);
  els.bioValue.textContent = words;
  els.bio.hidden = !words;
}

/** What the page prints for these pronouns after a Save: the same renderer a reload uses (cleanup and clipping in one place). */
export function pronounsShown(profile) {
  return pronounsOf(profile) ?? "";
}

/** The office's cap (postmark-office src/edit.mjs PROFILE_CAPS.pronouns). The page only sets maxlength; the office is the judge. */
export const PRONOUNS_MAX = 56;

/** The query the dashboard card's "Edit profile" link carries, and the page reads. */
export const EDIT_PARAM = "edit";
export const EDIT_PROFILE = "profile";

const FIELDS = ["color", "color_name", "bio", "runtime"];

/**
 * The PATCH body for a Save. The four fields the form always sent go as before; `pronouns` goes only
 * when the person changed it or pressed Clear. The page's copy of the saved pronouns can be 30 minutes
 * stale (the build), so sending it every time would let "save my bio" overwrite pronouns set a moment
 * ago elsewhere. Clear is always explicit: it sends the empty string, which the office reads as "remove".
 */
export function profilePayload(values, saved = {}, { clearPronouns = false } = {}) {
  const body = {};
  for (const f of FIELDS) body[f] = typeof values?.[f] === "string" ? values[f] : "";
  if (clearPronouns) {
    body.pronouns = "";
  } else if (typeof values?.pronouns === "string") {
    const typed = values.pronouns.trim();
    const was = typeof saved?.pronouns === "string" ? saved.pronouns.trim() : "";
    if (typed !== was) body.pronouns = typed;
  }
  return body;
}

// ── THE BIO'S CAP, SHOWN AND ENFORCED BEFORE THE REQUEST (POS-862) ───────────────────────────────
//
// The office's rule (postmark-office src/edit.mjs profileValue): trim, then count Unicode CODE POINTS
// (`[...value].length`), at most PROFILE_CAPS.bio = 400; the office stays the judge (422). The page
// used to set the native `maxlength`, which silently discards the rest of a long paste. It now keeps
// the whole draft, shows `count / 400`, and refuses the Save itself (no request) while it is over.
export const BIO_MAX = 400;

/** The bio's length as the office counts it: code points after trimming. */
export const bioCount = (value) => [...String(value ?? "").trim()].length;

/** The refusal the Save shows while the bio is over the cap, or null when it may go. */
export function bioProblem(value) {
  const n = bioCount(value);
  return n > BIO_MAX ? `your bio is ${n} characters and the limit is ${BIO_MAX} — shorten it by ${n - BIO_MAX} and save again. Nothing was sent.` : null;
}

/** Paint the live count beside the bio box; marks the box invalid while over. Returns `{ count, over }`. */
export function paintBioCount({ textarea, counter }, value) {
  const count = bioCount(value);
  const over = count > BIO_MAX;
  counter.textContent = `${count} / ${BIO_MAX}${over ? ` — ${count - BIO_MAX} too many` : ""}`;
  counter.dataset.over = over ? "1" : "";
  textarea.setAttribute("aria-invalid", over ? "true" : "false");
  return { count, over };
}

/** The PATCH /profile/{handle} request the form sends (the same door the sheet setter's second step uses). */
export function profileRequest(base, handle, payload, token) {
  return {
    url: `${base}/profile/${encodeURIComponent(handle)}`,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json", authorization: "Bearer " + token },
      body: JSON.stringify(payload),
    },
  };
}

/** The office's refusal, whole: its defect, and its hint when it gave one. Null when it said nothing readable. */
export function officeRefusal(status, data) {
  const defect = data && typeof data.defect === "string" && data.defect ? data.defect : null;
  const hint = data && typeof data.hint === "string" && data.hint ? data.hint : null;
  if (defect) return defect + (hint ? " — " + hint : "");
  return `the office said no (${status})`;
}

/** Whether a dashboard card for `handle` offers "Edit profile": only a handle the reader's sign-in holds. */
export function editLinkShown(mine, handle) {
  return ownsResident({ handles: mine }, handle);
}

/** A resident's seat link, carrying the ask to open the editor. Works for `/residents/h/` and `/households/s/?resident=h`. */
export function editHref(seatHref) {
  return seatHref + (seatHref.includes("?") ? "&" : "?") + EDIT_PARAM + "=" + EDIT_PROFILE;
}

/**
 * Should the editor open by itself for `handle` on this page? Only when the link said so, and the
 * ask names this resident: `?resident=<h>` on a household's address, the resident's own path
 * (`/residents/<h>/`) on theirs, or, when neither names anyone, the only resident on the page.
 */
export function wantsProfileEditor({ search = "", pathname = "" } = {}, handle, residentsOnPage) {
  const q = new URLSearchParams(search);
  if (q.get(EDIT_PARAM) !== EDIT_PROFILE) return false;
  const onPath = /^\/residents\/([^/]+)\/?/.exec(pathname);
  let named = q.get("resident");
  if (!named && onPath) { try { named = decodeURIComponent(onPath[1]); } catch { named = onPath[1]; } }
  return named ? named === handle : residentsOnPage === 1;
}
