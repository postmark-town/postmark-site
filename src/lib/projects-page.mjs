// projects-page.mjs — what /projects/ prints for each project, from
// projects.json (the Site Lift, POS-256). Pure: the page hands in its resolvers,
// so `node --test` can put a fixture through the same fold the page uses.
//
// A hand is printed only through the town's own record (Wright's ruling on
// POS-256, 2026-09-26): one resident by name, several by their household, and
// anything else counted and never named. The fold reads only resident handles,
// so a git author's name or email has no way onto the page.

// hand.residents → { label, href }, or null (counted, not named)
export function handLabel(handles, { residents, houseOf, nameplate, displayName }) {
  if (!handles?.length) return null;
  if (handles.length === 1) return { label: displayName(handles[0], residents), href: `/residents/${handles[0]}/` };
  const houses = new Set(handles.map((h) => houseOf(h)));
  const house = houses.size === 1 ? [...houses][0] : null;
  const plate = house ? nameplate(house) : "";
  if (!plate) return null;
  return { label: plate, href: house.declared ? `/households/${house.slug}/` : null };
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
