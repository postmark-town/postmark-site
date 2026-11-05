// quests-road.test.mjs — a road from the front page and the bulletin to the quests.
//
//   node --test test/quests-road.test.mjs
//
// WHY (site-ux, POS-855). Cold walks found that the front page never says
// "quest", that no nav item reaches the quest hub (/town/ — the Civic Quarter),
// and that the bulletin's "The Quest Board" card pointed at `#quests`, which is
// that notice's own address on /bulletin/ and not a place to scroll to. This
// file pins the three roads that were added, and the one target they all end on:
//
//   1. /town/ carries a real `id="quests"` in its served HTML (no script): the
//      Quest Guild lane, which holds the quest offers. `/town/#quests` is the
//      address every road below uses.
//   2. The bulletin's Quest Board card is a STANDINGS notice, so without script
//      it goes to /town/quests/, and the window it opens carries a plain
//      "See the quests you can take →" link to /town/#quests.
//   3. The front page's "How the town works" step 03 names "quest" and links it
//      to /town/#quests.
//
// NAVIGATION ONLY. Nothing here reads which quests are offered, who is eligible
// or what progress is; that is POS-857's. The source is read with its prose
// blanked (comments quote these very hrefs), so a revert that leaves the
// explanation behind still reds. When `dist-town/` exists (after `npm run
// build`), the built pages are read too; CI runs `npm test` without a build, so
// the source half is the one that runs on every push.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "town", "pages");
const DIST = join(ROOT, "dist-town");

/** Source with JSX/HTML block comments and whole-line `//` comments blanked. */
function sourceOf(...parts) {
  return readFileSync(join(PAGES, ...parts), "utf8")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const hub = sourceOf("town", "index.astro");
const bulletin = sourceOf("bulletin", "index.astro");
const home = sourceOf("index.astro");
// The quest notice's constants and its route block moved out of the bulletin
// page when the posting got a page of its own: the lib holds the three names,
// and the shared NoticeBody component draws the road (so the window and the
// page carry the same one).
const noticeLib = readFileSync(join(ROOT, "src", "lib", "bulletin-notice.mjs"), "utf8");
const noticeBody = readFileSync(join(ROOT, "src", "components", "NoticeBody.astro"), "utf8");

test("the hub carries one real id=quests, on the Quest Guild lane that holds the offers", () => {
  const ids = [...hub.matchAll(/\bid="quests"/g)];
  assert.equal(ids.length, 1, `/town/ has ${ids.length} id="quests" (want exactly one, so the fragment has one place to land)`);
  const lane = hub.indexOf('<section class="c-lane" id="quests"');
  assert.ok(lane >= 0, 'id="quests" is no longer on the Quest Guild lane section');
  const offers = hub.indexOf('<article class="m-card is-quest">');
  assert.ok(offers > lane, "the quest offers no longer sit inside/after the lane that carries id=\"quests\"");
  // the lane opens when it is the target, with no script: the :target rule is the mechanism
  assert.match(hub, /c-lane/, "the hub lost its lanes");
});

test("the bulletin's Quest Board card opens its standings notice and goes to /town/quests/ without script", () => {
  assert.match(noticeLib, /export const QUEST_NOTICE = "quests";/);
  assert.match(noticeLib, /export const QUEST_STANDINGS = "\/town\/quests\/";/);
  assert.ok(
    bulletin.includes("<a href={p.slug === QUEST_NOTICE ? QUEST_STANDINGS : `#${p.slug}`} data-note-open={p.slug} data-card={p.slug}>"),
    "the Quest Board card no longer routes to /town/quests/ (it would be the dead `#quests` again), or lost data-note-open (the window)",
  );
});

test("the Quest Board notice's window carries a plain link to the quests a reader can take", () => {
  assert.match(noticeLib, /export const QUEST_OFFERS = "\/town\/#quests";/);
  const at = noticeBody.indexOf("{posting.slug === QUEST_NOTICE && (");
  assert.ok(at >= 0, "the Quest Board notice lost its route block");
  const block = noticeBody.slice(at, at + 400);
  assert.ok(block.includes("<a href={QUEST_OFFERS}>See the quests you can take →</a>"), "the 'quests you can take' link is gone");
  assert.ok(block.includes("<a href={QUEST_STANDINGS}>the full standings →</a>"), "the full-standings link is gone");
});

test("the front page's step 03 names a quest and links it to /town/#quests", () => {
  const step = home.slice(home.indexOf('<span class="n">03</span>'));
  assert.ok(step.indexOf("</div>") > 0);
  const line = step.slice(0, step.indexOf("</div>"));
  assert.ok(line.includes('<a href="/town/#quests">quest</a>'), 'step 03 no longer links "quest" to /town/#quests');
  // the neighbours it sits among are unchanged
  assert.ok(line.includes('<a href="/mail/">letters</a>') && line.includes('<a href="/world/">the World</a>'));
});

test("every road ends on a target the hub serves", () => {
  // the fragment the roads use is the id the hub has
  assert.ok(/href="\/town\/#quests"/.test(home));
  assert.ok(/QUEST_OFFERS = "\/town\/#quests"/.test(noticeLib));
  assert.ok(/\bid="quests"/.test(hub));
});

const built = existsSync(join(DIST, "town", "index.html")) && existsSync(join(DIST, "bulletin", "index.html")) && existsSync(join(DIST, "index.html"));

test("built pages: the hub's id, the bulletin's card and window, the front page's link", { skip: !built && "no dist-town/ (run npm run build)" }, () => {
  const read = (p) => readFileSync(join(DIST, p), "utf8");
  assert.equal((read("town/index.html").match(/\bid="quests"/g) ?? []).length, 1);
  const b = read("bulletin/index.html");
  assert.ok(/<a href="\/town\/quests\/" data-note-open="quests" data-card="quests"/.test(b), "built bulletin: the Quest Board card does not go to /town/quests/");
  const tpl = b.match(/<template[^>]*data-note="quests"[\s\S]*?<\/template>/);
  assert.ok(tpl, "no Quest Board notice template");
  assert.ok(/href="\/town\/#quests"[^>]*>See the quests you can take →<\/a>/.test(tpl[0]), "built window: no link to /town/#quests");
  assert.ok(/href="\/town\/quests\/"[^>]*>the full standings →<\/a>/.test(tpl[0]), "built window: no standings link");
  assert.ok(/href="\/town\/#quests"[^>]*>quest<\/a>/.test(read("index.html")), "built front page: no quest link");
});
