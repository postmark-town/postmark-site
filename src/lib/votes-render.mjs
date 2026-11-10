// votes-render.mjs — the Ballot Box's tally, as HTML, from the office's GET /votes (POS-983).
//
// The /votes/ page fetches the office's answer in the browser and draws it
// here, so a test can draw the same answer without a browser
// (test/votes-render.test.mjs). Pure: data in, a string out.
//
// POS-983 (Darko, POS-684 call 4 and call 5b, 2026-11-09): a ballot is a full
// post. Each topic carries its title and body (what is being decided, how and
// when, with links), and each choice its credit (who made it), link and
// one-line note beside its raw stamps and its backing households. The office
// answers the choices in the count's order: most raw stamps, then more
// backing households. A bare-name ballot (illuminator-name) has no words, and
// an office from before POS-983 sends no households; both draw as they did.
//
// Everything the office sends is text: it is escaped for the attribute it
// lands in, and a link is drawn only when it is an https address.

/** Text, escaped for an element's content or a double- or single-quoted attribute. */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** An https address as given, or null: nothing else is ever put in an href. */
export function safeHref(s) {
  if (typeof s !== "string") return null;
  try { return new URL(s).protocol === "https:" ? s : null; } catch { return null; }
}

/** One line of a body: its text escaped, each https address in it a link. */
export function lineHtml(line) {
  const parts = String(line).split(/(https:\/\/[^\s<>"']+)/);
  return parts.map((p, i) => {
    if (i % 2 === 0) return esc(p);
    const trail = /[.,;:!?)]+$/.exec(p)?.[0] ?? "";
    const url = trail ? p.slice(0, -trail.length) : p;
    const href = safeHref(url);
    return (href ? `<a href="${esc(href)}" rel="nofollow noopener">${esc(url)}</a>` : esc(url)) + esc(trail);
  }).join("");
}

// Known record pages for topics, so the tally links its own story.
export const RECORDS = { "illuminator-name": "/bulletin/#name-the-illuminator" };

const pretty = (slug) => String(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** One choice's row: its name, its bar, its stamps, and its words beneath. */
function choiceHtml(c, max) {
  const n = Number(c.staked) || 0;
  const pct = (max > 0 && n > 0) ? Math.max(1.5, (n / max) * 100) : 0;
  const words = [];
  if (c.credit) words.push(`<span class="v-cand-credit">by ${esc(c.credit)}</span>`);
  if (c.note) words.push(`<span class="v-cand-note">${esc(c.note)}</span>`);
  const href = safeHref(c.link);
  if (href) words.push(`<a class="v-cand-link" href="${esc(href)}" rel="nofollow noopener">see it →</a>`);
  if (Number.isInteger(c.backing_households))
    words.push(`<span class="v-cand-houses">${esc(plural(c.backing_households, "household", "households"))} backing</span>`);
  return '<li class="v-cand"><span class="v-cand-name">' + esc(c.candidate) + "</span>" +
    '<span class="v-cand-track"><span class="v-cand-fill" style="width:' + pct + '%"></span></span>' +
    '<span class="v-cand-n">' + esc(n) + "</span>" +
    (words.length ? '<p class="v-cand-words">' + words.join(" · ") + "</p>" : "") +
    "</li>";
}

/** One ballot: its head, its body, its choices in the office's order, its cap. */
export function topicHtml(t) {
  const open = t.status === "staking";
  const cands = Array.isArray(t.candidates) ? t.candidates : [];
  let max = 0;
  cands.forEach((c) => { const n = Number(c.staked) || 0; if (n > max) max = n; });
  const body = String(t.body ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => '<p class="v-body">' + lineHtml(l) + "</p>").join("");
  const record = RECORDS[t.topic]
    ? '<p class="v-record"><a href="' + RECORDS[t.topic] + '">The full board & record →</a></p>' : "";
  const tieNote = cands.some((c) => Number.isInteger(c.backing_households))
    ? " · the most stamps leads; more backing households breaks a tie" : "";
  return '<article class="v-topic">' +
    '<div class="v-topic-head"><h2>' + esc(t.title || pretty(t.topic)) + "</h2>" +
    '<span class="v-chip ' + (open ? "open" : "closed") + '">' + esc(t.status) + "</span></div>" +
    (t.window ? '<p class="v-window">' + esc(t.window) + "</p>" : "") +
    body +
    '<ul class="v-cands">' + cands.map((c) => choiceHtml(c, max)).join("") + "</ul>" +
    (t.cap_per_household_per_candidate
      ? '<p class="v-cap">cap ' + esc(t.cap_per_household_per_candidate) + " per household per choice · stakes are escrow, returned at close" + tieNote + "</p>"
      : "") +
    record +
    // POS-502: a staking ballot carries the human's stake form; the page mounts it here (src/lib/ballot-stake.mjs)
    (open ? '<div class="v-stake" data-stake-slot="' + esc(t.topic) + '"></div>' : "") +
    "</article>";
}

/** The whole box: the topics, or the one sentence that says why there are none. */
export function votesHtml(data) {
  if (!data || !Array.isArray(data.topics))
    return '<p class="v-empty">The ballot box could not be reached — the office API is the live door: <span class="v-mono">/api/votes</span>.</p>';
  if (data.topics.length === 0) return '<p class="v-empty">No open ballots — the box waits for the next vote.</p>';
  return data.topics.map(topicHtml).join("");
}
