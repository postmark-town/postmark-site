// town-views.mjs — the Town page's pieces, and what each address on it opens
// (POS-273; the Town page, POS-278, 2026-09-27).
//
// Imported by the page's own script as well as by bulletin-board.mjs and the
// suite, so it imports nothing: the browser bundle carries only this file.

// ── THE BOARD HOLDS THE TOWN (POS-273, 2026-09-27; the Town page, POS-278) ──
//
// Keemin: "I want the civic quarter and the meeps to themselves be pins on the
// bulletin board … the clicks should show you that component integrated into
// the one cork board page." And, the same day, of the panel that first did it:
// "I'm also generally not a fan of the whole pop-up window. could we try
// containing everything in the town's page, and simply having the corkboard
// move to the left and get replaced by the page contents of whatever you
// clicked? with a clear 'back to board' arrow".
//
// So a piece's click slides the board off to the left and its content fills
// the page. A piece's `hash` is that view's address on /bulletin/, so a view
// can be linked and Back returns to the board; its `page` is where it lives on
// its own, and what the piece links to with JavaScript off. NO ELEMENT ON THE
// PAGE CARRIES ONE OF THESE HASHES AS ITS ID: a fragment that names an id is a
// fragment the browser scrolls to, and nothing on this page auto-scrolls.
//
// In Keemin's order, which is also the phone's order down the board.
export const BOARD_PIECES = Object.freeze([
  { key: "calendar", hash: "calendar", page: "/calendar/", label: "the calendar" },
  { key: "daily", hash: "daily", page: "/daily/", label: "Ferry's Daily" },
  { key: "notices", hash: "notices", page: null, label: "the notices" },
  { key: "meeps", hash: "meeps", page: "/meeps/", label: "the meeps" },
  { key: "quarter", hash: "quarter", page: "/town/", label: "the civic quarter" },
]);

/**
 * The pieces whose view is another page, framed, and loaded only on open
 * (Wright's page-weight budget on POS-273: the board must not carry the
 * quarter's or the meeps' markup). The Daily is the office's own html; the
 * quarter and the meeps are their own pages at `?embed`, framed whole, so
 * their switches run as they do at home and there is one source of each
 * (Wright's ruling on POS-273). The page is the same static file either way,
 * so a visit without ?embed is untouched: `dress` means the board, from
 * outside, puts one class on the framed page and the CSS that class wears
 * (the site chrome off); the Daily has no chrome to take off. Both pages
 * carry a canonical link to their bare URL, which is what ?embed resolves to.
 * `deep` is the prefix by which a hash on /bulletin/ reaches INTO the framed
 * page: /bulletin/#quarter-quests opens the quarter on the Quest Guild. The
 * prefix keeps the quarter's own ids (quests, marketplace, board) apart from
 * this page's addresses, where two of them are notice slugs.
 */
export const FRAMED = Object.freeze({
  daily: { src: "/daily/ferrys-daily.html", deep: null, dress: false },
  meeps: { src: "/meeps/?embed", deep: "meeps-", dress: true },
  quarter: { src: "/town/?embed", deep: "quarter-", dress: true },
});

/**
 * Every address the board itself answers on /bulletin/: `board` (the fold
 * years' anchor, which now opens the board and scrolls nowhere), each piece's
 * view, and one deep address per framed room (`ids` per piece: the lane
 * anchors, the meep keys). A notice slug that equals any of these would open
 * the wrong thing, so the suite holds the town's slugs against this list.
 */
export function boardIds(inner = {}) {
  const out = ["board", NOSCRIPT_NOTICES];
  for (const p of BOARD_PIECES) {
    out.push(p.hash);
    const deep = FRAMED[p.key]?.deep;
    if (deep) for (const id of inner[p.key] ?? []) out.push(`${deep}${id}`);
  }
  return out;
}

/**
 * The id of the notices' list that stands in the page's <noscript>: without
 * JavaScript the notices piece links to it. It never exists in a scripted
 * page, and the address opens the notices there too.
 */
export const NOSCRIPT_NOTICES = "the-notices";

/**
 * The address a history entry's `from` stands for, in the form the page's
 * "back" controls compare it in. A move records the hash it left (`here()`),
 * and a control asks "is that where I lead?" (`backTo("notices")`); two
 * spellings name the same place, so each folds to the one the controls use:
 * "board" is the board ("", no hash), and NOSCRIPT_NOTICES, the address the
 * no-script link and the posting pages' back link arrive on, is the notices.
 * Without the second, a reader who arrived on #the-notices, opened a notice
 * and closed it was pushed a new entry rather than sent back. Anything else
 * (a piece's hash, a deep address, a notice slug, "") is returned as it came.
 * @param {string} from  the `from` a pushState entry recorded, without its "#"
 */
export function backAddress(from) {
  if (from === "board") return "";
  if (from === NOSCRIPT_NOTICES) return BOARD_PIECES.find((p) => p.key === "notices").hash;
  return from;
}

/**
 * What an address on /bulletin/ opens: `{ view, inner, note }`. `view` is a
 * piece's key, or null for the board; `inner` is the fragment to reach inside
 * a framed view; `note` is the notice to pop up over the notices' sub-board.
 * An address the board does not know opens the board: an old link lands on
 * the town, never on a blank page. The page's script and the suite both read
 * this one function, so the two cannot disagree on what a link opens.
 * @param {string} hash       location.hash, with or without its "#"
 * @param {Iterable<string>} slugs  every notice slug the page can open
 */
export function viewOf(hash, slugs = []) {
  let id = String(hash ?? "").replace(/^#/, "");
  try { id = decodeURIComponent(id); } catch {}
  const board = { view: null, inner: null, note: null };
  if (!id || id === "board") return board;
  if (id === NOSCRIPT_NOTICES) return { ...board, view: "notices" };
  const piece = BOARD_PIECES.find((p) => p.hash === id);
  if (piece) return { ...board, view: piece.key };
  for (const [key, f] of Object.entries(FRAMED)) {
    if (f.deep && id.startsWith(f.deep) && id.length > f.deep.length) {
      return { ...board, view: key, inner: id.slice(f.deep.length) };
    }
  }
  if (new Set(slugs).has(id)) return { ...board, view: "notices", note: id };
  return board;
}
