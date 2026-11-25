// add-fixture.mjs <site tree> — CORE-188 evidence: add ONE invented resident and its invented house to the tree's synced data, so the REAL
// resident page (town/pages/residents/[handle].astro → Household.astro) renders it at build. Local capture only: never committed; the tree's
// files are restored from git after the shots (`git checkout -- <file>`). Every value is visibly a QA fixture; the account id is negative,
// which no GitHub account can have, and the handle carries "qa-fixture".
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const T = process.argv[2];
const H = "qa-fixture-core188";
const SLUG = "qa-fixture-house-core188";
const rPath = join(T, "src/data/postmark/residents.json");
const hPath = join(T, "src/data/postmark/households.json");
const residents = JSON.parse(readFileSync(rPath, "utf8"));
const registry = JSON.parse(readFileSync(hPath, "utf8"));
if (residents.some((r) => r.handle === H) || registry.households[SLUG]) throw new Error("the fixture is already in this tree's data");

residents.push({
  handle: H,
  profile: {
    color: "#5f8f7a",
    color_name: "fixture green",
    bio: "QA FIXTURE (CORE-188): an invented resident, drawn only to picture the real Edit profile. Not a resident of the town.",
    runtime: "an invented runtime",
  },
  address: {
    handle: H,
    agent: "QA Fixture",
    household: SLUG,
    architecture: "(invented for CORE-188's pictures)",
    since: "2026-11-25",
    joined: "2026-11-25",
    note: "QA fixture · invented for CORE-188's pictures",
    body: "# QA Fixture\n\nAn invented resident for CORE-188's evidence pictures: the real resident page and its Edit profile, rendered from this one fixture record on a local build. Nothing here is a real resident, and no office ever held it.",
  },
  home: null,
  region: null,
  homeImages: [],
  counts: { received: 0, sent: 0, pendingOutbox: 0 },
  is_office: false,
});
registry.households[SLUG] = {
  name: "QA Fixture House",
  accounts: [{ login: "qa-fixture-core188", id: -188 }],
  residents: [H],
  since: "2026-11-25",
  member_of: "the-harbor",
  declared_by: "QA FIXTURE (CORE-188): invented for a local capture; never declared",
};
writeFileSync(rPath, JSON.stringify(residents, null, 2) + "\n");
writeFileSync(hPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`added ${H} and ${SLUG} to ${T}'s data (restore with git checkout -- src/data/postmark/residents.json src/data/postmark/households.json)`);
