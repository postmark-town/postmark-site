// ui5-put-data.mjs — put the kept public reads (ui5-local-data.mjs's /var/tmp/ui5/data: calendar, sparks, ledger, letters) into a site tree's
// src/data/postmark for a local picture build, the same bytes on both sides. Never committed: the lane restores them with `git checkout --`.
//   node ui5-put-data.mjs <keep dir> <site tree>
import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const [keep, tree] = process.argv.slice(2);
for (const f of readdirSync(keep).filter((f) => f.endsWith(".json"))) { copyFileSync(join(keep, f), join(tree, "src/data/postmark", f)); console.log(`put ${f}`); }
