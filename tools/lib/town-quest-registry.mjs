// town-quest-registry.mjs — THE TOWN'S QUEST REGISTRY, read from the town checkout (POS-954).
//
// The civic quarter's Quest Guild draws its cards from the office's quest POSTS (POS-294, quest-posts.json). A quest the
// registry defines but the office has not put up as a post has no card there: Bring a neighbour (cadence `monthly`, town
// #4424) is on the office's household board, which reads the registry itself, and missing from the Guild. The registry is
// the canonical definition both read, so the build reads it too, from the same place the office's own board does: the
// town repo's `quest-registry.json` (the town is public), through the checkout this job is already handed (`--town`).
//
// What is kept is the part a card needs, and only that: a quest's id, title, cadence, source, reward, target, `ends`,
// `validation` and `subtype`. The registry's long `derivation` notes are documentation for builders ("unrendered, unparsed")
// and stay in the town. Nothing here is a list of quests: a quest is a row of the file, and every field is the file's.
//
// Pure projection first, so `node --test` proves each rule without a checkout; the one function that touches the disk is last.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export const QUEST_REGISTRY_FILE = "quest-registry.json";
export const QUEST_REGISTRY_SOURCE = "postmark-town/postmark quest-registry.json";

// The fields of a registry row the site reads. A field the row lacks is left out, never filled in.
const KEPT = ["id", "title", "cadence", "validation", "subtype", "source", "reward", "target", "ends"];

/** The registry's rows reduced to the fields a card reads, in the file's own order. Throws on a file that is not a registry. */
export function projectQuestRegistry(parsed) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.quests))
    throw new Error("not the town's quest registry: no `quests` array");
  const quests = [];
  for (const row of parsed.quests) {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) continue;
    quests.push(Object.fromEntries(KEPT.filter((k) => row[k] !== undefined && row[k] !== null).map((k) => [k, row[k]])));
  }
  return { quests };
}

/** The checkout's HEAD sha (12 chars), or null when it cannot be read (a plain folder, not a clone). */
function headOf(townRoot) {
  try { return execFileSync("git", ["-C", townRoot, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; }
  catch { return null; }
}

/** `{ source, quests }` read from `<townRoot>/quest-registry.json`. Throws when the file is missing or is not a registry. */
export function readQuestRegistryFromCheckout(townRoot) {
  const file = join(townRoot, QUEST_REGISTRY_FILE);
  if (!existsSync(file)) throw new Error(`no ${QUEST_REGISTRY_FILE} in the town checkout`);
  const { quests } = projectQuestRegistry(JSON.parse(readFileSync(file, "utf8")));
  const at = headOf(townRoot);
  return { source: `${QUEST_REGISTRY_SOURCE}${at ? ` @ ${at}` : ""}`, quests };
}
