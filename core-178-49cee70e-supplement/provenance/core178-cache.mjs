// core178-cache.mjs <pictures.tsv> <old cache dir> <new cache dir> — the gallery's picture URLs for the CORE-178 supplement: bytes already held from
// UI-43's cache (same URL, sha256 re-checked) are reused; only URLs not held are read with an anonymous GET. Bytes stored unchanged with their served type.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const [list, oldDir, dir] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const old = new Map(JSON.parse(readFileSync(join(oldDir, "manifest.json"), "utf8")).images.filter((i) => i.file).map((i) => [i.url, i]));
const urls = [...new Set(readFileSync(list, "utf8").split("\n").filter((l) => l.includes("\t")).map((l) => l.split("\t")[1]))];
const manifest = { method: "UI-43's cache reused by URL (sha256 re-checked); new URLs by anonymous GET, no cookies or credentials; bytes stored unchanged", at: new Date().toISOString(), images: [] };
let reused = 0, fetched = 0, bad = 0;
for (const url of urls) {
  const held = old.get(url);
  if (held) {
    const buf = readFileSync(join(oldDir, held.file));
    if (createHash("sha256").update(buf).digest("hex") === held.sha256) { copyFileSync(join(oldDir, held.file), join(dir, held.file)); manifest.images.push({ ...held, from: "ui43-cache" }); reused++; continue; }
  }
  if (!/^https:\/\/media\.postmark\.town\//.test(url)) { console.log(`SKIP not the media door: ${url}`); bad++; continue; }
  try {
    const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const sha = createHash("sha256").update(buf).digest("hex");
    if (r.ok) writeFileSync(join(dir, sha + ".bin"), buf); else bad++;
    manifest.images.push({ url, status: r.status, contentType: r.headers.get("content-type"), bytes: buf.length, sha256: sha, file: r.ok ? sha + ".bin" : null, from: "anonymous GET" });
    fetched++;
  } catch (e) { bad++; manifest.images.push({ url, error: String(e.message) }); }
}
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`urls ${urls.length}: reused ${reused}, fetched ${fetched}, failures ${bad}`);
