// plain-checkout.test.mjs — the town refuses symbolic links (mode 120000):
// intake is plain files only (POS-969). tools/lib/plain-checkout.mjs names
// every link in a checkout, and extract-town.mjs and fetch-town.mjs read
// nothing from one that holds any.
//
// Needs a machine that can make symbolic links (CI can; a Windows box without
// the privilege skips).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { linksIn } from "../tools/lib/plain-checkout.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function link(t, target, path, type) {
  try {
    symlinkSync(target, path, type);
    return true;
  } catch (error) {
    if (error.code === "EPERM") { t.skip("this machine cannot make symlinks"); return false; }
    throw error;
  }
}

test("linksIn names a linked file and a linked folder, and walks no further into either", (t) => {
  const town = mkdtempSync(join(tmpdir(), "plain-checkout-"));
  try {
    mkdirSync(join(town, "WHITE_PAGES", "alice", "HOME"), { recursive: true });
    writeFileSync(join(town, "WHITE_PAGES", "alice", "ADDRESS.md"), "---\nhandle: alice\n---\n");
    if (!link(t, "ADDRESS.md", join(town, "WHITE_PAGES", "alice", "HOME", "HOME.md"), "file")) return;
    if (!link(t, join(town, "WHITE_PAGES"), join(town, "PROJECTS"), "dir")) return;
    assert.deepEqual(linksIn(town), ["PROJECTS", "WHITE_PAGES/alice/HOME/HOME.md"]);
  } finally {
    rmSync(town, { recursive: true, force: true });
  }
});

test("linksIn passes a plain checkout and leaves its .git alone", (t) => {
  const town = mkdtempSync(join(tmpdir(), "plain-checkout-"));
  try {
    mkdirSync(join(town, ".git"), { recursive: true });
    mkdirSync(join(town, "WHITE_PAGES", "alice"), { recursive: true });
    writeFileSync(join(town, "WHITE_PAGES", "alice", "ADDRESS.md"), "---\nhandle: alice\n---\n");
    if (!link(t, "HEAD", join(town, ".git", "ORIG"), "file")) return;
    assert.deepEqual(linksIn(town), []);
  } finally {
    rmSync(town, { recursive: true, force: true });
  }
});

test("a checkout that cannot be read is never read as plain", () => {
  assert.throws(() => linksIn(join(tmpdir(), "plain-checkout-no-such-town")));
});

test("both extractors ask before they read the checkout", () => {
  for (const tool of ["extract-town.mjs", "fetch-town.mjs"]) {
    const src = readFileSync(join(ROOT, "tools", tool), "utf8");
    assert.match(src, /refuseLinkedCheckout\(TOWN\)/, `${tool} reads the checkout without asking`);
  }
});
