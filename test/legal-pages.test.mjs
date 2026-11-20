// legal-pages.test.mjs — CORE-143: /privacy/ and /terms/ show blueprints' PRIVACY.md and TERMS.md as they stand, and every
// Postmark page's foot links to both.
//
//   node --test test/legal-pages.test.mjs
//
// FALSIFIER: either route missing, a changed or lost byte of the policy text, or the links confined to chrome the Postmark
// shell suppresses (BaseLayout's .site-footer is off for chrome="none"; the Postmark foot is DoorLine, rendered by PostmarkLayout).

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p));
const sha = (b) => createHash("sha256").update(b).digest("hex");

// the two files at postmark-blueprints e5cb8356f28d8f64d8a20878f7cac9899bf1543d (blueprints#93), byte for byte
const SOURCE = {
  "PRIVACY.md": { bytes: 2706, sha256: "c9ab69b4a58822250dc150cbd8006316c868ee32da56642159d2d9399a38b126", route: "privacy" },
  "TERMS.md": { bytes: 1853, sha256: "6ff1bfdc1236dacbfe589c28f93f13eda85e7f2a1dafd428e0a4c160d991ec6b", route: "terms" },
};

for (const [file, want] of Object.entries(SOURCE)) {
  test(`${file}: the copy is byte-identical to the released blueprints text (nothing lost, nothing rewritten)`, () => {
    const b = read(`src/data/legal/${file}`);
    assert.equal(b.length, want.bytes);
    assert.equal(sha(b), want.sha256);
  });

  test(`/${want.route}/ exists, renders that file whole, and says where the text lives`, () => {
    const page = read(`town/pages/${want.route}/index.astro`).toString("utf8");
    assert.match(page, new RegExp(`import markdown from "@/data/legal/${file.replace(".", "\\.")}\\?raw"`), "the page shows the file, not words of its own");
    assert.match(page, new RegExp(`canonical="/${want.route}/"`));
    assert.match(page, new RegExp(`source="${file.replace(".", "\\.")}"`));
    const comp = read("src/components/LegalPage.astro").toString("utf8");
    assert.match(comp, /postmark-blueprints\/blob\/\$\{PIN\}\/\$\{source\}/, "the note points at the source file at its pin");
    assert.match(comp, /e5cb8356f28d8f64d8a20878f7cac9899bf1543d/);
  });

  test(`${file}: every heading, paragraph and list item of the source survives the render, through to the last line`, () => {
    const md = read(`src/data/legal/${file}`).toString("utf8");
    const html = marked.parse(md, { async: false });
    const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);
    const plain = html.replace(/<[^>]+>/g, "").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
    for (const l of lines) {
      const text = l.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/\*\*|\*|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ");
      assert.ok(plain.includes(text), `missing from the render: ${text.slice(0, 80)}`);
    }
    assert.match(html, /<h1/);
    assert.match(plain, /Effective 2026-11-20/);
    assert.match(plain, /office@postmark\.town/, "the contact is there");
    assert.ok(plain.trimEnd().endsWith(lines.at(-1).replace(/\*\*|\*|`/g, "").replace(/\s+/g, " ")), "the tail is not lost");
  });
}

test("the Postmark foot links to both policies: in DoorLine (rendered by PostmarkLayout), not only in the guarded base footer", () => {
  const foot = read("src/components/DoorLine.astro").toString("utf8");
  assert.match(foot, /<a href="\/privacy\/"[^>]*>Privacy<\/a>/);
  assert.match(foot, /<a href="\/terms\/"[^>]*>Terms<\/a>/);
  assert.match(foot, /aria-label="Policies"/);
  const layout = read("src/layouts/PostmarkLayout.astro").toString("utf8");
  assert.match(layout, /chrome="none"/, "Postmark suppresses the base chrome, which is why the links are not there");
  assert.match(layout, /<DoorLine\b/, "and the foot that Postmark does draw is DoorLine");
  assert.ok(existsSync(join(ROOT, "town/pages/privacy/index.astro")) && existsSync(join(ROOT, "town/pages/terms/index.astro")));
});
