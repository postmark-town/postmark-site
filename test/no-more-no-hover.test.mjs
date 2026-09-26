// no-more-no-hover.test.mjs — the Site Lift, POS-250 (Keemin, 2026-09-26): no
// "more" buttons, and nothing that lives only in a hover. The "more" buttons
// "save like 2 sentences, and often are redundant with the existing text";
// "almost no one hovers long enough and actually reads it".
//
//   node --test test/no-more-no-hover.test.mjs
//
// The door line's half of the rule is asserted with the rest of the door line
// in conciseness.test.mjs. The pages another Site Lift issue rebuilds keep the
// rule inside that issue (POS-250 part 3); the Meeps page is one (POS-252).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function astroFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) astroFiles(full, out);
    else if (name.endsWith(".astro")) out.push(full);
  }
  return out;
}

// the Meeps page is POS-252's, rebuilt in its own lane under this same rule
const REBUILT_ELSEWHERE = new Set(["town/pages/meeps/index.astro"]);

test("no page opens a <details> on a bare \"more\"", () => {
  const files = [...astroFiles(join(ROOT, "town")), ...astroFiles(join(ROOT, "src"))]
    .map((f) => relative(ROOT, f).split("\\").join("/"))
    .filter((f) => !REBUILT_ELSEWHERE.has(f));
  const found = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)) {
      const words = m[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
      if (/^(?:\+ ?)?(?:read |show |see )?more\b/.test(words)) found.push(`${f}: "${words}"`);
    }
  }
  assert.deepEqual(found, [], "a \"more\" expand is back");
});

test("the home page's ferry countdown is in view, not surfaced on hover", () => {
  const home = read("town/pages/index.astro");
  const style = home.slice(home.indexOf(".fc-text {"));
  const rule = style.slice(0, style.indexOf("}"));
  assert.ok(rule.length > 0, "the .fc-text rule is gone");
  assert.equal(/opacity:\s*0\b/.test(rule), false, "the countdown line is transparent until hovered again");
  assert.equal(/\.ferry-clock:hover\s+\.fc-text/.test(home), false, "the countdown line surfaces on hover again");
});

test("the plank photo is retired: gone from public/, and nothing names it", () => {
  assert.equal(existsSync(join(ROOT, "public/atelier/postmark/board/quest-board-wood.jpg")), false);
  const names = [...astroFiles(join(ROOT, "town")), ...astroFiles(join(ROOT, "src"))]
    .filter((f) => read(relative(ROOT, f)).includes("quest-board-wood"))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(names, [], "a page still paints the retired plank photo");
});
