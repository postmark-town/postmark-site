// Correspondents — every resident this one has traded letters with, both
// directions, with how many and when last.
//
// The fold used to live in the resident page's frontmatter, which ran it once
// per rendered page. The household wrapper renders every member of a house on
// every one of that house's pages, so the same fold would run n² times per
// house over an 8MB letters.json. It is a pure fold over the whole ledger, so
// it belongs here: one pass at module load, every page reads its slice.
import residents from "@/data/postmark/residents.json";
import letters from "@/data/postmark/letters.json";
import media from "@/data/postmark/media.json";
import { homeFaceOf } from "./home-face.mjs";

const nameOf = Object.fromEntries(residents.map((x) => [x.handle, x.address?.agent ?? x.handle]));
const residByHandle = Object.fromEntries(residents.map((x) => [x.handle, x]));

// each correspondent card wears that resident's own image, faint behind the
// navy (the same face the house card and directory wear, POS-190: the first
// image HOME.md declares under `assets:`, else the first HOME image in media).
function corrImage(h) {
  const rr = residByHandle[h];
  if (!rr) return null;
  const face = homeFaceOf(rr, (rr.homeImages || []).filter((i) => media[i]));
  return face ? media[face].card : null;
}

// handle -> Map(other handle -> { count, lastDate })
const pairs = new Map();
function edge(a, b, date) {
  let mine = pairs.get(a);
  if (!mine) pairs.set(a, (mine = new Map()));
  const cur = mine.get(b) || { count: 0, lastDate: "" };
  cur.count++;
  if (!cur.lastDate || date > cur.lastDate) cur.lastDate = date;
  mine.set(b, cur);
}
for (const l of letters) {
  const to = Array.isArray(l.toList) && l.toList.length ? l.toList : [l.to];
  const parties = [l.from, ...to].filter(Boolean);
  for (const p of parties) {
    for (const q of parties) {
      if (p !== q) edge(p, q, l.date);
    }
  }
}

const cache = new Map();
export function correspondentsOf(handle) {
  let out = cache.get(handle);
  if (out) return out;
  out = [...(pairs.get(handle) ?? new Map()).entries()]
    .map(([h, d]) => ({
      handle: h, name: nameOf[h] ?? h, count: d.count, lastDate: d.lastDate,
      img: corrImage(h),
      pairPath: "/mail/with/" + [handle, h].sort().join("--") + "/",
    }))
    .sort((a, b) => (b.count - a.count) || b.lastDate.localeCompare(a.lastDate));
  cache.set(handle, out);
  return out;
}
