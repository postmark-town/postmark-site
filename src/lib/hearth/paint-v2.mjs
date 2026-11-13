// paint-v2.mjs — the live half of the Hearth's v2 slots (POS-1024, POS-1028): the residents' windows, and the four parts read from the office's
// public Hearth bundle (ties, stamps that went, the town feed, a resident's day).
//
// THE RULE FOR A PART WHOSE DATA HAS NOT COME: it draws nothing. Each v2 slot ships hidden (HearthSlot.astro) and is shown only once its
// answer is here. A bundle that did not answer (the office's read is not shipped, or it failed) leaves the slot hidden, so a design that places
// a v2 slot today breaks nothing and shows nothing. A part that answered with no rows is an honest none, and says so.
//
// TEXT ONLY, as paint.mjs: every string the town or a resident wrote goes in through textContent; the only markup is elements made here.

import { tiesOf, wentOf, feedOf, feedShown, dayOf } from "./bundle.mjs";
import { whenOf } from "../household-dashboard/fold.mjs";

const PANES = "https://panes.postmark.town";
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const nameOf = (faces, h) => faces?.[h]?.name ?? h;
const who = (ctx, h) => {
  const a = el("a", "hx-who", nameOf(ctx.faces, h));
  a.href = ctx.residentHref ? ctx.residentHref(h) : `/residents/${encodeURIComponent(h)}/`;
  if (ctx.faces?.[h]?.accent) a.style.setProperty("--hd-c", ctx.faces[h].accent);
  return a;
};
const other = (h) => { const a = el("a", null, h); a.href = `/residents/${encodeURIComponent(h)}/`; return a; };
const slotOf = (root, name) => root.querySelector(`[data-hearth-slot="${name}"]`);
const show = (box, on) => { if (box) box.hidden = !on; };

/** The residents' windows: each hung pane, sandboxed on its own origin exactly as on the resident's page. `hung` is readHungWindows's answer. */
export function paintWindows(root, hung, ctx) {
  const box = slotOf(root, "windows");
  if (!box) return;
  if (hung == null) { show(box, false); return; }          // the panes origin did not answer (or has not yet): nothing is drawn
  const list = box.querySelector("[data-hx-windows]");
  if (!list) return;
  const have = new Set([...list.querySelectorAll("[data-hx-pane-of]")].map((f) => f.getAttribute("data-hx-pane-of")));
  // already drawn: a repaint never reloads a pane (only when there are panes: an empty list must still be told "none", review of #420's paint test)
  if (hung.length && have.size === hung.length && hung.every((h) => have.has(h))) { show(box, true); return; }
  list.textContent = "";
  if (!hung.length) list.appendChild(el("p", "hd-empty", "No resident of this house has hung a window yet."));
  for (const h of hung) {
    const fig = el("figure", "hx-window");
    fig.setAttribute("data-hx-pane-of", h);
    // A RESIDENT'S WINDOW, NOT THE HEARTH'S SCRIPT: a window is hung through the office without review, so it keeps the window's own rules (its
    // own origin, sandbox="allow-scripts"), as on every page that shows one. The Hearth's own scripted part is the other thing (script.mjs).
    const frame = el("iframe", "hx-window-frame");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("data-win-frame", "");
    frame.title = `${nameOf(ctx.faces, h)}'s window`;
    frame.src = `${PANES}/~${encodeURIComponent(h)}/`;
    fig.appendChild(frame);
    const cap = el("figcaption", "hx-window-cap");
    cap.setAttribute("data-hearth-part", "caption");
    cap.appendChild(who(ctx, h));
    cap.appendChild(document.createTextNode("'s window · "));
    const full = el("a", null, "open full screen");
    full.href = `${PANES}/~${encodeURIComponent(h)}/`;
    full.target = "_blank";
    full.rel = "noopener";
    cap.appendChild(full);
    fig.appendChild(cap);
    list.appendChild(fig);
  }
  show(box, true);
}

/** The ties: who the residents write, letters each way, and the newest line each way when the office carries it. */
export function paintTies(root, bundle, ctx) {
  const box = slotOf(root, "ties");
  if (!box) return;
  const t = tiesOf(bundle, ctx.handles);
  if (!t) { show(box, false); return; }
  const ul = box.querySelector("[data-hx-ties]");
  if (!ul) return;
  ul.textContent = "";
  if (!t.rows.length) ul.appendChild(el("li", "hd-empty", "No letters have crossed between these residents and others yet."));
  for (const r of t.rows) {
    const li = el("li", "hx-tie");
    li.appendChild(who(ctx, r.handle));
    li.appendChild(document.createTextNode(" and "));
    li.appendChild(other(r.with));
    li.appendChild(el("span", "hx-with", ` · ${r.out} out, ${r.in} back` + (r.stamps ? ` · ✦${r.stamps} between` : "") + (r.latest ? ` · ${whenOf(r.latest, ctx.now)}` : "")));
    if (r.milestones.length) li.appendChild(el("span", "hx-milestones", " · " + r.milestones.join(", ")));
    for (const [q, dir] of [[r.quoteOut, "out"], [r.quoteIn, "in"]]) {
      if (!q) continue;
      const bq = el("q", "hx-quote is-" + dir, q);
      li.appendChild(bq);
    }
    ul.appendChild(li);
  }
  show(box, true);
}

/** Where the stamps went: one group per kind, its total, and its newest rows. */
export function paintWent(root, bundle, ctx) {
  const box = slotOf(root, "stamps-went");
  if (!box) return;
  const w = wentOf(bundle, ctx.handles);
  if (!w) { show(box, false); return; }
  const list = box.querySelector("[data-hx-went]");
  if (!list) return;
  list.textContent = "";
  if (!w.groups.length) list.appendChild(el("p", "hd-empty", "No stamps have gone out from this house yet."));
  for (const g of w.groups) {
    const sec = el("div", "hx-went-group is-" + g.kind);
    const head = el("p", "hx-went-head");
    head.appendChild(el("span", "hx-went-words", g.words));
    head.appendChild(el("span", "hx-went-n", ` ✦${g.total}`));
    sec.appendChild(head);
    const ul = el("ul", "hx-list");
    for (const r of g.rows) {
      const li = el("li");
      if (r.handle) { li.appendChild(who(ctx, r.handle)); li.appendChild(document.createTextNode(" ")); }
      li.appendChild(el("span", "hx-went-amt", `✦${r.stamps}`));
      if (r.title) {
        li.appendChild(document.createTextNode(" · "));
        if (r.href) { const a = el("a", null, r.title); a.href = r.href; li.appendChild(a); } else li.appendChild(el("span", null, r.title));
      }
      if (r.at) li.appendChild(el("span", "hx-when", " · " + whenOf(r.at, ctx.now)));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
    list.appendChild(sec);
  }
  show(box, true);
}

/** The town as one feed, with the sort the reader picks (the switcher is drawn here, so its keys are the bundle's own). */
export function paintTown(root, bundle, ctx) {
  const box = slotOf(root, "town");
  if (!box) return;
  const f = feedOf(bundle);
  if (!f) { show(box, false); return; }
  const ul = box.querySelector("[data-hx-feed]");
  const bar = box.querySelector("[data-hx-feed-sorts]");
  if (!ul || !bar) return;
  const sort = f.sorts.includes(ctx.feedSort) ? ctx.feedSort : "newest";
  bar.textContent = "";
  for (const s of f.sorts) {
    const b = el("button", "hd-chip" + (s === sort ? " is-on" : ""), s === "newest" ? "newest" : s === "backed" ? "most backed" : "nearest");
    b.type = "button";
    b.setAttribute("data-hx-feed-sort", s);
    b.setAttribute("aria-pressed", String(s === sort));
    bar.appendChild(b);
  }
  const rows = feedShown(f.rows, sort);   // the whole feed sorted the reader's way, then cut (bundle.mjs)
  ul.textContent = "";
  if (!rows.length) ul.appendChild(el("li", "hd-empty", "Nothing new around town."));
  for (const r of rows) {
    const li = el("li", "hx-feed-row is-" + r.kind.replace(/[^a-z-]/g, ""));
    li.appendChild(el("span", "hx-kind", r.kind));
    if (r.href) { const a = el("a", null, r.title); a.href = r.href; li.appendChild(a); } else li.appendChild(el("span", null, r.title));
    const meta = [r.by && "by " + r.by, r.backed ? `✦${r.backed} behind it` : null, r.at ? whenOf(r.at, ctx.now) : null].filter(Boolean).join(" · ");
    if (meta) li.appendChild(el("span", "hx-when", " · " + meta));
    ul.appendChild(li);
  }
  show(box, true);
}

/** Each resident's day, in the office's own sentences. */
export function paintDay(root, bundle, ctx) {
  const box = slotOf(root, "day");
  if (!box) return;
  const d = dayOf(bundle, ctx.handles);
  if (!d) { show(box, false); return; }
  const ul = box.querySelector("[data-hx-day]");
  if (!ul) return;
  ul.textContent = "";
  for (const r of d.rows) {
    const li = el("li", "hx-day-row");
    li.appendChild(who(ctx, r.handle));
    li.appendChild(document.createTextNode(": "));
    li.appendChild(el("span", "hx-day-words", r.lines.length ? r.lines.join(" · ") : r.answered ? "a quiet day." : "not read."));
    ul.appendChild(li);
  }
  show(box, true);
}

/** Every v2 part, in one call. */
export function paintV2(root, { bundle = null, hung = null } = {}, ctx) {
  paintWindows(root, hung, ctx);
  paintTies(root, bundle, ctx);
  paintWent(root, bundle, ctx);
  paintTown(root, bundle, ctx);
  paintDay(root, bundle, ctx);
}
