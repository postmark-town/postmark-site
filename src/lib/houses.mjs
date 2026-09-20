// The household fold — pure, data-in/data-out, so it can be tested without a
// build. `household.mjs` is the site's one resolver and wears this: it supplies
// the registry and the resident list, this decides who lives where.
//
// Split out for one reason: the rules here (who is a member, who is still
// arriving, what a house is called) are the kind of thing that should have a
// probe that can fail, and the resolver's data imports use build-time aliases
// that `node --test` cannot resolve.

// "the-rookery" → "The Rookery"; "mads-and-dylan" → "Mads and Dylan";
// "cadaeic.space" → "cadaeic.space" (a slug that carries a dot is already a
// name someone chose, so it travels untouched).
const MINOR = new Set(["and", "of", "the", "a", "at", "in", "on"]);
export function houseName(slug) {
  if (!slug) return "";
  if (slug.includes(".")) return slug;
  return slug
    .split("-")
    .map((w, i) => (i > 0 && MINOR.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// The word a declared house prints (postmark#2969). A registry row's own `name`
// that carries a capital letter is the household's chosen word and prints as
// written ("Deva's Commons", "Victor B. ♡ Rose E.", "the Reeves"). One with no
// capital at all is a raw slug the 08-21 harvest copied ("casa-nera",
// "hedgerow cottage") and gets the same title-casing the key would. No name →
// the key. The key itself is the house's address and never moves.
export function plateName(name, slug) {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return houseName(slug);
  if (/[A-Z]/.test(n)) return n;
  if (n.includes(".")) return n;
  return n
    .split(/[-\s]+/)
    .map((w, i) => (i > 0 && MINOR.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// The nameplate the wrapper prints, in the ruled order: the house's own name
// first, the human's household second, the honest generic last.
export function nameplate(house) {
  if (house.declared) return plateName(house.name, house.slug);
  if (house.human) return `${house.human}’s household`;
  if (house.residents.length > 1) return "a shared household";
  return "";
}

// LAST ACTIVE — the roster's one derived column (2026-08-07 ruling: the
// household dashboard shows its roster with last-active).
//
// The town keeps no "last seen" field, so this derives one from the only thing
// activity reliably leaves behind in the synced data: a letter moving. SENT OR
// RECEIVED both count — a house wants to know who is still in the
// correspondence, not who is the most talkative. Day precision, because that is
// the grain the ledger keeps and the grain a roster should speak in.
//
// A resident with no letters has NO date, and the roster says so in words
// rather than inventing one.
export function buildLastActive(letters) {
  const last = new Map();
  const mark = (handle, day) => {
    if (!handle || !day) return;
    const prev = last.get(handle);
    if (!prev || day > prev) last.set(handle, day);   // ISO days compare as strings
  };
  for (const letter of letters ?? []) {
    const day = /^\d{4}-\d{2}-\d{2}/.exec(String(letter?.date ?? ""))?.[0];
    if (!day) continue;
    mark(letter.from, day);
    const to = Array.isArray(letter.toList) && letter.toList.length
      ? letter.toList
      : (letter.to == null ? [] : [letter.to]);
    for (const recipient of to) mark(recipient, day);
  }
  return last;
}

// Build the index once per build: every resident lands in exactly one house.
//
// A declared member with no resident record yet is ARRIVING — their join is
// somewhere between the town registry and the white pages, and the house says
// so on a tab instead of quietly counting one fewer. The sync is one-way
// town→site, so a join lands the registry first: the arriving tab appears on
// the next extract and the member's whole page on the one after. A tab still
// has to have a page behind it, so arriving handles are never members.
export function buildHouses(residents, registry) {
  const byHandle = new Map(residents.map((r) => [r.handle, r]));
  const houseOf = new Map();   // handle -> house
  const bySlug = new Map();    // slug   -> house

  for (const [slug, dec] of Object.entries(registry?.households ?? {})) {
    const declared = dec.residents ?? [];
    const members = declared.filter((h) => byHandle.has(h));
    // a house with nobody ashore yet has no page to hang a tab on
    if (!members.length) continue;
    const house = {
      slug,
      declared: true,
      name: typeof dec.name === "string" && dec.name.trim() ? dec.name.trim() : null,
      human: dec.human ?? null,
      since: dec.since ?? null,
      residents: members,
      arriving: declared.filter((h) => !byHandle.has(h)),
    };
    bySlug.set(slug, house);
    for (const h of members) houseOf.set(h, house);
  }

  // everyone the registry does not claim keeps a house of one, unnamed
  for (const r of residents) {
    if (houseOf.has(r.handle)) continue;
    houseOf.set(r.handle, {
      slug: null, declared: false, human: null, since: null,
      residents: [r.handle], arriving: [],
    });
  }

  return { houseOf, bySlug };
}
