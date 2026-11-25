// atlas-frozen-notice.mjs — the words the Atlas MAP page carries now that the Atlas is frozen (CORE-166, parent CORE-162; Darko 2026-11-23 09:50 EST).
//
// /atlas/town.html is the town's own drawing, regenerated twice a day, and the site's extractor (tools/extract-town.mjs) DECORATES it on the way in (the site doors,
// the image rewrites). This is the same kind of decoration: it adds a plain notice under the map's own header, so the next canonical regeneration keeps it, and the
// generated HTML is never patched by hand. Decorate, never redraw: the notice is an ordinary block in the page's flow (not fixed, not over the map), so it hides no
// control; its link is a site door (`target="_top"`, as the doors are, because the atlas lives in an iframe on /atlas/).
//
// PURE: a string in, a string out. It is idempotent (the marker below), so a second pass over its own output is a no-op and the words never double.

export const FROZEN_WORDS = "This map stopped changing in September 2026. Homes placed since then are on the World map.";
/** the attribute that marks the notice, so a second pass finds it and adds nothing */
export const FROZEN_MARK = "data-frozen-notice";

const NOTICE = `<p class="frozen-notice" ${FROZEN_MARK} role="note">This map stopped changing in September 2026. Homes placed since then are on the <a href="/world/" target="_top">World map</a>.</p>`;
const STYLE = `<style>
.frozen-notice { max-width: 40rem; margin: 0 auto 1.4rem; padding: .65rem 1rem; text-align: center; font-size: .95rem; line-height: 1.5; color: #e9dfc4;
  background: rgba(232, 196, 139, 0.08); border: 1px solid rgba(201, 163, 90, 0.5); border-radius: 8px; }
.frozen-notice a { color: #f6dcae; text-decoration: underline; }
.frozen-notice a:hover, .frozen-notice a:focus-visible { color: #fff2d4; }
</style>`;

/**
 * The canonical map page with the notice added right after its header. Throws (the extractor makes that a FATAL, like its other decoration hooks) when the page no
 * longer has exactly one `</header>` to place it under, so a layout change upstream is said, not silently skipped.
 */
export function decorateFrozenNotice(html) {
  const src = String(html);
  if (src.includes(FROZEN_MARK)) return src;
  const at = src.indexOf("</header>");
  if (at === -1 || src.indexOf("</header>", at + 1) !== -1) {
    throw new Error("atlas town.html no longer has exactly one </header>: the frozen notice has nowhere to sit; teach tools/lib/atlas-frozen-notice.mjs the new layout");
  }
  const end = at + "</header>".length;
  return `${src.slice(0, end)}\n  ${STYLE}\n  ${NOTICE}${src.slice(end)}`;
}
