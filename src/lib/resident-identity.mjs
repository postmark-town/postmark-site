// resident-identity.mjs — the Site's one renderer, handed to the World's circle reader as its speaker identity (CORE-178; the World half is
// WLD-248).
//
// THE CONTRACT (Facet, CORE-178, relayed 2026-11-24 15:59Z; the World hook is Bevel's WLD-248). The reader takes an OPTIONAL
// `identityForSpeaker(handle) -> fresh Element | null`. A valid whole identity replaces the byline's face AND name only (the time and the
// actions stay the reader's); an absent, null, invalid, reused or throwing answer keeps the reader's existing face/default path. The identity
// must stay accessible: never decorative, never aria-hidden. The split: the Site supplies its ONE renderer (resident-mention.mjs) and its
// deliberate human handling; the World adds no profile lookup and no Office read; nobody draws a second renderer or patches the reader's DOM.
//
// WHAT THIS ANSWERS, per speaker:
//   · a resident the World's residents-meta names (the faces the Conversations page already reads): the site's one mention, built FRESH per
//     call (resident-mention.mjs § mentionNode), linked to their page as the page's own personLink links every resident;
//   · a house's human (`human-of-*`): null, deliberately. A human is never drawn as a resident, so the reader keeps its own path for them
//     (the page's face provider gives them the dashed chip and no picture, the reader prints their name);
//   · anyone the faces do not name, or every speaker while the faces have not landed: null, so the reader keeps its face/default path and
//     the page asks the readers to redraw when the faces land (as it already does for faces);
//   · and it never throws: a failure is null.
// The picture is admitted only by the World's own rule for this data (a rooted same-site path, or the town's media door: media-door.mjs, the
// site's one owner of that question), and the colour only as a plain hex.

import { hexOf, isHuman, mentionModel, mentionNode } from "./resident-mention.mjs";
import { atTownMediaDoor } from "./media-door.mjs";

// spectator/viewer.mjs safeAvatarUrl's rooted-path rule, as the Conversations page copies it
const ROOTED = /^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

/** A residents-meta picture this surface may draw, or null. */
export function speakerPicture(src) {
  const s = String(src ?? "").trim();
  if (!s || s.length > 300 || s.includes("..")) return null;
  if (ROOTED.test(s)) return s;
  return atTownMediaDoor(s) ? s : null;
}

/** residents-meta's row (`{ name, avatar, color }`) as the face resident-mention.mjs draws. */
export function speakerFace(meta) {
  if (!meta || typeof meta !== "object") return null;
  return {
    name: typeof meta.name === "string" ? meta.name : null,
    accent: hexOf(meta.color),
    avatar: speakerPicture(meta.avatar),
  };
}

/** Where a speaker's identity links: their resident page, as the Conversations page's personLink links every resident. */
export const speakerHref = (handle) => `/residents/${encodeURIComponent(handle)}/`;

/** The build's renames a page carries on `[data-resident-aliases]` (resident-mentions.mjs § mentionAliases), or {} (no element, unreadable: the floor). */
export function residentAliasesOf(doc) {
  try {
    const m = JSON.parse(doc?.querySelector?.("[data-resident-aliases]")?.getAttribute("data-resident-aliases") || "null");
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  } catch { return {}; }
}

/**
 * The handle a face and a page are found under: the recorded one when the faces hold it, else its current one by the build's alias map (one hop: the
 * map already holds each chain's end), else the recorded one. A non-object map, an inherited key or a non-string target is no alias.
 */
export function resolveHandle(handle, aliases, faces = null) {
  const h = String(handle ?? "");
  if (faces && typeof faces === "object" && Object.hasOwn(faces, h)) return h;
  if (aliases && typeof aliases === "object" && Object.hasOwn(aliases, h) && typeof aliases[h] === "string" && aliases[h]) return aliases[h];
  return h;
}

/**
 * The reader's identity provider.
 * @param {Document} doc
 * @param {() => (Record<string, {name?: string, avatar?: string, color?: string}> | null)} getFaces  residents-meta's residents, or null until read
 * @param {{ hrefOf?: (handle: string) => string | null, toFace?: (row: object) => object | null }} [opts] `toFace` reads a row as the face the mention
 *   draws: residents-meta's rows by default (speakerFace, the World's picture rule); a page that holds the site's own build faces (resident-mentions.mjs
 *   § mentionFaceOf, already through the site's picture rule) passes `(f) => f`. `aliases` ({ recordedHandle: currentHandle }, resident-mentions.mjs §
 *   mentionAliases, the build's own rename walk) resolves a speaker recorded under an old handle to the resident's current face, name and page (Darko c,
 *   "Current name and face"); the mention keeps the recorded handle as `data-rm`.
 */
export function identityProvider(doc, getFaces = () => null, { hrefOf = speakerHref, toFace = speakerFace, aliases = null } = {}) {
  return function identityForSpeaker(handle) {
    try {
      const h = String(handle ?? "").trim();
      if (!h || isHuman(h)) return null;
      const faces = typeof getFaces === "function" ? getFaces() : null;
      const key = resolveHandle(h, aliases, faces);
      const meta = faces && typeof faces === "object" && Object.hasOwn(faces, key) ? faces[key] : null;
      if (!meta) return null;
      const model = mentionModel({ handle: h, face: toFace(meta), href: hrefOf(key) });
      if (model.kind !== "resident") return null;
      return mentionNode(doc, model, { cls: "rm-speaker" });
    } catch {
      return null;
    }
  };
}
