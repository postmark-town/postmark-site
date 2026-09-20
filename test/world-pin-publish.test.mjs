// world-pin-publish.test.mjs — the one line the office cannot derive.
//
// LANE A's A8 (docs/2026-09-07/jetto-lane-a-report.md § 5.4), verbatim:
//
//   "`receipt.site_pin` is `null` and cannot be anything else today: the office
//    holds no clone of `postmark-town/postmark-site` and no record of its
//    `postmark-world` pin. … the question it answers is real — 'the world says
//    my mark is published; why does the site not show it?' is a resident
//    question, and it is unanswerable without that sha. But it is the site's to
//    publish, so it is Lane E's."
//
//   node --test test/world-pin-publish.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { worldPin, shaFromSpec, shaFromResolved } from "../tools/lib/world-pin-publish.mjs";

const SHA = "ecc63613a063ca2e3da262c6306c34b72ae3b9f8";
const SEP = String.fromCharCode(92); // a backslash, spelled so no quoting layer can eat it
// Windows joins with a backslash and the fixture keys are written with slashes,
// so the match is on the tail of either spelling rather than a normalized copy.
const reader = (files) => (p) => {
  const key = String(p).split(SEP).join("/");
  for (const [suffix, value] of Object.entries(files)) if (key.endsWith(suffix)) return value;
  const e = new Error(`ENOENT ${key}`); e.code = "ENOENT"; throw e;
};

test("the spec's sha is the pin, and anything that is not a pinned sha is refused as one", () => {
  assert.equal(shaFromSpec(`github:keeminlee/postmark-world#${SHA}`), SHA);
  assert.equal(shaFromSpec("github:keeminlee/postmark-world#main"), null, "a branch is a moving target, not a pin");
  assert.equal(shaFromSpec("^1.2.3"), null);
  assert.equal(shaFromSpec(undefined), null);
});

test("the ordinary build reads the resolved sha out of the LOCKFILE, and says where it came from", () => {
  // THE REPAIR (fresh reviewer, 2026-09-07): the first draft looked only in
  // node_modules/postmark-world/package.json for `_resolved`/`gitHead`, which
  // npm DROPS on a git install — so this field was null on every ordinary
  // install and could never detect the disagreement it exists for. The lockfile
  // records it and always has.
  const p = worldPin({
    builtAt: "2026-09-07T09:00:00.000Z",
    readJson: reader({
      "package-lock.json": { packages: { "node_modules/postmark-world": { resolved: `git+ssh://git@github.com/keeminlee/postmark-world.git#${SHA}` } } },
      "node_modules/postmark-world/package.json": { name: "postmark-world" },
      "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
    }),
  });
  assert.equal(p.world_pin, SHA);
  assert.equal(p.world_installed, SHA, "the field speaks — this is what the first draft could never do");
  assert.equal(p.world_installed_from, "package-lock.json");
  assert.equal(p.built_at, "2026-09-07T09:00:00.000Z");
  assert.ok(!(p.notes ?? []).some((n) => /records no commit of its own/.test(n)),
    "and the old apology is gone — a field that now speaks must stop explaining why it cannot");
});

test("A PIN AND A LOCK THAT DISAGREE: both are named and the note fires — the case the field exists for", () => {
  // The conductor's proof, exactly: package.json pins A, the lockfile resolves
  // B. This is the rebuild lane's real shape — resolve-world-pin.mjs moves the
  // spec before the install — and it is what a single number could not express.
  const B = "1111111111111111111111111111111111111111";
  const p = worldPin({
    readJson: reader({
      "package-lock.json": { packages: { "node_modules/postmark-world": { resolved: `git+https://github.com/keeminlee/postmark-world.git#${B}` } } },
      "node_modules/postmark-world/package.json": {},
      "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
    }),
  });
  assert.equal(p.world_pin, SHA, "what the repo asks for");
  assert.equal(p.world_installed, B, "and what npm ci would actually install");
  assert.match(p.notes.join(" "), /the build compiled against the installed one/);
});

test("the lockfile's URL scheme does not decide whether the field can speak", () => {
  // npm writes git+ssh, git+https or plain https depending on how the dep was
  // added. Pinning the reader to one of those would make the field go quiet the
  // next time somebody re-added it another way — the same never-speaks failure.
  for (const url of [
    `git+ssh://git@github.com/keeminlee/postmark-world.git#${SHA}`,
    `git+https://github.com/keeminlee/postmark-world.git#${SHA}`,
    `https://github.com/keeminlee/postmark-world.git#${SHA}`,
  ]) assert.equal(shaFromResolved(url), SHA, url);
  // A registry tarball has no sha, and null there is a real state.
  assert.equal(shaFromResolved("https://registry.npmjs.org/x/-/x-1.0.0.tgz"), null);
  assert.equal(shaFromResolved(undefined), null);
});

test("no lockfile falls back to the installed package, and says which source answered", () => {
  const p = worldPin({
    readJson: reader({
      "node_modules/postmark-world/package.json": { _resolved: `github:keeminlee/postmark-world#${SHA}` },
      "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
    }),
  });
  assert.equal(p.world_installed, SHA);
  assert.equal(p.world_installed_from, "node_modules", "the weaker source, named as such");
  assert.match(p.notes.join(" "), /package-lock.json could not be read/);
});

test("neither source can answer: null with reasons, never an invented sha", () => {
  const p = worldPin({
    readJson: reader({
      "node_modules/postmark-world/package.json": { name: "postmark-world" },
      "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
    }),
  });
  assert.equal(p.world_installed, null);
  assert.equal(p.world_installed_from, null);
  assert.match(p.notes.join(" "), /the lockfile did not answer either/);
});

test("an unreadable package.json publishes nulls with a reason — never an invented sha", () => {
  const p = worldPin({ readJson: reader({}) });
  assert.equal(p.world_pin, null);
  assert.equal(p.world_spec, null);
  assert.match(p.notes.join(" "), /package.json could not be read/);
  assert.match(p.notes.join(" "), /could not be read at all/, "and the missing package is its own sentence");
});

test("a dependency that names a branch is called out as a moving target", () => {
  const p = worldPin({
    readJson: reader({
      "node_modules/postmark-world/package.json": {},
      "package.json": { dependencies: { "postmark-world": "github:keeminlee/postmark-world#main" } },
    }),
  });
  assert.equal(p.world_pin, null, "a branch is not a pin, and null says so");
  assert.match(p.notes.join(" "), /pinned to a moving target/);
});

test("code_ref comes from the SAME env var build.json takes it from, and is null off the deploy lane", () => {
  // build-stamp.mjs § gather reads `env.BUILD_CODE_REF`; so does this. Two
  // stamps on one page must not disagree about which ref built the site.
  const files = {
    "node_modules/postmark-world/package.json": {},
    "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
  };
  const shipped = worldPin({ readJson: reader(files), env: { BUILD_CODE_REF: "release/2026-w37.4" } });
  assert.equal(shipped.code_ref, "release/2026-w37.4");
  assert.doesNotMatch(shipped.notes.join(" "), /outside it/, "a deploy-lane build says nothing about being outside one");

  const local = worldPin({ readJson: reader(files), env: {} });
  assert.equal(local.code_ref, null, "null, never invented — a dev artifact must not look shipped");
  assert.match(local.notes.join(" "), /written outside it/);
});

test("THE CHANNEL SAYS WHETHER THE PIN IS A BLESSING, because a sha alone cannot", () => {
  // A reader asking "is this the world the town blessed?" cannot answer it from
  // forty hex characters — they would have to resolve the world's settlement
  // tags, and the office holds no clone to do it with. deploy.yml's two lanes
  // ARE that distinction: the release lane resolves the newest settlement tag
  // and installs it; the snapshot lane runs no resolver and installs whatever
  // the branch's lockfile pins. So the lane is the answer, and it is published.
  const files = {
    "node_modules/postmark-world/package.json": {},
    "package.json": { dependencies: { "postmark-world": `github:keeminlee/postmark-world#${SHA}` } },
  };
  const dev = worldPin({ readJson: reader(files), env: { PUBLIC_CHANNEL: "snapshot", BUILD_CODE_REF: "jetto/atlas-build" } });
  assert.equal(dev.channel, "snapshot");
  assert.match(dev.notes.join(" "), /SNAPSHOT BUILD/,
    "a dev pin says out loud that it is not a blessed world");
  assert.match(dev.notes.join(" "), /not a blessed world/);

  const prod = worldPin({ readJson: reader(files), env: { PUBLIC_CHANNEL: "release", BUILD_CODE_REF: "release/2026-w37.4" } });
  assert.equal(prod.channel, "release");
  assert.doesNotMatch(prod.notes.join(" "), /SNAPSHOT BUILD/,
    "and a release pin does not carry the dev warning");

  // off the deploy lane, and on a value neither lane produces: null with a
  // reason, never a guess — the same rule code_ref follows
  for (const env of [{}, { PUBLIC_CHANNEL: "" }, { PUBLIC_CHANNEL: "prod" }]) {
    const p = worldPin({ readJson: reader(files), env });
    assert.equal(p.channel, null, JSON.stringify(env));
    assert.match(p.notes.join(" "), /whether the pin is a blessing or a branch build/);
  }
});
