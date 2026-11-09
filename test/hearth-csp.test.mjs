// hearth-csp.test.mjs — the Hearth page's security policy: what it allows, where it sits, and that it governs ONLY the Hearth (POS-959).
//
// Darko (2026-11-01 15:54 EST) ruled "inline scripts forbidden by the page's security policy"; Wright (2026-11-09 00:38) ruled
// the shape: a Hearth-scoped meta policy in the repo, hashes for the host's inline scripts, the page's only policy, no edge
// or global one. tools/lib/hearth-csp.mjs writes it; town/scripts/hearth-csp.mjs applies it to the built pages. The walk
// (qa-shots/hearth-walk.mjs) proves in a real browser that the host's controls still work under it and an injected inline
// handler or script does not run.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { inlineScripts, hearthPolicy, withHearthPolicy, hearthPages } from "../tools/lib/hearth-csp.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist-town");
const built = fs.existsSync(path.join(DIST, "households"));
const sha = (t) => "sha256-" + createHash("sha256").update(t, "utf8").digest("base64");

const PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>x</title>
<script>var a = 1;</script><script type="module">import "./x.js";</script><script src="/_astro/a.js" type="module"></script>
<script type="application/json" data-x>{"a":"</s"}</script><script type="application/ld+json">{}</script><script type="text/javascript">window.b=2</script>
</head><body><script>var a = 1;</script></body></html>`;

test("inlineScripts: the inline scripts a page would execute, hashed from their exact text; external scripts and data blocks are not", () => {
  const s = inlineScripts(PAGE);
  assert.deepEqual(s.map((x) => x.text), ["var a = 1;", 'import "./x.js";', "window.b=2", "var a = 1;"]);
  assert.equal(s[0].hash, sha("var a = 1;"));
  assert.equal(s[0].hash, s[3].hash, "the same text hashes the same");
  assert.deepEqual(inlineScripts("<p>none</p><script src=x></script>"), []);
});

test("the policy: scripts are 'self' and hashes only: no inline, eval, hashes-of-attributes, data:, blob:, https: or wildcard for script", () => {
  const p = hearthPolicy([sha("b"), sha("a"), sha("a")]);
  const script = /(?:^|; )script-src ([^;]*)/.exec(p)[1].split(" ");
  assert.deepEqual(script, ["'self'", `'${sha("a")}'`, `'${sha("b")}'`].sort((x, y) => (x === "'self'" ? -1 : y === "'self'" ? 1 : x < y ? -1 : 1)), "self, then each distinct hash once, sorted");
  for (const t of script) assert.ok(t === "'self'" || /^'sha256-[A-Za-z0-9+/]+={0,2}'$/.test(t), `an unexpected script source: ${t}`);
  assert.ok(!/unsafe-inline|unsafe-eval|unsafe-hashes|strict-dynamic|nonce-/.test(script.join(" ")));
  const dirs = Object.fromEntries(p.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1).join(" ")]));
  assert.equal(dirs["default-src"], "'self'");
  assert.equal(dirs["object-src"], "'none'");
  assert.equal(dirs["frame-src"], "'none'");
  assert.equal(dirs["base-uri"], "'self'");
  assert.equal(dirs["form-action"], "'self'");
  assert.equal(dirs["connect-src"], "'self' https://postmark.town", "the page may reach its own origin and the office's API, and nothing else");
  assert.ok(!/\*/.test(p), "no wildcard anywhere");
  assert.ok(!/["<>]/.test(p), "it can sit in a quoted attribute");
});

test("withHearthPolicy: the meta goes right after the charset, before any script, and every inline script is covered", () => {
  const out = withHearthPolicy(PAGE);
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(out);
  assert.ok(meta);
  assert.ok(out.indexOf(meta[0]) < out.search(/<script\b/), "before the first script");
  assert.ok(out.startsWith('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv='));
  for (const s of inlineScripts(PAGE)) assert.ok(meta[1].includes(`'${s.hash}'`), "covers " + s.text);
  assert.equal((out.match(/Content-Security-Policy/g) ?? []).length, 1);
  assert.equal(out.replace(meta[0], ""), PAGE, "nothing else in the page changed");
});

test("withHearthPolicy refuses a page that already has a policy (this is the page's only one) or has no head", () => {
  assert.throws(() => withHearthPolicy(withHearthPolicy(PAGE)), /already carries a security policy/);
  assert.throws(() => withHearthPolicy(`<meta http-equiv='content-security-policy' content="x"><head></head>`), /already carries/);
  assert.throws(() => withHearthPolicy("<p>no head</p>"), /no <head>/);
});

test("hearthPages: only households/<slug>/hearth/index.html", () => {
  const tree = { households: ["a", "b", "c"], "households/a/hearth/index.html": 1, "households/b/index.html": 1, "households/c/hearth/index.html": 1 };
  assert.deepEqual(hearthPages((d) => tree[d] ?? [], (...p) => p.join("/"), (p) => p in tree),
    ["households/a/hearth/index.html", "households/c/hearth/index.html"]);
});

test("the integration is wired, and touches only the Hearth pages", () => {
  const cfg = fs.readFileSync(path.join(ROOT, "astro.config.town.mjs"), "utf8");
  assert.match(cfg, /import hearthCsp from '\.\/town\/scripts\/hearth-csp\.mjs'/);
  assert.match(cfg, /integrations: \[worldEngineIsland\(\), hearthCsp\(\)\]/);
  const src = fs.readFileSync(path.join(ROOT, "town/scripts/hearth-csp.mjs"), "utf8");
  assert.match(src, /hearthPages\(/);
  assert.ok(!/walk|readdirSync\(dest|recursive/.test(src.replace(/\/\/.*$/gm, "")), "it does not sweep the whole build");
});

// ── the built site (skipped without a build, like the funding tests: run `npm run build` first) ──

function everyPage(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) everyPage(p, out); else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

test("built: every Hearth page carries exactly one policy, before its scripts, covering every inline script it carries", { skip: !built }, () => {
  const pages = fs.readdirSync(path.join(DIST, "households")).map((s) => path.join(DIST, "households", s, "hearth", "index.html")).filter(fs.existsSync);
  assert.ok(pages.length > 10, "there are Hearth pages in the build");
  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8");
    const metas = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)];
    assert.equal(metas.length, 1, `${p}: one policy`);
    assert.ok(html.indexOf(metas[0][0]) < html.search(/<script\b/), `${p}: policy before the first script`);
    const scripts = /script-src ([^;]*)/.exec(metas[0][1])[1];
    for (const s of inlineScripts(html)) assert.ok(scripts.includes(`'${s.hash}'`), `${p}: an inline script is not allowed by hash: ${s.text.slice(0, 50)}`);
    assert.ok(!/unsafe-inline|unsafe-eval/.test(scripts), `${p}: no inline allowance for script`);
  }
});

test("built: NO other page carries a policy: the household page, the rail and every other route are untouched", { skip: !built }, () => {
  const others = everyPage(DIST).filter((p) => !/\/households\/[^/]+\/hearth\/index\.html$/.test(p));
  assert.ok(others.length > 1000, "the rest of the site is in the build");
  const withPolicy = others.filter((p) => /http-equiv="?Content-Security-Policy/i.test(fs.readFileSync(p, "utf8")));
  assert.deepEqual(withPolicy, []);
});
