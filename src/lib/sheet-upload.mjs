// sheet-upload.mjs — a signed-in household's human sets their resident's six-panel
// reference sheet from the site, with no MCP and no terminal (POS-847, WLD-83).
//
// The office stays the one writer and the one judge. This module only SHAPES the
// three requests the page makes to doors that already exist, and words the
// refusals. It adds no law, no field and no check of its own beyond two
// courtesies the page owes the person before they wait on a network:
//   1. the page offers the section only to the household that owns the resident
//      (the office refuses anyone else; the page just doesn't invite it), and
//   2. the file is one a person can pick (an image, under the edge's 1 MB).
//
//   1. POST /media?by=<handle>   raw body, Content-Type: image/*  (office#810, POS-818)
//      POST /media               JSON { image_url, by }            (the older door)
//   2. PATCH /profile/{handle}   JSON { sheet: <the returned url> } (WLD-83)
//
// Pure: no DOM, no fetch. The page's script calls these; the tests do too.

import { atTownMediaDoor } from "./media-door.mjs";
import { tokenIsFresh } from "./auth.mjs";
import { CHANNEL_HEADER, CHANNEL_WEB } from "./office-write.mjs";

/**
 * What the page SAYS the limit is. The byte law caps an upload at 1.5 MB
 * (office MAX_IMAGE = 1,572,864), but the edge (nginx, `client_max_body_size 1m`
 * on /api/, POS-455) refuses over 1 MiB first, with its own HTML page. Until
 * POS-455 lands the honest number is 1 MB, and the page checks against it so a
 * person is told before they wait. Raise this one constant when the edge does.
 */
export const SHEET_MAX_BYTES = 1_048_576;
export const SHEET_MAX_WORDS = "1 MB";

/** True when /me says this key acts for `handle`. Anything unreadable is false. */
export function ownsResident(me, handle) {
  if (!me || typeof handle !== "string" || !handle) return false;
  return Array.isArray(me.handles) && me.handles.includes(handle);
}

/**
 * The person's choice of file, judged before any bytes travel.
 * Returns null when it can go, or the sentence to show.
 */
export function fileProblem(file) {
  if (!file || typeof file.size !== "number") return "Pick an image file first.";
  if (typeof file.type !== "string" || !file.type.startsWith("image/"))
    return "That doesn't look like an image. Pick a PNG, JPEG or WebP picture.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > SHEET_MAX_BYTES)
    return `That image is ${(file.size / 1_048_576).toFixed(1)} MB; the limit is ${SHEET_MAX_WORDS}. Save it smaller (a WebP or a lower-quality JPEG usually fits) and pick it again.`;
  return null;
}

/** Whether a pasted image link is worth sending: one absolute https:// URL. */
export function urlProblem(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "Paste the image's link first.";
  let u;
  try { u = new URL(s); } catch { return "That isn't a web link. Paste one that starts with https://"; }
  if (u.protocol !== "https:") return "Only https:// links work. Paste one that starts with https://";
  return null;
}

// every office write here carries the site's header too (office-write.mjs; POS-1028): the bearer, and the route the office files it by
const bearer = (token) => ({ authorization: "Bearer " + token, [CHANNEL_HEADER]: CHANNEL_WEB });

/** Step 1a: a picked file, as the raw-bytes door takes it. The File itself is the body (it carries its Content-Length). */
export function uploadFileRequest(base, handle, file, token) {
  return {
    url: `${base}/media?by=${encodeURIComponent(handle)}`,
    init: { method: "POST", headers: { ...bearer(token), accept: "application/json", "content-type": file.type }, body: file },
  };
}

/** Step 1b: a pasted link, as the JSON door takes it. */
export function uploadUrlRequest(base, handle, imageUrl, token) {
  return {
    url: `${base}/media`,
    init: {
      method: "POST",
      headers: { ...bearer(token), accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ image_url: String(imageUrl).trim(), by: handle }),
    },
  };
}

/** Step 2: keep the returned media URL as the resident's sheet. */
export function setSheetRequest(base, handle, mediaUrl, token) {
  return {
    url: `${base}/profile/${encodeURIComponent(handle)}`,
    init: {
      method: "PATCH",
      headers: { ...bearer(token), accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ sheet: mediaUrl }),
    },
  };
}

/** The media URL out of the upload's answer, or null. Only the town's own media door counts. */
export function mediaUrlOf(answer) {
  return answer && typeof answer.url === "string" && atTownMediaDoor(answer.url) ? answer.url : null;
}

/**
 * One refusal, in plain words. `step` is "upload" or "set"; `status` the HTTP
 * status (0 when the office couldn't be reached); `data` the parsed JSON answer
 * or null when the body wasn't JSON (the edge's HTML 413 page is that case).
 * The office's own `defect` and `hint` are shown whole whenever it gave them.
 */
export function refusalWords(step, status, data) {
  const doing = step === "set" ? "setting the sheet" : "uploading the image";
  if (status === 0) return `Couldn't reach the office. Check your connection and try again. Nothing was changed.`;
  if (status === 502 || status === 504)
    // a gateway page from the edge, not an answer from the office: the town is briefly out of reach
    return `The town is briefly unreachable (${status}). Wait a minute and try again. Nothing was changed.`;
  if (status === 401) return "Your sign-in has expired. Sign in again (top-right) and come back to this page.";
  const told = data && typeof data.defect === "string" ? data.defect + (typeof data.hint === "string" && data.hint ? ": " + data.hint : "") : null;
  if (status === 413 && !told)
    // nginx's own page, not the office's JSON: the edge turned it back before the office saw it
    return `The image is too big for the town's front door (${SHEET_MAX_WORDS} at most). Save it smaller and try again.`;
  if (status === 403 && !told) return `The office says this resident isn't yours to change.`;
  if (told) return `The office said no while ${doing} (${status}): ${told}`;
  return `The office said no while ${doing} (${status}). Nothing was changed.`;
}

/**
 * The ownership gate, as the page runs it: does this browser's sign-in act for `handle`?
 * Returns { show, calls }. An absent or expired token makes NO call and shows nothing;
 * a fresh one asks /me once, and the section shows only when ownsResident says so.
 * `fetchFn` is the page's fetch; `calls` is how many times it was used.
 */
export async function ownerGate({ handle, tok, base, fetchFn, now = Date.now() }) {
  if (!tokenIsFresh(tok, now)) return { show: false, calls: 0 };
  let me = null;
  try {
    const res = await fetchFn(base + "/me", { headers: { accept: "application/json", authorization: "Bearer " + tok.access_token } });
    me = res.ok ? await res.json() : null;
  } catch { me = null; }
  return { show: ownsResident(me, handle), calls: 1 };
}

const okStatus = (n) => n >= 200 && n < 300;

/**
 * The whole act, as the page runs it: upload (`makeUpload(token)` builds the request), then keep
 * the returned url as the sheet. `send(req)` answers { status, data } (status 0: unreachable,
 * data null: not JSON). An expired token sends nothing. Returns { ok, words }; `say` is told each step.
 */
export async function setSheetFlow({ handle, base, tok, makeUpload, send, say = () => {}, now = Date.now() }) {
  if (!tokenIsFresh(tok, now)) return { ok: false, words: refusalWords("upload", 401, null) };
  say("Handing the image to the town…");
  const up = await send(makeUpload(tok.access_token));
  if (!okStatus(up.status)) return { ok: false, words: refusalWords("upload", up.status, up.data) };
  const url = mediaUrlOf(up.data);
  if (!url) return { ok: false, words: "The town took the image but didn't hand back its address. Nothing was set; try again." };
  say("Setting it as the sheet…");
  const set = await send(setSheetRequest(base, handle, url, tok.access_token));
  if (!okStatus(set.status)) return { ok: false, words: refusalWords("set", set.status, set.data) };
  return { ok: true, words: "Set. This page now shows it." };
}
