// think-tank-posts.test.mjs — the Think Tank draws idea posts beside the legacy idea marks (POS-290).
//
//   node --test test/think-tank-posts.test.mjs
//
// Darko, 2026-10-09: "New ideas are posts … The legacy idea marks keep being
// read alongside the posts." The office's GET /posts?class=idea is baked as
// idea-posts.json, and /town/'s Think Tank draws one card per idea mark plus
// one per idea post: title, author, the post's stage, its backing's net, and
// the counts of its history and its standing sign-ups.
//
//   1. the reader: posts join the marks, each with its own road's stage, and the
//      dashboard counts both;
//   2. the bake: a 422 (the office does not carry the idea class yet) or a 404
//      keeps the committed snapshot and names the gap; an answer, empty or
//      not, is written verbatim; a body that is not the idea class stops;
//   3. the page, rendered through Astro's own pipeline with the fixture baked
//      in: one card per idea mark and one per post, and a post's title is
//      text, never markup.
//
// Falsifiers: drop the posts loop in civic.mjs ideas() and the page's post
// cards are gone (3 reds); drop the 422 branch in fetchIdeaPosts and the bake
// test reds.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ideas, ideaDashboard, byStage, toIdeaPost, IDEA_POST_STAGES, STAGES } from "../src/lib/civic.mjs";
import { loadWorldState } from "../src/lib/board.mjs";
import {
  fetchIdeaPosts, EMPTY_IDEA_POSTS, IDEA_POSTS_GAP, IDEA_POSTS_NOT_YET_GAP, DATA_FILES,
} from "../tools/lib/fetch-town-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_PATH = join(ROOT, "test", "fixtures", "office-idea-posts.json");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
const SNAPSHOT = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "idea-posts.json"), "utf8"));
const MARKS = {
  marks: [
    { id: "k/a-bench", class: "idea", body: "A bench by the well", by: "k", date: "2026-09-02" },
    { id: "j/a-lamp", class: "idea", body: "A lamp on the corner", by: "j", date: "2026-09-03" },
    { id: "the-town/idea", class: "idea", kind: "class", body: "One thought by a resident" },
  ],
};

// ── 1 · the reader ──────────────────────────────────────────────────────────

test("1 · idea posts join the idea marks, one row each, a post on its own road", () => {
  const tank = ideas(MARKS, { posts: FIXTURE });
  assert.deepEqual(tank.ideas.map((i) => i.id).sort(),
    ["alder/a-bench-by-the-quay", "brook/a-lantern-on-the-pier", "cedar/a-second-bench", "j/a-lamp", "k/a-bench"]);
  assert.equal(tank.malformed.length, 0);
  // the marks keep the chest's road; the posts show their own, and the groups follow the chest's
  assert.deepEqual(byStage(tank.ideas).map((g) => g.stage), ["proposed", "posted", "building", "duplicate"]);
  assert.deepEqual(IDEA_POST_STAGES, ["posted", "in conversation", "ruled in", "building", "built", "shipped", "declined", "duplicate"]);
  assert.ok(IDEA_POST_STAGES.every((s) => !STAGES.includes(s)), "the two roads share no word");
  // no posts at all is today's tank exactly
  assert.deepEqual(ideas(MARKS, { posts: SNAPSHOT }), ideas(MARKS));
});

test("1 · a post's card: its stage, its net, its steps, and the sign-ups that stand", () => {
  const p = toIdeaPost(FIXTURE.posts[0]);
  assert.equal(p.ok, true);
  assert.deepEqual(
    { title: p.title, by: p.by, stage: p.stage, backing: p.backing, steps: p.steps, signUps: p.signUps, staked: p.staked },
    { title: "A bench by the quay", by: "alder", stage: "building", backing: { for: 6, against: 1, net: 5 }, steps: 3, signUps: 2, staked: null });
  // the office's hyphenated words read like the chest's
  assert.equal(toIdeaPost({ ...FIXTURE.posts[0], state: "ruled-in" }).stage, "ruled in");
  assert.equal(toIdeaPost({ ...FIXTURE.posts[0], state: "in-conversation" }).stage, "in conversation");
  // a net the office leaves out is for minus against
  assert.equal(toIdeaPost({ ...FIXTURE.posts[0], backing: { for: 4, against: 7 } }).backing.net, -3);
  // a row with no title is named, never drawn half-built
  assert.deepEqual(toIdeaPost({ id: "x/y", title: "  " }), { ok: false, id: "x/y", reason: "an idea post with no title" });
  // the body is the claim, drawn once: a body that only repeats the title is not drawn twice
  assert.equal(p.body, "Somewhere to sit and watch the ferry come in.");
  assert.equal(toIdeaPost({ ...FIXTURE.posts[0], body: "A bench by the quay" }).body, null);
  assert.equal(toIdeaPost({ ...FIXTURE.posts[0], body: undefined }).body, null);
});

test("1 · the dashboard counts both", () => {
  const board = ideaDashboard(ideas(MARKS, { posts: FIXTURE }), null);
  assert.equal(board.ideas, 5);
  assert.equal(board.posts, 3);
  assert.equal(board.drawn, 0);
});

// ── 2 · the bake ────────────────────────────────────────────────────────────

const answering = (status, body = {}) => async () => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => null }, json: async () => JSON.parse(JSON.stringify(body)),
});
const read = (fetchImpl) => fetchIdeaPosts({ apiBase: "https://office.test", fetchImpl, retries: 1 });

test("2 · an office that does not carry the idea class yet (422) keeps the snapshot and names why", async () => {
  const r = await read(answering(422, { error: "ideas are not posts yet" }));
  assert.deepEqual(r, { missing: true, gap: IDEA_POSTS_NOT_YET_GAP, ideaPosts: null });
});

test("2 · a door that is not live (404) keeps the snapshot and names why", async () => {
  assert.deepEqual(await read(answering(404)), { missing: true, gap: IDEA_POSTS_GAP, ideaPosts: null });
});

test("2 · an answer is written verbatim, an empty one too; a body that is not the idea class stops", async () => {
  assert.deepEqual(await read(answering(200, FIXTURE)), { missing: false, ideaPosts: FIXTURE });
  assert.deepEqual(await read(answering(200, EMPTY_IDEA_POSTS)), { missing: false, ideaPosts: EMPTY_IDEA_POSTS });
  await assert.rejects(read(answering(200, { class: "quest", posts: [] })), /not the idea class's posts/);
  await assert.rejects(read(answering(500)), /failed after 1 attempts/);
});

test("2 · the committed snapshot is the empty idea class, and fetch-town writes it", () => {
  assert.deepEqual(SNAPSHOT, EMPTY_IDEA_POSTS);
  assert.ok(DATA_FILES.includes("idea-posts.json"));
  assert.match(readFileSync(join(ROOT, "tools", "fetch-town.mjs"), "utf8"), /"idea-posts\.json": "the town's ideas as posts/);
});

// ── 3 · the page ────────────────────────────────────────────────────────────
// /town/ served by Astro's own dev pipeline with the town config, idea-posts.json
// resolved to the fixture: the page as a build with that bake would make it. A
// dev server rather than the container API, because the page's canonical link
// is built on the config's `site`, which the container does not carry.
// No dist and no network beyond this machine.

let dev = null, page = null;

// Rendered once, when the first page test asks: a pipeline that cannot start
// FAILS those tests rather than skipping them (a skip would read as a pass),
// and the reader and bake tests above do not wait on it.
const renderPage = () => page ??= (async () => {
  const astro = await import("astro");
  dev = await astro.dev({
    root: ROOT, configFile: "astro.config.town.mjs", logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    // the bake, as a build with the fixture's answer would have written it:
    // the snapshot's module loads the fixture's bytes, and nothing on disk moves
    vite: { plugins: [{
      name: "think-tank-posts-fixture", enforce: "pre",
      load: (id) => (id.replace(/\\/g, "/").split("?")[0].endsWith("/src/data/postmark/idea-posts.json") ? readFileSync(FIXTURE_PATH, "utf8") : null),
    }] },
  });
  const res = await fetch(`http://127.0.0.1:${dev.address.port}/town/`);
  assert.equal(res.status, 200, "the dev server did not serve /town/");
  return res.text();
})();

after(async () => { if (dev) await dev.stop(); });

const tankOf = (page) => {
  const a = page.indexOf('id="ideas"');
  assert.ok(a >= 0, "the page has no Think Tank lane");
  const b = page.indexOf("</section>", a);
  // the dev pipeline's own attributes (scoping and source locations) are not the page's
  return page.slice(a, b).replace(/ data-astro-[\w-]+(="[^"]*")?/g, "");
};

test("3 · the page holds one Think Tank card per idea mark and one per idea post", async () => {
  const tank = tankOf(await renderPage());
  const cards = tank.match(/<article class="m-card is-idea[ "]/g) ?? [];
  const posts = tank.match(/data-idea-post="/g) ?? [];
  const marks = ideas(loadWorldState()).ideas.length;
  assert.equal(posts.length, FIXTURE.posts.length, "one card per idea post");
  assert.equal(cards.length, marks + FIXTURE.posts.length, "one card per idea mark plus one per post");
  for (const p of FIXTURE.posts) assert.ok(tank.includes(`data-idea-post="${p.id}"`), p.id);
  assert.match(tank, /5<span class="m-u">✦<\/span><\/b>\s*<span class="m-dim"> net backing · 6 for · 1 against<\/span>/);
  assert.match(tank, /3 steps · 2 signed up/);
  // each post's body is drawn, as a mark card's is
  for (const p of FIXTURE.posts) {
    const card = tank.slice(tank.indexOf(`data-idea-post="${p.id}"`)).split("</article>")[0];
    assert.match(card, /<p class="m-body">/, `${p.id} draws its body`);
  }
  assert.ok(tank.includes('<p class="m-body">Somewhere to sit and watch the ferry come in.</p>'));
});

test("3 · a post's title and body are text: markup in them renders escaped, never as an element", async () => {
  const tank = tankOf(await renderPage());
  assert.ok(tank.includes("&lt;img src=x onerror=alert(1)&gt; a &lt;b&gt;lantern&lt;/b&gt; &amp; a pier"), "the title is shown as its own characters");
  assert.ok(!/<img src=x/i.test(tank), "the title's markup became an element");
  assert.ok(!tank.includes("<b>lantern</b>"));
  assert.ok(tank.includes("So the late ferry can find the pier. &lt;script&gt;alert(2)&lt;/script&gt; &lt;a href=&quot;https://example.test&quot;&gt;a link&lt;/a&gt; &amp; a light"),
    "the body is shown as its own characters");
  assert.ok(!tank.includes("<script>alert(2)"), "the body's script became an element");
  assert.ok(!/<a href="https:\/\/example\.test"/.test(tank), "the body's link became an element");
});
