// core178-tidemark-row.mjs <site tree> [--write] — CORE-178 picture supplement (Facet 23:25Z): ONE keyless public read of Tidemark's resident card
// (GET <office>/residents/tidemark, the door fetch-town reads for every roll row), projected exactly as fetch-town does (town.mjs normalizeProfile +
// fetch-town-data.mjs mapResident, with no letters or ledger, so counts are zero), and with --write inserted into the LOCAL src/data/postmark/residents.json
// in handle order for a local build only. Never committed; restored with `git checkout --` after the batch. Prints the row's public identity fields.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const T = process.argv[2];
const { apiGet, mapResident, jsonText } = await import(join(T, "tools/lib/fetch-town-data.mjs"));
const { normalizeProfile } = await import(join(T, "tools/lib/town.mjs"));
const at = new Date().toISOString();
const { body: card } = await apiGet("/residents/tidemark", { apiBase: "https://postmark.town/api", retries: 2 });
const problems = [];
const office = card?.profile && typeof card.profile === "object" && !Array.isArray(card.profile) ? card.profile : {};
const profile = Object.keys(office).length ? normalizeProfile(office, "office card /residents/tidemark", problems) : {};
const row = mapResident(card, [], [], profile);
console.log(JSON.stringify({ read: "GET https://postmark.town/api/residents/tidemark", at, handle: row.handle, name: row.profile?.name ?? null, avatar_url: row.profile?.avatar_url ?? null, color: row.profile?.color ?? null, color_name: row.profile?.color_name ?? null, problems }));
if (process.argv.includes("--write")) {
  const f = join(T, "src/data/postmark/residents.json");
  const roll = JSON.parse(readFileSync(f, "utf8")).filter((r) => r.handle !== row.handle);
  roll.push(row); roll.sort((a, b) => a.handle.localeCompare(b.handle));
  writeFileSync(f, jsonText(roll));
  console.log(`wrote ${f}: ${roll.length} rows`);
}
