// resident-mention-bridge.mjs — the site's one resident mention, for the page scripts that can't import a module (CORE-178).
//
// Several pages draw resident names from `is:inline` scripts (the replay's live feed, the Conversations page's lists, the household page's quest
// lines, the window street, the front page's hero line). An inline script is not bundled, so it can't import resident-mention.mjs. Facet's ruling
// (CORE-178, 17:38Z): "POS531 preserves non-resident plain text; it does not prohibit imports … through only the bounded shared-module adapter/bridge
// work needed". So PostmarkLayout's one bundled script hands this object to `window.__pmMention`, and each inline script calls it; where it is not
// there yet, or answers null, the script keeps the plain text it always drew.
//
// It adds no format: every answer is resident-mention.mjs § mentionModel + mentionNode, and a residents-meta row goes through
// resident-identity.mjs § speakerFace (the World's own picture rule). A non-resident (no face and no page), a house's human, or bad input is null:
// the caller's plain text stands.

import { mentionModel, mentionNode, mentionTree } from "./resident-mention.mjs";
import { speakerFace } from "./resident-identity.mjs";

/** @param {Document} doc */
export function mentionBridge(doc) {
  const model = (handle, face, href) => mentionModel({ handle: String(handle ?? ""), face: face ?? null, href: typeof href === "string" && href ? href : null });
  /** A fresh mention element, or null (the caller keeps its plain text). */
  const node = (handle, face, href, opts) => {
    try {
      const m = model(handle, face, href);
      return m.kind === "resident" ? mentionNode(doc, m, opts) : null;
    } catch { return null; }
  };
  /** The same, from a residents-meta row ({ name, avatar, color }). */
  const fromMeta = (handle, meta, href, opts) => node(handle, speakerFace(meta), href, opts);
  /**
   * Make an EXISTING element the mention, in place: its attributes and children become the mention's, the element stays (so a link that holds the
   * focus keeps it). True when it did; false leaves the element exactly as it was.
   */
  const restyle = (el, handle, face, href, opts) => {
    try {
      const m = model(handle, face, href);
      if (!el || m.kind !== "resident") return false;
      const [root] = mentionTree(m, { ...opts, link: el.tagName === "A" || el.tagName === "a" });
      const fresh = mentionNode(doc, m, { ...opts, link: el.tagName === "A" || el.tagName === "a" });
      for (const k of ["class", "style", "title", "data-rm"]) el.removeAttribute?.(k);
      for (const [k, v] of Object.entries(root.attrs)) if (k !== "href" || !el.getAttribute?.("href")) el.setAttribute(k, v);
      while (el.firstChild) el.removeChild(el.firstChild);
      while (fresh.firstChild) el.appendChild(fresh.firstChild);
      return true;
    } catch { return false; }
  };
  const restyleFromMeta = (el, handle, meta, href, opts) => restyle(el, handle, speakerFace(meta), href, opts);
  return Object.freeze({ node, fromMeta, restyle, restyleFromMeta });
}
