// resident-projects.test.mjs — a resident's page lists the town projects they are
// a named hand on (POS-855: cold walks found a page that showed counts and never
// a thing made).
//
//   node --test test/resident-projects.test.mjs
//
// The fixture is invented and written here: no real project, handle, name or
// email. The helper is projectsByResident in src/lib/projects-page.mjs, which
// keeps /projects/'s hands rule (Wright's POS-256 ruling): a resident matches
// only through a hand's `residents`, never a git author's name or email. The page
// (town/components/Household.astro) is pinned at the source, because the render
// needs the residents' data, which a test does not read.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { projectsByResident as byResident, projectCards, RESIDENT_PROJECTS_LIMIT } from "../src/lib/projects-page.mjs";
import { nameplate } from "../src/lib/houses.mjs";
import { displayName } from "../src/lib/pm.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

const href = (dir) => `https://example.test/PROJECTS/${dir}`;
const project = (dir, date, hands, extra = {}) => ({
  dir, name: `Project ${dir}`, href: href(dir), hands,
  latest: date ? { date, subject: "a change", residents: [] } : null,
  ...extra,
});
const hand = (residents, commits = 1) => ({ residents, commits });
// a hand the town's record ties to no resident: only a git author and an email
const gitOnly = () => ({ residents: [], commits: 9, author: "Invented Person", email: "invented.person@example.test" });

// ada-fx and ben-fx share a household with a nameplate; cat-fx and ada-fx-2 are
// houses of one; ghost-fx is in no house the record can resolve.
const house = { declared: true, slug: "fixture-house", name: "Fixture House", residents: ["ada-fx", "ben-fx"] };
const resolvers = {
  residents: [],
  houseOf: (h) => (house.residents.includes(h) ? house : h === "ghost-fx" ? undefined : { declared: false, slug: h, residents: [h] }),
  nameplate,
  displayName,
};
const projectsByResident = (data, handle, limit) => byResident(data, handle, resolvers, limit);

const FIXTURE = {
  sha: "abc1234",
  projects: [
    project("alpha", "2026-08-01T10:00:00Z", [hand(["ada-fx"], 2)]),
    project("bravo", "2026-10-30T09:00:00Z", [hand(["ben-fx"]), hand(["ada-fx"], 5)]),
    project("charlie", "2026-09-15T12:00:00Z", [hand(["ben-fx"])]),
    project("delta", "2026-10-20T08:00:00Z", [hand(["ada-fx", "ben-fx"], 3)]),   // one hand, two residents
    project("echo", "2026-10-25T08:00:00Z", [gitOnly()]),                        // git-only: matches nobody
    project("foxtrot", "2026-07-01T08:00:00Z", [hand(["ada-fx"])]),
    project("golf", "2026-06-01T08:00:00Z", [hand(["ada-fx"])]),
    project("hotel", "2026-05-01T08:00:00Z", [hand(["ada-fx"])]),
    project("india", "2026-04-01T08:00:00Z", [hand(["ada-fx"])]),
    project("juliet", null, [hand(["ada-fx"])]),                                  // no dated work
    project("kilo", "2026-10-31T08:00:00Z", [hand(["ada-fx"])], { href: "" }),    // nothing to open
    project("lima", "2026-10-31T08:00:00Z", [hand(["ada-fx"])], { name: "" }),    // no name
    project("mike", "2026-03-01T08:00:00Z", [hand(["ADA-FX"]), hand(["ada-fx-2"]), hand(["ada"])]), // near misses only
    // /projects/ counts these hands and never names them, so neither does a resident's page
    project("papa", "2026-10-29T08:00:00Z", [hand(["ada-fx", "cat-fx"])]),       // across two houses
    project("romeo", "2026-10-28T08:00:00Z", [hand(["ada-fx", "ghost-fx"])]),    // a house the record cannot resolve
    project("quebec", "2026-10-27T08:00:00Z", [hand(["cat-fx"]), hand(["ada-fx", "cat-fx"])]), // cat-fx alone is named
  ],
};

test("newest first, each with its name, its link and its latest date, capped at five", () => {
  const { projects, total } = projectsByResident(FIXTURE, "ada-fx");
  assert.equal(RESIDENT_PROJECTS_LIMIT, 5);
  assert.deepEqual(projects.map((p) => p.name), ["Project bravo", "Project delta", "Project alpha", "Project foxtrot", "Project golf"]);
  assert.equal(total, 7, "the total counts every match, so the page can say there are more");
  assert.deepEqual(projects[0], { name: "Project bravo", href: href("bravo"), date: "2026-10-30T09:00:00Z" });
});

test("the limit argument is honoured, and a zero limit lists nothing but still counts", () => {
  assert.equal(projectsByResident(FIXTURE, "ada-fx", 2).projects.length, 2);
  assert.equal(projectsByResident(FIXTURE, "ada-fx", 99).projects.length, 7);
  const none = projectsByResident(FIXTURE, "ada-fx", 0);
  assert.deepEqual([none.projects.length, none.total], [0, 7]);
});

test("a resident with fewer than the cap gets them all and no 'more'", () => {
  const { projects, total } = projectsByResident(FIXTURE, "ben-fx");
  assert.deepEqual(projects.map((p) => p.name), ["Project bravo", "Project delta", "Project charlie"]);
  assert.equal(total, projects.length);
});

test("a resident on no project gets nothing", () => {
  assert.deepEqual(projectsByResident(FIXTURE, "nobody-fx"), { projects: [], total: 0 });
});

test("a git-only hand never matches: not by author, not by email, not by empty residents", () => {
  const carol = { sha: "x", projects: [project("echo", "2026-10-25T08:00:00Z", [gitOnly()])] };
  for (const who of ["Invented Person", "invented.person@example.test", "invented.person", "", undefined, null]) {
    assert.deepEqual(projectsByResident(carol, who), { projects: [], total: 0 }, `${JSON.stringify(who)} matched a git-only hand`);
  }
  assert.equal(projectsByResident(FIXTURE, "ada-fx").projects.some((p) => p.name === "Project echo"), false);
  assert.equal(JSON.stringify(projectsByResident(FIXTURE, "ada-fx")).includes("Invented Person"), false);
});

test("a hand of several residents counts for each of them", () => {
  assert.ok(projectsByResident(FIXTURE, "ada-fx").projects.some((p) => p.name === "Project delta"));
  assert.ok(projectsByResident(FIXTURE, "ben-fx").projects.some((p) => p.name === "Project delta"));
});

test("a hand /projects/ would not name is not listed: across two houses, or a house the record cannot resolve", () => {
  const ada = projectsByResident(FIXTURE, "ada-fx", 99).projects.map((p) => p.name);
  for (const name of ["Project papa", "Project romeo", "Project quebec"]) assert.equal(ada.includes(name), false, `${name} is listed for ada-fx`);
  const cat = projectsByResident(FIXTURE, "cat-fx");
  assert.deepEqual(cat.projects.map((p) => p.name), ["Project quebec"], "only cat-fx's own lone hand names them");
  assert.deepEqual(projectsByResident(FIXTURE, "ghost-fx"), { projects: [], total: 0 });
  // the one fold: exactly the projects /projects/ would name this resident on
  for (const who of ["ada-fx", "ben-fx", "cat-fx"]) {
    const named = projectCards(FIXTURE, resolvers).filter((c) => c.named.some((h) => h.href.includes(`/${who}/`) || h.label === nameplate(house)));
    const viaPage = projectsByResident(FIXTURE, who, 99).projects.map((p) => p.name);
    for (const name of viaPage) assert.ok(named.some((c) => c.name === name), `${who}: ${name} is listed here but /projects/ names no hand on it`);
  }
});

test("a project is listed once, however many of the resident's hands it holds", () => {
  const twice = { projects: [project("twice", "2026-10-01T00:00:00Z", [hand(["ada-fx"]), hand(["ada-fx", "ben-fx"])])] };
  assert.equal(projectsByResident(twice, "ada-fx").total, 1);
});

test("the handle is compared exactly: another account, a different case or a prefix is not a match", () => {
  const { projects } = projectsByResident(FIXTURE, "ada-fx");
  assert.equal(projects.some((p) => p.name === "Project mike"), false);
  assert.deepEqual(projectsByResident(FIXTURE, "ada-fx-2"), { projects: [{ name: "Project mike", href: href("mike"), date: "2026-03-01T08:00:00Z" }], total: 1 });
});

test("a project with no name, no link to open or no dated work is not listed or counted", () => {
  const { projects, total } = projectsByResident(FIXTURE, "ada-fx", 99);
  for (const name of ["Project juliet", "Project kilo"]) assert.equal(projects.some((p) => p.name === name), false, name);
  assert.equal(projects.some((p) => p.name === ""), false);
  assert.equal(total, 7);
});

test("two projects on the same day are ordered by name, so the page does not shuffle", () => {
  const same = { projects: [
    project("zulu", "2026-10-01T00:00:00Z", [hand(["ada-fx"])]),
    project("yankee", "2026-10-01T00:00:00Z", [hand(["ada-fx"])]),
  ] };
  assert.deepEqual(projectsByResident(same, "ada-fx").projects.map((p) => p.name), ["Project yankee", "Project zulu"]);
});

test("missing or malformed data gives nothing, so the page prints no heading", () => {
  const empty = { projects: [], total: 0 };
  for (const bad of [null, undefined, {}, { projects: [] }, { projects: null }, { projects: "nope" }, [], { projects: [null, 3, {}, { name: "x" }] }]) {
    assert.deepEqual(projectsByResident(bad, "ada-fx"), empty, `${JSON.stringify(bad)} gave projects`);
  }
  const noHands = { projects: [project("lone", "2026-10-01T00:00:00Z", undefined), project("odd", "2026-10-01T00:00:00Z", [null, { residents: "ada-fx" }, {}])] };
  assert.deepEqual(projectsByResident(noHands, "ada-fx"), empty);
});

// ── THE PAGE ─────────────────────────────────────────────────────────────────

const PAGE = read("town", "components", "Household.astro");
const made = PAGE.slice(PAGE.indexOf('<section class="made"'), PAGE.indexOf("<!-- CORRESPONDENTS"));

test("the resident page calls the helper with the tab's own handle, from projects.json", () => {
  assert.match(PAGE, /import \{ projectsByResident \} from "@\/lib\/projects-page\.mjs"/);
  assert.match(PAGE, /import projectsData from "@\/data\/postmark\/projects\.json"/);
  assert.match(PAGE, /madeProjects: projectsByResident\(projectsData, r\.handle, \{ residents: \[\], houseOf, nameplate, displayName \}\)/);
});

test("the list sits in 'What <name> has made', prints nothing when empty, and links the town's projects only when there are more", () => {
  assert.ok(made.length > 0 && made.includes("What {t.name} has made"), "the section was not found");
  assert.match(made, /t\.madeProjects\.projects\.length > 0 &&/);
  assert.match(made, /href=\{p\.href\}/);
  assert.match(made, /fmtDate\(p\.date\)/);
  assert.match(made, /t\.madeProjects\.total > t\.madeProjects\.projects\.length &&/);
  assert.match(made, /<a href="\/projects\/">all the town's projects →<\/a>/);
  // nothing else about projects is printed outside that guard: no heading of its own
  assert.equal(/pm-rule[^\n]*[Pp]rojects/.test(made), false, "a heading of its own would print when empty");
});

test("the marks lines are as they were", () => {
  for (const line of [
    "mark stands",
    "marks stand",
    "has nothing standing in the told world yet.",
    "could not be read from the record.",
    "Nothing of theirs is waiting on a crossing.",
    "waiting on a crossing.",
    "A resident's private drafts are their own",
    "This page was not told what {t.name} has put in the told world.",
  ]) assert.ok(made.includes(line), `${line} is gone from the section`);
});

test("the render proof copies the helper, and gives the page an invented projects record", () => {
  const proof = read("tools", "pos394-render-proof.mjs");
  assert.match(proof, /"src\/lib\/projects-page\.mjs"/);
  assert.match(proof, /"projects\.json": \{ sha: "pos394", projects: \[\] \}/);
});
