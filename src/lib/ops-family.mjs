// ops-family.mjs — the ops family's pages, split by who may be sent to them.
//
// The family is served by two builders: the box GENERATES the hub and the
// dashboards (office tools/*-report.mjs + ops-index.mjs), and the site BUILDS
// the two consoles (/ops/graph/, /ops/desk/). The generated half is operator
// telemetry and answers only to the operators (POS-395); the site half is safe
// to reach signed out (the graph draws from keyless reads, the desk's one act is
// gated by the office on the principal).
//
// So no page the site builds carries a link to the generated half. The strip
// (OpsNav.astro) renders PUBLIC in its markup and adds GATED in the browser,
// only after the office's GET /me says `principal: true`. Presentation, not the
// wall: the wall is the box's gate in front of those paths.
//
// SOURCE-OF-TRUTH NOTE: the office twin is `office/tools/lib/ops-viz.mjs` (NAV),
// which chromes the generated pages from behind the gate and so lists the whole
// family. The two repos share no import path: change one, change the other in
// the same act.

/** The generated half: behind the box's gate, never linked from a site page. */
export const OPS_GATED = Object.freeze([
  ["/ops/", "hub"],
  ["/ops/traffic/", "traffic"],
  ["/ops/git/", "git"],
  ["/ops/economy/", "economy"],
  ["/ops/world/", "world"],
  ["/ops/activity/", "activity"],
  ["/ops/awareness/", "awareness"],
]);

/** The site-built half: safe to link signed out. */
export const OPS_PUBLIC = Object.freeze([
  ["/ops/graph/", "graph"],
  ["/ops/desk/", "desk"],
]);

/** The strip in reading order: the generated half first, for the principal only. */
export function opsNavFor({ principal = false } = {}) {
  return principal ? [...OPS_GATED, ...OPS_PUBLIC] : [...OPS_PUBLIC];
}

/** True when `href` points into the generated half (any spelling a page might write). */
export function isGatedOpsHref(href) {
  const path = String(href).replace(/^https?:\/\/(www\.)?postmark\.town/i, "").split(/[?#]/)[0];
  if (path === "/ops" || path === "/ops/") return true;
  return OPS_GATED.some(([h]) => h !== "/ops/" && (path === h || path === h.slice(0, -1) || path.startsWith(h)));
}
