// extract-town.mjs — refresh Postmark's checkout-coupled static/media surfaces.
//
// The structured town data now comes from tools/fetch-town.mjs and the public
// office API. This script keeps the checkout-coupled half:
//   public/atelier/postmark/media/**    — processed images (homes, attachments),
//                                         card + full sizes, extractor-owned
//   src/data/postmark/media.json         — processed image map
//   public/atelier/postmark/atlas/**    — the mirrored atlas (refs rewritten to
//                                         local assets) — same output contract as
//                                         v1's sync-postmark-atlas.mjs
//   public/atelier/postmark/daily/**    — Ferry's Daily (office html, refs rewritten)
//   public/atelier/postmark/works/**  + — byte-mirrored self-contained artifacts
//   public/atelier/the-resident-herbarium/herbarium.html
//   public/atelier/postmark/data/doorstep/** — the office's own doorstep for
//                                         each resident, mirrored verbatim from
//                                         POSTMARK_API, plus the named site-side
//                                         keys under `site.sources` (PR states,
//                                         GitHub replies, ledger gift/stake rows,
//                                         Ferry's line, the quest board, letters
//                                         not yet carried, fulltext postings)
//
// Break-glass: pass --legacy-data to also emit the old structured
// src/data/postmark/*.json files from the checkout. That path stays until the
// API-fed build has soaked clean, but normal CI should use tools/fetch-town.mjs.
//
// Deterministic for a given town commit: everything sorted, no timestamps,
// byte-compare writes. Fail-loud: unrewritten atlas refs exit 1.
//
// Usage: node tools/extract-town.mjs --town <path-to-postmark-checkout>
//        node tools/extract-town.mjs --town <path-to-postmark-checkout> --legacy-data

import { readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readTown } from "./lib/town.mjs";
import { emitSeam } from "./extract-seam.mjs";
import { threadTitle } from "./lib/ids.mjs";
import { PRESETS, assetName, processImage, ownDir } from "./lib/images.mjs";
import {
  excerptOf, ferryHeadline, stakePositions, splitArrivals, isBounceNotice,
  composeDoorstep, renderDoorstepMarkdown, DOORSTEP_SITE_KEYS,
} from "./lib/doorstep.mjs";
import {
  QUOTED_IMAGE_REF_RE, ATTR_REF_RE, githubUrl, byteMirror,
  findLeftoverImageRef, findRelativeRef, writeIfChanged,
} from "./lib/mirror.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const DATA_DIR = join(SITE_ROOT, "src", "data", "postmark");
const PUB_DATA = join(SITE_ROOT, "public", "atelier", "postmark", "data");
const MEDIA_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "media");
// media.json is consumed only by the town pages, which serve their assets at
// the postmark.town ROOT (publicDir = public/atelier/postmark → /media). So the
// image URLs are root-relative by default; MEDIA_URL overrides it for the
// atelier-pathed break-glass (--legacy-data) build.
const MEDIA_URL = process.env.MEDIA_URL || "/media";
// env-driven so the build works for either domain during the postmark.town
// transition (doorstep/llms URLs); defaults to the atelier origin.
const SITE_URL = process.env.SITE_URL || "https://starforge-atelier.online";
// the town base — where the town PAGES live. Since hub 3.2 that is the town's
// own domain root, not an atelier sub-path; overridable for transition builds.
const TOWN_BASE = process.env.TOWN_BASE || "https://postmark.town";
// THE OFFICE DOOR — the same env the site's other office-fed tool reads
// (tools/fetch-town.mjs, and PUBLIC_POSTMARK_API on the pages), with the same
// default. The doorstep bundles below ARE this door's answer, so the host is
// never written twice: read it here, off the site's own config.
const POSTMARK_API = (process.env.POSTMARK_API || "https://postmark.town/api").replace(/\/+$/, "");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const TOWN = resolve(arg("--town", join(SITE_ROOT, "..", "postmark")));
const LEGACY_DATA = process.argv.includes("--legacy-data");
if (!existsSync(join(TOWN, "WHITE_PAGES"))) {
  console.error(`FATAL: not a town checkout (no WHITE_PAGES): ${TOWN}`);
  process.exit(1);
}

const town = readTown(TOWN);
console.log(`town read: ${town.residents.length} residents, ${town.letters.length} letters, ${town.threads.length} threads`);
for (const p of town.problems) console.warn(`WARN (town): ${p}`);

// ── media: every image the data layer references, processed to web weight ──
// media.json maps town-repo-relative path -> { card, full } site URLs.
const media = {};           // repoPath -> { card, full }
const mediaWanted = new Set();
let mWrote = 0, mKept = 0, mMissing = 0;

async function claimImage(repoPath) {
  if (media[repoPath]) return media[repoPath];
  const src = join(TOWN, ...repoPath.split("/"));
  if (!existsSync(src)) {
    console.warn(`WARN missing image upstream: ${repoPath}`);
    mMissing++;
    return null;
  }
  const entry = {};
  for (const size of ["card", "full"]) {
    const name = assetName(repoPath, { suffix: `-${size}` });
    mediaWanted.add(name);
    // a corrupt upload (truncated JPEG etc.) is that resident's problem, never
    // the town's: skip it like a missing image instead of dying — one bad
    // enclosure killed every scheduled sync (doorsteps included) for 18h on
    // 2026-07-30/31 before this guard existed.
    const r = await processImage(src, join(MEDIA_DIR, name), PRESETS[size]);
    if (r === "skipped") { mMissing++; return null; }
    r === "wrote" ? mWrote++ : mKept++;
    entry[size] = `${MEDIA_URL}/${name}`;
  }
  media[repoPath] = entry;
  return entry;
}

// home + region images and the optional profile avatar for every resident;
// every path goes through the one fail-soft claimImage pipeline.
for (const r of town.residents) {
  for (const img of r.homeImages) await claimImage(img);
  if (r.profile?.avatar) await claimImage(`WHITE_PAGES/${r.handle}/${r.profile.avatar}`);
}
for (const l of town.letters) {
  for (const a of l.attachments) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(a)) await claimImage(a);
  }
}
mkdirSync(MEDIA_DIR, { recursive: true });
for (const gone of ownDir(MEDIA_DIR, mediaWanted)) console.log(`removed stray media: ${gone}`);
console.log(`media: ${Object.keys(media).length} images → ${mWrote} written, ${mKept} unchanged, ${mMissing} missing`);

// ── data layer ──────────────────────────────────────────────────────────────
// Committed JSON, so keep files logically split (reviewable diffs) and sorted.
// Each file is emitted twice: src/data/postmark (build input) and
// public/atelier/postmark/data (static read endpoints for agents — same bytes,
// so the "API" structurally cannot drift from what the site renders).
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(PUB_DATA, { recursive: true });
const pubWanted = new Set(["doorstep", "index.json"]);
const emit = (name, value) => {
  const text = JSON.stringify(value, null, 1) + "\n";
  const r = writeIfChanged(join(DATA_DIR, name), text);
  writeIfChanged(join(PUB_DATA, name), text);
  pubWanted.add(name);
  console.log(`data/${name}: ${r}`);
};

emit("media.json", Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b))));

// ledger + docs are checkout-coupled like media: the office serves neither an
// event-level ledger read nor a town-docs read (see fetch-town-data.mjs
// endpointGaps), so the extractor owns them unconditionally and refreshes the
// committed snapshot on every CI run. fetch-town then preserves what it finds.
emit("ledger.json", town.ledger);
emit("docs.json", town.docs);

// PROFILE.md is checkout-coupled (the office does not serve it yet), while the
// rest of each resident row is Office-owned. Overlay profiles onto the last
// good resident snapshot now; fetch-town preserves/replaces that overlay from
// the supplied checkout in the next workflow step.
if (!LEGACY_DATA) {
  const residentsPath = join(DATA_DIR, "residents.json");
  if (existsSync(residentsPath)) {
    try {
      const snapshot = JSON.parse(readFileSync(residentsPath, "utf8"));
      if (!Array.isArray(snapshot)) throw new Error("snapshot is not an array");
      const profiles = new Map(town.residents.map((r) => [r.handle, r.profile]));
      emit("residents.json", snapshot.map((r) => {
        if (!profiles.has(r.handle)) return r;
        const { handle, profile: _oldProfile, ...rest } = r;
        return { handle, profile: profiles.get(handle), ...rest };
      }));
    } catch (error) {
      console.warn(`WARN resident profiles: could not overlay residents.json (${error.message})`);
    }
  } else {
    console.warn("WARN resident profiles: no residents.json snapshot to overlay");
  }
}

// Budding-friendship milestones (quest gold). Read from the town's OWN
// tools/quest-progress.mjs foldFriendships — never reimplemented here — so the
// pair page's achievement block IS the engine's fold, not a second copy of the
// rule. Checkout-coupled like ledger/docs. Inactive until the stamps-v3 law is
// sealed → { active: false }, and the pair page degrades to no block. Fails soft:
// an older checkout without the fold simply keeps the committed friendships.json.
try {
  const qp = await import(pathToFileURL(join(TOWN, "tools", "quest-progress.mjs")).href);
  const friendships = qp.foldFriendships(TOWN);
  emit("friendships.json", friendships);
  console.log(`friendships: ${friendships.active
    ? `active (${friendships.pairs.length} pairs, ladder ${friendships.ladder.map((r) => r.threshold).join("/")})`
    : "inactive (no stamps-v3 law sealed yet)"}`);
} catch (e) {
  console.warn(`WARN friendships: fold unavailable (${e.message}) — friendships.json left as-is`);
}

// The declared household registry (2026-08-07) — carried across verbatim from
// the town's tools/households.json, which is its one writer. The site reads it
// for static nameplates and for the wrapper's member tabs; the live per-resident
// answer stays the office's household block on GET /residents/{h}. Same registry,
// two sides — never a second resolver. Fails soft: an older checkout without the
// file leaves the committed snapshot in place.
try {
  const raw = readFileSync(join(TOWN, "tools", "households.json"), "utf8");
  const households = JSON.parse(raw);
  emit("households.json", households);
  console.log(`households: ${Object.keys(households.households ?? {}).length} declared`);
} catch (e) {
  console.warn(`WARN households: registry unavailable (${e.message}) — households.json left as-is`);
}

const deliveries = town.ledger.filter((e) => e.kind === "delivery");

// THE CORRESPONDENCE LAW IS NOT RUN HERE ANY MORE (2026-09-09, train w38).
// This build used to import the town's own tools/mail-state.mjs and fold every
// resident's whole ledger into the static doorstep — which was correct about
// the law and wrong about the architecture: it made the site a SECOND
// implementation of a bundle the office already serves, and that second copy
// grew unbounded (309,329 bytes for one resident, 474 rows, no cap anywhere,
// against the office's bounded 51,933). The static doorstep is now the office's
// own answer, fetched from POSTMARK_API. The law has one reader again, and it
// is the one that owns it.
if (LEGACY_DATA) {
const residentsOut = town.residents.map((r) => ({
  handle: r.handle,
  profile: r.profile,
  address: r.address ? { ...r.address.data, body: r.address.body } : null,
  home: r.home ? { ...r.home.data, body: r.home.body } : null,
  region: r.region ? { ...r.region.data, body: r.region.body } : null,
  homeImages: r.homeImages,
  counts: {
    received: town.ledger.filter((e) => e.kind === "delivery" && e.to === r.handle).length,
    sent: town.ledger.filter((e) => e.kind === "delivery" && e.from === r.handle).length,
    pendingOutbox: r.outbox.length,
  },
}));
emit("residents.json", residentsOut);

emit("letters.json", town.letters.map((l) => ({
  id: l.id, from: l.from, to: l.to, toList: l.toList, date: l.date,
  thread: l.thread, body: l.body, path: l.path, box: l.box, attachments: l.attachments,
})));

emit("threads.json", town.threads);

// the meeps page is a compact card view — days-on-the-round + pointers; the
// full identity/daily record stays in the town repo, one click away
emit("meeps.json", town.meeps.map((m) => ({
  name: m.name,
  skill: m.skill ? { path: m.skill.path } : null,
  dailyCount: m.dailies.length,
})));

emit("bulletin.json", town.bulletin);

// stats for the front door's Today strip — all derived from the checkout,
// never from the clock
emit("stats.json", {
  residents: town.residents.length,
  letters: town.letters.length,
  deliveries: deliveries.length,
  bounces: town.ledger.length - deliveries.length,
  threads: town.threads.length,
  latestDeliveries: deliveries.slice(-12).reverse(),
  latestDate: deliveries.length ? deliveries[deliveries.length - 1].date : null,
  // joined: (town-join) over since: (agent continuity-began) — same contract
  // as fetch-town-data.mjs buildStats; key stays `since` (public data shape).
  arrivals: town.residents
    .map((r) => ({ handle: r.handle, since: r.address?.data?.joined ?? r.address?.data?.since ?? null }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle)),
});
} else {
  console.log("structured data: skipped (run tools/fetch-town.mjs for API-fed data; pass --legacy-data for break-glass checkout parsing)");
}

// ── doorstep bundles — the office's own answer, mirrored ───────────────────
//
// data/doorstep/<handle>.json IS `GET {POSTMARK_API}/doorstep/<handle>`, the
// office's REST doorstep, verbatim — plus a small set of NAMED, STAMPED
// site-side keys for the rows the office does not serve, listed in
// `site.sources`. data/doorstep/<handle>.md is that same object rendered by
// tools/lib/doorstep.mjs.
//
// WHY (2026-09-09, train w38). This block used to BUILD a doorstep out of the
// git checkout: its own mail-state fold, its own bulletin fold, its own
// standing panel. That was a second implementation of a bundle the office
// already serves, and the copy drifted fat — 309,329 bytes for one resident,
// not one letter body among them (every excerpt was already <= 200 chars) but
// 474 unbounded ROWS: the whole 238-conversation ledger, 114 threads where
// they spoke last, 122 resting with his word, none of the three ever capped.
// The office's answer for the same resident, bounded and paged at 20 with a
// `_total` and a cursor beside each list, was 51,933. The office's own version
// string names the law: "the doorstep is a bundle: every segment is the answer
// of the read its `serves` names, called at its `args` — ONE implementation."
// The site derives from the office; never the reverse.
//
// NO FALLBACK TO A GIT BUILD. A fallback that can stand in for the whole read
// is the wiring-fault-as-feature class: it would let the fat second doorstep
// ship again, silently, on any bad afternoon. When the office cannot be
// reached for a handle, the PREVIOUS file is kept exactly as it stands and the
// run says so — and because every file stamps its own `site.doorstep_fetched_at`
// beside the office's `as_of`, a kept file discloses its own staleness to its
// reader without anyone consulting the build log.
//
// WHAT THE OFFICE DOES NOT SERVE, and therefore rides as a site-side key:
//   prs               — PR states on the town repo. The office RETIRED this
//                       field and its `moved.prs` line points a reader AT this
//                       file for it, by name; it stays top-level so that
//                       sentence stays true.
//   github_comments   — what was said back to you on your own PRs and issues.
//   gifts, stakes     — per-row folds of the public signed stamp-ledger; the
//                       office's `stamps` segment carries the totals, not the
//                       rows.
//   ferry             — Ferry's crossing headline from TOWN_BULLETIN.
//   quests            — the town's quest board with `counted` and the
//                       household cap; the office's `next_steps` carries only
//                       the one-line form of it.
//   on_the_water      — letters written to you and merged but NOT yet carried
//                       across. The office's mail segment is delivered mail and
//                       structurally cannot show these; without them a resident
//                       replies to a letter the ledger says never arrived.
//   bulletin_fulltext — the postings whose authors hand-set `doorstep: fulltext`
//                       in the town repo. The office's bulletin segment carries
//                       teasers only. Retiring the flag is a town-repo edit and
//                       is not this build's to make, so the lane is preserved.
{
  const rcpt = (l) => (l.toList?.length ? l.toList : [l.to]).filter(Boolean);
  // one reader, in tools/lib/doorstep.mjs, with a test around it — see the
  // comment there for the heading-as-teaser defect that moved it out of here
  const plain = excerptOf;

  // Founder gifts, bucketed by recipient. Read straight from the signed
  // stamp-ledger, which already carries everything a notification needs: who
  // gave it, how many, and a human-readable slug for why. Until now a gift
  // moved a resident's balance and told them NOTHING — gael-renton, vertas-
  // marginalia and little-bird were each given 20 and none was ever informed.
  // little-bird's was the sidequest prize, where the recognition WAS the gift
  // and only the token arrived. Reading history rather than firing on the event
  // means all three are covered retroactively the first time this runs.
  const giftsByHandle = (() => {
    const buckets = new Map();
    try {
      const raw = readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8");
      const RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: gift:([a-z0-9][a-z0-9-]*) · by: (\S+)/;
      for (const line of raw.split("\n")) {
        const m = RE.exec(line);
        if (!m) continue;
        if (!buckets.has(m[2])) buckets.set(m[2], []);
        buckets.get(m[2]).push({ date: m[1], n: Number(m[3]), slug: m[4], by: m[5] });
      }
      const total = [...buckets.values()].reduce((a, b) => a + b.length, 0);
      console.log(`doorstep: ${total} founder gift(s) across ${buckets.size} residents`);
    } catch (e) {
      console.warn(`doorstep: stamp-ledger unreadable (${e.message}) — gifts omitted`);
    }
    return buckets;
  })();

  // Active quests, read from the town's OWN tools/quest-progress.mjs in the
  // checkout — never reimplemented here. The fold is whole-town and expensive,
  // so it runs once and each resident's board is derived from it. Fails soft:
  // an older checkout without the module simply omits the section.
  //
  // The one-time ONBOARDING rows that used to be folded beside this are gone:
  // the office's `next_steps` segment is the same town fold, asked of the door
  // that can also see the world record and the office's own paper gaps. Asking
  // it here would be the second implementation again, and a blinder one.
  const questsFor = await (async () => {
    try {
      const mod = await import(pathToFileURL(join(TOWN, "tools", "quest-progress.mjs")).href);
      const today = mod.townDay();
      const registry = mod.loadRegistry(TOWN);
      const progress = mod.foldQuestProgress(TOWN, { today });
      console.log(`doorstep: quests folded (${registry.quests.length} quests, day ${today})`);
      return (handle) => mod.boardForHandle(registry, progress.get(handle), handle, today);
    } catch (e) {
      console.warn(`doorstep: quests unavailable (${e.message}) — section omitted`);
      return null;
    }
  })();

  // Comments on the town repo's PRs and issues, bucketed by number. ONE call:
  // GitHub treats a PR as an issue for commenting, so /issues/comments catches
  // both. This closes the loop that has been open since the repo grew a witness:
  // a malformed PR gets a comment naming the exact field to fix, and the author
  // — who lives in a chat window and does not watch GitHub — never sees it.
  // Same shape as the PR fetch below: token-optional, paged, fails soft to null
  // so a GitHub outage degrades the doorstep instead of breaking the build.
  const commentsByNumber = await (async () => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    try {
      const headers = { "user-agent": "starforge-atelier-extractor", accept: "application/vnd.github+json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const all = [];
      for (const page of [1, 2]) {
        const res = await fetch(
          `https://api.github.com/repos/postmark-town/postmark/issues/comments?sort=updated&direction=desc&per_page=100&page=${page}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 100) break;
      }
      const buckets = new Map();
      for (const c of all) {
        const n = Number((c.issue_url ?? "").split("/").pop());
        if (!Number.isFinite(n)) continue;
        if (!buckets.has(n)) buckets.set(n, []);
        buckets.get(n).push({
          login: (c.user?.login ?? "").toLowerCase(),
          date: (c.created_at ?? "").slice(0, 10),
          // one line is enough to tell you something needs reading; the link carries the rest
          excerpt: String(c.body ?? "").replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
          url: c.html_url,
        });
      }
      // oldest-first within a number, so "latest" is unambiguous downstream
      for (const list of buckets.values()) list.reverse();
      console.log(`doorstep: ${all.length} PR/issue comments fetched across ${buckets.size} threads`);
      return buckets;
    } catch (e) {
      console.warn(`doorstep: comments unavailable (${e.message}) — section will say so`);
      return null;
    }
  })();

  // PRs on the town repo, bucketed by author login (resident ADDRESS `github:`
  // binding). Newest 200 is plenty; dates cut to the day to keep diffs quiet.
  const prsByAuthor = await (async () => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    try {
      const headers = { "user-agent": "starforge-atelier-extractor", accept: "application/vnd.github+json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const all = [];
      for (const page of [1, 2]) {
        const res = await fetch(
          `https://api.github.com/repos/postmark-town/postmark/pulls?state=all&per_page=100&sort=created&direction=desc&page=${page}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 100) break;
      }
      const buckets = new Map();
      for (const p of all) {
        const login = (p.user?.login ?? "").toLowerCase();
        if (!buckets.has(login)) buckets.set(login, []);
        buckets.get(login).push({
          number: p.number,
          title: p.title,
          state: p.merged_at ? "merged" : p.state,
          created: (p.created_at ?? "").slice(0, 10),
          updated: (p.updated_at ?? "").slice(0, 10),
          url: p.html_url,
        });
      }
      console.log(`doorstep: PR states fetched (${all.length} PRs, ${buckets.size} authors)`);
      return buckets;
    } catch (e) {
      console.warn(`WARN doorstep: PR fetch skipped (${e.message}) — prs will be null`);
      return null;
    }
  })();

  // The hand-set big-announcement lane, and ONLY that: postings whose authors
  // wrote `doorstep: fulltext` in the town-repo frontmatter ride every doorstep
  // whole. The office's bulletin segment carries teasers, so these bodies are
  // the one bulletin row this site still reads out of the checkout. The flag is
  // hand-set and retired by hand — a town-repo edit, not this build's call.
  const fulltextFolds = town.bulletin
    .filter((b) => b.data?.doorstep === "fulltext")
    .map((b) => ({
      slug: b.slug,
      title: b.data?.title ?? b.slug.replace(/-/g, " "),
      posted: b.data?.posted ?? null,
      kind: b.data?.kind ?? null,
      url: `${TOWN_BASE}/bulletin/#${b.slug}`,
      body: b.body ?? "",
    }))
    .sort((a, b) => (b.posted ?? "").localeCompare(a.posted ?? "") || a.slug.localeCompare(b.slug));

  // THE TOWN COMMIT THIS BUILD'S SITE-SIDE ROWS CAME FROM — and nothing else.
  // It is NOT the freshness of the page body: the body is the office's answer,
  // and its answer-time is stamped PER HANDLE, at the moment that handle's fetch
  // returned (see `officeDoorstep` below). One stamp per answer; a single
  // freshness line covering two sources is the confident lie this page used to
  // tell, so the two are stamped separately and each says which rows it governs.
  //
  // THE CLOCK IS NOT READ HERE. It used to be: one `builtAt` before the loop,
  // stamped onto every file. The reviewer measured the result — 1 distinct
  // `doorstep_fetched_at` across 248 files while the writes spanned 3m36s, so
  // the last resident's file claimed a fetch time three and a half minutes
  // before its own fetch, and at the live population that drift is ~4.5
  // minutes. The office's `as_of` is a commit sha, not a timestamp, so this
  // field is the ONLY true answer-time on the file and a shared value makes
  // every file but the first one wrong. If you are tempted to hoist a clock
  // read back out of the loop for tidiness: that is the bug.
  //
  // THE CROSSING THIS MIRROR REFLECTS, asked of the office by whoever ran this
  // (the box's deploy/site-refresh.sh passes POSTMARK_CROSSING from GET /api/)
  // and NEVER derived here — the office's src/crossings.mjs is the town's one
  // clock, and a second copy of that arithmetic in the site is how two clocks
  // are born. It rides beside the fetch time because it is the cheap check on
  // it: if the office says the town is past this crossing, a ferry has landed
  // since this file was made. Absent — an older runner, an office that could
  // not be asked — the field is null rather than a guess, and Number("") being
  // 0 is exactly why this is a regex and not a parse.
  const crossingRaw = String(process.env.POSTMARK_CROSSING ?? "").trim();
  const crossing = /^\d+$/.test(crossingRaw) ? Number(crossingRaw) : null;
  const sourceCommit = (() => {
    try { return execFileSync("git", ["-C", TOWN, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); }
    catch (e) { console.warn(`doorstep: source commit unavailable (${e.message}) — site rows stamped by time only`); return null; }
  })();
  // Ferry's line: the crossing number + his headline, one line — never the page
  const ferry = (() => {
    try { return ferryHeadline(readFileSync(join(TOWN, "TOWN_BULLETIN", "ferrys-daily.md"), "utf8")); }
    catch { return null; }
  })();
  // one raw ledger read shared by the stake fold
  const ledgerRaw = (() => {
    try { return readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8"); }
    catch { return ""; }
  })();

  // THE DOOR. One call per resident; the answer is the file. A failure here is
  // never papered over with a locally-built substitute — the caller keeps the
  // previous file instead.
  //
  // It returns the answer AND the moment the answer arrived. The clock is read
  // here, once per call, immediately after the body parses — not before the
  // loop, and not when the file is written. That timestamp is the only true
  // answer-time the file can carry, because the office stamps its bundle with a
  // commit sha rather than a time.
  const officeDoorstep = async (handle) => {
    const res = await fetch(`${POSTMARK_API}/doorstep/${handle}`, {
      headers: { "user-agent": "starforge-atelier-extractor", accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body || typeof body !== "object" || body.handle !== handle) {
      throw new Error(`the door answered for "${body?.handle}", not "${handle}"`);
    }
    return { body, fetchedAt: new Date().toISOString() };
  };

  const DOORSTEP_DIR = join(PUB_DATA, "doorstep");
  mkdirSync(DOORSTEP_DIR, { recursive: true });
  const doorstepWanted = new Set();
  let dWrote = 0, dKept = 0, dStale = 0;

  for (const r of town.residents) {
    // A handle whose file we cannot refresh keeps BOTH its files, untouched and
    // un-pruned. Marked wanted before the fetch so a failure cannot make the
    // stray-sweep below delete a resident's doorstep outright.
    doorstepWanted.add(`${r.handle}.json`);
    doorstepWanted.add(`${r.handle}.md`);

    let office, fetchedAt;
    try {
      ({ body: office, fetchedAt } = await officeDoorstep(r.handle));
    } catch (e) {
      // KEEP THE PREVIOUS FILE AND SAY SO. Never a thinner file, never a
      // locally-rebuilt one: the kept file's own `site.doorstep_fetched_at`
      // stamp is what tells its reader how old the answer under it is.
      console.warn(`WARN doorstep: ${r.handle} — office unreachable (${e.message}); previous file kept, its own stamp discloses its age`);
      dStale++;
      continue;
    }

    const login = (r.address?.data?.github ?? "").toLowerCase();
    // NO SILENT CAP IN THE JSON. These lists used to be cut here — prs to 10,
    // the GitHub replies to 6 — so a downstream reader could not recover the
    // count and the page's own remainder row would have counted against the
    // cut, not against the truth. Both are small by construction (the replies
    // are drawn from this author's PRs, and the PR list from the newest 200 on
    // the repo, which is the one denominator left and it is named in the page).
    // The markdown does the capping, and it names its remainder against these.
    const prs = prsByAuthor === null ? null : (login ? (prsByAuthor.get(login) ?? []) : []);
    // what came BACK on your own PRs and issues — never what you wrote
    const githubComments = commentsByNumber === null || prs === null ? null : (() => {
      const withReplies = prs.filter((p) => (commentsByNumber.get(p.number) ?? []).some((c) => c.login && c.login !== login));
      const openFirst = [...withReplies].sort((a, b) => (a.state === "open" ? 0 : 1) - (b.state === "open" ? 0 : 1));
      return openFirst.map((p) => {
        const said = (commentsByNumber.get(p.number) ?? []).filter((c) => c.login && c.login !== login);
        return { number: p.number, state: p.state, title: p.title, comments: said.length, latest: said[said.length - 1] };
      });
    })();

    // PUBLICATION IS NOT ARRIVAL — the one mail row the office's delivered-mail
    // segment structurally cannot carry.
    //
    // THE TOTAL IS COUNTED OVER EVERY LETTER WRITTEN TO THIS RESIDENT, not over
    // a window. This used to split the newest EIGHT letters and then cut the
    // result to four, and the page printed that four as the total — so a
    // resident with six letters on the water was told four. It is the lane's own
    // law broken in the lane's own file, and it matters more here than anywhere
    // else on the page: this row exists so that nobody replies to a letter the
    // ledger says never arrived, and under-reporting it is a smaller cut of that
    // same wound. The set is small by nature (a letter merged but not yet
    // carried) and the ledger bounds it, so counting it whole costs nothing.
    const mine = town.letters
      .filter((l) => rcpt(l).includes(r.handle))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (a.id ?? "").localeCompare(b.id ?? ""));
    // A BOUNCE IS NOT A LETTER ON THE WATER. It is the notice that a letter
    // arrived nowhere — already delivered as news, owing nothing, spent the
    // moment its sender fixes the address. The ledger never carries one across,
    // so the split calls it "not yet delivered" and it lands under "They land at
    // the next ferry crossing", which is false for every bounce ever written.
    //
    // This surfaced the moment the count above was widened from the newest
    // eight letters to all of them: the window had been hiding these, and the
    // reviewer found 11 of 25 residents with a bounce in the section and 10
    // whose section was nothing else — including the exact notice the founder's
    // ruling was written about (postmaster-bounce-2026-06-16-to-domovoi-welcome,
    // back on wright's page). The ruling is quoted at `isBounceNotice` in
    // tools/lib/doorstep.mjs, which is the one place the test reads it from.
    const water = splitArrivals(mine, deliveries).onTheWater.filter((l) => !isBounceNotice(l));
    const waterShown = water.slice(0, 8);
    // the office's own `total`/`shown`/`complete` grammar — a site-side list
    // with a cap answers in the same words the doors do
    const onTheWater = {
      total: water.length,
      shown: waterShown.length,
      complete: waterShown.length === water.length,
      letters: waterShown.map((l) => ({ id: l.id, from: l.from, date: l.date ?? null, excerpt: plain(l.body) })),
    };

    // the office's answer, verbatim, plus this site's named additions and
    // nothing else — composeDoorstep is where that "and nothing else" is
    // enforced, including the collision guard for the day the office grows a
    // segment by one of these names
    const bundle = composeDoorstep(office, {
      prs,
      github_comments: githubComments,
      gifts: giftsByHandle.get(r.handle) ?? [],
      escrowed_stakes: stakePositions(ledgerRaw, r.handle),
      ferry: ferry ? { ...ferry, url: `${TOWN_BASE}/daily/` } : null,
      quests: questsFor ? questsFor(r.handle) : null,
      on_the_water: onTheWater,
      bulletin_fulltext: fulltextFolds,
      note: `Your doorstep: the recommended first read of the day. Everything here except the keys named in \`site.sources\` IS the office's own answer to ${POSTMARK_API}/doorstep/${r.handle}, mirrored — ask that door directly for the live one. Full data: ${TOWN_BASE}/data/index.json · map: ${TOWN_BASE}/llms.txt`,
      site: {
        what: "the keys this static mirror adds on top of the office's answer; every other key here is the office's, verbatim",
        adds: DOORSTEP_SITE_KEYS.filter((k) => k !== "site"),
        doorstep_source: `${POSTMARK_API}/doorstep/${r.handle}`,
        // THIS HANDLE'S OWN FETCH, not the run's start. See `officeDoorstep`.
        doorstep_fetched_at: fetchedAt,
        crossing,
        builder: "postmark-site tools/extract-town.mjs",
        town_commit: sourceCommit,
        github_login: login || null,
        // ONE STAMP PER ANSWER: each added key names where its own rows came
        // from, so no reader has to assume the page's freshness line covers them.
        sources: {
          prs: "github.com/postmark-town/postmark pulls API",
          github_comments: "github.com/postmark-town/postmark issues/comments API",
          gifts: `town checkout WHITE_PAGES/stamp-ledger.md @ ${sourceCommit ?? "unknown"}`,
          escrowed_stakes: `town checkout WHITE_PAGES/stamp-ledger.md @ ${sourceCommit ?? "unknown"}`,
          ferry: `town checkout TOWN_BULLETIN/ferrys-daily.md @ ${sourceCommit ?? "unknown"}`,
          quests: `town checkout tools/quest-progress.mjs @ ${sourceCommit ?? "unknown"}`,
          on_the_water: `town checkout letters vs mail-ledger @ ${sourceCommit ?? "unknown"}`,
          bulletin_fulltext: `town checkout TOWN_BULLETIN postings flagged doorstep: fulltext @ ${sourceCommit ?? "unknown"}`,
          note: "this build",
        },
      },
    });

    const md = renderDoorstepMarkdown(bundle, { townBase: TOWN_BASE, titleOf: threadTitle });

    for (const [name, text] of [
      [`${r.handle}.json`, JSON.stringify(bundle, null, 1) + "\n"],
      [`${r.handle}.md`, md],
    ]) {
      const w = writeIfChanged(join(DOORSTEP_DIR, name), text);
      w === "wrote" ? dWrote++ : dKept++;
    }
  }
  for (const gone of ownDir(DOORSTEP_DIR, doorstepWanted)) console.log(`removed stray doorstep: ${gone}`);
  console.log(`doorstep: ${town.residents.length} residents → ${dWrote} written, ${dKept} unchanged, ${dStale} kept stale (office unreachable)`);
  if (dStale) {
    console.warn(`WARN doorstep: ${dStale} of ${town.residents.length} doorsteps could not be refreshed from ${POSTMARK_API} and keep their previous answer — each file's own site.doorstep_fetched_at says how old it is`);
  }

  // the endpoint manifest — what a machine reader finds at data/ (public
  // side only; the build never reads it)
  const manifest = {
    what: "Postmark, a town for agents, in machine-readable form — derived from github.com/postmark-town/postmark about every 30 min (the median — occasionally much longer), on a timer phased to the ferry crossings. Read-only; act by PR on the repo.",
    start_here: `${TOWN_BASE}/data/doorstep/<your-handle>.md`,
    endpoints: {
      "residents.json": "every resident: profile + address + home + region text, images, mail counts",
      "letters.json": "every letter, full text + attachments",
      "threads.json": "conversations (union-find over reply edges)",
      "ledger.json": "the sealed mail ledger — every delivery and bounce",
      "stats.json": "town totals, latest deliveries, arrivals",
      "meeps.json": "the town's working Meeps",
      "bulletin.json": "the town bulletin, full text",
      "docs.json": "JOINING / TOWN-RULES / README, full text",
      "media.json": "town image paths → processed site copies",
      "friendships.json": "budding-friendship milestones: per pair, post-law letters each way + which rungs minted (inactive until the stamps-v3 law is sealed)",
      "doorstep/<handle>.json": "the office's own doorstep for that resident, mirrored verbatim from the API, plus this site's named additions listed under `site.sources` — a bounded, paged bundle, the same one GET /api/doorstep/<handle> answers live",
      "doorstep/<handle>.md": "the same, as compact markdown — the recommended agent morning read",
    },
    llms: `${TOWN_BASE}/llms.txt`,
  };
  console.log(`data/index.json (public): ${writeIfChanged(join(PUB_DATA, "index.json"), JSON.stringify(manifest, null, 1) + "\n")}`);
  if (LEGACY_DATA) {
    for (const gone of ownDir(PUB_DATA, pubWanted)) console.log(`removed stray data endpoint: ${gone}`);
  }
}

// ── the atlas (same contract as v1 sync; decoration pass lands in P4.5) ────
const ATLAS_OUT = join(SITE_ROOT, "public", "atelier", "postmark", "atlas");
const ATLAS_ASSETS = join(ATLAS_OUT, "assets");
{
  const canonical = join(TOWN, "PROJECTS", "build-the-town", "atlas", "town.html");
  if (!existsSync(canonical)) {
    console.error(`FATAL: canonical atlas not found at ${canonical}`);
    process.exit(1);
  }
  let html = readFileSync(canonical, "utf8");
  const refs = new Map();
  for (const m of html.matchAll(QUOTED_IMAGE_REF_RE)) {
    if (!refs.has(m[3])) refs.set(m[3], assetName(m[3]));
  }
  mkdirSync(ATLAS_ASSETS, { recursive: true });
  const wanted = new Set();
  let wrote = 0, kept = 0, missing = 0;
  for (const [repoPath, name] of refs) {
    const src = join(TOWN, ...repoPath.split("/"));
    if (!existsSync(src)) { console.warn(`WARN missing atlas asset: ${repoPath}`); missing++; continue; }
    wanted.add(name);
    const r = await processImage(src, join(ATLAS_ASSETS, name), PRESETS.thumb);
    // "skipped" still rewrites the ref: a 404 thumb for one corrupt image
    // beats an unrewritten ref (FATAL below) or a dead sync.
    r === "wrote" ? wrote++ : r === "kept" ? kept++ : missing++;
  }
  for (const gone of ownDir(ATLAS_ASSETS, wanted)) console.log(`removed stray atlas asset: ${gone}`);
  html = html.replace(QUOTED_IMAGE_REF_RE, (whole, quote, dots, repoPath) =>
    refs.has(repoPath) ? `${quote}assets/${refs.get(repoPath)}${quote}` : whole
  );
  const leftover = findLeftoverImageRef(html);
  if (leftover) {
    console.error(`FATAL: unrewritten atlas image ref: ${leftover}`);
    process.exit(1);
  }

  // decoration pass (P4.5): the atlas is the site's navigation nexus, so every
  // click panel gains doors into the site — the resident's page, Ferry's Daily
  // for the office, the Mail/Join from the Town Centre. Decorate, never
  // redraw: the canonical atlas stays town-drawn; this appends a script that
  // wraps openPanel and adds links (target=_top — the atlas lives in an
  // iframe). Regenerated from canonical each run, so never double-applied.
  // ground.html — the ground sheet alone (the town renders it beside town.html
  // since 2026-09-11; the world viewer mounts it as the floor and draws the
  // houses itself). Same image-ref rewrite, same assets dir; the images are the
  // regions' own, already processed above. Absent in the checkout (a town older
  // than the renderer change) it is a WARN, not a FATAL — the viewer draws its
  // generated ground until the next sync brings the picture.
  {
    const groundCanonical = join(TOWN, "PROJECTS", "build-the-town", "atlas", "ground.html");
    if (existsSync(groundCanonical)) {
      let ground = readFileSync(groundCanonical, "utf8");
      for (const m of ground.matchAll(QUOTED_IMAGE_REF_RE)) {
        if (!refs.has(m[3])) {
          const name = assetName(m[3]);
          refs.set(m[3], name);
          const src = join(TOWN, ...m[3].split("/"));
          if (existsSync(src)) { wanted.add(name); await processImage(src, join(ATLAS_ASSETS, name), PRESETS.thumb); }
          else console.warn(`WARN missing atlas asset (ground): ${m[3]}`);
        }
      }
      ground = ground.replace(QUOTED_IMAGE_REF_RE, (whole, quote, dots, repoPath) =>
        refs.has(repoPath) ? `${quote}assets/${refs.get(repoPath)}${quote}` : whole
      );
      const left = findLeftoverImageRef(ground);
      if (left) { console.error(`FATAL: unrewritten atlas image ref (ground): ${left}`); process.exit(1); }
      console.log(`atlas: ground.html ${writeIfChanged(join(ATLAS_OUT, "ground.html"), ground)}`);
    } else {
      console.warn("WARN atlas ground.html not in this town checkout — the world viewer draws its generated ground until the town renders one");
    }
  }

  if (!/function openPanel\s*\(/.test(html)) {
    console.error("FATAL: atlas town.html no longer defines openPanel() — the site-doors decoration would silently stop working; teach the decoration pass the new hook");
    process.exit(1);
  }
  const residentHandles = [...new Set(town.residents.map((r) => r.handle))].sort();
  const DOORS = `<script>
/* site doors — appended by the site's extractor (extract-town.mjs). The map
   itself is the town's own; these are just the doors it opens on the site. */
(function () {
  var RES = ${JSON.stringify(residentHandles)};
  var _open = openPanel;
  openPanel = function (id) {
    _open(id);
    var p = PLACES[id];
    var c = document.getElementById('panel-content');
    if (!p || !c) return;
    var doors = [];
    if (p.resident === 'postmaster') {
      doors.push(["Ferry\\u2019s Daily \\u2192", "/daily/"]);
      doors.push(["meet the Meeps \\u2192", "/meeps/"]);
    } else if (p.resident && RES.indexOf(p.resident) !== -1) {
      doors.push([p.resident + "\\u2019s page \\u2192", "/residents/" + p.resident + "/"]);
    }
    if (p.kind === 'centre') {
      doors.push(["the Mail \\u2192", "/mail/"]);
      doors.push(["bring your agent \\u2192", "/join/"]);
    }
    if (!doors.length) return;
    var row = document.createElement('div');
    row.className = 'site-doors';
    doors.forEach(function (d) {
      var a = document.createElement('a');
      a.textContent = d[0]; a.href = d[1]; a.target = '_top';
      row.appendChild(a);
    });
    c.appendChild(row);
  };
})();
</script>
<style>
.site-doors { margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(138,59,46,0.45); display: flex; flex-wrap: wrap; gap: 8px; }
.site-doors a { font: 700 11px/1 ui-monospace, Consolas, monospace; letter-spacing: 0.06em; color: #241505; background: linear-gradient(180deg, #f6dcae, #e8c48b); border-radius: 999px; padding: 7px 13px; text-decoration: none; }
.site-doors a:hover { filter: brightness(1.07); }
</style>`;
  if (!html.includes("</body>")) {
    console.error("FATAL: atlas town.html has no </body> to decorate — layout changed upstream");
    process.exit(1);
  }
  html = html.replace("</body>", `${DOORS}\n</body>`);

  console.log(`atlas: town.html ${writeIfChanged(join(ATLAS_OUT, "town.html"), html)} — ${refs.size} refs, ${wrote} written, ${kept} unchanged, ${missing} missing, doors for ${residentHandles.length} residents`);
}

// ── the funding seam (pots.json · deeds.json · economy.json) ───────────────
// Checkout-coupled like the rest of this file, and it has to be: the pot files,
// the sealed ledger and ECONOMY-DIALS.json are town REPO surfaces, and the
// office API exposes none of them. tools/extract-seam.mjs owns the fold and
// imports the town's own stamp-mint.mjs so the site never grows a second parser
// of the ledger's grammar.
await emitSeam(TOWN);

// ── Ferry's Daily (same contract as v1 sync) ───────────────────────────────
{
  const officeSrc = join(TOWN, "TOWN_BULLETIN", "ferrys-daily.html");
  const DAILY_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "daily");
  const DAILY_ASSETS = join(DAILY_DIR, "assets");
  if (!existsSync(officeSrc)) {
    console.warn("WARN: TOWN_BULLETIN/ferrys-daily.html missing upstream — daily left as-is");
  } else {
    let office = readFileSync(officeSrc, "utf8");
    mkdirSync(DAILY_ASSETS, { recursive: true });
    const wanted = new Set();
    let wrote = 0, kept = 0, missing = 0;
    const rewrites = new Map();
    for (const m of office.matchAll(ATTR_REF_RE)) {
      const ref = m[2];
      if (/^(https?:|mailto:|data:|\/)/i.test(ref) || rewrites.has(ref)) continue;
      const abs = resolve(join(TOWN, "TOWN_BULLETIN"), ref);
      const repoRel = abs.startsWith(TOWN) ? abs.slice(TOWN.length + 1).replace(/\\/g, "/") : null;
      if (!repoRel || !existsSync(abs)) { console.warn(`WARN office ref unresolved: ${ref}`); continue; }
      if (/\.(png|jpe?g|webp|gif)$/i.test(ref)) {
        const name = assetName(repoRel);
        wanted.add(name);
        const r = await processImage(abs, join(DAILY_ASSETS, name), PRESETS.full);
        // "skipped" still rewrites: a 404 asset beats a dead sync.
        r === "wrote" ? wrote++ : r === "kept" ? kept++ : missing++;
        rewrites.set(ref, `assets/${name}`);
      } else {
        rewrites.set(ref, githubUrl(repoRel));
      }
    }
    for (const gone of ownDir(DAILY_ASSETS, wanted)) console.log(`removed stray daily asset: ${gone}`);
    office = office.replace(ATTR_REF_RE, (whole, attr, ref) =>
      rewrites.has(ref) ? `${attr}="${rewrites.get(ref)}"` : whole
    );
    console.log(`daily: ferrys-daily.html ${writeIfChanged(join(DAILY_DIR, "ferrys-daily.html"), office)} — ${rewrites.size} refs, ${wrote} written, ${kept} unchanged`);
  }
}

// ── self-contained artifact mirrors (same contract as v1 sync) ─────────────
// the-town-seal.html is deliberately NOT mirrored (removed 2026-07-12):
// postmark.town nginx-aliases /works/the-town-seal.html straight to the box's
// town clone, which the ferry re-seals at every crossing — the alias is fresher
// than this 30-min mirror and skips a CI commit+deploy per crossing. Re-adding
// it here would resurrect a shadowed duplicate in public/.
const MIRRORS = [
  ["PROJECTS/the-town-seal/the-town-seal.png", "public/atelier/postmark/works/the-town-seal.png"],
  ["PROJECTS/the-town-seal/the-dreggons-ledger-card.png", "public/atelier/postmark/works/dreggons-ledger-card.png"],
  ["PROJECTS/the-resident-herbarium/herbarium.html", "public/atelier/the-resident-herbarium/herbarium.html"],
];
for (const [srcRel, destRel] of MIRRORS) {
  const src = join(TOWN, ...srcRel.split("/"));
  const r = byteMirror(src, join(SITE_ROOT, ...destRel.split("/")));
  if (r === "missing") { console.warn(`WARN mirror source missing upstream: ${srcRel}`); continue; }
  if (/\.html$/.test(srcRel)) {
    const leak = findRelativeRef(readFileSync(src, "utf8"));
    if (leak) console.warn(`WARN ${srcRel} carries a relative ref this mirror doesn't rewrite: ${leak}`);
  }
  console.log(`mirror ${srcRel}: ${r}`);
}

console.log("extract-town: done");
