// ui5-cache.mjs — the camera's picture cache for UI-5: every media.postmark.town picture the front page can show from the given data (the
// landing's Sparks and calendar faces through the tree's own helpers, Regina's portrait, the examples' pictures), read by anonymous GET,
// unchanged, with each sha256 in manifest.json. site-prep aborts any off-origin request a setup module does not answer; the module answers
// these from here and nothing else.
//   node ui5-cache.mjs <site tree> <data dir> <cache dir>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [tree, dataDir, cache] = process.argv.slice(2);
mkdirSync(cache, { recursive: true });
const j = (f) => JSON.parse(readFileSync(existsSync(join(dataDir, f)) ? join(dataDir, f) : join(tree, "src/data/postmark", f), "utf8"));
const imp = (p) => import(pathToFileURL(join(tree, p)).href);
const L = await imp("src/lib/visitor-landing.mjs");
const EX = await imp("src/lib/visitor-landing-examples.mjs");
const { pictureOf } = await imp("src/lib/calendar.mjs");
const { profilePicture } = await imp("src/lib/profile-picture.mjs");
const residents = j("residents.json"), media = j("media.json");
const urls = new Set(["https://media.postmark.town/media/the-town/40b8c76c3c6d381d4950eb83793ecc7a93c2c5c3dd0c5c7a4f21ce0aad9e5169.jpg"]);
for (const s of L.landingSparks(j("sparks.json"), { pictureOf })) urls.add(s.picture.src);
for (const e of L.upcomingEvents(j("calendar.json"), { residents, pictureOf: (h, p) => profilePicture(h, p, media) })) for (const f of e.faces) if (f.src) urls.add(f.src);
for (const s of EX.SPARKS) urls.add(s.picture.src);
for (const e of EX.EVENTS) for (const f of e.faces) if (f.src) urls.add(f.src);
for (const h of Object.values(EX.HOMES)) urls.add(h.img);
const images = [];
for (const url of [...urls].filter((u) => u.startsWith("https://media.postmark.town/"))) {
  const res = await fetch(url);
  if (!res.ok) { images.push({ url, status: res.status }); console.log(`MISS ${res.status} ${url}`); continue; }
  const body = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  const file = `${sha256}${url.match(/\.\w+$/)?.[0] ?? ""}`;
  writeFileSync(join(cache, file), body);
  images.push({ url, file, sha256, bytes: body.length, contentType: res.headers.get("content-type") });
}
writeFileSync(join(cache, "manifest.json"), JSON.stringify({ read_at: new Date().toISOString(), images }, null, 1));
console.log(`cached ${images.filter((i) => i.file).length}/${images.length} into ${cache}`);
