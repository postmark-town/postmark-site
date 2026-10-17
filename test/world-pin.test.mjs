// world-pin.test.mjs — the three guardrails on the rebuild-time world pin.
//
//   node --test test/world-pin.test.mjs
//
// Each test name quotes the guardrail it asserts, verbatim from the ruling that
// created it, and each guardrail is falsified in BOTH directions: the case that
// must advance and the case that must refuse. A fallback that fires on every
// input is not a fallback, it is a broken mechanism that looks safe — so the
// fallback tests are always paired with a healthy case that must NOT fall back.
//
// Nothing here touches the network. Both seams that do (`lsRemote`,
// `floorSettlementOf`) are injected, which is the whole reason they are seams.

import test from "node:test";
import assert from "node:assert/strict";

import {
  decideWorldPin,
  floorPinFrom,
  newestSettlement,
  settlementTagsFrom,
} from "../tools/lib/world-pin.mjs";

const sha = (seed) => seed.repeat(40).slice(0, 40);

const MAIN_TIP = sha("a");
const FLOOR = sha("f"); // the release's frozen pin — a commit downstream of S44
const S44_TAG = sha("4");
const S44_COMMIT = sha("b");
const S45_TAG = sha("5");
const S45_COMMIT = sha("c");

// A `git ls-remote <url>` listing as the command actually prints one: HEAD, the
// branches, PR refs, release tags, and each ANNOTATED settlement tag twice —
// the tag object, then the peeled `^{}` commit.
function listing({ settlements = [[44, S44_TAG, S44_COMMIT], [45, S45_TAG, S45_COMMIT]], extras = [] } = {}) {
  const lines = [
    `${MAIN_TIP}\tHEAD`,
    `${MAIN_TIP}\trefs/heads/main`,
    `${sha("d")}\trefs/heads/keeper/next-blessing`,
    `${sha("e")}\trefs/pull/900/head`,
    `${sha("9")}\trefs/tags/release/2026-w35`,
    `${sha("8")}\trefs/tags/settlement/S45-rc`,
    `${sha("7")}\trefs/tags/settlement/Sfoo`,
  ];
  for (const [n, tagSha, commitSha] of settlements) {
    lines.push(`${tagSha}\trefs/tags/settlement/S${n}`);
    if (commitSha) lines.push(`${commitSha}\trefs/tags/settlement/S${n}^{}`);
  }
  return [...lines, ...extras].join("\n") + "\n";
}

/** The floor sits downstream of S44 — the shape the live pin actually has. */
const floorAtS44 = () => 44;

// ---------------------------------------------------------------------------
// GUARDRAIL 1 — "tags only, never main tip"
// ---------------------------------------------------------------------------

test("tags only, never main tip: the resolved pin is a settlement tag's commit, not the world's main tip", () => {
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: () => listing(), floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "advance");
  assert.equal(out.settlement, 45);
  assert.equal(out.sha, S45_COMMIT, "must be the PEELED commit of settlement/S45");
  assert.notEqual(out.sha, MAIN_TIP, "main's tip is never a candidate");
  assert.notEqual(out.sha, S45_TAG, "the annotated tag OBJECT is not a commit and cannot be pinned");
});

test("tags only, never main tip: a listing carrying only branches resolves nothing and holds at the floor", () => {
  // The flip. If the ref filter were loose enough to let main through, this
  // would come back advance/MAIN_TIP instead of a hold.
  const branchesOnly = () => `${MAIN_TIP}\tHEAD\n${MAIN_TIP}\trefs/heads/main\n${sha("d")}\trefs/heads/keeper/next\n`;
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: branchesOnly, floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "hold");
  assert.equal(out.sha, FLOOR);
  assert.equal(out.reason, "no-settlement-tags");
});

test("tags only, never main tip: near-miss settlement names are not settlements", () => {
  const tags = settlementTagsFrom(listing());
  assert.deepEqual([...tags.keys()].sort((a, b) => a - b), [44, 45]);
  // `settlement/S45-rc` and `settlement/Sfoo` are in the fixture and excluded;
  // a regex anchored loosely would have admitted both.
  assert.equal(tags.get(45), S45_COMMIT);
});

// ---------------------------------------------------------------------------
// GUARDRAIL 2 — "monotonic by settlement number — the pin never rolls backwards"
// ---------------------------------------------------------------------------

test("monotonic by settlement number: S100 outranks S9, because the number is compared as a number", () => {
  // The bronze class this belongs to is "release tags can roll the world pin
  // backwards". A lexical sort is the same bug in a different coat: it answers
  // S9, and the town silently loses ninety-one settlements.
  const tags = settlementTagsFrom(
    listing({ settlements: [[9, sha("1"), sha("2")], [100, sha("3"), sha("6")], [45, S45_TAG, S45_COMMIT]] }),
  );
  assert.deepEqual(newestSettlement(tags), { settlement: 100, sha: sha("6") });

  const out = decideWorldPin({
    floorSha: FLOOR,
    lsRemote: () => listing({ settlements: [[9, sha("1"), sha("2")], [100, sha("3"), sha("6")], [45, S45_TAG, S45_COMMIT]] }),
    floorSettlementOf: floorAtS44,
  });
  assert.equal(out.settlement, 100);
  assert.notEqual(out.settlement, 9, "a lexical max would have rolled the pin back to S9");
});

test("monotonic by settlement number: the most recently ADVERTISED tag does not win — the highest number does", () => {
  // S44 listed last, as a re-cut tag would appear. Creation order is not the law.
  const recut = () => listing({ settlements: [[45, S45_TAG, S45_COMMIT], [44, S44_TAG, S44_COMMIT]] });
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: recut, floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "advance");
  assert.equal(out.settlement, 45);
});

test("the pin never rolls backwards: a newest settlement OLDER than the floor's is refused", () => {
  // S45 has been deleted from the world repo; the newest advertised is S44
  // while the release floor already sits at S45. Advancing here would un-ship a
  // settlement residents have already read.
  const withoutS45 = () => listing({ settlements: [[44, S44_TAG, S44_COMMIT]] });
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: withoutS45, floorSettlementOf: () => 45 });
  assert.equal(out.decision, "hold");
  assert.equal(out.sha, FLOOR);
  assert.match(out.reason, /would-roll-backwards/);
});

test("the pin never rolls backwards: a newest settlement EQUAL to the floor's is refused", () => {
  // The floor is a commit downstream of its own settlement tag — which is what
  // the live pin is (272ed4bb sits after settlement/S44). Replacing it with the
  // tag itself is a rollback wearing an equals sign.
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: () => listing(), floorSettlementOf: () => 45 });
  assert.equal(out.decision, "hold");
  assert.equal(out.sha, FLOOR);
  assert.match(out.reason, /already-at-newest/);
});

test("the pin never rolls backwards: a strictly newer settlement DOES advance (the refusal is not blanket)", () => {
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: () => listing(), floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "advance");
  assert.equal(out.floorSettlement, 44);
  assert.equal(out.settlement, 45);
  assert.equal(out.reason, "newest-settlement: S44 -> S45");
});

// ---------------------------------------------------------------------------
// GUARDRAIL 3 — "on any tag-resolution failure, fall back to the release's
//                frozen pin file (the floor)"
// ---------------------------------------------------------------------------

test("on any tag-resolution failure, fall back to the frozen pin file: ls-remote throwing holds at the floor", () => {
  const out = decideWorldPin({
    floorSha: FLOOR,
    lsRemote: () => { throw new Error("Could not resolve host: github.com"); },
    floorSettlementOf: floorAtS44,
  });
  assert.equal(out.decision, "hold");
  assert.equal(out.sha, FLOOR, "the floor is what the release froze and what npm ci already installed");
  assert.match(out.reason, /ls-remote-failed/);
});

test("on any tag-resolution failure, fall back to the frozen pin file: an unresolvable floor holds at the floor", () => {
  const out = decideWorldPin({
    floorSha: FLOOR,
    lsRemote: () => listing(),
    floorSettlementOf: () => { throw new Error("the frozen pin ffffffff is not a commit in the world repo"); },
  });
  assert.equal(out.decision, "hold");
  assert.equal(out.sha, FLOOR);
  assert.match(out.reason, /floor-settlement-unresolved/);
});

test("on any tag-resolution failure, fall back to the frozen pin file: an empty listing holds at the floor", () => {
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: () => "", floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "hold");
  assert.equal(out.sha, FLOOR);
  assert.equal(out.reason, "no-settlement-tags");
});

test("on any tag-resolution failure, fall back to the frozen pin file: a healthy resolution does NOT fall back", () => {
  // The flip that keeps the three tests above from being vacuous. If the
  // fallback fired unconditionally every one of them would still pass.
  const out = decideWorldPin({ floorSha: FLOOR, lsRemote: () => listing(), floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "advance");
  assert.notEqual(out.sha, FLOOR);
});

// ---------------------------------------------------------------------------
// The floor is READ from the pin file the keeper's ceremony keeps fresh
// ---------------------------------------------------------------------------

test("the floor is the release's frozen pin file, read and never written", () => {
  const pkg = JSON.stringify({
    dependencies: { "postmark-world": "github:postmark-town/postmark-world#272ed4bb47bb0ce4cf5aa89fe746a3e3a1926d89" },
  });
  assert.deepEqual(floorPinFrom(pkg), {
    sha: "272ed4bb47bb0ce4cf5aa89fe746a3e3a1926d89",
    spec: "github:postmark-town/postmark-world#272ed4bb47bb0ce4cf5aa89fe746a3e3a1926d89",
    owner: "postmark-town",
    repo: "postmark-world",
  });
});

// THE LEGACY FIXTURE (POS-499): older release tags still carry the old owner's
// spelling, and a hold reads the tag's own floor. Named in test/no-old-owner.test.mjs.
test("an older release tag's floor, in the old owner's spelling, is still a floor", () => {
  const pkg = JSON.stringify({ dependencies: { "postmark-world": "github:keeminlee/postmark-world#272ed4bb47bb0ce4cf5aa89fe746a3e3a1926d89" } });
  assert.equal(floorPinFrom(pkg).sha, "272ed4bb47bb0ce4cf5aa89fe746a3e3a1926d89");
});

test("a pin that is not a 40-hex commit is not a floor", () => {
  // A branch-shaped pin ("#main") would make the whole mechanism meaningless:
  // there would be no floor to fall back to and no number to be monotonic in.
  for (const spec of ["github:postmark-town/postmark-world#main", "github:postmark-town/postmark-world", "^0.1.0"]) {
    assert.throws(() => floorPinFrom(JSON.stringify({ dependencies: { "postmark-world": spec } })), /not pinned|no postmark-world/);
  }
  assert.throws(() => floorPinFrom(JSON.stringify({ dependencies: {} })), /no postmark-world dependency/);
});

test("the resolver holds when the pin file's floor is unusable", () => {
  const out = decideWorldPin({ floorSha: "not-a-sha", lsRemote: () => listing(), floorSettlementOf: floorAtS44 });
  assert.equal(out.decision, "hold");
  assert.equal(out.reason, "no-floor-sha");
});
