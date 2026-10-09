// POS-385: a home's `assets:` line. The town reader reads a YAML flow list
// (`[the-arc-house.jpg]`, no quotes) as the list it is, and warns by name about
// an entry that can never name a picture: a list it can't read, or a path out
// of HOME/. A warning only: such a house renders as it did before.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { homeAssetsProblems, parseFrontmatter, readTown } from "../tools/lib/town.mjs";
import { homeFaceOf, homeGalleryOf } from "../src/lib/home-face.mjs";

const HOME = "WHITE_PAGES/test-resident/HOME";
const HOME_MD = `${HOME}/HOME.md`;

// `a-first.png` sorts first, so a face other than it proves the list was read
function townWith(assetsLine, images = ["a-first.png", "b.png"]) {
  const root = mkdtempSync(join(tmpdir(), "postmark-home-assets-test-"));
  const dir = join(root, "WHITE_PAGES", "test-resident");
  mkdirSync(join(dir, "HOME"), { recursive: true });
  writeFileSync(join(dir, "ADDRESS.md"), "---\nhandle: test-resident\n---\n");
  writeFileSync(join(dir, "HOME", "HOME.md"), `---\nresident: test-resident\n${assetsLine ?? ""}\n---\n\n# The Test House\n`);
  for (const image of images) writeFileSync(join(dir, "HOME", image), "");
  return root;
}

// the fixture town has no mail ledger, and says so; that line is not ours
function read(assetsLine, images) {
  const town = readTown(townWith(assetsLine, images));
  const resident = town.residents[0];
  const r = { handle: resident.handle, home: resident.home.data };
  return {
    assets: resident.home.data.assets,
    problems: town.problems.filter((p) => !p.startsWith("mail-ledger.md missing")),
    face: homeFaceOf(r, resident.homeImages),
    gallery: homeGalleryOf(r, resident.homeImages),
  };
}

test("iris's line reads as a list of one, and her house wears it", () => {
  const { assets, problems, face, gallery } = read("assets: [the-arc-house.jpg]", ["a-first.png", "the-arc-house.jpg"]);
  assert.deepEqual(assets, ["the-arc-house.jpg"]);
  assert.deepEqual(problems, []);
  assert.equal(face, `${HOME}/the-arc-house.jpg`);
  assert.deepEqual(gallery, [`${HOME}/the-arc-house.jpg`]);
});

test("tarn's line reads as a list of one, and his house wears it", () => {
  const { assets, problems, face } = read("assets: [the-spring-house.jpg]", ["a-first.png", "the-spring-house.jpg"]);
  assert.deepEqual(assets, ["the-spring-house.jpg"]);
  assert.deepEqual(problems, []);
  assert.equal(face, `${HOME}/the-spring-house.jpg`);
});

test("a two-item flow list, one item quoted, reads as both, in order", () => {
  const { assets, problems, face, gallery } = read('assets: [b.png, "a-first.png"]');
  assert.deepEqual(assets, ["b.png", "a-first.png"]);
  assert.deepEqual(problems, []);
  assert.equal(face, `${HOME}/b.png`);
  assert.deepEqual(gallery, [`${HOME}/a-first.png`, `${HOME}/b.png`]);
});

test("an unclosed bracket warns by name and renders as today", () => {
  const { assets, problems, face, gallery } = read("assets: [b.png");
  assert.equal(assets, "[b.png");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /home assets entry is not a list the reader can read \("\[b\.png"\)/);
  assert.ok(problems[0].includes(HOME_MD), problems[0]);
  // the face rule is unchanged: no declared match, so the first image by filename
  assert.equal(face, `${HOME}/a-first.png`);
  assert.deepEqual(gallery, [`${HOME}/a-first.png`, `${HOME}/b.png`]);
});

test('a ( form and the quoted string "[b.png]" warn the same way', () => {
  for (const [line, entry] of [['assets: "(b.png)"', '"(b.png)"'], ["assets: (b.png)", '"(b.png)"'], ['assets: "[b.png]"', '"[b.png]"']]) {
    const { problems, face } = read(line);
    assert.equal(problems.length, 1, line);
    assert.ok(problems[0].includes(`not a list the reader can read (${entry})`), problems[0]);
    assert.equal(face, `${HOME}/a-first.png`, line);
  }
});

test("an entry naming a path out of HOME/ warns by name", () => {
  for (const line of ["assets: [../b.png]", 'assets: ["HOME/b.png"]', 'assets: ["sub\\\\b.png"]', 'assets: ".."']) {
    const { problems } = read(line);
    assert.equal(problems.length, 1, line);
    assert.match(problems[0], /home assets entry names a path, not a file in HOME\//, line);
    assert.ok(problems[0].includes(HOME_MD), problems[0]);
  }
});

test("a JSON list, a bare filename, an empty line and no assets line read clean", () => {
  for (const line of ['assets: ["b.png", "a-first.png"]', "assets: b.png", "assets:", null]) {
    assert.deepEqual(read(line).problems, [], String(line));
  }
});

test("only `assets:` takes the flow list; other keys keep the raw string", () => {
  const { data } = parseFrontmatter("---\nassets: [a.jpg, b.jpg]\ntags: [a, b]\nnested: [[a]]\n---\n");
  assert.deepEqual(data.assets, ["a.jpg", "b.jpg"]);
  assert.equal(data.tags, "[a, b]");
  assert.equal(parseFrontmatter("---\nassets: [[a.jpg]]\n---\n").data.assets, "[[a.jpg]]");
});

test("each bad entry of a list is named once; good entries and non-strings pass", () => {
  assert.equal(homeAssetsProblems(["b.png", "[c.png", 3, "../d.png"], HOME_MD).length, 2);
  assert.deepEqual(homeAssetsProblems(undefined, HOME_MD), []);
});
