// check-resident-links.mjs — every /residents/<handle>/ link in the built mail and replay pages lands on a page (POS-530, POS-531).
//
//   node tools/check-resident-links.mjs [--dist dist-town]
//
// Offline, over a finished build: it reads every .html and .json under
// <dist>/mail/ and <dist>/replay/ (the older-letters chunks are JSON, and they
// carry the same letterheads), takes each href to /residents/<handle>/, and
// asks whether <dist>/residents/<handle>/index.html exists. Exit 0 when every
// one does, 1 with the dead ones listed (handle, how many links, a few pages
// that carry them), 2 when there is no build to read.
//
// It reads the built pages because that is where a dead link is. Links the
// replay draws in the browser (its feed) are not in the HTML; the page hands
// them the same two facts as the server-drawn column, and the test file holds
// that walk.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCOPES = ["mail", "replay"];
// an href attribute, quoted plainly in HTML or escaped inside a JSON string
const HREF = /href=\\?"\/residents\/([^"\\/?#]+)\/?[^"\\]*\\?"/g;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(html|json)$/.test(name)) yield path;
  }
}

export function residentLinkReport(dist) {
  const dead = new Map();   // handle -> { links, pages: Set }
  let links = 0, pages = 0;
  for (const scope of SCOPES) {
    const root = join(dist, scope);
    if (!existsSync(root)) continue;
    for (const path of files(root)) {
      pages++;
      const text = readFileSync(path, "utf8");
      for (const m of text.matchAll(HREF)) {
        links++;
        const handle = decodeURIComponent(m[1]);
        if (existsSync(join(dist, "residents", handle, "index.html"))) continue;
        if (!dead.has(handle)) dead.set(handle, { links: 0, pages: new Set() });
        const d = dead.get(handle);
        d.links++;
        d.pages.add(relative(dist, path).replace(/\\/g, "/"));
      }
    }
  }
  return { pages, links, dead };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const at = process.argv.indexOf("--dist");
  const dist = resolve(at > 0 ? process.argv[at + 1] : "dist-town");
  if (!existsSync(join(dist, "residents")) || !SCOPES.some((s) => existsSync(join(dist, s)))) {
    console.error(`no built site to read at ${dist} (run npm run build first)`);
    process.exit(2);
  }
  const { pages, links, dead } = residentLinkReport(dist);
  const deadLinks = [...dead.values()].reduce((n, d) => n + d.links, 0);
  console.log(`${pages} mail and replay files, ${links} links to /residents/, ${deadLinks} dead (${dead.size} handles)`);
  for (const [handle, d] of [...dead].sort((a, b) => b[1].links - a[1].links)) {
    console.log(`  /residents/${handle}/  ${d.links} links on ${d.pages.size} files, e.g. ${[...d.pages].slice(0, 3).join(", ")}`);
  }
  process.exit(dead.size ? 1 : 0);
}
