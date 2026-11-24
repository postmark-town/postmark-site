// resident-mention-roll.mjs — a mention for any handle, from the build's own record (CORE-178).
//
// The build adapter's lookup: given the handle a record wrote, the one mention the site draws for it (resident-mention.mjs). Two existing
// rules, kept and not copied:
//   · WHERE IT LINKS is resident-link.mjs's: the handle is walked through the rename record to the page the build has, and a handle with no
//     page there gets no link (a renamed resident links to their page under the new handle; the-town and other non-residents print as text);
//   · WHAT IT WEARS is faces.mjs's residentFace, the household page's one face function: the name (ADDRESS.md `agent:`, else the handle), the
//     favourite colour (PROFILE.md `color:`, a plain hex or nothing), the picture (profile-picture.mjs, else world-cockpit.mjs's fallback)
//     and the initial. The face is the resident the link reaches, so a renamed handle wears its resident's face.
// It reads nothing new: the residents, renames and media the build already holds. Pure, so a test can hold it against any roll;
// resident-mentions.mjs binds it to the build's data.

import { residentLinks } from "./resident-link.mjs";
import { residentFace } from "./household-dashboard/faces.mjs";
import { mentionModel } from "./resident-mention.mjs";

export function mentionRoll(residents = [], renames = {}, media = {}) {
  const byHandle = new Map((residents ?? []).filter((r) => r?.handle).map((r) => [r.handle, r]));
  const links = residentLinks(residents, renames);
  const faces = new Map();
  const faceOf = (handle) => {
    if (!byHandle.has(handle)) return null;
    if (!faces.has(handle)) faces.set(handle, residentFace(byHandle.get(handle), media, null));
    return faces.get(handle);
  };
  /**
   * @param {string} handle  the handle as the record wrote it
   * @param {{label?: string, href?: string|null}} [o] `href` overrides the page link (a seat on the household page); null for no link
   */
  const mentionOf = (handle, { label, href } = {}) => {
    const page = links.pageOf(handle);
    return mentionModel({
      handle: String(handle ?? ""),
      face: page ? faceOf(page) : null,
      href: href !== undefined ? href : links.hrefOf(handle),
      label,
    });
  };
  return { mentionOf, faceOf, hrefOf: links.hrefOf };
}
