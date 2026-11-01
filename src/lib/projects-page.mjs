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
// card is one link to the project.
export const MADE_IN_TOWN_LIMIT = 4;

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
    what: c.what || null,
    href: c.href,
    date: c.latest.date,
    makers: c.named.map((h) => h.label),
  }));
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
