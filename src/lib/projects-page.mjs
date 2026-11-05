// projects-page.mjs — what /projects/ prints for each project, from
// projects.json (the Site Lift, POS-256). Pure: the page hands in its resolvers,
// so `node --test` can put a fixture through the same fold the page uses.
//
// A hand is printed only through the town's own record (Wright's ruling on
// POS-256, 2026-09-26): one resident by name, several by their household, and
// anything else counted and never named. The fold reads only resident handles,
// so a git author's name or email has no way onto the page.

import { houseHref } from "./houses.mjs";

// hand.residents → { label, href }, or null (counted, not named)
export function handLabel(handles, { residents, houseOf, nameplate, displayName }) {
  if (!handles?.length) return null;
  if (handles.length === 1) return { label: displayName(handles[0], residents), href: `/residents/${handles[0]}/` };
  const houses = new Set(handles.map((h) => houseOf(h)));
  const house = houses.size === 1 ? [...houses][0] : null;
  const plate = house ? nameplate(house) : "";
  if (!plate) return null;
  return { label: plate, href: houseHref(house) };
}

// "Made in town" on the front page (POS-855): the town's most recently active
// projects, newest first, up to `limit`, from the same projects.json and through
// the same fold /projects/ prints (projectCards), so a git author's name or
// email has no more way onto the front door than onto that page.
//
// A project with no dated work is not "recently active" and is left out, and so
// is one with no name or no https link (a card that opens nothing). Data that is
// missing or not the shape the reader writes gives [], and the page then draws
// no section at all. Each card is plain text, no nested links, because the whole
// card is one link to the project. Its "what" is shortened (trimWhat) and each
// maker is named once.
export const MADE_IN_TOWN_LIMIT = 4;
export const MADE_IN_TOWN_WHAT_MAX = 160;

// A sentence ends at ".", "!" or "?" (and any closing quote or bracket) that is
// followed by an uppercase letter or the end of the text, so "e.g. the" does not
// end one; a short list of abbreviations ("Dr. Smith") is passed over too.
const ABBREVIATION = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|vs|e\.g|i\.e)$/i;
function firstSentence(text) {
  const stop = /[.!?]["')\]”’]*(?=\s+[A-Z]|\s*$)/g;
  let m;
  while ((m = stop.exec(text))) {
    if (text[m.index] === "." && ABBREVIATION.test(text.slice(0, m.index))) continue;
    return text.slice(0, m.index + m[0].length);
  }
  return text;
}

// Never leave an unmatched "(" or an odd number of '"' on a card: cut back to
// just before the last unmatched "(" (or the last '"' when they are odd), until
// both balance.
function closeOff(s) {
  for (;;) {
    const open = [];
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === "(") open.push(i);
      else if (s[i] === ")") open.pop();
    }
    if (open.length) { s = s.slice(0, open[open.length - 1]); continue; }
    if ((s.match(/"/g) ?? []).length % 2) { s = s.slice(0, s.lastIndexOf('"')); continue; }
    return s;
  }
}

// The card's "what" line: the project's first sentence, and when that is still
// longer than `max`, cut at a word boundary with an ellipsis; a cut never leaves
// a bracket or quote open (nothing left to show gives null). /projects/ keeps
// the whole text; only the front door shortens it.
export function trimWhat(what, max = MADE_IN_TOWN_WHAT_MAX) {
  const text = typeof what === "string" ? what.replace(/\s+/g, " ").trim() : "";
  if (!text) return null;
  let s = firstSentence(text);
  let ellipsis = false;
  if (s.length > max) {
    const cut = s.slice(0, max - 1);
    const at = cut.lastIndexOf(" ");
    s = at > 0 ? cut.slice(0, at) : cut;
    ellipsis = true;
  }
  if (s.length < text.length) {
    const closed = closeOff(s);
    if (closed.length < s.length) { s = closed; ellipsis = true; }
  }
  if (!ellipsis) return s;
  s = s.replace(/[\s,;:\-—–]+$/, "");
  return s ? `${s}…` : null;
}

export function madeInTown(data, resolvers, limit = MADE_IN_TOWN_LIMIT) {
  const list = Array.isArray(data?.projects) ? data.projects : [];
  const active = list
    .filter((p) => p && typeof p.name === "string" && p.name
      && typeof p.href === "string" && /^https?:\/\//.test(p.href)
      && Number.isFinite(Date.parse(p.latest?.date)))
    .sort((a, b) => Date.parse(b.latest.date) - Date.parse(a.latest.date) || a.name.localeCompare(b.name))
    .slice(0, limit);
  return projectCards({ projects: active }, resolvers).map((c) => ({
    name: c.name,
    what: trimWhat(c.what),
    href: c.href,
    date: c.latest.date,
    // each maker once: two accounts of one resident, or two hands of one house,
    // print one name (done here, not in projectCards, so /projects/ is unchanged)
    makers: [...new Set(c.named.map((h) => h.label))],
  }));
}

// "What <name> has made" on a resident's page (POS-855): the town projects where
// this resident is a named hand, newest first, up to `limit`, from the same
// projects.json /projects/ prints.
//
// The rule is /projects/'s (Wright's POS-256 ruling), and it is the same code:
// a hand counts for a resident only when handLabel (above, with the resolvers
// the page passes /projects/) would NAME it, and their handle is in its
// `residents`, compared exactly. So a lone resident, or several residents of one
// household that has a nameplate, are named; a hand across two houses, or whose
// house cannot be resolved, is counted on /projects/ and never named, and it is
// not listed here either. A hand the record ties to no resident (a git-only hand:
// an author name, an email, an empty `residents`) never matches anyone, and the
// name and email are never read. A handle is one account: an account of the same
// household is a different handle and has its own page and its own list.
//
// Returns { projects: [{ name, href, date }], total }: `total` counts every match,
// so the page can say there are more than it lists. A project with no name, no
// https link (nothing to open) or no dated work (nothing to sort or show) is not
// counted. Data that is missing or not the shape the reader writes gives
// { projects: [], total: 0 }, and the page then prints nothing at all.
export const RESIDENT_PROJECTS_LIMIT = 5;

export function projectsByResident(data, handle, resolvers, limit = RESIDENT_PROJECTS_LIMIT) {
  const none = { projects: [], total: 0 };
  if (typeof handle !== "string" || !handle) return none;
  const list = Array.isArray(data?.projects) ? data.projects : [];
  const mine = list
    .filter((p) => p && typeof p.name === "string" && p.name
      && typeof p.href === "string" && /^https?:\/\//.test(p.href)
      && Number.isFinite(Date.parse(p.latest?.date))
      && Array.isArray(p.hands)
      && p.hands.some((h) => Array.isArray(h?.residents) && h.residents.includes(handle)
        && handLabel(h.residents, resolvers) !== null))
    .sort((a, b) => Date.parse(b.latest.date) - Date.parse(a.latest.date) || a.name.localeCompare(b.name));
  return {
    projects: mine.slice(0, Math.max(0, limit)).map((p) => ({ name: p.name, href: p.href, date: p.latest.date })),
    total: mine.length,
  };
}

export function projectCards(data, resolvers) {
  return (data?.projects ?? []).map((p) => {
    const named = [];
    let unnamed = p.unnamed_hands ?? 0;
    for (const hand of p.hands ?? []) {
      const w = handLabel(hand.residents, resolvers);
      if (w) named.push({ ...w, commits: hand.commits });
      else unnamed += 1;
    }
    return {
      dir: p.dir,
      name: p.name,
      seeded_by: p.seeded_by,
      what: p.what,
      href: p.href,
      latest: p.latest ? { date: p.latest.date, subject: p.latest.subject } : null,
      named,
      unnamed,
      latestBy: p.latest ? handLabel(p.latest.residents, resolvers) : null,
    };
  });
}
