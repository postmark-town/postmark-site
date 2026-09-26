// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import worldEngineIsland from './town/scripts/world-engine-island.mjs';

// The TOWN build — the Postmark pages served at the postmark.town ROOT.
//
// One repo, two outputs. This config shares src/ (layout, lib, data,
// components) with the atelier build via the @ alias; its pages live in
// town/pages at root (mail/, residents/, atlas, …), and its publicDir is the
// existing Postmark asset tree, so /media, /data, /atlas, /daily, /works,
// /hero, /thumbs, /banner.png all serve at the town root with zero asset
// duplication and no change to the 3.1 data pipeline.
//
// Build: `astro build --config astro.config.town.mjs` (see package.json
// build:town). The atelier build (astro.config.mjs) is unchanged.
//
// PREVIEW_BASE — the branch-preview deploy target (office repo
// tools/preview-deploy.mjs) sets this to `/preview/<branch>/` so a branch
// build's bundled assets (the CSS/JS under _astro/) resolve under that path
// instead of the root. Unset → no prefix, so the normal town build (and the
// deploy.yml CI build, which never sets it) is byte-identical to before.
//
// Why `build.assetsPrefix` and not Astro `base`: base rewrites routing, and
// Astro 6.4.0's static build fails to strip the base prefix from the pathname
// before matching it against a route pattern (core/render/params-and-props.js
// getParams) — so EVERY prerendered getStaticPaths route throws "Missing
// parameter" and the whole town build dies (verified: base '/' builds 912
// pages, base '/preview/x/' builds 7). assetsPrefix touches only the emitted
// asset URLs, never routing, so the build completes AND the bundled CSS/JS
// load under the preview path — the exact win base was meant to give, without
// the bug. Caveat, same as base would have: hand-written root-relative refs
// (/data, /media, nav hrefs) still resolve to prod on a preview, which is fine
// for reveal-bundle QA (the render is driven by the bundled assets that DO get
// the prefix).
const PREVIEW_BASE = process.env.PREVIEW_BASE || '';
const DEV = process.argv.includes('dev');

export default defineConfig({
  site: 'https://postmark.town',
  ...(PREVIEW_BASE ? { build: { assetsPrefix: PREVIEW_BASE } } : {}),
  srcDir: 'town',
  publicDir: 'public/atelier/postmark',
  outDir: 'dist-town',
  // Internal navigation warms on intent without spending bandwidth on every
  // visible link; Astro automatically skips off-site and current-page targets.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // stage the told-world viewer + engine at /world-engine/** from the postmark-world
  // package (build output + dev middleware) so /world serves the SAME file locally
  integrations: [worldEngineIsland()],
  // NO `redirects` HERE. Every moved URL lives in ONE table, `MOVED` in
  // src/lib/nav.mjs, and town/pages/[...moved].astro builds its forwarding
  // pages — because this config's meta refresh drops the #fragment, and letters
  // link /stamps/#board. The entries that stood here (/archive/, /board/,
  // /stamps/guide/) are rows of that table now, with their reasons beside them.
  vite: {
    ...(DEV ? {
      server: {
        proxy: {
          '/api': {
            target: 'https://postmark.town/api',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ''),
          },
        },
      },
    } : {}),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});
