// ui5-local-data.mjs — UI-5 local pictures only: read the few public office doors the landing draws from, with the tree's OWN
// fetchers (tools/lib/fetch-town-data.mjs), anonymously, gently (one read at a time), and write them into the tree's src/data/postmark
// for a local build. NEVER committed: the lane restores the files with `git checkout --` after the pictures.
//   node ui5-local-data.mjs <site tree> <keep dir>
// Reads: GET /calendar, GET /world2/marks?all=true&full=true (the Spark register), GET /town/ledger, and the newest delivered letters
// by id (GET /letters?full=1&ids=…, one read of at most 40). Letters are appended to the committed letters.json (whose newest is weeks old).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [tree, keep] = process.argv.slice(2);
if (!tree || !keep) throw new Error("usage: node ui5-local-data.mjs <site tree> <keep dir>");
const lib = await import(pathToFileURL(join(tree, "tools/lib/fetch-town-data.mjs")).href);
const apiBase = "https://postmark.town/api";
const DATA = join(tree, "src/data/postmark");
mkdirSync(keep, { recursive: true });
const write = (name, value) => {
  const text = lib.jsonText(value);
  writeFileSync(join(keep, name), text);
  writeFileSync(join(DATA, name), text);
  console.log(`wrote ${name} (${text.length} bytes)`);
};

const only = process.argv[4] ?? "all";
if (only === "all") {
  const cal = await lib.fetchCalendar({ apiBase, retries: 2 });
  console.log("calendar:", JSON.stringify(cal).slice(0, 200));
  const calendar = cal?.calendar ?? cal;
  if (calendar && (Array.isArray(calendar.now) || Array.isArray(calendar.coming))) write("calendar.json", calendar);

  const sp = await lib.fetchSparks({ apiBase, retries: 2 });
  console.log("sparks:", sp?.sparks?.read, sp?.sparks?.count);
  if (sp?.sparks?.read === "ok") write("sparks.json", sp.sparks);
}

const led = await lib.fetchLedger({ apiBase, retries: 2 });
const ledger = Array.isArray(led) ? led : (led?.entries ?? led?.ledger ?? null);
console.log("ledger:", Array.isArray(ledger) ? ledger.length : JSON.stringify(led).slice(0, 200));
if (Array.isArray(ledger) && ledger.length) {
  write("ledger.json", ledger);
  const held = JSON.parse(readFileSync(join(DATA, "letters.json"), "utf8"));
  const have = new Set(held.map((l) => l.id));
  const ids = ledger.filter((e) => e.kind === "delivery" && !have.has(e.id)).slice(-40).map((e) => e.id);
  if (ids.length) {
    const { body } = await lib.apiGet(`/letters?full=1&limit=${ids.length}&ids=${ids.map(encodeURIComponent).join(",")}`, { apiBase, retries: 2 });
    const rows = Array.isArray(body) ? body : (body?.letters ?? body?.items ?? []);
    const mapped = rows.map(lib.mapLetter).filter(Boolean);
    console.log(`letters: asked ${ids.length}, got ${rows.length}, mapped ${mapped.length}`);
    if (mapped.length) write("letters.json", [...held, ...mapped]);
  }
}
