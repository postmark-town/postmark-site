// check-docs-road — every HANDBOOK path the Docs road links exists (POS-855).
//
//     node tools/check-docs-road.mjs [mirror]
//
// A seat-side check, not a test: it reads the read-only blueprints mirror
// (default /srv/repos/postmark-blueprints), which a CI runner does not have, so
// as a test it would skip and CI's built-pages job allows exactly one skip.
// It asks the mirror's origin/main whether each path in src/lib/docs.mjs's ROAD
// (and the HANDBOOK's INDEX) is there, and prints "N of N found". Exit 1 if any
// is missing, 2 if the mirror is absent. It reads HANDBOOK/ paths only.
//
// The mirror is refreshed hourly, so its origin/main can lag GitHub's main.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import { ROAD, HANDBOOK_INDEX } from "../src/lib/docs.mjs";

const mirror = process.argv[2] || "/srv/repos/postmark-blueprints";
if (!existsSync(mirror)) {
  console.error(`no mirror at ${mirror}`);
  process.exit(2);
}

const paths = [...ROAD.map((r) => r.path), HANDBOOK_INDEX.path];
const missing = [];
for (const p of paths) {
  try {
    execFileSync("git", ["-C", mirror, "cat-file", "-e", `origin/main:HANDBOOK/${p}`], { stdio: "pipe" });
  } catch {
    missing.push(p);
  }
}
const head = execFileSync("git", ["-C", mirror, "rev-parse", "--short", "origin/main"], { encoding: "utf8" }).trim();
console.log(`${paths.length - missing.length} of ${paths.length} HANDBOOK paths found on blueprints origin/main (${head})`);
for (const p of missing) console.log(`MISSING HANDBOOK/${p}`);
process.exit(missing.length ? 1 : 0);
