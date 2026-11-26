// pictures-list.mjs <tree> — lists the register's (sparks.json in the tree) pictured Sparks and their picture src, through the tree's own pictureOf
import { readFileSync } from "node:fs";
const T = process.argv[2];
const { pictureOf } = await import(T + "/src/lib/calendar.mjs");
const reg = JSON.parse(readFileSync(T + "/src/data/postmark/sparks.json", "utf8"));
console.log(`register: read=${reg.read} count=${reg.count ?? reg.sparks?.length} keys=${Object.keys(reg).join(",")}`);
for (const s of reg.sparks ?? []) { const p = pictureOf(s); if (p) console.log(`${s.id}\t${p.src}`); }
