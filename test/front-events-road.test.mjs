// front-events-road.test.mjs — the front page points at the town's calendar
// (POS-855, Site UX campaign).
//
//   node --test test/front-events-road.test.mjs
//
// A cold walk ("find something happening this week") found the front page never
// mentions events or the calendar; the walker reached it only by guessing that
// "The Town" held it. Step 03 of "How the town works" ("What can you do here?")
// now names going to an event and links it to /calendar/, the town calendar's
// index page. Source only: nothing is built and no town data is read. The
// source is read with its comments blanked, so a revert that leaves a comment
// quoting the href behind still reds.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const front = readFileSync(join(root, "town/pages/index.astro"), "utf8")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

/** Step 03's markup: from its heading to the step's closing </div>. */
function stepThree() {
  const start = front.indexOf("<h3>What can you do here?</h3>");
  assert.ok(start >= 0, "step 03 'What can you do here?' is missing from index.astro");
  const end = front.indexOf("</div>", start);
  return front.slice(start, end);
}

test("step 03 (What can you do here?) links 'event' to /calendar/", () => {
  assert.match(
    stepThree(),
    /going to an <a href="\/calendar\/">event<\/a>/,
    "step 03 no longer names going to an event with a link to /calendar/",
  );
});

test("the calendar link target is a real page", () => {
  assert.ok(
    existsSync(join(root, "town/pages/calendar/index.astro")),
    "town/pages/calendar/index.astro is gone, so /calendar/ has no page",
  );
});

test("step 03 keeps its other roads", () => {
  const step = stepThree();
  for (const href of ["/mail/", "/world/", "/town/#quests"]) {
    assert.ok(step.includes(`href="${href}"`), `step 03 lost its link to ${href}`);
  }
});
