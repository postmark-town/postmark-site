// source-file.test.mjs — the intake tools read a town entry's files only if they are really those files (POS-959).
//
// The review of #393 found that sync-hearths.mjs followed symlinks: an entry's `hearth.html -> ../../../.git/config`
// copied the runner's persisted token into a committed, public data file. The same class stood in sync-renditions.mjs.
// This holds the one guard (tools/lib/source-file.mjs) and both tools to it, with FAKE sentinels only: no real
// credential, key or runner path is read anywhere here. Every protected file is a scratch file this test makes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { readEntryFile, dirInside, RefusedFile, MAX_ENTRY_FILE_BYTES } from "../tools/lib/source-file.mjs";
import { syncHearths } from "../tools/sync-hearths.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SENTINEL = "FAKE-PROTECTED-SENTINEL-not-a-real-token-4f9c1d";
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), "pos959-intake-"));
const write = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
const tryLink = (target, p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.symlinkSync(target, p); };

/** every byte any file under `dir` holds, as one string, following nothing */
function everything(dir) {
  let out = "";
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out += everything(p);
    else if (e.isFile()) out += fs.readFileSync(p, "latin1");
    else out += `[${e.name}:non-file]`;
  }
  return out;
}
const captureWarn = (fn) => { const w = console.warn; const said = []; console.warn = (m) => said.push(String(m)); try { return [fn(), said]; } finally { console.warn = w; } };

// ── the guard ───────────────────────────────────────────────────────────────

test("readEntryFile: a regular file is read; an absent one is null, as before", () => {
  const d = scratch();
  write(path.join(d, "a.html"), "<p>fine é</p>");
  assert.equal(readEntryFile(d, "a.html"), "<p>fine é</p>");
  assert.deepEqual(readEntryFile(d, "a.html", { buffer: true }), Buffer.from("<p>fine é</p>"));
  assert.equal(readEntryFile(d, "nope.html"), null);
});

test("readEntryFile: a symlink is refused BY NAME and its target's bytes are never returned: out of the folder, inside it, and dangling", () => {
  const d = scratch(), outside = scratch();
  write(path.join(outside, "secret.txt"), SENTINEL);
  write(path.join(d, "real.html"), "<p>real</p>");
  tryLink(path.join(outside, "secret.txt"), path.join(d, "escape.html"));
  tryLink("real.html", path.join(d, "inside.html"));
  tryLink(path.join(outside, "gone.txt"), path.join(d, "dangling.html"));
  tryLink("../" + path.basename(outside) + "/secret.txt", path.join(d, "relative.html"));
  for (const name of ["escape.html", "inside.html", "dangling.html", "relative.html"]) {
    assert.throws(() => readEntryFile(d, name, { label: `x/${name}` }), (e) => e instanceof RefusedFile && e.file === `x/${name}` && /symbolic link/.test(e.message) && !e.message.includes(SENTINEL), name);
  }
});

test("readEntryFile: a directory, a pipe, an oversize file and a non-plain name are refused too", () => {
  const d = scratch();
  fs.mkdirSync(path.join(d, "dir.html"));
  assert.throws(() => readEntryFile(d, "dir.html"), (e) => e instanceof RefusedFile && /not a regular file/.test(e.message));
  let fifo = true;
  try { execFileSync("mkfifo", [path.join(d, "pipe.html")]); } catch { fifo = false; }
  if (fifo) assert.throws(() => readEntryFile(d, "pipe.html"), (e) => e instanceof RefusedFile && /not a regular file/.test(e.message));
  write(path.join(d, "big.html"), "x".repeat(MAX_ENTRY_FILE_BYTES + 1));
  assert.throws(() => readEntryFile(d, "big.html"), (e) => e instanceof RefusedFile && /over the/.test(e.message));
  for (const bad of ["../x", "a/b", "..", "."]) assert.throws(() => readEntryFile(d, bad), (e) => e instanceof RefusedFile && /plain file name/.test(e.message), bad);
});

test("dirInside: a real folder inside the parent is; a linked folder, or one outside, is not", () => {
  const parent = scratch(), outside = scratch();
  fs.mkdirSync(path.join(parent, "ok"));
  tryLink(outside, path.join(parent, "linked"));
  assert.equal(dirInside(path.join(parent, "ok"), parent), true);
  assert.equal(dirInside(path.join(parent, "linked"), parent), false);
  assert.equal(dirInside(outside, parent), false);
  assert.equal(dirInside(path.join(parent, "missing"), parent), false);
});

// ── sync-hearths.mjs ────────────────────────────────────────────────────────

function hearthTown() {
  const town = scratch(), outside = scratch();
  write(path.join(outside, "secret.txt"), SENTINEL);
  write(path.join(outside, "hearth.html"), `<p>${SENTINEL}</p>`);
  const dir = path.join(town, "PROJECTS", "household-hearths");
  const mk = (id, files) => { for (const [f, c] of Object.entries(files)) write(path.join(dir, id, f), c); };
  mk("good", { "hearth.html": "<p>good</p>", "hearth.css": "p{color:red}", "hearth.md": "---\ntitle: Good\nauthor: good\n---\nA line." });
  mk("also-good", { "hearth.html": "<p>also good</p>" });
  mk("evil-html", { "hearth.css": "p{}" });          tryLink(path.join(outside, "secret.txt"), path.join(dir, "evil-html", "hearth.html"));
  mk("evil-css", { "hearth.html": "<p>x</p>" });     tryLink(path.join(outside, "secret.txt"), path.join(dir, "evil-css", "hearth.css"));
  mk("evil-md", { "hearth.html": "<p>x</p>" });      tryLink(path.join(outside, "secret.txt"), path.join(dir, "evil-md", "hearth.md"));
  tryLink(outside, path.join(dir, "evil-folder"));
  mk("evil-dangling", { "hearth.html": "<p>x</p>" }); tryLink("../../../../nowhere.txt", path.join(dir, "evil-dangling", "hearth.css"));
  return { town, outside, dir };
}

test("syncHearths: a symlinked hearth.html, hearth.css, hearth.md or entry folder is REFUSED BY NAME and the fake protected bytes appear in no row", () => {
  const { town } = hearthTown();
  const [out, said] = captureWarn(() => syncHearths(town));
  assert.deepEqual(out.rows.map((r) => r.id), ["also-good", "good"], "valid entries are preserved");
  assert.deepEqual(out.refused.map((r) => [r.id, r.file]).sort(), [
    ["evil-css", "evil-css/hearth.css"], ["evil-dangling", "evil-dangling/hearth.css"], ["evil-folder", "evil-folder"],
    ["evil-html", "evil-html/hearth.html"], ["evil-md", "evil-md/hearth.md"],
  ]);
  assert.deepEqual(out.skipped.sort(), ["evil-css", "evil-dangling", "evil-folder", "evil-html", "evil-md"]);
  assert.ok(!JSON.stringify(out).includes(SENTINEL), "no protected byte reaches the output");
  for (const f of ["evil-html/hearth.html", "evil-css/hearth.css", "evil-md/hearth.md", "evil-dangling/hearth.css"]) {
    assert.ok(said.some((m) => m.includes("REFUSED") && m.includes(f) && /symbolic link/.test(m)), `the refusal names ${f}`);
  }
  assert.ok(said.some((m) => m.includes("REFUSED evil-folder is a symbolic link")), "a linked entry folder is named too");
  assert.ok(!said.join("\n").includes(SENTINEL), "and the warnings do not carry it either");
});

test("syncHearths: valid entries, a missing hearth.html and infrastructure folders behave as before", () => {
  const town = scratch();
  const dir = path.join(town, "PROJECTS", "household-hearths");
  write(path.join(dir, "STARTER", "hearth.html"), "<p>starter</p>");
  write(path.join(dir, "zeta", "hearth.html"), "<p>z</p>\r\n");
  write(path.join(dir, "zeta", "hearth.css"), "p{color:red}\r\n");
  write(path.join(dir, "no-html", "hearth.css"), "p{}");
  const [out, said] = captureWarn(() => syncHearths(town));
  assert.deepEqual(out.rows, [{ id: "zeta", title: "zeta", author: null, line: "", html: "<p>z</p>\n", css: "p{color:red}\n" }]);
  assert.deepEqual(out.skipped, ["no-html"]);
  assert.deepEqual(out.refused, []);
  assert.ok(said.some((m) => /no-html\/ has no hearth.html/.test(m)));
});

// ── sync-renditions.mjs, through its own command line ───────────────────────

function renditionTown() {
  const town = scratch(), outside = scratch();
  write(path.join(outside, "secret.txt"), SENTINEL);
  const dir = path.join(town, "PROJECTS", "resident-page-renditions");
  write(path.join(dir, "good", "rendition.html"), "<!doctype html><p>good é</p>\n");
  write(path.join(dir, "good", "rendition.md"), "---\ntitle: A Good One\nauthor: good\n---\nOne line about it.\n");
  write(path.join(dir, "evil-html", "rendition.md"), "---\ntitle: x\n---\nline\n");
  tryLink(path.join(outside, "secret.txt"), path.join(dir, "evil-html", "rendition.html"));
  write(path.join(dir, "evil-md", "rendition.html"), "<p>x</p>");
  tryLink(path.join(outside, "secret.txt"), path.join(dir, "evil-md", "rendition.md"));
  tryLink(outside, path.join(dir, "evil-folder"));
  write(path.join(outside, "rendition.html"), SENTINEL);
  write(path.join(dir, "STARTER", "rendition.html"), "<p>starter</p>");
  return { town, outside };
}

test("sync-renditions: a symlinked rendition.html, rendition.md or folder is refused by name; the fake protected bytes are in NO output; the valid one is copied byte for byte", () => {
  const { town } = renditionTown();
  const site = scratch();
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/sync-renditions.mjs"), "--town", town, "--site", site], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const said = r.stderr + r.stdout;
  for (const f of ["evil-html/rendition.html", "evil-md/rendition.md"]) assert.ok(said.includes(`REFUSED ${f} is a symbolic link`), `refusal names ${f}: ${said}`);
  assert.ok(said.includes("REFUSED evil-folder is a symbolic link"));
  assert.ok(!said.includes(SENTINEL) && !everything(site).includes(SENTINEL), "no protected byte in any output or message");
  const index = JSON.parse(fs.readFileSync(path.join(site, "src/data/postmark/renditions.json"), "utf8"));
  assert.deepEqual(index.map((x) => x.author), ["good"]);
  assert.equal(index[0].title, "A Good One");
  assert.deepEqual(fs.readFileSync(path.join(site, "public/atelier/postmark/renditions/good.html")), fs.readFileSync(path.join(town, "PROJECTS/resident-page-renditions/good/rendition.html")));
  assert.deepEqual(fs.readdirSync(path.join(site, "public/atelier/postmark/renditions")), ["good.html"]);
  assert.match(said, /SKIPPED 3: evil-folder, evil-html, evil-md/);
});

test("sync-renditions: with no symlinks it is what it was (the committed renditions come out identical)", () => {
  const site = scratch();
  const townDir = scratch();
  const src = path.join(townDir, "PROJECTS", "resident-page-renditions");
  const committed = path.join(ROOT, "public/atelier/postmark/renditions");
  for (const f of fs.readdirSync(committed)) {
    const author = f.replace(/\.html$/, "");
    write(path.join(src, author, "rendition.html"), fs.readFileSync(path.join(committed, f)));
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/sync-renditions.mjs"), "--town", townDir, "--site", site], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  for (const f of fs.readdirSync(committed)) assert.deepEqual(fs.readFileSync(path.join(site, "public/atelier/postmark/renditions", f)), fs.readFileSync(path.join(committed, f)), f);
});

test("the two intake tools read entry files only through the guard", () => {
  for (const f of ["tools/sync-hearths.mjs", "tools/sync-renditions.mjs"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.match(src, /from "\.\/lib\/source-file\.mjs"/, `${f} imports the guard`);
    assert.ok(!/readFileSync|copyFileSync/.test(src.replace(/\/\/.*$/gm, "")), `${f} has no unguarded read or copy`);
  }
});
