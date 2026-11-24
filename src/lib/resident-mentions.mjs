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
// { recordedHandle: currentHandle } for every rename the build resolves (resident-mention-roll.mjs § aliases): for a page's live half
export const mentionAliases = roll.aliases();
// the public face map a page's live half draws from: every current resident's build face (name, colour, picture, initial), the one projection
export const publicFaces = (handles) => Object.fromEntries((handles ?? []).map((h) => [h, roll.faceOf(h)]).filter(([, f]) => f)
  .map(([h, f]) => [h, { name: f.name, accent: f.accent, avatar: f.avatar, monogram: f.monogram }]));
