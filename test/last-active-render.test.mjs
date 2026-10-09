// last-active-render.test.mjs — the words render on the card and the resident's tab (POS-481 review, S3).
//
//   node --test test/last-active-render.test.mjs
//
// test/last-active.test.mjs proves the fields and the words; this proves the
// PAGE carries them. ResidentCard (the /households/ directory and its search)
// and the resident's tab in Household.astro (/residents/<h>/) are rendered
// through Astro's own pipeline (the town config's Vite, the container API)
// from a residents.json-shaped row, as #445's card makes it. No dist and no
// network: it runs wherever `npm test` does.
//
// Falsifier (POS-481 review S3): blank ROW.last_active_crossing and both
// assertions of "· crossing 236" go red.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORDS = "active Oct 6 · crossing 236";
// a residents.json row as tools/lib/fetch-town-data.mjs § mapResident writes it from a #445 card
const ROW = {
  handle: "pos481-render", profile: {}, address: { agent: "Render Fixture", joined: "2026-07-01", body: "# Render Fixture\n\nA row for the render test." },
  home: null, region: null, homeImages: [], counts: { received: 1, sent: 2 }, is_office: false, window: null, marks: null,
  last_active: "2026-10-06T08:00:00.000Z", last_active_crossing: 236,
};

let server = null, container = null;

// A pipeline that cannot start FAILS the file rather than skipping it: a skip
// would read as a pass and hide the falsifier.
before(async () => {
  const { createServer } = await import("vite");
  const { getViteConfig } = await import("astro/config");
  const cfg = await getViteConfig({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" },
    { root: ROOT, configFile: "astro.config.town.mjs" } /* relative: Astro resolves it against root */)({ mode: "test", command: "serve" });
  server = await createServer(cfg);
  const { experimental_AstroContainer } = await import("astro/container");
  container = await experimental_AstroContainer.create();
});

after(async () => { if (server) await server.close(); });

const text = (html, attr) => (new RegExp(`${attr}[^>]*>([^<]*)<`).exec(html) ?? [])[1] ?? null;

test("the directory's card carries the words", async () => {
  const { default: Card } = await server.ssrLoadModule("/src/components/ResidentCard.astro");
  const html = await container.renderToString(Card, { props: { r: ROW } });
  assert.equal(text(html, "data-res-active"), WORDS);
});

test("the resident's tab carries the words", async () => {
  const { default: House } = await server.ssrLoadModule("/town/components/Household.astro");
  const html = await container.renderToString(House, {
    props: { house: { slug: null, declared: false, residents: [ROW.handle], arriving: [] }, members: [ROW], active: ROW.handle, route: "resident" },
  });
  assert.equal(text(html, "data-profile-active"), WORDS);
});

test("a row the office did not say renders no words at all", async () => {
  const { default: Card } = await server.ssrLoadModule("/src/components/ResidentCard.astro");
  const { last_active, last_active_crossing, ...unsaid } = ROW;
  const html = await container.renderToString(Card, { props: { r: unsaid } });
  assert.equal(text(html, "data-res-active"), null);
});
