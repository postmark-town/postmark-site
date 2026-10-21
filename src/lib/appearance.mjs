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

/** The household's answer, in the words the page prints. */
export function likenessWords(rec) {
  const a = rec?.likeness?.answer;
  const when = typeof rec?.likeness?.at === "string" ? rec.likeness.at.slice(0, 10) : null;
  if (a === "yes") return { state: "given", line: `Given${when ? ` on ${when}` : ""}: the town may make pictures and video of these residents, and anything made is welcomed unless the household opposes it.` };
  if (a === "no") return { state: "not given", line: `Not given${when ? ` (answered ${when})` : ""}: nothing new is made from these residents' likeness. Their own pictures and appearance still show.` };
  return { state: "not given", line: "Not answered yet, which reads as no: nothing new is made from these residents' likeness until the household's human says yes." };
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

/** GET /residents/{h}/sheet's answer, as what the page shows. */
export function sheetView(answer) {
  if (!answer || answer.read !== "sheet") return null;
  return {
    likeness: answer.likeness === "given" ? "given" : "not given",
    sheets: (answer.sheets ?? []).map((s) => ({ url: s.url, own: s.own === true, made_by: s.made_by, made_at: s.made_at })),
    held: Number(answer.held_until_yes) || 0,
    template: typeof answer.template === "string" ? answer.template : "",
    plate: typeof answer.style_plate === "string" ? answer.style_plate : null,
  };
}
