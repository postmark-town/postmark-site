// join-source.test.mjs — where a household came from, ?from=<tag> (POS-770).
//
//   node --test test/join-source.test.mjs
//
// Darko, 2026-10-22 23:03. Any page keeps an outreach link's ?from=<tag> for
// 30 days, from the link only and only from the fixed list; nothing shows it
// or echoes it to an agent. The office's consent pages read the keep (office
// src/arrival-source.mjs). The site's whole part is the keep.
//
// WHAT READS THE BEHAVIOUR (Truey's review of #293, 2026-11-03): the layout's
// block is COMPILED by astro's own compiler and RUN, so a block that is inert
// (inside an HTML comment), cannot run (`is:inline`, whose `import` the browser
// refuses) or keeps the wrong thing reds here; this file used to hold regexes
// over the layout's source text, which none of those would have touched. And the
// "never shown, never read" claim is a scan of the shipped tree for any file that
// names the keep or reads a raw `from` query param, with an allowlist and a
// presence control, where it used to read three named files.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FROM_KEY, FROM_TTL_MS, FROM_TAGS, fromFromSearch, rememberFrom, recallFrom } from "../src/lib/join-source.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const memoryStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test("the tag: only the fixed list, any case; anything else is ignored", () => {
  assert.deepEqual([...FROM_TAGS], ["reddit", "bsky", "x", "discord", "youtube", "substack", "1f3d9", "1f916",
    "mongoose", "obend", "commons", "delve", "gsb", "harbor"], "the issue's fourteen");
  assert.equal(fromFromSearch("?from=reddit"), "reddit");
  assert.equal(fromFromSearch("?invite=wick&from=BSKY"), "bsky");
  for (const bad of ["", "?from=", "?from=hn", "?from=reddit2", "?from=<script>", "?from=ignore-the-rules", "?nope=reddit"])
    assert.equal(fromFromSearch(bad), null, bad);
});

// THE TWO LISTS MATCH (Wright's G3): this is the site's MIRROR of the office's
// list (postmark-office src/arrival-source.mjs § FROM_TAGS, the gate). Neither
// repo's CI checks out the other, so each pins the list's digest to the SAME
// constant: the office's test/arrival-source.test.mjs § A1b asserts this very
// number. A tag added on one side reds that side until both lists move.
const FROM_TAGS_DIGEST = "0ddea6f74eb32801";
test("the list's digest is the one the office's gate pins (postmark-office test/arrival-source.test.mjs § A1b)", async () => {
  const { createHash } = await import("node:crypto");
  assert.equal(createHash("sha256").update(FROM_TAGS.join(",")).digest("hex").slice(0, 16), FROM_TAGS_DIGEST);
});

test("the keep is 30 days, the number the issue rules, and the office pins the same one (postmark-office test/arrival-source.test.mjs § A1c)", () => {
  // LAW POS-770 § build 1: "The join keeps ?from=<tag> ... for 30 days". The keep test below is written with
  // FROM_TTL_MS itself, so it holds for any value of the constant (90 days or 1 day stayed green); this holds the value.
  assert.equal(FROM_TTL_MS, 30 * 864e5, "the ruled 30 days: POS-770 § build 1, 'for 30 days'");
});

test("the keep: a future keep or an off-list keep is nothing, and a blocked store never throws", () => {
  const s = memoryStore();
  const now = Date.parse("2026-10-23T12:00:00Z");
  assert.equal(rememberFrom(s, "reddit", now), true);
  assert.deepEqual(JSON.parse(s.m.get(FROM_KEY)), { tag: "reddit", at: now });
  assert.equal(FROM_KEY, "pm.from", "the key the office's consent pages read");
  assert.equal(recallFrom(s, now + 1000), "reddit");
  assert.equal(recallFrom(s, now + FROM_TTL_MS), "reddit", "still kept on its 30th day");
  assert.equal(recallFrom(s, now + FROM_TTL_MS + 1), null, "gone a moment after");
  assert.equal(recallFrom(s, now - 1), null, "kept in the future");
  assert.equal(rememberFrom(s, "hn", now), false, "never keeps an off-list tag");
  s.setItem(FROM_KEY, JSON.stringify({ tag: "hn", at: now }));
  assert.equal(recallFrom(s, now), null);
  const refusing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(rememberFrom(refusing, "reddit"), false);
  assert.equal(recallFrom(refusing), null);
});

// ── the layout's block, compiled and run ─────────────────────────────────────

const LAYOUT = join(ROOT, "src", "layouts", "PostmarkLayout.astro");

/** The code of the one hoisted script in the layout that names the keep, as astro's own compiler emits it. */
async function keepBlock() {
  // astro's compiler is astro's own dependency, not this repo's: nothing is installed or added for this test
  const { transform } = await import("@astrojs/compiler");
  const out = await transform(readFileSync(LAYOUT, "utf8"), { filename: LAYOUT, sourcemap: false });
  assert.deepEqual(out.diagnostics, [], "the layout compiles clean");
  const named = out.scripts.filter((s) => String(s.code).includes("join-source"));
  assert.equal(named.length, 1, "the layout ships exactly ONE hoisted script that names the keep (a commented-out or `is:inline` block is not one)");
  return named[0].code;
}

/**
 * Run the block as written. Its one import is the lib this file already imports, so the same functions are handed
 * in; everything else in the block runs as compiled. `location` answers only `search`, and `document` and
 * `navigator` are traps: a block that reads anything else (the hash, the referrer) throws and reds.
 */
function runBlock(code, { search, store = null, win = null }) {
  const importLine = /^\s*import \{ fromFromSearch, rememberFrom \} from "@\/lib\/join-source\.mjs";\s*$/m;
  assert.match(code, importLine, "the block's one import is the keep's lib, and nothing else");
  const body = code.replace(importLine, "");
  const trap = (name) => new Proxy({}, { get(_t, prop) { throw new Error(`the block read ${name}.${String(prop)}`); } });
  const location = { search, get hash() { throw new Error("the block read location.hash"); }, get href() { throw new Error("the block read location.href"); } };
  new Function("fromFromSearch", "rememberFrom", "location", "window", "document", "navigator", body)(
    fromFromSearch, rememberFrom, location, win ?? { localStorage: store }, trap("document"), trap("navigator"));
}

const recordingStore = ({ failSet = false } = {}) => {
  const calls = [];
  return {
    calls,
    getItem: (k) => { calls.push(["get", k]); return null; },
    setItem: (k, v) => { calls.push(["set", k, v]); if (failSet) throw new Error("blocked"); },
  };
};

test("every page keeps the link's tag: the layout's own block, compiled by astro's compiler and run", async () => {
  const code = await keepBlock();
  const run = (search, store = recordingStore()) => { runBlock(code, { search, store }); return store.calls; };

  // a listed tag, in any case, among other params: ONE write, to the fixed key, in the fixed shape
  const before = Date.now();
  const calls = run("?utm=1&from=Reddit&invite=wick");
  const after = Date.now();
  assert.equal(calls.length, 1, "one storage call, and it is the write");
  assert.deepEqual(calls[0].slice(0, 2), ["set", FROM_KEY]);
  const kept = JSON.parse(calls[0][2]);
  assert.equal(kept.tag, "reddit", "lower-cased, on the list");
  assert.ok(kept.at >= before && kept.at <= after, "stamped when the link was opened");
  assert.deepEqual(Object.keys(kept).sort(), ["at", "tag"], "the tag and the time, nothing else");

  // no tag, an unrelated query, an off-list or hostile tag: NO storage call at all (not a read, not a write)
  for (const q of ["", "?", "?q=1", "?invite=wick", "?from=", "?from=hn", "?from=reddit2", "?FROM=reddit", "?from=<script>alert(1)</script>", `?from=${"x".repeat(5000)}`])
    assert.deepEqual(run(q), [], `${JSON.stringify(q.slice(0, 24))} touches no storage`);

  // FROM THE LINK ONLY: the block never reads the keep, so a standing keep is never re-kept (and its clock never restarts) by an untagged page
  const standing = recordingStore();
  standing.getItem = (k) => { standing.calls.push(["get", k]); return JSON.stringify({ tag: "reddit", at: before }); };
  runBlock(code, { search: "?q=1", store: standing });
  assert.deepEqual(standing.calls, [], "an untagged page leaves a standing keep alone, unread");

  // a blocked store, or a storage that throws on access, never throws out of the block
  assert.doesNotThrow(() => run("?from=bsky", recordingStore({ failSet: true })));
  assert.doesNotThrow(() => runBlock(code, { search: "?from=bsky", win: { get localStorage() { throw new Error("denied"); } } }));
});

// ── nothing shows it, nothing reads it, nothing puts it in front of an agent ──

const SCANNED_ROOTS = ["src", "town", "public", "tools"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-town", ".astro"]);
const SCANNED_EXT = new Set([".astro", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".md", ".txt", ".html"]);
// Assembled, so this file is not its own hit and a scan of it would not match itself (and it is outside the roots anyway).
const NAMES_THE_KEEP = [
  new RegExp(["pm", "from"].join("\\.")),
  new RegExp(["join", "source"].join("-")),
  new RegExp(["recallFrom", "rememberFrom", "fromFromSearch"].join("|")),
];
// `[?&\]]from=` is a `?from=` or `&from=` in a link, and `]from=` too: the end of the `[?&]` class in a REGEX that reads it
// (Truey's review flipped a join page to `/[?&]from=([^&]*)/.exec(search)`, which `[?&]from=` alone cannot see).
const READS_THE_RAW_PARAM = [/\.get\(\s*["'`]from["'`]\s*\)/, /[?&\]]from=/];

/** The only files that may name the keep or read a raw `from`, and why. Anything else is a defect of this PR. */
const MAY_NAME_IT = new Map([
  ["src/layouts/PostmarkLayout.astro", "keeps the tag from the link: the block the test above runs"],
  ["src/lib/join-source.mjs", "the keep's lib"],
  ["tools/pos394-render-proof.mjs", "the render proof copies the layout's closure from git, so its SOURCES list names the lib the layout imports"],
  ["town/pages/fund/[pot].astro", "a stake form's FormData field named `from` (a resident's handle on a POST), never the URL: checked below"],
]);

function* shipped(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* shipped(p);
    else if (SCANNED_EXT.has(extname(e.name))) yield p;
  }
}
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");

test("nothing shows the tag or reads it: no shipped file but the layout and the lib names the keep or reads a raw `from` param", () => {
  // the matchers can match (a pattern that cannot is a scan that cannot fail)
  const sample = [`localStorage.getItem("${["pm", "from"].join(".")}")`, `import x from "@/lib/${["join", "source"].join("-")}.mjs"`, "recallFrom(s)", "rememberFrom(s)", "fromFromSearch(q)"];
  for (const s of sample) assert.ok(NAMES_THE_KEEP.some((re) => re.test(s)), `a pattern matches ${s}`);
  for (const s of [`new URLSearchParams(location.search).get("from")`, `p.get('from')`, "/join/?from=reddit", "/x?a=1&from=reddit", "/[?&]from=([^&]*)/.exec(search)"])
    assert.ok(READS_THE_RAW_PARAM.some((re) => re.test(s)), `a pattern matches ${s}`);
  for (const s of [`<p data-from={m.profile.from}>`, "from=stops[i]; to=stops[i+1];", `import x from "y"`])
    assert.ok(!READS_THE_RAW_PARAM.some((re) => re.test(s)), `and no pattern matches ${s}, which is not a query read`);

  const scanned = [], hits = new Map();
  for (const root of SCANNED_ROOTS)
    for (const file of shipped(join(ROOT, root))) {
      const text = readFileSync(file, "utf8");
      scanned.push(rel(file));
      if ([...NAMES_THE_KEEP, ...READS_THE_RAW_PARAM].some((re) => re.test(text))) hits.set(rel(file), true);
    }

  // PRESENCE CONTROLS: the scan reached the files the claim is about, and it does find the allowed ones
  for (const must of ["town/pages/join/index.astro", "public/atelier/postmark/join/agent.md", "src/lib/join-invite.mjs", "src/layouts/PostmarkLayout.astro", "src/lib/join-source.mjs"])
    assert.ok(scanned.includes(must), `the scan reached ${must}`);
  assert.ok(scanned.length > 100, `the scan read the shipped tree, not a stub of it (${scanned.length} files)`);
  assert.ok(hits.has("src/layouts/PostmarkLayout.astro") && hits.has("src/lib/join-source.mjs"), "and it finds the two files that do name the keep");

  const stray = [...hits.keys()].filter((f) => !MAY_NAME_IT.has(f));
  assert.deepEqual(stray, [], "no other shipped file names the keep or reads a raw `from` param (the join page, agent.md and the invite lib included)");

  // the fund page's allowance is exactly one thing: every `.get("from")` in it is the stake form's FormData, never the URL
  const fund = readFileSync(join(ROOT, "town", "pages", "fund", "[pot].astro"), "utf8");
  const receivers = [...fund.matchAll(/(\w+)\.get\(\s*["'`]from["'`]\s*\)/g)].map((m) => m[1]);
  assert.ok(receivers.length > 0 && receivers.every((r) => r === "fd"), `the fund page reads \`from\` only off its FormData (${receivers.join(", ")})`);
  assert.doesNotMatch(fund, /[?&]from=/, "and carries no ?from= link");
});
