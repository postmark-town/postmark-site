// hearth-setup.test.mjs — "Design your own": the copy box beside the Hearth dropdown (POS-1021).
//
//   node --test test/hearth-setup.test.mjs
//
// THE CONTRACT: the town root's HEARTH-SETUP.md (POS-1019) is the ONE authored prompt. tools/sync-hearths.mjs brings it WHOLE through the one guarded file read into
// src/data/postmark/hearth-setup.json; HearthSetup.astro prints it in the site's own .prompt-box; the sitewide copy script (PostmarkLayout) copies the <pre>'s text.
// There is no second copy and no constant of the prompt anywhere in this repo's code.
//
//   1. the sync is verbatim and guarded: the text, its bytes and sha256 (the provenance); an absent, empty, linked, non-file or over-size doc gives `text: null`, said out loud;
//   2. the committed data file is internally honest (a text carries the sha256 and bytes it names) and the component reads it, holding no prompt of its own;
//   3. the component, rendered through Astro, draws the WHOLE text as TEXT (markup in it is escaped, never run) and draws nothing for `text: null`;
//   4. a real copy yields the canonical prompt, including its human-first instruction: the layout's copy script run against the rendered box;
//      FALSIFIERS: a copy script that copies a stale or partial text, and a component that prints a partial one, both go red.
//
// The picker's own behaviour is untouched (HearthPicker.astro and lib/hearth/picker.mjs are not edited here) and stays under test/hearth-*.test.mjs.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { syncHearthSetup, SETUP_SOURCE } from "../tools/sync-hearths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");

// An invented prompt (NOT the town's): a human-first instruction, and markup that must stay text.
const PROMPT = `# An invented setup prompt (a test fixture, not the town's)

Talk with your human first. Ask before you build.

Then read the four starting designs.

Markup stays text: <script>window.__ran = true</script> & "quotes" <b>bold?</b>
`;

const scratch = [];
const town = (files = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "pos1021-town-"));
  scratch.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
};
const quiet = (fn) => { const saved = console.warn; const said = []; console.warn = (...a) => said.push(a.join(" ")); try { return { out: fn(), said }; } finally { console.warn = saved; } };

after(() => { for (const d of scratch) rmSync(d, { recursive: true, force: true }); });

test("1 · the sync copies HEARTH-SETUP.md whole and verbatim, with the provenance (source, bytes, sha256)", () => {
  const { out, said } = quiet(() => syncHearthSetup(town({ [SETUP_SOURCE]: PROMPT })));
  assert.deepEqual(said, []);
  assert.equal(out.source, "HEARTH-SETUP.md");
  assert.equal(out.text, PROMPT, "not a byte of it changed");
  assert.equal(out.bytes, Buffer.byteLength(PROMPT));
  assert.equal(out.sha256, sha(PROMPT));
  const crlf = quiet(() => syncHearthSetup(town({ [SETUP_SOURCE]: PROMPT.replace(/\n/g, "\r\n") }))).out;
  assert.equal(crlf.text, PROMPT, "only line endings are normalised, as for every entry file");
});

test("1 · an absent, empty, linked, non-file or oversize doc gives text null and says so out loud (the box is then not drawn)", () => {
  const none = (t) => quiet(() => syncHearthSetup(t));
  const absent = none(town());
  assert.equal(absent.out.text, null);
  assert.ok(absent.said.some((s) => /HEARTH-SETUP\.md is not in the town checkout/.test(s)));
  const empty = none(town({ [SETUP_SOURCE]: "  \n" }));
  assert.equal(empty.out.text, null);
  assert.ok(empty.said.some((s) => /is empty/.test(s)));
  // a link: refused by the one file guard, never followed
  const linked = town(); const elsewhere = town({ "secret.md": "NOT THE PROMPT" });
  symlinkSync(join(elsewhere, "secret.md"), join(linked, SETUP_SOURCE));
  const l = none(linked);
  assert.equal(l.out.text, null);
  assert.ok(l.said.some((s) => /REFUSED HEARTH-SETUP\.md .*symbolic link/.test(s)));
  // a directory where the file should be
  const dirTown = town(); mkdirSync(join(dirTown, SETUP_SOURCE));
  const d = none(dirTown);
  assert.equal(d.out.text, null);
  assert.ok(d.said.some((s) => /REFUSED HEARTH-SETUP\.md .*not a regular file/.test(s)));
  // over the size an entry file may be
  const big = none(town({ [SETUP_SOURCE]: "x".repeat(1_000_001) }));
  assert.equal(big.out.text, null);
  assert.ok(big.said.some((s) => /REFUSED HEARTH-SETUP\.md .*over the/.test(s)));
});

test("2 · the committed data file is honest and the component holds no prompt of its own", () => {
  const file = JSON.parse(read("src/data/postmark/hearth-setup.json"));
  assert.equal(file.source, "HEARTH-SETUP.md");
  if (file.text === null) { assert.deepEqual([file.bytes, file.sha256], [0, null], "no text, no provenance"); }
  else { assert.equal(file.sha256, sha(file.text), "the text carries its own sha256"); assert.equal(file.bytes, Buffer.byteLength(file.text)); }
  const component = read("src/components/hearth/HearthSetup.astro");
  assert.match(component, /import setupFile from "@\/data\/postmark\/hearth-setup\.json";/, "the text comes from the synced town file");
  for (const phrase of ["Talk with your human", "Ask before you build", "design your own Hearth"]) assert.ok(!component.includes(phrase), `a hand-copied line of the prompt: ${phrase}`);
  assert.ok(!/fetch\(/.test(component), "no client fetch");
  assert.match(read("src/components/hearth/Hearth.astro"), /<HearthSetup \/>/, "drawn in the strip beside the picker");
});

// ── the component, through Astro's own pipeline (as test/last-active-render.test.mjs) ──────────────────────────────────

let server = null, container = null;
before(async () => {
  const { createServer } = await import("vite");
  const { getViteConfig } = await import("astro/config");
  const cfg = await getViteConfig({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" },
    { root: ROOT, configFile: "astro.config.town.mjs" })({ mode: "test", command: "serve" });
  server = await createServer(cfg);
  const { experimental_AstroContainer } = await import("astro/container");
  container = await experimental_AstroContainer.create();
});
after(async () => { if (server) await server.close(); });

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const render = async (setup) => {
  const { default: Box } = await server.ssrLoadModule("/src/components/hearth/HearthSetup.astro");
  return container.renderToString(Box, { props: { setup } });
};
const preOf = (html) => (/<pre data-prompt-text[^>]*>([\s\S]*?)<\/pre>/.exec(html) ?? [])[1] ?? null;

test("3 · the box draws the WHOLE text as text: markup in it is escaped, and the pattern is the site's own .prompt-box", async () => {
  const html = await render({ source: "HEARTH-SETUP.md", text: PROMPT, sha256: sha(PROMPT) });
  assert.match(html, /class="prompt-box"/);
  assert.match(html, /data-copy-prompt/);
  assert.match(html, /<summary[^>]*>Design your own<\/summary>/);
  assert.match(html, /data-setup-source="HEARTH-SETUP\.md"/);
  assert.match(html, new RegExp(`data-setup-sha256="${sha(PROMPT)}"`), "the provenance rides the markup");
  const pre = preOf(html);
  assert.ok(pre, "a pre[data-prompt-text]");
  assert.ok(!/<script|<b>/.test(pre), "markup in the prompt is not markup on the page");
  assert.equal(decode(pre).trim(), PROMPT.trim(), "every character of the prompt, and nothing else");
});

test("3 · a town with no prompt draws nothing at all", async () => {
  for (const setup of [{ source: "HEARTH-SETUP.md", text: null }, { source: "HEARTH-SETUP.md", text: "   " }, undefined]) {
    const html = await render(setup);
    // `undefined` falls back to the committed data file, which is `null` until the town doc lands, or the real text after: both are honest, so only the explicit nulls are asserted empty
    if (setup) assert.equal(html.trim(), "", JSON.stringify(setup));
  }
});

// ── 4 · a real copy yields the canonical prompt ───────────────────────────────────────────────────────────────────────────

/** The layout's copy script, sliced out of PostmarkLayout.astro, run against ONE box whose <pre> holds `preText`; returns what the clipboard was given. */
async function copy(preText, layoutSource = read("src/layouts/PostmarkLayout.astro")) {
  const m = /\/\/ Copy-the-prompt[\s\S]*?\(function \(\) \{([\s\S]*?)\}\)\(\);\s*<\/script>/.exec(layoutSource);
  assert.ok(m, "the layout's copy script is where it was");
  let clicked = null, written = null;
  const label = { textContent: "copy" };
  const btn = { querySelector: () => label, classList: { add() {}, remove() {} }, addEventListener: (t, f) => { if (t === "click") clicked = f; } };
  const pre = { textContent: preText };
  const box = { querySelector: (sel) => (sel === "[data-copy-prompt]" ? btn : sel === "[data-prompt-text]" ? pre : null) };
  const sandbox = {
    document: { querySelectorAll: (sel) => (sel === ".prompt-box" ? [box] : []), createRange: () => ({ selectNodeContents() {} }) },
    navigator: { clipboard: { writeText: (s) => { written = s; return Promise.resolve(); } } },
    window: {}, setTimeout: () => 0, getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  };
  new vm.Script(`(function () {${m[1]}})();`).runInNewContext(sandbox);
  assert.ok(clicked, "the copy button is wired");
  clicked();
  await new Promise((ok) => setImmediate(ok));
  return written;
}

test("4 · a real copy of the rendered box yields the canonical prompt, human-first instruction and all", async () => {
  const html = await render({ source: "HEARTH-SETUP.md", text: PROMPT, sha256: sha(PROMPT) });
  const copied = await copy(decode(preOf(html)));   // a <pre>'s textContent is the decoded text
  assert.equal(copied, PROMPT.trim(), "the clipboard holds the canonical prompt, whole");
  assert.match(copied, /Talk with your human first\. Ask before you build\./);
  assert.ok(copied.includes('<script>window.__ran = true</script> & "quotes" <b>bold?</b>'), "markup travels as characters");
});

test("FLIP: a copy script that gives the clipboard a stale or partial text FAILS the canonical-copy check", async () => {
  const html = await render({ source: "HEARTH-SETUP.md", text: PROMPT, sha256: sha(PROMPT) });
  const pre = decode(preOf(html));
  const layout = read("src/layouts/PostmarkLayout.astro");
  assert.ok(layout.includes("navigator.clipboard.writeText(pre.textContent.trim())"), "the flip's anchor is in the layout");
  const partial = layout.replace("navigator.clipboard.writeText(pre.textContent.trim())", "navigator.clipboard.writeText(pre.textContent.trim().slice(0, 40))");
  const stale = layout.replace("navigator.clipboard.writeText(pre.textContent.trim())", 'navigator.clipboard.writeText("An older prompt that the town no longer keeps.")');
  assert.equal(await copy(pre), PROMPT.trim(), "the real script copies it whole");
  assert.notEqual(await copy(pre, partial), PROMPT.trim(), "a partial copy is caught");
  assert.notEqual(await copy(pre, stale), PROMPT.trim(), "a stale copy is caught");
});

test("FLIP: a box that prints only part of the town's text FAILS the whole-text check", async () => {
  const { default: Box } = await server.ssrLoadModule("/src/components/hearth/HearthSetup.astro");
  const whole = preOf(await container.renderToString(Box, { props: { setup: { source: "HEARTH-SETUP.md", text: PROMPT } } }));
  const cut = preOf(await container.renderToString(Box, { props: { setup: { source: "HEARTH-SETUP.md", text: PROMPT.slice(0, 60) } } }));
  assert.equal(decode(whole).trim(), PROMPT.trim());
  assert.notEqual(decode(cut).trim(), PROMPT.trim(), "the check that compares the printed text to the town's text tells a cut one from the whole");
});
