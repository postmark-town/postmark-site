// make-real-sparks.mjs: shape the ONE real filed Spark, read from the public register (GET /world2/marks?all=true&full=true, saved by an anonymous curl), with the site's own sparkViewOfMark,
// into a sparks.json for a local evidence build. Output is outside the tree; nothing is committed.
import { readFileSync, writeFileSync } from "node:fs";
import { sparkViewOfMark } from "/home/seat/trees-interfaces/pool/site-2/tools/lib/fetch-town-data.mjs";
const j = JSON.parse(readFileSync("/var/tmp/core-190/register.json", "utf8"));
const m = j.marks.find((x) => x.slug === "landfall/low-tide-a-bird-folds-and-the-beach-hands-it-back");
if (!m) throw new Error("the filed Spark is not in the register");
const view = sparkViewOfMark(m);
console.log(Object.keys(view).join(","), "| picture:", view.picture);
writeFileSync("/var/tmp/core-190/real-sparks.json", JSON.stringify({
  read: "ok",
  note: "CORE-190 local evidence: the ONE real filed Spark, read from the public register (GET /world2/marks?all=true&full=true) and shaped by the site's own sparkViewOfMark; not committed",
  count: 1,
  sparks: [view],
}, null, 2) + "\n");
