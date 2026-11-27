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
      // the element's own title (a hero line's "…'s window") stays unless the mention brings one (a long name's whole)
      for (const k of ["class", "style", "data-rm"]) el.removeAttribute?.(k);
      for (const [k, v] of Object.entries(root.attrs)) if (k !== "href" || !el.getAttribute?.("href")) el.setAttribute(k, v);
      while (el.firstChild) el.removeChild(el.firstChild);
      while (fresh.firstChild) el.appendChild(fresh.firstChild);
      return true;
    } catch { return false; }
  };
  const restyleFromMeta = (el, handle, meta, href, opts) => restyle(el, handle, speakerFace(meta), href, opts);
  return Object.freeze({ node, fromMeta, restyle, restyleFromMeta });
}

/**
 * THE LOAD ORDER (Facet, CORE-178: a fast data answer and a late module left known residents plain for good). An inline script that drew a resident
 * before the bridge was here draws its plain text and marks it: `data-rm-pending` (the handle), and what it already holds for them, `data-rm-face`
 * (a face, JSON) or `data-rm-meta` (a residents-meta row, JSON), with `data-rm-opts` (the mention's options, JSON) and, for an element that is not a
 * link, `data-rm-href`. When the bridge arrives, PostmarkLayout calls this once, before it says `pm:mention-ready`: every marked element becomes the
 * mention IN PLACE (the same element, so its link and its focus stay), with no second read of anything. One it can't draw stays as it was, plain:
 * the honest floor. Returns how many it drew.
 */
export const PENDING = ["data-rm-pending", "data-rm-face", "data-rm-meta", "data-rm-opts", "data-rm-href"];
export function upgradePending(root, bridge) {
  if (!root || typeof root.querySelectorAll !== "function" || !bridge) return 0;
  const json = (el, k) => { try { return JSON.parse(el.getAttribute(k) || "null"); } catch { return null; } };
  let n = 0;
  for (const el of root.querySelectorAll("[data-rm-pending]")) {
    const handle = el.getAttribute("data-rm-pending");
    const opts = json(el, "data-rm-opts") ?? {};
    const href = el.getAttribute("href") || el.getAttribute("data-rm-href") || null;
    const meta = json(el, "data-rm-meta");
    const ok = meta ? bridge.restyleFromMeta(el, handle, meta, href, opts) : bridge.restyle(el, handle, json(el, "data-rm-face"), href, opts);
    if (!ok) continue;
    for (const k of PENDING) el.removeAttribute(k);
    n++;
  }
  return n;
}
