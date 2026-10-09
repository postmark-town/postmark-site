// POS-385: the town reader warns by name when a home's `assets:` entry can
// never name a picture: one string that looks like a list, or a path out of
// HOME/. A warning only: the face and the gallery render as they did before.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { homeAssetsProblems, readTown } from "../tools/lib/town.mjs";
import { homeFaceOf, homeGalleryOf } from "../src/lib/home-face.mjs";

const HOME_MD = "WHITE_PAGES/test-resident/HOME/HOME.md";

function townWith(assetsLine) {
  const root = mkdtempSync(join(tmpdir(), "postmark-home-assets-test-"));
  const dir = join(root, "WHITE_PAGES", "test-resident");
  mkdirSync(join(dir, "HOME"), { recursive: true });
  writeFileSync(join(dir, "ADDRESS.md"), "---\nhandle: test-resident\n---\n");
  writeFileSync(join(dir, "HOME", "HOME.md"), `---\nresident: test-resident\n${assetsLine ?? ""}\n---\n\n# The Test House\n`);
  writeFileSync(join(dir, "HOME", "a.png"), "");
  writeFileSync(join(dir, "HOME", "b.png"), "");
  return root;
}

// the fixture town has no mail ledger, and says so; that line is not ours
function read(assetsLine) {
  const town = readTown(townWith(assetsLine));
  const problems = town.problems.filter((p) => !p.startsWith("mail-ledger.md missing"));
  return { resident: town.residents[0], problems };
}

test('assets: "[b.png]" gives one named problem and renders as today', () => {
  const { resident, problems } = read('assets: "[b.png]"');
  assert.equal(resident.home.data.assets, "[b.png]");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /home assets entry is one string that looks like a list \("\[b\.png\]"\)/);
  assert.ok(problems[0].includes(HOME_MD), problems[0]);

  // the face rule is unchanged: no declared match, so the first image by filename
  const r = { handle: resident.handle, home: resident.home.data };
  assert.equal(homeFaceOf(r, resident.homeImages), "WHITE_PAGES/test-resident/HOME/a.png");
  assert.deepEqual(homeGalleryOf(r, resident.homeImages), resident.homeImages);
});

test("a YAML list with no quotes (iris's and tarn's line) warns the same way", () => {
  const { problems } = read("assets: [b.png]");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /looks like a list \("\[b\.png\]"\)/);
});

test("an entry opening with ( warns too", () => {
  const { problems } = read('assets: "(b.png)"');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /looks like a list \("\(b\.png\)"\)/);
});

test("an entry naming a path out of HOME/ warns by name", () => {
  for (const line of ['assets: ["../b.png"]', 'assets: ["HOME/b.png"]', 'assets: ["sub\\\\b.png"]', 'assets: ".."']) {
    const { problems } = read(line);
    assert.equal(problems.length, 1, line);
    assert.match(problems[0], /home assets entry names a path, not a file in HOME\//, line);
    assert.ok(problems[0].includes(HOME_MD), problems[0]);
  }
});

test("a JSON list, a bare filename and no assets line read clean", () => {
  for (const line of ['assets: ["b.png", "a.png"]', "assets: b.png", null]) {
    assert.deepEqual(read(line).problems, [], String(line));
  }
});

test("each bad entry of a list is named once; good entries and non-strings pass", () => {
  assert.equal(homeAssetsProblems(["b.png", "[c.png]", 3, "../d.png"], HOME_MD).length, 2);
  assert.deepEqual(homeAssetsProblems(undefined, HOME_MD), []);
});
