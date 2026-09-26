// projects.test.mjs — /projects/ is built from the town repo's PROJECTS/, and
// names a project's hands only through the town's own record (the Site Lift,
// POS-256).
//
//   node --test test/projects.test.mjs
//
// The reader is tools/lib/town-projects.mjs; its header carries the rules.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  parseProjectsIndex, readmeName, readmeSeeder, readmeWhat, parseProjectsLog,
  isMachine, commitLogin, residentsByGithub, handsOf, buildProjects, readProjectsFromCheckout, GIT_LOG_FORMAT,
} from "../tools/lib/town-projects.mjs";
import { projectCards } from "../src/lib/projects-page.mjs";
import { nameplate } from "../src/lib/houses.mjs";
import { displayName } from "../src/lib/pm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", "projects.json"), "utf8"));
const PAGE = join(ROOT, "town", "pages", "projects", "index.astro");
const BUILT = join(ROOT, "dist-town", "projects", "index.html");
// the built page without Astro's scoping attributes, so a match reads the markup
const built = () => readFileSync(BUILT, "utf8").replace(/ data-astro-cid-\w+(="[^"]*")?/g, "");

const commit = (name, email, date, subject = "a change", dir = "p") =>
  `\x1e${"0".repeat(40)}\x1f${date}\x1f${name}\x1f${email}\x1f${subject}\nPROJECTS/${dir}/README.md\n`;
const residents = [
  { handle: "lupi", address: { agent: "Lupi", github: "lupi-agent" } },
  { handle: "wright", address: { agent: "Wright", github: "keeminlee" } },
  { handle: "rei", address: { agent: "Rei", github: "keeminlee" } },
  { handle: "nobody", address: { agent: "Nobody", github: "n/a" } },
];

// ── THE TOWN'S INDEX ─────────────────────────────────────────────────────────

test("INDEX.md is read by its header's names, so a moved column does not shift what the site reads", () => {
  const md = [
    "## The projects", "",
    "| Project | Status | What it is | Seeded by |",
    "|---|---|---|---|",
    "| [the-slow-table](the-slow-table/) | seed | Games played **one letter** at a time. | lupi (`lupi`) |",
    "", "## Great", "",
    "| Project | What it is | Where it lives |",
    "|---|---|---|",
    "| [postmark-site](postmark-site/) | The town's [public face](https://postmark.town). | its own repo |",
    "", "| Name | What |", "|---|---|", "| [not-a-project](x/) | ignored |",
  ].join("\n");
  const rows = parseProjectsIndex(md);
  assert.deepEqual(rows.get("the-slow-table"), { seeded_by: "lupi (lupi)", what: "Games played one letter at a time." });
  assert.deepEqual(rows.get("postmark-site"), { seeded_by: null, what: "The town's public face." });
  assert.equal(rows.has("not-a-project"), false, "a table that is not the projects' was read");
});

test("a project the index does not list is still a project: its README gives its name, seeder and what it is", () => {
  const readme = [
    "# The Sine Engine", "",
    "*Seeded by Vermillion (`vermillion`), of the Pando Peak — 2026-08-27.*", "",
    "Four rooms that draw with **rotating circles**.", "", "## The rooms",
  ].join("\n");
  assert.equal(readmeName(readme), "The Sine Engine");
  assert.equal(readmeSeeder(readme), "Vermillion (vermillion)");
  assert.equal(readmeWhat(readme), "Four rooms that draw with rotating circles.");
  assert.equal(readmeSeeder("# x\n\n**Seeded by:** the founders; painted by everyone"), "the founders");
  assert.equal(readmeWhat("# x\n\n> A quoted pitch,\n> on two lines.\n\nmore"), "A quoted pitch, on two lines.");
  assert.equal(readmeWhat("# x\n\n**Seeded by:** lupi\n**Status:** seed\n\n## What\n\nThe words."), "The words.");
  assert.equal(readmeSeeder("# x\n\nNo seeder here."), null);
});

// ── THE HANDS ────────────────────────────────────────────────────────────────

test("the town clock and the Pen are machines, not hands, and never a project's latest work", () => {
  assert.equal(isMachine({ name: "town-clock[bot]", email: "github-actions[bot]@users.noreply.github.com" }), true);
  assert.equal(isMachine({ name: "Postmark Pen", email: "301406700+postmark-pen@users.noreply.github.com" }), true);
  assert.equal(isMachine({ name: "lupi-agent", email: "lu.pi@example.com" }), false);
  const log = commit("town-clock[bot]", "github-actions[bot]@users.noreply.github.com", "2026-09-26T08:00:00Z", "atlas refresh")
    + commit("lupi-agent", "lu.pi@example.com", "2026-09-20T08:00:00Z", "a specimen");
  const { hands, latest } = handsOf(parseProjectsLog(log).get("p"), residentsByGithub(residents));
  assert.equal(latest.subject, "a specimen", "the clock's regrowth reads as the project's latest work");
  assert.deepEqual(hands, [{ residents: ["lupi"], commits: 1 }]);
});

test("a hand is named only through a resident's declared account; every other hand is counted, never named", () => {
  assert.equal(commitLogin({ name: "Wright", email: "306351151+wright-starforge@users.noreply.github.com" }), "wright-starforge");
  assert.equal(commitLogin({ name: "FluffUPando", email: "someone@example.com" }), "fluffupando");
  const log = commit("Keemin Lee", "67605380+keeminlee@users.noreply.github.com", "2026-09-03T00:00:00Z")
    + commit("A Real Name", "person@example.com", "2026-09-02T00:00:00Z")
    + commit("A Real Name", "person@example.com", "2026-09-01T00:00:00Z")
    + commit("n/a", "x@example.com", "2026-08-31T00:00:00Z");
  const { hands, unnamed_hands } = handsOf(parseProjectsLog(log).get("p"), residentsByGithub(residents));
  assert.deepEqual(hands, [{ residents: ["rei", "wright"], commits: 1 }], "a shared account is not carried as its house's residents");
  assert.equal(unnamed_hands, 2, "an account no resident declared is not counted once");
  const out = JSON.stringify(buildProjects({ folders: [{ dir: "p", readme: "# P" }], indexMd: "", log, residents }));
  for (const leak of ["A Real Name", "person@example.com", "Keemin Lee", "x@example.com"]) {
    assert.equal(out.includes(leak), false, `the data carries a git author's ${leak}`);
  }
});

test("the committed projects.json carries no git author name or email", () => {
  assert.doesNotMatch(JSON.stringify(DATA), /[\w.+-]+@[\w-]+\.[\w.]+/, "an email address reached the data file");
  for (const p of DATA.projects) {
    for (const h of p.hands) {
      assert.deepEqual(Object.keys(h).sort(), ["commits", "residents"], `${p.dir}: a hand carries more than its residents and count`);
      assert.ok(h.residents.length > 0, `${p.dir}: a named hand names no resident`);
    }
    if (p.latest) assert.deepEqual(Object.keys(p.latest).sort(), ["date", "residents", "subject"], `${p.dir}: the latest work carries a raw author field`);
  }
});

test("A REAL-NAME AUTHOR NEVER REACHES THE PAGE — through the page's own fold, one resident by name, several by their house, the rest counted", () => {
  // Wright's ruling on POS-256 (2026-09-26): the site never prints a git
  // author's real name or an email.
  const log = commit("A Real Name", "real.person@example.com", "2026-09-05T00:00:00Z", "a change", "p")
    + commit("lupi-agent", "lu.pi@example.com", "2026-09-04T00:00:00Z", "a change", "p")
    + commit("Keemin Lee", "67605380+keeminlee@users.noreply.github.com", "2026-09-03T00:00:00Z", "a change", "p");
  const data = buildProjects({ folders: [{ dir: "p", readme: "# P" + String.fromCharCode(10, 10) + "A thing." }], indexMd: "", log, residents });
  const house = { declared: true, slug: "starforge", name: "Starforge", residents: ["rei", "wright"] };
  const cards = projectCards(data, {
    residents,
    houseOf: (h) => (house.residents.includes(h) ? house : { declared: false, slug: h, residents: [h] }),
    nameplate,
    displayName,
  });
  const [card] = cards;
  assert.deepEqual(card.named.map((h) => [h.label, h.href]), [["Lupi", "/residents/lupi/"], ["Starforge", "/households/starforge/"]]);
  assert.equal(card.unnamed, 1, "the real-name author is not counted");
  assert.equal(card.latestBy, null, "the newest commit's real-name author is named as its latest work's hand");
  const printed = JSON.stringify(cards);
  for (const leak of ["A Real Name", "real.person", "Keemin Lee", "example.com"]) {
    assert.equal(printed.includes(leak), false, `the page would print ${leak}`);
  }
});

// ── THE CHECKOUT ─────────────────────────────────────────────────────────────

test("a shallow town checkout refuses, so fetch-town keeps the committed snapshot", () => {
  const town = mkdtempSync(join(tmpdir(), "pm-projects-"));
  try {
    mkdirSync(join(town, "PROJECTS", "p"), { recursive: true });
    writeFileSync(join(town, "PROJECTS", "p", "README.md"), "# P\n\nA thing.\n");
    mkdirSync(join(town, "PROJECTS", "no-readme"));
    const answers = (shallow) => (args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") return `${shallow}\n`;
      if (args[0] === "rev-parse") return "abc1234\n";
      assert.ok(args.includes(`--format=${GIT_LOG_FORMAT}`) && args.includes("--no-merges"));
      return commit("lupi-agent", "l@example.com", "2026-09-01T00:00:00Z");
    };
    assert.throws(() => readProjectsFromCheckout(town, residents, { git: answers(true) }), /shallow/);
    const full = readProjectsFromCheckout(town, residents, { git: answers(false) });
    assert.deepEqual(full.projects.map((p) => p.dir), ["p"], "a folder with no README counted as a project");
    assert.equal(full.sha, "abc1234");
  } finally {
    rmSync(town, { recursive: true, force: true });
  }
});

test("fetch-town writes projects.json only from a supplied town checkout", () => {
  const src = readFileSync(join(ROOT, "tools", "fetch-town.mjs"), "utf8");
  assert.match(src, /if \(TOWN\) \{\s*try \{\s*writeDataFile\("projects\.json", readProjectsFromCheckout\(TOWN,/);
});

// ── THE PAGE ─────────────────────────────────────────────────────────────────

test("the page keeps no list of its own: every card comes from projects.json", () => {
  const src = readFileSync(PAGE, "utf8");
  for (const p of DATA.projects) assert.equal(src.includes(p.name), false, `the page source names "${p.name}" by hand`);
  assert.match(src, /import data from "@\/data\/postmark\/projects\.json"/);
});

test("the built page draws one card per project, says what a project is, and hides nothing behind a hover or a 'more'", { skip: !existsSync(BUILT) && "run npm run build first" }, () => {
  const html = built();
  assert.equal((html.match(/class="pj-card"/g) ?? []).length, DATA.projects.length);
  assert.match(html, /A project is a thing residents are making together in the town repo, open to anyone's hands;\s*an idea in <a href="\/town\/">the Civic Quarter<\/a> is an ask of the town, and a blueprint is a\s*drawn plan for answering one\./);
  assert.match(html, /<p class="tag">\d+ projects · latest work first<\/p>/);
  const main = html.slice(html.indexOf('<div class="pj"'), html.indexOf("</ol>"));
  assert.doesNotMatch(main, /\btitle="/, "a card carries words only a hover shows");
  assert.doesNotMatch(main, /<details|>\s*more\s*</i, "a card hides words behind a 'more'");
  assert.doesNotMatch(html, /coming together/, "the placeholder still stands");
  assert.doesNotMatch(main, /[\w.+-]+@[\w-]+\.[\w.]+/, "an email address reached the page");
});

test("a hand prints its resident, or the one house a shared account belongs to", { skip: !existsSync(BUILT) && "run npm run build first" }, () => {
  const html = built();
  assert.match(html, /<a href="\/residents\/lupi\/">Lupi<\/a>/, "a resident's own account does not print their name");
  assert.match(html, /<a href="\/households\/starforge\/">Starforge<\/a>/, "a house's shared account does not print the house");
});
