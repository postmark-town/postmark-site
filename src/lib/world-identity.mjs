// world-identity.mjs — the site's one resident mention, handed to the World page's viewer as each speaker's identity (CORE-178; World WLD-249).
//
// THE AGREED SHAPE (Facet accepted it on WLD-249, 2026-11-24, relayed ~19:1xZ; Bevel's to build): the viewer module the World page's own shell runs
// exports `setViewerIdentityForSpeaker(appEl, provider|null)`. Called on THE SAME served module instance as the shell (the World page emits the
// World's spectator shell verbatim, which imports `/world-engine/spectator/viewer.mjs` and mounts it on `#app`; an import of the same URL is that
// instance), in either arrival order, it hands the viewer's internal column and readers the host's whole identity; a repeated call with the same
// function invalidates changed backing data; null restores the defaults.
//
// THE FLOOR. The installed World does not export it yet (WLD-249 is not built or published). Without it this does nothing and says so: the viewer
// keeps its own face and name path. No second viewer bundle, no patch of the viewer's DOM, no remount, no new read.
//
// The provider is resident-identity.mjs § identityProvider over the faces the page already holds: the site's one renderer and its human handling.

import { identityProvider } from "./resident-identity.mjs";

/** The viewer module the World page's shell imports: the same URL, so the same instance. */
export const VIEWER_URL = "/world-engine/spectator/viewer.mjs";

/**
 * @param {{ doc: Document, app: Element | null, faces: object | null, importViewer: () => Promise<object>, toFace?: (row: object) => object | null,
 *   aliases?: Record<string, string> | null }} o  `aliases`: the build's renames (resident-mentions.mjs § mentionAliases), so an old handle wears its
 *   resident's current face and page
 * @returns {Promise<{ ok: true } | { ok: false, why: string }>}
 */
export async function attachViewerIdentity({ doc, app, faces, importViewer, toFace, aliases = null } = {}) {
  if (!app) return { ok: false, why: "no viewer root on this page" };
  let mod = null;
  try { mod = await importViewer(); } catch { return { ok: false, why: "the viewer module could not be loaded" }; }
  if (typeof mod?.setViewerIdentityForSpeaker !== "function") return { ok: false, why: "the installed viewer has no setViewerIdentityForSpeaker yet (WLD-249)" };
  try {
    mod.setViewerIdentityForSpeaker(app, identityProvider(doc, () => faces, { ...(toFace ? { toFace } : {}), aliases }));
    return { ok: true };
  } catch {
    return { ok: false, why: "the viewer refused the identity" };
  }
}
