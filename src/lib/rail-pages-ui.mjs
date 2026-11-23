// rail-pages-ui.mjs — a main-rail seat's page list, opened and closed (CORE-164). The pages themselves are rail-pages.mjs's; the markup is
// PostmarkLayout.astro's (`.pm-rail-seat`: the seat's link, `[data-rail-more]`, `[data-rail-pages]`).
//
// HOW IT OPENS. Pointing at a seat shows its list: that is the stylesheet's (`:hover`, where the device reports it can hover, or once this
// script has seen a real mouse move over the rail), so it needs no script on a desktop and closes the moment the pointer leaves the seat and its list (the list hangs from the seat with no gap between them, so the
// pointer can travel into it). For a keyboard and a touch screen there is the seat's small button: Enter, Space or a tap opens the list
// and says so (aria-expanded), and it stays open while the reader is using it.
// HOW IT CLOSES. The button again; Escape anywhere in the seat (focus goes back to the button, and a list shown by pointing stays shut
// until the pointer leaves); focus leaving the seat (Tab past its last page, Shift-Tab before its link); a press anywhere outside it; and
// opening another seat's list. One list is open at a time.
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
  const parts = (seat) => ({ btn: seat.querySelector("[data-rail-more]"), list: seat.querySelector("[data-rail-pages]") });

  function place(seat) {
    const { list } = parts(seat);
    if (!list) return;
    list.style.setProperty("--pm-rail-shift", "0px");
    const r = list.getBoundingClientRect();
    if (!r.width) return;                                   // not shown: nothing to place
    const width = doc.documentElement.clientWidth || r.right;
    list.style.setProperty("--pm-rail-shift", `${shiftFor(r.left, r.right, width)}px`);
  }
  function close(seat, { focusButton = false } = {}) {
    const { btn } = parts(seat);
    delete seat.dataset.open;
    btn?.setAttribute("aria-expanded", "false");
    if (focusButton) btn?.focus();
  }
  function open(seat) {
    for (const s of seats) if (s !== seat && "open" in s.dataset) close(s);
    const { btn } = parts(seat);
    seat.dataset.open = "";
    btn?.setAttribute("aria-expanded", "true");
    place(seat);
  }

  for (const seat of seats) {
    const { btn } = parts(seat);
    if (!btn) continue;
    btn.hidden = false;
    btn.addEventListener("click", () => ("open" in seat.dataset ? close(seat) : open(seat)));
    seat.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      seat.dataset.shut = "";                               // a list shown by pointing stays shut until the pointer leaves
      close(seat, { focusButton: true });
    });
    seat.addEventListener("focusout", (e) => { if (!seat.contains(e.relatedTarget)) close(seat); });
    seat.addEventListener("mouseenter", () => place(seat));
    seat.addEventListener("mouseleave", () => { delete seat.dataset.shut; });
  }
  doc.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") delete nav.dataset.mouse;  // a touch's sticky hover must not hold a list open
    for (const s of seats) if ("open" in s.dataset && !s.contains(e.target)) close(s);
  });
  // POINTING SHOWS THE LIST where the device reports hover (the stylesheet's media query), and also wherever a real mouse is seen moving
  // over the rail: a device whose media report says otherwise (a headless browser, a touch laptop with a mouse) is still pointed at
  nav.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") nav.dataset.mouse = ""; });
  return { open, close, seats };
}
