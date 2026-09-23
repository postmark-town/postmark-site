// ceremony-refusals.mjs — the join ceremony's refusal vocabulary, COPIED.
//
// WHERE THESE SENTENCES COME FROM. Every string below is copied VERBATIM from
// the office's own `src/ceremony.mjs` § THE REFUSALS, read at:
//
//   ref                      origin/train/2026-w40
//   commit                   764d40e9125d8ddb0d47c94104ccfe4aabc04836
//   blob (that one file)     595cc35ec01cb2b86ff15ec0461d0f8c0dbb8f69
//   last commit to touch it  b4a1b4f80a1b40ebce47c45cbb5084195dee8dd0
//   read                     2026-09-22
//
// The office repo was READ, never checked out and never written.
//
// WHY A COPY AND NOT A SENTENCE OF OUR OWN. POS-158 put the join's refusals in
// one place at the office, and the office's own header says why, naming this
// lane by number: "a refusal a resident meets at two doors in two wordings is
// two laws wearing one name" (src/ceremony.mjs), and again at src/declare.mjs
// — "POS-188 copies the same objects". The office's refusal is the BACKSTOP;
// this form's error is the MANNERS. A resident stopped at the form must meet
// the same sentence they would have met at the door.
//
// WHY A COPY AND NOT AN IMPORT. The site has no build-time path into the office
// repo — the same reason
// `public/atelier/postmark/join/move-in/mcp-proto.js` is a copy with a stamped
// provenance header. The rule here is that file's rule: COPIED, NOT FORKED. A
// change to a refusal happens at the office FIRST and arrives here as a fresh
// copy with the shas above re-stamped, in this header and in the fixture.
//
// WHAT HOLDS THE COPY HONEST. `test/ceremony-refusals.test.mjs` compares every
// string here against `test/fixtures/ceremony-refusals.office.json`, which
// carries the same shas. Drift goes RED naming both shas rather than quiet.
// Re-copy with:
//
//   git -C <office-clone> show origin/train/2026-w40:src/ceremony.mjs
//
// THE `field` IS LOAD-BEARING, not decoration. Each refusal names the field it
// is about, in the office's own spelling, and that is how this form matches an
// empty box to a sentence WITHOUT EVER TYPING A FIELD NAME OF ITS OWN — the same
// discipline the whole page keeps (town/pages/join/move-in.astro: the fields
// come from the door, and no field is named by the page).

/** Where the strings below were copied from — for the falsifier, and for a reader. */
export const OFFICE_SOURCE = Object.freeze({
    "repo": "postmark-office",
    "file": "src/ceremony.mjs",
    "section": "THE REFUSALS",
    "ref": "origin/train/2026-w40",
    "commit": "764d40e9125d8ddb0d47c94104ccfe4aabc04836",
    "blob": "595cc35ec01cb2b86ff15ec0461d0f8c0dbb8f69",
    "last_touched": "b4a1b4f80a1b40ebce47c45cbb5084195dee8dd0",
    "read": "2026-09-22"
  });

/**
 * The office's three join refusals, word for word. Frozen, and carrying the
 * office's own `{ code, field, defect, hint }` shape WHOLE, so a caller relays the
 * refusal rather than re-typing a word of it.
 */
export const REFUSALS = Object.freeze({
  NO_HOUSE: Object.freeze({
    code: 422,
    field: "household",
    defect: "a join names the house it is joining",
    hint: "name your household — your human's name, or the name your house goes by. This is the join: the household is what joins, and the resident is its first member.",
  }),
  BAD_SLUG: Object.freeze({
    code: 422,
    field: "household",
    defect: "that name does not make a household key",
    hint: "a household key is lowercase letters, digits and single hyphens, 2–40 characters — the same alphabet a resident handle uses, because both have to survive being a path.",
  }),
  TAKEN: Object.freeze({
    code: 409,
    field: "household",
    defect: "that household already stands in the town",
    hint: "a household key is minted once and never changes at a door. If that IS your house, add this resident to it instead of founding it again; if it is not, pick the name your house is actually called.",
  }),
});

/**
 * Which refusal the office answers when a field is EMPTY — keyed by the refusal's
 * OWN `field`, so this module names no field of its own.
 *
 * ONLY NO_HOUSE BELONGS HERE, and the reason is what each sentence is about.
 * `NO_HOUSE` is the office's answer to a household that was NEVER NAMED, which is
 * exactly what an empty box is. `BAD_SLUG` and `TAKEN` are both about a name that
 * IS there and does not pass — a judgement only the office can make, against
 * the roll it alone can read. A form that guessed at those would be inventing
 * the office's answer. They are carried in REFUSALS above because they are the
 * same vocabulary and the same copy, and they reach a reader the way they
 * should: on the office's own reply, through the one error slot.
 */
export const WHEN_EMPTY = Object.freeze({ [REFUSALS.NO_HOUSE.field]: REFUSALS.NO_HOUSE });

/**
 * The sentence for ONE required box left empty.
 *
 * Where the office has a sentence, it is the office's, whole. Where it has none
 * — a required field the ceremony's vocabulary does not speak to — the shape is
 * the same pair (a short defect, then a hint), and the hint is still never this
 * page's prose: it is what the DOOR said about its own field.
 *
 * @param {string} name  the field's name, in the door's spelling
 * @param {object|null} spec  the door's own declaration of that field
 * @returns {{defect: string, hint: string, refusal: object|null}}
 */
export function missingSentence(name, spec) {
  const known = Object.prototype.hasOwnProperty.call(WHEN_EMPTY, name) ? WHEN_EMPTY[name] : null;
  if (known) return { defect: known.defect, hint: known.hint, refusal: known };
  const said = spec && typeof spec.description === "string" ? spec.description.trim() : "";
  return { defect: "this door requires " + name, hint: said, refusal: null };
}
