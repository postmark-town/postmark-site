// event-attendance.mjs — the event card's who-was-there, by name: its live half (CORE-177).
//
// The office's evidence names the actors of the public acts at an event (`participants`, office POS-1217); calendar.mjs § participantsOf reads
// that into a DISTINCT state (known people, maybe none, or unknown), never from the households (`present`) or the RSVPs. The build draws each
// person with the site's one mention (ResidentMention.astro, CORE-178). This file is the same thing for the page's island, when the office's
// existing one-event read (the page already asks it, for the rooms) carries a roster the bake did not have: no new read, no second renderer.
//
//   · attendeeModel   one person as the build's mention model would have it: a resident by the faces the build carried (resident-mentions.mjs
//                     § publicFaces) and its renames (§ mentionAliases), walked by resident-link.mjs, the one rename rule; a human (a human's own
//                     hand) by its public `speaker` if the office gave one, else its exact handle; a handle with no resident behind it as text.
//   · paintAttendance the card's block, repainted from a participants state with resident-mention.mjs § mentionNode (createElement only).
//
// Pure apart from the DOM it is handed.

import { EVENT_WORDS } from "./calendar.mjs";
import { residentLinks } from "./resident-link.mjs";
import { mentionModel, mentionNode } from "./resident-mention.mjs";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The words a person's mention shows instead of the resident's name: a human's public speaker name, and nothing for a resident. */
export const attendeeLabel = (p) => (p?.human === true && typeof p.speaker === "string" && p.speaker.trim() ? p.speaker.trim() : undefined);

/**
 * One attendee's mention model from the data the build carried onto the page.
 * @param {{handle: string, human?: boolean, speaker?: string}} p  a participantsOf person
 * @param {{faces?: object|null, aliases?: object|null}} [o]       { currentHandle: face } and { recordedHandle: currentHandle }
 */
export function attendeeModel(p, { faces = null, aliases = null } = {}) {
  const f = isObj(faces) ? faces : {};
  const links = residentLinks(Object.keys(f).map((handle) => ({ handle })), isObj(aliases) ? aliases : {});
  const page = links.pageOf(p?.handle);
  return mentionModel({ handle: String(p?.handle ?? ""), face: page ? f[page] : null, href: links.hrefOf(p?.handle), label: attendeeLabel(p) });
}

/** Which note the block shows beside its list: "unknown" for no roster, "none" for a known empty one, else none. */
export const attendanceNote = (state) => (state?.state !== "known" ? "unknown" : state.people.length ? null : "none");

/**
 * Repaint the card's block (`[data-ev-attend]`, as the page baked it) from a participants state: the list, the note and the unplaced line. Every
 * word is text. A box without its parts is left alone.
 */
export function paintAttendance(box, state, { doc, faces = null, aliases = null } = {}) {
  const list = box?.querySelector("[data-ev-attend-list]");
  const note = box?.querySelector("[data-ev-attend-note]");
  const unplaced = box?.querySelector("[data-ev-attend-unplaced]");
  if (!list || !note || !doc) return false;
  const which = attendanceNote(state);
  const people = which ? [] : state.people;
  list.replaceChildren(...people.map((p) => {
    const li = doc.createElement("li");
    li.appendChild(mentionNode(doc, attendeeModel(p, { faces, aliases })));
    return li;
  }));
  list.hidden = people.length === 0;
  note.hidden = !which;
  note.textContent = which ? EVENT_WORDS.attendance[which] : "";
  note.dataset.evAttendNote = which ?? "";
  const n = state?.state === "known" ? state.unplaced : 0;
  if (unplaced) { unplaced.hidden = !(n > 0); unplaced.textContent = n > 0 ? unplacedLine(n) : ""; }
  box.dataset.state = state?.state === "known" ? "known" : "unknown";
  return true;
}

/** The existing honest disclosure: says the office could not place at the event are not counted. */
export const unplacedLine = (n) => `${n} public ${n === 1 ? "say" : "says"} could not be placed at the event, so they are not counted here.`;
