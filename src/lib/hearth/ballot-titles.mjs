// ballot-titles.mjs — the build's one map of Hearth designs to their authored titles (CORE-126), for the boards that list the Hearth ballot.
//
// Build-time only, like ballot-previews.mjs, and for the same reason: a page hands the map to its browser script as a data attribute and the script
// reads it back through ballot-caption.mjs § readTitles. It reads the entries' METADATA (hearths.json: id, title), not the prepared registry, so a
// design's title never depends on whether this build can preview or render it.

import rows from "../../data/postmark/hearths.json";
import { titlesOf } from "./ballot-caption.mjs";

export const hearthTitles = titlesOf(rows);
