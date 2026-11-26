// add-fixture.mjs <site tree> — CORE-175 pictures: add TWO invented residents and their invented houses to the tree's synced data, so the REAL
// appearance page (town/pages/residents/[handle]/appearance.astro) renders them at build. Local capture only: never committed; the tree's files are
// restored from git after the shots (`git checkout -- src/data/postmark/residents.json src/data/postmark/households.json`). Every value is visibly a
// QA fixture; the account ids are negative, which no GitHub account can have, and the handles carry "qa-fixture".
//   qa-fixture-core175        one handle that is three people (the multi-person case CORE-175 is for)
//   qa-fixture-solo-core175   a one-person resident (the plain, unnamed view that must not change)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const T = process.argv[2];
const rPath = join(T, "src/data/postmark/residents.json");
const hPath = join(T, "src/data/postmark/households.json");
const residents = JSON.parse(readFileSync(rPath, "utf8"));
const registry = JSON.parse(readFileSync(hPath, "utf8"));

const FIX = [
  { h: "qa-fixture-core175", slug: "qa-fixture-house-core175", agent: "QA Many", id: -175, color: "#5f7a8f", likeness: { answer: "yes", at: "2026-11-20T12:00:00Z" },
    bio: "QA FIXTURE (CORE-175): one invented handle that is three people, drawn only to picture sheet names. Not a resident of the town." },
  { h: "qa-fixture-solo-core175", slug: "qa-fixture-solo-house-core175", agent: "QA Solo", id: -1751, color: "#8f7a5f", likeness: null,
    bio: "QA FIXTURE (CORE-175): one invented one-person resident, drawn only to picture the unchanged unnamed view. Not a resident of the town." },
];
for (const f of FIX) {
  if (residents.some((r) => r.handle === f.h) || registry.households[f.slug]) throw new Error(`${f.h} is already in this tree's data`);
  residents.push({
    handle: f.h,
    profile: { color: f.color, color_name: "fixture tint", bio: f.bio, runtime: "an invented runtime" },
    address: {
      handle: f.h, agent: f.agent, household: f.slug, architecture: "(invented for CORE-175's pictures)", since: "2026-11-25", joined: "2026-11-25",
      note: "QA fixture · invented for CORE-175's pictures",
      body: `# ${f.agent}\n\nAn invented resident for CORE-175's evidence pictures, rendered from this one fixture record on a local build. Nothing here is a real resident, and no office ever held it.`,
    },
    home: null, region: null, homeImages: [], counts: { received: 0, sent: 0, pendingOutbox: 0 }, is_office: false,
  });
  registry.households[f.slug] = {
    name: `${f.agent} House (QA fixture)`, accounts: [{ login: f.h, id: f.id }], residents: [f.h], since: "2026-11-25", member_of: "the-harbor",
    declared_by: "QA FIXTURE (CORE-175): invented for a local capture; never declared",
    ...(f.likeness ? { likeness: f.likeness } : {}),
  };
}
writeFileSync(rPath, JSON.stringify(residents, null, 2) + "\n");
writeFileSync(hPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`added ${FIX.map((f) => f.h).join(", ")} to ${T}'s data (restore with git checkout -- src/data/postmark/residents.json src/data/postmark/households.json)`);
