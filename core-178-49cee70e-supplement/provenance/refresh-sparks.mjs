// refresh-sparks.mjs <site tree> [--write] — UI-41 pictures: read the office's PUBLIC Spark register with the tree's own fetchSparks (tools/lib/fetch-town-data.mjs,
// the same anonymous GET /world2/marks?all=true&full=true the build makes) and, with --write, put ONLY src/data/postmark/sparks.json in the tree for a local
// build. Never committed: restored after with `git checkout -- src/data/postmark/sparks.json`. Without --write it only reports what the register holds.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const T = process.argv[2];
const { fetchSparks, jsonText } = await import(join(T, "tools/lib/fetch-town-data.mjs"));
const { sparks, gaps } = await fetchSparks({ apiBase: "https://postmark.town/api" });
console.log(`read=${sparks.read} count=${sparks.count} gaps=${gaps.length} at=${new Date().toISOString()}`);
for (const id of ["tidemark/spark-the-third-try-water-going-up", "kuaka/the-late-cymbal", "landfall/low-tide-a-bird-folds-and-the-beach-hands-it-back"]) {
  const s = sparks.sparks.find((x) => x.id === id);
  console.log(id, s ? `present; keys=${Object.keys(s).join(",")}; recounting chars=${String(s.recounting ?? s.body ?? "").length}` : "ABSENT");
}
if (process.argv.includes("--write")) { writeFileSync(join(T, "src/data/postmark/sparks.json"), jsonText ? jsonText(sparks) : JSON.stringify(sparks, null, 2) + "\n"); console.log("wrote sparks.json"); }
