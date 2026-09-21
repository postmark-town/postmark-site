import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { composeStamp, gather, main, readWorldSha, SCHEMA } from "../tools/build-stamp.mjs";

const AT = "2026-08-25T23:00:00.000Z";
// A complete build names its world. Fixtures that assert "no notes" carry this.
const WORLD = { sha: "256db2fe02b4c786f4f6182629d896c38cd2b442", from: "package-lock.json", note: null };
// …and, since POS-180, a complete build can also say what its fetch could not
// get. `[]` is "asked for everything and got it"; the absence of the list is a
// note, because a stamp that says nothing went wrong BECAUSE it failed to look
// is the false all-clear this file exists to refuse. Fixtures that assert "no
// notes" carry this for the same reason they carry WORLD.
const NO_PROBLEMS = [];

/** The served manifest, where a `gather()` fixture's problems list comes from. */
function writeManifestAt(root, problems = []) {
  const dir = join(root, "public", "atelier", "postmark", "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.json"), JSON.stringify({ as_of: "abc123", endpoint_gaps: [], problems }));
  return root;
}

test("the release lane stamps two shas on two different clocks", () => {
  // Prod builds CODE from the newest release/* tag and overlays town DATA from
  // main. One number cannot hold both, and comparing the code against main
  // would report a permanent staleness that is actually the design working.
  const s = composeStamp({
    channel: "release",
    codeSha: "aaaaaaaaaaaaaaaa",
    codeRef: "release/2026-w35.1",
    townDataSha: "bbbbbbbbbbbbbbbb",
    townSha: "cccccccccccccccc",
    crossing: 149,
    builtAt: AT,
    world: WORLD,
    problems: NO_PROBLEMS,
  });
  assert.equal(s.schema, SCHEMA);
  assert.equal(s.channel, "release");
  assert.equal(s.code_sha, "aaaaaaaaaaaaaaaa");
  assert.equal(s.code_ref, "release/2026-w35.1");
  assert.equal(s.town_data_sha, "bbbbbbbbbbbbbbbb");
  assert.match(s.town_data_from, /overlaid from site main/);
  assert.deepEqual(s.notes, []);
});

test("the snapshot lane says the two shas share one commit rather than leaving a reader to guess", () => {
  // Dev has no tag pin and no overlay, so code and data genuinely are the same
  // commit. Equal fields must not be readable as "verified in sync".
  const s = composeStamp({ channel: "snapshot", codeSha: "cccccccc", codeRef: "main", townDataSha: null, builtAt: AT, world: WORLD, problems: NO_PROBLEMS });
  assert.equal(s.town_data_sha, "cccccccc");
  assert.match(s.town_data_from, /the checkout itself/);
  assert.deepEqual(s.notes, [], "a snapshot build with no overlay is complete, not degraded");
  // …and that stays true now that the stamp carries a town commit and a
  // crossing. Dev has no town checkout and no box refresh asking the office, so
  // those two are absent BY DESIGN here — noting them every time would make the
  // notes array a standing complaint nobody reads.
  assert.equal(s.town_sha, null);
  assert.equal(s.crossing, null);
});

test("an unknown is null plus a note — never a plausible guess", () => {
  // A stamp that is confidently wrong is worse than one that admits it cannot
  // say, because the watcher downstream believes it.
  const noSha = composeStamp({ channel: "release", codeSha: null, codeRef: "release/x", townDataSha: "bbb", builtAt: AT });
  assert.equal(noSha.code_sha, null);
  assert.ok(noSha.notes.some((n) => /could not read the built commit/.test(n)));

  // The release lane must NOT fall back to the code sha for town data — that
  // would silently assert the overlay happened when it may not have.
  const noOverlay = composeStamp({ channel: "release", codeSha: "aaa", codeRef: "release/x", townDataSha: null, builtAt: AT });
  assert.equal(noOverlay.town_data_sha, null, "the release lane must not borrow the code sha for the data sha");
  assert.ok(noOverlay.notes.some((n) => /did not report the overlay/.test(n)));

  const noLane = composeStamp({ channel: undefined, codeSha: "aaa", codeRef: null, townDataSha: null, builtAt: AT });
  assert.equal(noLane.channel, null);
  assert.ok(noLane.notes.some((n) => /PUBLIC_CHANNEL/.test(n)));
});

test("gather reads HEAD, not github.sha, and survives a git that will not answer", () => {
  // github.sha names the commit that TRIGGERED the workflow; the release lane
  // then checks out the tag and github.sha does not follow it. HEAD is read
  // after every checkout, so it is the sha that was actually compiled.
  const exec = (bin, args) => {
    assert.equal(bin, "git");
    assert.deepEqual(args, ["rev-parse", "HEAD"]);
    return "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n";
  };
  const s = gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w35.1", BUILD_TOWN_DATA_SHA: "f00d" },
    exec,
    now: () => new Date(AT),
  });
  assert.equal(s.code_sha, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  assert.equal(s.built_at, AT);

  // A git that throws costs the build a field, never the build itself.
  const broken = gather({ env: { PUBLIC_CHANNEL: "snapshot" }, exec: () => { throw new Error("not a git repo"); }, now: () => new Date(AT) });
  assert.equal(broken.code_sha, null);
  assert.equal(broken.town_data_sha, null);
});

// ── the town record and the crossing ────────────────────────────────────────
//
// THE LAW THESE ASSERT, verbatim from EPICS/POSTMARK/freshness-architecture.md
// § the mushy middle:
//
//   "mushiness must be disclosed — the page states when it was generated and
//    which ferry crossing it reflects, says 'a ferry has landed since this page
//    was made' when true, and never prints a cadence promise it does not
//    control."
//
// A page cannot say which crossing it reflects unless the build writes it down.
// These are the field that makes the sentence possible.

test("the stamp names the TOWN record it read and the crossing it reflects", () => {
  const s = composeStamp({
    channel: "release", codeSha: "a".repeat(40), codeRef: "release/2026-w35.1",
    townDataSha: "b".repeat(40), townSha: "c".repeat(40), crossing: 149, builtAt: AT, world: WORLD, problems: NO_PROBLEMS,
  });
  assert.equal(s.town_sha, "c".repeat(40));
  assert.equal(s.crossing, 149);
  assert.deepEqual(s.notes, [], "a build that knows both is complete, not degraded");
  assert.notEqual(s.town_sha, s.town_data_sha,
    "the town commit and the site commit the data was copied from are DIFFERENT questions — one field cannot answer both");
});

test("crossing ZERO is a real crossing and must survive — the falsifier for a truthy test", () => {
  // `if (crossing)` would drop 0, and 0 is the town's first ferry. The bug
  // would be invisible for the rest of the town's life and wrong on the one
  // day it mattered, which is exactly the kind that ships.
  const s = composeStamp({ channel: "release", codeSha: "a", codeRef: "r", townDataSha: "b", townSha: "c", crossing: 0, builtAt: AT });
  assert.equal(s.crossing, 0);
  assert.deepEqual(s.notes.filter((n) => /crossing/.test(n)), [], "zero is known, not unknown");
});

test("an unreachable office is null plus a note — NEVER crossing 0, which is a real ferry in June", () => {
  // THE FALSIFIER. gather() takes BUILD_CROSSING from a shell, and the box
  // script passes `$(crossing_now)`, which is the EMPTY STRING when the office
  // did not answer. Number("") is 0. A build that could not ask would then
  // stamp the town's very first crossing and the site would report itself 150
  // ferries behind — a loud, confident lie, which is worse than the silence.
  for (const raw of ["", "   ", undefined, "not-a-number", "-3"]) {
    const s = gather({
      env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), ...(raw === undefined ? {} : { BUILD_CROSSING: raw }) },
      exec: () => "a".repeat(40) + "\n",
      now: () => new Date(AT),
    });
    assert.equal(s.crossing, null, `BUILD_CROSSING=${JSON.stringify(raw)} must be unknown, not a number`);
    assert.ok(s.notes.some((n) => /cannot say which ferry crossing/.test(n)),
      "and it must say WHY, so a reader of the stamp knows the office was unreachable rather than the field being new");
  }

  // and a real number still gets through the same gate
  assert.equal(gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "149" },
    exec: () => "a".repeat(40) + "\n", now: () => new Date(AT),
  }).crossing, 149);
});

test("a town sha that is not a sha is unknown, not repeated back", () => {
  // The box passes this through a shell too. A stamp that echoes "none" or a
  // half-written value would put it on the page as if it were a commit.
  for (const bad of [null, "", "none", "HEAD", "not a sha"]) {
    const s = composeStamp({ channel: "release", codeSha: "a", codeRef: "r", townDataSha: "b", townSha: bad, crossing: 1, builtAt: AT });
    assert.equal(s.town_sha, null);
    assert.ok(s.notes.some((n) => /which town record it reflects/.test(n)));
  }
});

test("main writes valid JSON the sentinel can parse, at the path it was given", () => {
  const dir = mkdtempSync(join(tmpdir(), "build-stamp-"));
  const out = join(dir, "nested", "build.json");
  const logged = [];
  const realLog = console.log;
  console.log = (m) => logged.push(String(m));
  try {
    main(["node", "build-stamp.mjs", "--out", out], {
      env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w35.1", BUILD_TOWN_DATA_SHA: "b".repeat(40) },
      exec: () => "a".repeat(40) + "\n",
      now: () => new Date(AT),
    });
  } finally { console.log = realLog; }

  const parsed = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(parsed.channel, "release");
  assert.equal(parsed.code_sha, "a".repeat(40));
  assert.equal(parsed.town_data_sha, "b".repeat(40));
  assert.ok(parsed.why_two.length > 40, "the stamp explains its own two-tense shape to whoever meets it first");
  assert.ok(logged.some((l) => /build-stamp:/.test(l)));
});

// ── which WORLD this build compiled ──────────────────────────────────────────
//
// 2026-09-08: prod's /world/ ground flipped from the atlas painting to the
// record-drawn townGround() and back across three releases, and no stamp on the
// live site could say which postmark-world was serving at /world-engine/**.
// /data/pin.json is written by the EXTRACT tree from site main's lockfile —
// the FLOOR — while the build tree had advanced to a newer settlement, so it
// named a world the page was not running. The field the night was missing is
// the build tree's own lockfile, read from the build tree.

const LOCK = (sha) => JSON.stringify({ packages: { "node_modules/postmark-world": { version: "0.1.0", resolved: `git+ssh://git@github.com/keeminlee/postmark-world.git#${sha}` } } });
const S63 = "256db2fe02b4c786f4f6182629d896c38cd2b442";
const TRAIN = "91536f7600000000000000000000000000000000";

test("world_sha is read from the tree the stamper runs in — the BUILD tree, never the extract tree's floor", () => {
  const main = mkdtempSync(join(tmpdir(), "build-stamp-main-"));   // the extract tree: site main, the floor
  const build = mkdtempSync(join(tmpdir(), "build-stamp-build-")); // the build tree, advanced by the resolver
  writeFileSync(join(main, "package-lock.json"), LOCK("ecc63613a063ca2e3da262c6306c34b72ae3b9f8"));
  writeFileSync(join(build, "package-lock.json"), LOCK(S63));
  writeManifestAt(build);   // a complete build also knows its fetch got everything (POS-180)
  const env = { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w37.6", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "178" };
  const s = gather({ env, exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root: build });
  assert.equal(s.world_sha, S63);
  assert.equal(s.world_from, "package-lock.json");
  assert.deepEqual(s.notes, [], "a build that names its world is complete");
  // pointed at the extract tree it would name the floor — which is exactly the wrong answer pin.json gives
  assert.equal(gather({ env, exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root: main }).world_sha, "ecc63613a063ca2e3da262c6306c34b72ae3b9f8");
});

test("THE FALSIFIER: flip the lockfile's resolved sha and the stamp follows — it reads the receipt, not a memory or the spec", () => {
  const root = mkdtempSync(join(tmpdir(), "build-stamp-flip-"));
  // package.json still names the floor (the keeper's ceremony bumps it on site
  // main); the lockfile is what the resolver's advance re-locked. The stamp
  // must name the LOCK's sha — the compiled one — and never the spec's.
  writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "postmark-world": `github:keeminlee/postmark-world#${S63}` } }));
  writeFileSync(join(root, "package-lock.json"), LOCK(S63));
  const read = () => gather({ env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "1" }, exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root });
  assert.equal(read().world_sha, S63);
  writeFileSync(join(root, "package-lock.json"), LOCK(TRAIN));
  assert.equal(read().world_sha, TRAIN, "the lockfile moved and the stamp did not — it would be reporting a world it did not compile");
  assert.notEqual(read().world_sha, S63, "package.json's pin must not leak into world_sha: that is the floor, and the floor is the lie this field exists to stop");
  // a lockfile whose resolved names no sha is UNKNOWN plus a reason, never the spec's sha
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/postmark-world": { version: "0.1.0", resolved: "https://registry.npmjs.org/postmark-world/-/postmark-world-0.1.0.tgz" } } }));
  const silent = read();
  assert.equal(silent.world_sha, null);
  assert.equal(silent.world_from, null);
  assert.ok(silent.notes.some((n) => /did not report which postmark-world/.test(n) && /names no sha/.test(n)), silent.notes.join(" | "));
});

test("readWorldSha falls back to the installed package only when the lockfile cannot answer, and says which source spoke", () => {
  const root = mkdtempSync(join(tmpdir(), "build-stamp-nolock-"));
  mkdirSync(join(root, "node_modules", "postmark-world"), { recursive: true });
  writeFileSync(join(root, "node_modules", "postmark-world", "package.json"), JSON.stringify({ name: "postmark-world", gitHead: S63.toUpperCase() }));
  const w = readWorldSha({ root });
  assert.deepEqual(w, { sha: S63, from: "node_modules", note: null }, "gitHead is normalised to lowercase so it compares against git output");
  // …and a tree with neither is a null with BOTH reasons, so a reader knows two doors were tried
  const bare = readWorldSha({ root: mkdtempSync(join(tmpdir(), "build-stamp-bare-")) });
  assert.equal(bare.sha, null);
  assert.match(bare.note, /package-lock\.json could not be read, and the installed package could not be read/);
});

test("world_ref is the lane's name for the world, or null — never derived from the sha", () => {
  const base = { channel: "release", codeSha: "a", codeRef: "r", townDataSha: "b", townSha: "c".repeat(40), crossing: 1, builtAt: AT, world: WORLD, problems: NO_PROBLEMS };
  assert.equal(composeStamp({ ...base, worldRef: "settlement/S63" }).world_ref, "settlement/S63");
  for (const empty of ["", "   ", null, undefined]) assert.equal(composeStamp({ ...base, worldRef: empty }).world_ref, null, `BUILD_WORLD_REF=${JSON.stringify(empty)} is "the lane did not say"`);
  // and a hold on the floor (the box script passes an empty ref) leaves the sha standing on its own
  const held = composeStamp({ ...base, worldRef: "" });
  assert.equal(held.world_sha, WORLD.sha);
  assert.deepEqual(held.notes, [], "an unnamed tag is not a degraded build; an unknown sha is");
});

test("main writes world_sha and world_ref into the JSON the sentinel reads", () => {
  const root = mkdtempSync(join(tmpdir(), "build-stamp-world-main-"));
  writeFileSync(join(root, "package-lock.json"), LOCK(S63));
  writeManifestAt(root);
  const out = join(root, "dist-town", "build.json");
  const realLog = console.log; const logged = [];
  console.log = (m) => logged.push(String(m));
  try {
    main(["node", "build-stamp.mjs", "--out", out], {
      env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w37.6", BUILD_TOWN_DATA_SHA: "b".repeat(40), BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "178", BUILD_WORLD_REF: "settlement/S63" },
      exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root,
    });
  } finally { console.log = realLog; }
  const parsed = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(parsed.world_sha, S63);
  assert.equal(parsed.world_from, "package-lock.json");
  assert.equal(parsed.world_ref, "settlement/S63");
  assert.deepEqual(parsed.notes, []);
  assert.ok(logged.some((l) => /world 256db2fe \(settlement\/S63\)/.test(l)), "the console line names the world too, so a box journal answers the question without curl");
});

// ── WHAT THIS BUILD COULD NOT GET, AS A SERVED VALUE (POS-180, 2026-09-21) ──
//
// POS-166 shipped the drop-and-record pattern and the RECORD went nowhere:
// `problems` was assembled by buildOfficeData and console.warn'd into a build
// log, while writeManifest published `endpoint_gaps` and not `problems`. The
// office's site-sentinel compares SERVED values against REFERENCE values, so it
// could not see that a drop had happened at all. These are the tests for the
// carry: fetch-town.mjs writes the list onto the served manifest, the box's
// overlay rsyncs public/atelier/postmark into the build tree, and the stamper
// reads it back onto /build.json where the sentinel already looks every pass.

test("the problems list travels from the served manifest onto the stamp", () => {
  const root = mkdtempSync(join(tmpdir(), "build-stamp-problems-"));
  writeFileSync(join(root, "package-lock.json"), LOCK(S63));
  writeManifestAt(root, ['residents: the roll named "wright" and the card door answered 404 — HELD OVER']);
  const s = gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "203" },
    exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root,
  });
  assert.equal(s.problems.length, 1);
  assert.match(s.problems[0], /the roll named "wright"/,
    "the bark must name the entity and the door — a count alone tells a reader nothing to act on");
  // A build that published WITH problems is still a complete build: the site is
  // fresh, something in it is held over. That is a finding, not a degradation
  // of the stamp, so it must not also fill `notes`.
  assert.deepEqual(s.notes, [], "problems and notes are different questions");
});

test("an UNREADABLE manifest is null plus a note — never [], which would be a false all-clear", () => {
  // THE FALSIFIER FOR THE WHOLE FIELD. `problems: []` means "asked for
  // everything and got it". A stamper that defaulted to [] when it could not
  // find the manifest would tell the sentinel every build was clean precisely
  // when it had stopped being able to look — the exact shape of lie this file
  // was written to refuse.
  const root = mkdtempSync(join(tmpdir(), "build-stamp-noman-"));
  writeFileSync(join(root, "package-lock.json"), LOCK(S63));
  const s = gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "203" },
    exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root,
  });
  assert.equal(s.problems, null, "unread is not clean");
  assert.notDeepEqual(s.problems, []);
  assert.ok(s.notes.some((n) => /could not read the town manifest/.test(n)),
    "and it says so, so a reader knows the field was unread rather than empty");

  // A manifest that exists but carries no `problems` key is the same answer:
  // an older fetch-town.mjs still writing the pre-POS-180 shape.
  mkdirSync(join(root, "public", "atelier", "postmark", "data"), { recursive: true });
  writeFileSync(join(root, "public", "atelier", "postmark", "data", "index.json"), JSON.stringify({ as_of: "abc", endpoint_gaps: [] }));
  const old = gather({
    env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "r", BUILD_TOWN_DATA_SHA: "b", BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "203" },
    exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root,
  });
  assert.equal(old.problems, null);
});

test("an EMPTY problems list leaves the stamp byte-compatible with today's readers", () => {
  // The additive check. Every field /build.json carried before POS-180 must
  // still be there, unchanged, in the ordinary case — the sentinel, the page's
  // own freshness line and world-pin-publish.mjs all read this file, and none
  // of them knows the new key.
  const before = composeStamp({
    channel: "release", codeSha: "a".repeat(40), codeRef: "release/2026-w40.1",
    townDataSha: "b".repeat(40), townSha: "c".repeat(40), crossing: 203, builtAt: AT, world: WORLD,
    worldRef: "settlement/S63", problems: [],
  });
  for (const key of ["schema", "channel", "built_at", "code_sha", "code_ref", "town_data_sha",
    "town_data_from", "town_sha", "crossing", "world_sha", "world_from", "world_ref", "why_two", "notes"]) {
    assert.ok(key in before, `${key} must survive — an added field may not cost an existing reader its own`);
  }
  assert.deepEqual(before.problems, []);
  assert.deepEqual(before.notes, [], "a clean build with an empty list is complete, not degraded");
  // …and the new key is the ONLY thing that changed shape.
  const legacyKeys = Object.keys(before).filter((k) => k !== "problems");
  const legacy = composeStamp({
    channel: "release", codeSha: "a".repeat(40), codeRef: "release/2026-w40.1",
    townDataSha: "b".repeat(40), townSha: "c".repeat(40), crossing: 203, builtAt: AT, world: WORLD,
    worldRef: "settlement/S63", problems: [],
  });
  for (const k of legacyKeys) assert.deepEqual(legacy[k], before[k]);
});

test("main writes problems into the JSON the sentinel reads, and names the count in the box journal", () => {
  const root = mkdtempSync(join(tmpdir(), "build-stamp-problems-main-"));
  writeFileSync(join(root, "package-lock.json"), LOCK(S63));
  writeManifestAt(root, ["bulletin: the list named \"darkos-birthday-at-lanternstep\" and the entry door answered 404"]);
  const out = join(root, "dist-town", "build.json");
  const realLog = console.log; const logged = [];
  console.log = (m) => logged.push(String(m));
  try {
    main(["node", "build-stamp.mjs", "--out", out], {
      env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w40.1", BUILD_TOWN_DATA_SHA: "b".repeat(40), BUILD_TOWN_SHA: "c".repeat(40), BUILD_CROSSING: "203" },
      exec: () => "a".repeat(40) + "\n", now: () => new Date(AT), root,
    });
  } finally { console.log = realLog; }
  const parsed = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(parsed.problems.length, 1);
  assert.match(parsed.problems[0], /darkos-birthday-at-lanternstep/);
  assert.ok(logged.some((l) => /problems 1/.test(l)),
    "the box journal answers the question without curl — the same courtesy the world line already pays");
  assert.ok(logged.some((l) => /problem: bulletin:/.test(l)), "and it prints the line itself, not only the count");
});
