// mail-letter.mjs — one letter, as the paper it is, as an HTML string (POS-274).
//
// A pair page and a thread page render their newest letters; the older ones
// arrive as parts, either a static page or a JSON chunk the "older letters"
// button fetches. All three are this one function, so a letter read in any of
// them is the same markup. Because the chunks are inserted as HTML, the pages
// style these classes with :global.
import { md, fmtDate, townFile, threadTitle } from "./pm.mjs";
import { lettersByPair, letterParts, pairThreadMarks } from "./mail.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A handle links only where `hrefOf` names a page (resident-link.mjs): through
// a rename to the page the resident has now, and as plain text where no page
// stands (POS-530). Without `hrefOf` nothing is linked, never a guessed href.
const resident = (h, hrefOf) => {
  const href = hrefOf?.(h);
  return href ? `<a href="${esc(href)}">${esc(h)}</a>` : esc(h);
};

// `thread` (a pair page's marks: { tkey, hue, divider }) adds the thread's
// colour, its name above the letterhead and the rule where the thread changes;
// `delivered` is the ledger's delivery date, worn as "✓ delivered"; `hrefOf`
// is the build's resident links (resident-pages.mjs § residentHref).
export function letterHtml(l, { media = {}, thread = null, delivered = null, hrefOf = null } = {}) {
  const tos = (l.toList && l.toList.length ? l.toList : [l.to]).filter(Boolean);
  const shown = (l.attachments ?? []).filter((at) => media[at]);
  const hue = thread ? ` style="--h:${thread.hue}"` : "";
  const repoDir = (l.path || "").split("/").slice(0, -1).join("/");
  return [
    thread?.divider ? `<div class="fr-newthread"${hue} aria-hidden="true">— ${thread.divider} —</div>` : "",
    `<article class="pm-letter pm-paper${thread ? " fr-letter" : ""}" id="${esc(l.id)}"${hue}${thread ? ` data-tkey="${esc(thread.tkey)}"` : ""}>`,
    thread ? `<div class="fr-threadline">${esc(threadTitle(thread.tkey))}</div>` : "",
    `<div class="pm-letterhead"><span class="route">${resident(l.from, hrefOf)} → ${tos.map((h) => resident(h, hrefOf)).join(", ")}</span>`,
    `<span class="when">${esc(fmtDate(l.date))}`,
    delivered ? `<span class="fr-sailed" title="carried by the ferry, sealed in the town ledger">✓ delivered ${esc(fmtDate(delivered))}</span>` : "",
    `</span></div>`,
    `<div class="pm-letterbody">${md(l.body, { repoDir, media })}</div>`,
    shown.length
      ? `<div class="pm-attachments">${shown.map((at) =>
          `<a class="pm-frame" href="${esc(media[at].full)}" target="_blank" rel="noopener"><img src="${esc(media[at].card)}" alt="attachment: ${esc(at.split("/").pop())}" loading="lazy" /></a>`).join("")}</div>`
      : "",
    `<div class="pm-letterfoot"><span>${esc(l.id)}</span>${l.path ? `<a href="${esc(townFile(l.path))}">the file, in the record →</a>` : ""}</div>`,
    `</article>`,
  ].join("");
}

// ── the two kinds of page, folded once for the page, its parts and its chunks ──

// every correspondence: "a--b" -> { a, b, pairLetters (oldest first),
// threadOrder, markOf, hueOf, tkeyOf, parts }. The thread of a letter is threads.json's root, never
// the letter's own `thread:` field, which may point mid-chain.
export function pairViews(letters, threads, ledger = null) {
  const rootOf = new Map();
  for (const t of threads ?? []) for (const id of t.letterIds) rootOf.set(id, t.key);
  const tkeyOf = (l) => rootOf.get(l.id) ?? l.thread ?? l.id;
  const views = new Map();
  for (const [key, pairLetters] of lettersByPair(letters, ledger)) {
    const [a, b] = key.split("--");
    const { order, marks, hueOf } = pairThreadMarks(pairLetters, tkeyOf);
    const markOf = new Map(pairLetters.map((l, i) => [l.id, marks[i]]));
    views.set(key, { key, a, b, pairLetters, threadOrder: order, markOf, hueOf, tkeyOf, parts: letterParts(pairLetters) });
  }
  return views;
}

// every conversation: { thread, members (oldest first), parts }
export function threadViews(threads, letters) {
  const byId = new Map((letters ?? []).map((l) => [l.id, l]));
  return (threads ?? []).map((thread) => {
    const members = thread.letterIds.map((id) => byId.get(id)).filter(Boolean);
    return { thread, members, parts: letterParts(members) };
  });
}

// the delivery date of every delivered letter, from the ledger
export function deliveredOnOf(ledger) {
  return new Map((ledger ?? []).filter((e) => e.kind === "delivery").map((e) => [e.id, e.date]));
}

export function pairLettersHtml(view, ls, { media, deliveredOn, hrefOf = null }) {
  return ls.map((l) => letterHtml(l, { media, thread: view.markOf.get(l.id), delivered: deliveredOn.get(l.id), hrefOf })).join("");
}

export function threadLettersHtml(ls, { media, hrefOf = null }) {
  return ls.map((l) => letterHtml(l, { media, hrefOf })).join("");
}
