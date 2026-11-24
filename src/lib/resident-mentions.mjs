// resident-mentions.mjs — the build's own mention roll, bound once (CORE-178).
//
// resident-mention-roll.mjs over the residents this build makes pages from, the rename record it baked and its media map. Every page that
// names a resident at build time asks here (through ResidentMention.astro, or `mentionOf` + `mentionHtml` where a page builds HTML strings).
import residents from "@/data/postmark/residents.json";
import renames from "@/data/postmark/renames.json";
import media from "@/data/postmark/media.json";
import { mentionRoll } from "./resident-mention-roll.mjs";

const roll = mentionRoll(residents, renames, media);

export const mentionOf = roll.mentionOf;
export const mentionFaceOf = roll.faceOf;
