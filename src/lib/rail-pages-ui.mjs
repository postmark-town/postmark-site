// rail-pages-ui.mjs — a main-rail seat's page list, opened and closed (CORE-164). The pages themselves are rail-pages.mjs's; the markup is
// PostmarkLayout.astro's (`.pm-rail-seat`: the seat's link, `[data-rail-more]`, `[data-rail-pages]`).
//
// WHAT SHOWS IT. Once this script runs it alone decides whether a list is shown, and the seat's button always says so (aria-expanded, and
// the seat's data-open, which the stylesheet reads). A list is shown while it is HELD, or while a real mouse POINTS at its seat:
//   held: the button (Enter or Space; it has no glyph and is out of sight until keyboard focus lands on it), a touch screen's first tap on
//         the seat's own link, or keyboard focus moving into the list holds it, and it stays held until the reader lets it go, however the
//         pointer moves. A reader who points at a seat, Tabs into its pages and moves the mouse away keeps the list
//         and their place in it.
//   pointing: a mouse on the seat or its list (the list hangs from the seat with no gap, so the pointer can travel into it). A finger is
//         never pointing (pointerType), so a tap's sticky hover holds nothing open on a phone. Leaving lets go of the pointing.
// A TAP ON THE SEAT (Darko, 2026-11-24 08:24 EST: "remove carets from rail, they look bad"; with no caret to tap, the seat's link is the
// phone's opener): a touch or pen press on the seat's link whose list isn't shown opens the list instead of following the link; a tap while
// it is shown goes to the seat, as a link does. A mouse click and the keyboard's Enter on the link always go to the seat.
// Without the script the stylesheet's own hover rule shows a list where the device can hover, and the seat is its plain link.
// WHAT CLOSES IT. The button while the list is shown; Escape anywhere in the seat (focus goes back to the button, and a mouse still on the
// seat doesn't show it again until it has left); focus leaving the seat (Tab past its last page, Shift-Tab before its link); a press
// anywhere outside it; and another seat's list being shown. One list is shown at a time; while keyboard focus is in a list, pointing at
// another seat leaves it where it is.
// WHERE IT SITS. Under its seat, moved sideways only as far as it takes to keep it inside the window's edges (8px), at every width.
//
// Pure DOM: it touches only the rail it is handed, and imports nothing.

export const EDGE = 8;

/** How far (px) to move a list sideways so [left, right] sits inside [EDGE, width - EDGE]; a list wider than that keeps its left edge. */
export function shiftFor(left, right, width, edge = EDGE) {
  if (right > width - edge) {
    const s = width - edge - right;
    return left + s < edge ? edge - left : s;
  }
  return left < edge ? edge - left : 0;
}

/** Bind every `[data-rail-seat]` in `nav`. Returns `{ open(seat), close(seat), seats }`. */
export function mountRailPages(nav, { doc = globalThis.document } = {}) {
  if (!nav || !doc) return { open() {}, close() {}, seats: [] };
  const seats = [...nav.querySelectorAll("[data-rail-seat]")];
  const parts = (seat) => ({ btn: seat.querySelector("[data-rail-more]"), list: seat.querySelector("[data-rail-pages]"), link: seat.querySelector("[data-rail-top]") });

  function place(seat) {
    const { list } = parts(seat);
    if (!list) return;
    list.style.setProperty("--pm-rail-shift", "0px");
    const r = list.getBoundingClientRect();
    if (!r.width) return;                                   // not shown: nothing to place
    const width = doc.documentElement.clientWidth || r.right;
    list.style.setProperty("--pm-rail-shift", `${shiftFor(r.left, r.right, width)}px`);
  }
  // the one place a list's shown state is written: data-open for the stylesheet, aria-expanded for the reader, both from held/pointing
  function sync(seat) {
    const { btn } = parts(seat);
    const shown = "held" in seat.dataset || ("pointing" in seat.dataset && !("shut" in seat.dataset));
    const was = "open" in seat.dataset;
    if (shown) seat.dataset.open = ""; else delete seat.dataset.open;
    btn?.setAttribute("aria-expanded", String(shown));
    if (shown && !was) place(seat);
  }
  const focusIn = (seat) => !!parts(seat).list?.contains(doc.activeElement);
  function close(seat, { focusButton = false } = {}) {
    delete seat.dataset.held;
    if ("pointing" in seat.dataset) seat.dataset.shut = "";  // a mouse still on the seat doesn't show it again until it has left
    sync(seat);
    if (focusButton) parts(seat).btn?.focus();
  }
  function release(seat) { delete seat.dataset.held; delete seat.dataset.pointing; sync(seat); }  // another seat's list is shown
  function open(seat) {
    for (const s of seats) if (s !== seat) release(s);
    seat.dataset.held = "";
    delete seat.dataset.shut;
    sync(seat);
  }

  for (const seat of seats) {
    const { btn, list, link } = parts(seat);
    if (!btn) continue;
    btn.hidden = false;
    btn.addEventListener("click", () => ("open" in seat.dataset ? close(seat) : open(seat)));
    // a touch screen's first tap on the seat opens its list; the next tap (the list shown) follows the link
    let touched = false;
    link?.addEventListener("pointerdown", (e) => { touched = e.pointerType === "touch" || e.pointerType === "pen"; });
    link?.addEventListener("click", (e) => {
      const tap = touched;
      touched = false;
      if (!tap || "open" in seat.dataset) return;
      e.preventDefault();
      open(seat);
    });
    seat.addEventListener("keydown", (e) => { if (e.key === "Escape") close(seat, { focusButton: true }); });
    seat.addEventListener("focusin", (e) => { if (list?.contains(e.target) && !("held" in seat.dataset)) open(seat); });
    seat.addEventListener("focusout", (e) => { if (!seat.contains(e.relatedTarget)) { delete seat.dataset.held; sync(seat); } });
    seat.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      if (seats.some((s) => s !== seat && focusIn(s))) return;  // keyboard focus is using another seat's list: that one stays
      for (const s of seats) if (s !== seat) release(s);
      seat.dataset.pointing = "";
      sync(seat);
    });
    seat.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      delete seat.dataset.pointing;
      delete seat.dataset.shut;
      sync(seat);
    });
  }
  doc.addEventListener("pointerdown", (e) => {
    for (const s of seats) if ("held" in s.dataset && !s.contains(e.target)) { delete s.dataset.held; sync(s); }
  });
  nav.dataset.railJs = "";                                   // the stylesheet's own hover rule stands down: the script shows the lists
  return { open, close, seats };
}
