// cache-images.mjs <pictures.tsv> <cache dir> — UI-43 (Facet 19:00Z): anonymous public GETs of the gallery's picture URLs, saved UNCHANGED with their served
// content type, so the capture's setup module can answer exactly those media.postmark.town GETs from bytes (the staged-page wall stays: no off-origin continue).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const [list, dir] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const urls = [...new Set(readFileSync(list, "utf8").split("\n").filter((l) => l.includes("\t")).map((l) => l.split("\t")[1]))];
const manifest = { method: "anonymous GET, no headers beyond node fetch defaults, no cookies or credentials; bytes stored unchanged", at: new Date().toISOString(), images: [] };
let bad = 0;
for (const url of urls) {
  if (!/^https:\/\/media\.postmark\.town\//.test(url)) { console.log(`SKIP not the media door: ${url}`); bad++; continue; }
  try {
    const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const sha = createHash("sha256").update(buf).digest("hex");
    const file = sha + ".bin";
    if (r.ok) writeFileSync(join(dir, file), buf);
    manifest.images.push({ url, status: r.status, contentType: r.headers.get("content-type"), bytes: buf.length, sha256: sha, file: r.ok ? file : null });
    if (!r.ok) { bad++; console.log(`FAIL ${r.status} ${url}`); }
  } catch (e) { bad++; manifest.images.push({ url, error: String(e.message) }); console.log(`FAIL ${e.message} ${url}`); }
}
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`cached ${manifest.images.filter((i) => i.file).length}/${urls.length}, failures ${bad}`);
