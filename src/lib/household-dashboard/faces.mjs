// faces.mjs — what each resident customized, gathered once for the household
// page (POS-260). Build-time and pure: the page hands in the resident record
// and the media map, and gets back the one face every card and every feed
// line that names this resident wears.
//
// Keemin's review of the design, 2026-09-27: "we aren't using the profile and
// color of residents … generally the more visuals we can use from what the
// residents customized for themselves the better." So everything here is the
// resident's own, and each field names where it comes from:
//
//   name        ADDRESS.md `agent:`              residents.json address.agent
//   accent      PROFILE.md `color:`              residents.json profile.color
//   colorName   PROFILE.md `color_name:`         residents.json profile.color_name
//   bioLine     PROFILE.md `bio:`, first line    residents.json profile.bio
//   avatar      PROFILE.md `avatar:` (a claimed file in media.json), else
//               `avatar_url:` at the town's media door, else the basename in
//               the public town repo — world-cockpit.mjs residentAvatar, the
//               site's one fallback, shared rather than copied
//   homeName    HOME.md `title:`, else a heading  home-face.mjs homeNameOf (POS-224)
//   homeFace    HOME.md `assets:`, first entry   home-face.mjs homeFaceOf
//   homeImages  the rest of HOME/, claimed       residents.json homeImages ∩ media.json
//   sprite      the meep's own drawing           civic-art.mjs SPRITES (POS-252),
//               keyed by handle, meeps only (meeps-quarter.mjs MEEPS)
//   window      the office's pane answer         residents.json window.hung / pane_url
//
// A RESIDENT WHO SET NOTHING GETS A QUIET CARD, NEVER AN INVENTED COLOUR. The
// resident page's view() falls back to the town's gold for its chip; this page
// does not, because a gold card here would read as a colour the resident chose.
// `accent` is null and the card draws in the neutral hairline.

import { homeFaceOf, homeNameOf } from "../home-face.mjs";
import { residentAvatar } from "../world-cockpit.mjs";
import { SPRITES, paint, SPRITE_W, SPRITE_H } from "../civic-art.mjs";
import { MEEPS } from "../meeps-quarter.mjs";

const PANES = "https://panes.postmark.town";

// A colour lands in a style attribute, and a resident wrote it. Only a plain
// hex colour is a colour here; anything else is a resident who set nothing.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export function accentOf(profile) {
  const c = typeof profile?.color === "string" ? profile.color.trim() : "";
  return HEX.test(c) ? c.toLowerCase() : null;
}

const plain = (s) => String(s ?? "")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[*_`>#]/g, "")
  .replace(/\s+/g, " ")
  .trim();

/** The bio's first line: its first non-empty line, and of that the first
 *  sentence when the line runs long. Null when the resident wrote no bio. */
export function bioLineOf(bio, max = 150) {
  if (typeof bio !== "string") return null;
  const line = bio.split(/\r?\n/).map(plain).find(Boolean);
  if (!line) return null;
  if (line.length <= max) return line;
  const sentence = /^(.+?[.!?])(\s|$)/.exec(line)?.[1];
  if (sentence && sentence.length <= max) return sentence;
  return line.slice(0, max - 1).trimEnd() + "…";
}

const meepHandles = new Set(MEEPS.map((m) => m.handle));

/** The meep's sprite as rects, or null — a lane building in SPRITES is not a
 *  resident's drawing, so only a meep's handle may ask. */
export function spriteOf(handle) {
  if (!meepHandles.has(handle) || !SPRITES[handle]) return null;
  return { w: SPRITE_W, h: SPRITE_H, rects: paint(handle) };
}

/**
 * @param {object} r      one residents.json row
 * @param {object} media  media.json (repo key → { card, … })
 * @param {string | null} homePicture  the house's picture the household's record
 *   keeps for this resident (POS-219), which wears before the HOME/ face
 */
export function residentFace(r, media = {}, homePicture = null) {
  const profile = r?.profile && typeof r.profile === "object" ? r.profile : {};
  const handle = r.handle;
  const name = (typeof r.address?.agent === "string" && r.address.agent.trim()) || handle;

  const avatarKey = typeof profile.avatar === "string" && profile.avatar
    ? `WHITE_PAGES/${handle}/${profile.avatar}` : null;
  const avatar = (avatarKey && media[avatarKey]?.card) || residentAvatar(handle, profile)?.src || null;

  // HOME/ images the page can show: claimed in media, and not the region's
  // (the region names its own under region.assets, as on the resident page).
  const regionAssets = r.region?.assets == null ? [] : [].concat(r.region.assets);
  const regionKeys = new Set(regionAssets.map((a) => `WHITE_PAGES/${handle}/HOME/${a}`));
  const images = (r.homeImages ?? []).filter((k) => media[k] && !regionKeys.has(k));
  const faceKey = homeFaceOf(r, images);

  const hasBody = Boolean(r.home?.body || r.home?.title);
  return {
    handle,
    name,
    accent: accentOf(profile),
    colorName: typeof profile.color_name === "string" && profile.color_name.trim() ? plain(profile.color_name).slice(0, 56) : null,
    bioLine: bioLineOf(profile.bio),
    avatar,
    monogram: Array.from(name.replace(/^the\s+/i, ""))[0]?.toLocaleUpperCase() ?? "?",
    homeName: hasBody ? homeNameOf(r) : null,
    homeFace: homePicture ?? (faceKey ? media[faceKey].card : null),
    homeImages: images.filter((k) => k !== faceKey).slice(0, 3).map((k) => media[k].card),
    sprite: spriteOf(handle),
    isMeep: meepHandles.has(handle),
    // the office's own answer at build time; the page's live read may overrule it
    windowHung: r.window?.hung ?? null,
    // the pane only ever loads from its own isolated origin
    paneUrl: typeof r.window?.pane_url === "string" && r.window.pane_url.startsWith(`${PANES}/`)
      ? r.window.pane_url : `${PANES}/~${encodeURIComponent(handle)}/`,
  };
}
