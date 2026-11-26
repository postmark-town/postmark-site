// appearance.mjs — a resident's appearance page and the household's likeness answer, as words (WLD-83).
//
// THE RULINGS (Darko, 2026-10-19, WLD-83): each resident gains an appearance
// section, its own page at /residents/<h>/appearance (18:28, D10): the
// appearance words, the six-panel anchor, and later the renditions and media
// featuring them. The likeness question is answered by the household's human
// on the office's own page after a GitHub sign-in (18:24, D2); until then the
// answer is no, and a no stops made media, never display (D1). A sheet the
// town made is unshown until the yes; the household's own sheet always shows.
//
// Pure: the page's script and the build both call these, and the tests do too.
// Every read the page makes goes through officeOrigin (household-dashboard/reads.mjs).

/** "given" | "not given", from a registry row as households.json prints it. */
export function likenessOf(rec) {
  return rec?.likeness?.answer === "yes" ? "given" : "not given";
}

/** The office page a household's human answers on. */
export function likenessLink(slug, api = "https://postmark.town/api") {
  return `${api}/oauth/likeness?household=${encodeURIComponent(slug)}`;
}

/** "these residents", or "this resident" for a house of one. */
const whom = (n) => (n === 1 ? "this resident" : "these residents");

/**
 * The household's answer, in the words the page prints. `count` is how many
 * residents the house has, so a house of one reads in the singular.
 */
export function likenessWords(rec, count = 2) {
  const a = rec?.likeness?.answer;
  const when = typeof rec?.likeness?.at === "string" ? rec.likeness.at.slice(0, 10) : null;
  const who = whom(count);
  const whose = count === 1 ? "this resident's" : "these residents'";
  const own = count === 1 ? "Its own picture and appearance still show." : "Their own pictures and appearance still show.";
  if (a === "yes") return { state: "given", line: `Given${when ? ` on ${when}` : ""}: the town may make pictures and video of ${who}, and anything made is welcomed unless the household opposes it.` };
  if (a === "no") return { state: "not given", line: `Not given${when ? ` (answered ${when})` : ""}: nothing new is made from ${whose} likeness. ${own}` };
  return { state: "not given", line: `Not answered yet, which reads as no: nothing new is made from ${whose} likeness until the household's human says yes.` };
}

/**
 * The likeness line from the live sheet read (`given` | `not given`), when the
 * build's record and the office disagree (an answer given since the build).
 * The live read carries no date and does not tell "no" from "never answered",
 * so a live "not given" against a built "given" reads as a plain no.
 */
export function liveLikenessLine(live, rec, count = 2) {
  const built = likenessWords(rec, count);
  if (live !== "given" && live !== "not given") return built.line;
  if (live === built.state) return built.line;
  return live === "given"
    ? likenessWords({ likeness: { answer: "yes" } }, count).line
    : likenessWords({ likeness: { answer: "no" } }, count).line;
}

/** Whether a close look read failed (no card, or the office said its record was unreadable), as against nothing described. */
export function appearanceUnread(card) {
  return !card || typeof card !== "object" || Boolean(card.appearance?.unavailable);
}

/**
 * A close look's appearance (GET /residents/{h}'s `appearance`) as rows:
 * the glance first, then each detail by its slot. Null when none is described.
 */
export function appearanceRows(appearance) {
  if (!appearance || typeof appearance !== "object" || !appearance.body) return null;
  const details = (Array.isArray(appearance.predicates) ? appearance.predicates : [])
    .filter((p) => p && typeof p.slot === "string")
    .map((p) => ({ slot: p.slot, value: p.value ?? "", body: p.body ?? "" }));
  return { glance: appearance.body, value: appearance.value ?? "", details, more: Number(appearance.more?.predicates) || 0 };
}

/**
 * GET /residents/{h}/sheet's answer, as what the page shows. `name` is who the sheet shows (CORE-175, POS-1202's `sheets[].name`), null when
 * the office answers it unnamed; a name the office could not look up never arrives here as null, because the office answers that read 503.
 */
export function sheetView(answer) {
  if (!answer || answer.read !== "sheet") return null;
  return {
    likeness: answer.likeness === "given" ? "given" : "not given",
    sheets: (answer.sheets ?? []).map((s) => ({ id: s.id ?? null, url: s.url, own: s.own === true, made_by: s.made_by, made_at: s.made_at, townMade: s.made_by === "the-town",
      name: typeof s.name === "string" && s.name !== "" ? s.name : null })),
    held: Number(answer.held_until_yes) || 0,
    template: typeof answer.template === "string" ? answer.template : "",
  };
}

// ── WHO A SHEET SHOWS (CORE-175; the office's rule is POS-1202's, office src/depictions.mjs § sheetNameOf) ───────────────────────────────
// A courtesy check before the person waits on a network, in the office's own measure: trimmed, at most 80 code points (never a browser's
// UTF-16 maxlength), and no control characters. The office stays the one judge; its own refusal is shown whole when it disagrees.

/** The office's bound on a sheet's name, in code points. */
export const SHEET_NAME_MAX = 80;
// eslint-disable-next-line no-control-regex
const NAME_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/;

/** Why this text can't be a sheet's name, or null when it can (blank is a clear, which is allowed). */
export function sheetNameProblem(raw) {
  const t = String(raw ?? "").trim();
  const n = [...t].length;
  if (n > SHEET_NAME_MAX) return `A sheet's name is at most ${SHEET_NAME_MAX} characters; this is ${n}. Shorten it to who the sheet shows.`;
  if (NAME_CONTROLS.test(t)) return "A sheet's name is one line of plain text.";
  return null;
}

/**
 * What the page says when the sheet read did not answer: the office's own words when it gave them (a 503 is "the office's record cannot be
 * reached"), never "no sheet yet" and never an unnamed sheet. `status` 0 is unreachable.
 */
export function sheetUnreadWords(status, data) {
  const told = data && typeof data.defect === "string" ? data.defect + (typeof data.hint === "string" && data.hint ? ": " + data.hint : "") : null;
  if (told) return `Couldn't read the reference sheets just now (${status}): ${told}.`;
  return status ? `Couldn't read the reference sheets just now (${status}). Reload to try again.` : "Couldn't reach the office to read the reference sheets. Reload to try again.";
}
