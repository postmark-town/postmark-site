// paint.mjs — the live half of the Hearth slots the dashboard does not draw (POS-959).
//
// The dashboard's paintHouse (household-dashboard/paint.mjs) draws the feed, Needs you, the
// numbers, the cards' live rows, the clocks and what is coming up, and the stage hands it the
// same root and the same context, so those slots are the dashboard's own parts under the
// dashboard's own gates. THIS file draws the rest: posts, marks, private mail, around town, the
// residents map, the stamps chart and the countdown's ticking.
//
// TEXT ONLY. Every string a resident or the town wrote goes in through textContent; the only
// markup built here is elements this file creates. A read that did not answer is said on the
// page ("could not be read"), never drawn as an empty list or a zero. And a read that is only still coming (POS-984: the stage
// paints as each resident's reads arrive, `ctx.reading`) has not answered yet: the part keeps its "reading…" placeholder until
// that read has answered or failed, and says "could not be read" only for the second.

import { marksOf, mailOf, postsOf, townEventsOf, placesOf, chartOf, countdownOf, leftWords } from "./fold.mjs";
import { feedOf, whenOf, dayWordOf, NOT_READING } from "../household-dashboard/fold.mjs";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const clip = (s, max) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const nameOf = (faces, h) => faces[h]?.name ?? h;

function resident(faces, handle, seatHref) {
  const a = el("a", "hx-who", nameOf(faces, handle));
  a.href = seatHref(handle);
  if (faces[handle]?.accent) a.style.setProperty("--hd-c", faces[handle].accent);
  return a;
}

/** One list slot: its `<ul>`, emptied, with a line for "could not read" or "nothing". */
function listOf(root, sel) {
  const ul = root.querySelector(sel);
  if (ul) ul.textContent = "";
  return ul;
}
const said = (ul, text) => ul.appendChild(el("li", "hd-empty", text));

export function paintPosts(root, extras, ctx) {
  if (!extras) return;                     // the town's posts have not answered yet: the slot keeps "reading the town’s posts…"
  const ul = listOf(root, "[data-hx-posts]");
  if (!ul) return;
  const note = root.querySelector("[data-hx-posts-note]");
  const p = postsOf(extras?.posts, ctx.handles, ctx.slug);
  if (note) { note.hidden = true; note.textContent = ""; }
  if (!p) { said(ul, "The town’s posts could not be read just now."); return; }
  if (!p.rows.length) said(ul, p.partial.length ? "None of this house’s posts are on the newest pages read." : "This house has no ideas or bugs posted.");
  for (const r of p.rows) {
    const li = el("li", "hx-post is-" + r.class);
    li.appendChild(el("span", "hx-kind", r.class));
    li.appendChild(el("span", "hx-title", clip(r.title || r.id, 90)));
    li.appendChild(el("span", "hx-state", " · " + (r.state || "posted")));
    li.appendChild(document.createTextNode(" · "));
    li.appendChild(resident(ctx.faces, r.author, ctx.seatHref));
    ul.appendChild(li);
  }
  const notes = [];
  if (p.missing.length) notes.push(`the ${p.missing.join(" and ")} posts could not be read`);
  for (const x of p.partial) notes.push(`the ${x.class} list is cut at its newest ${x.read} of ${x.total}`);
  if (note && notes.length) { note.textContent = "Not the whole record: " + notes.join("; ") + "."; note.hidden = false; }
}

export function paintMarks(root, items, ctx) {
  const marks = marksOf(items);
  // nothing yet, with residents still out: not "no marks", the placeholder stays
  if (!marks.length && (ctx.reading ?? NOT_READING).residents.length) return;
  const ul = listOf(root, "[data-hx-marks]");
  if (!ul) return;
  if (!marks.length) { said(ul, "No marks of the house’s have been ruled on lately."); return; }
  for (const m of marks) {
    const li = el("li", "hx-mark is-" + m.verdict);
    li.appendChild(el("span", "hx-when", whenOf(m.at, ctx.now) + " "));
    li.appendChild(el("span", "hx-verdict", m.verdict === "locked" ? "locked in" : m.verdict === "refused" ? "refused" : "ruled"));
    li.appendChild(document.createTextNode(": "));
    li.appendChild(el("span", "hx-markid", m.mark.split("/").pop().replace(/-/g, " ")));
    if (m.words) li.appendChild(el("span", "hx-why", " — " + clip(m.words.replace(/-/g, " "), 80)));
    ul.appendChild(li);
  }
}

export function paintMail(root, reads, ctx) {
  const box = root.querySelector("[data-hx-mail]");
  if (!box) return;
  if (!ctx.owner) { box.hidden = true; return; }       // private: the house's own sign-in, and no one else's
  const stillOut = (ctx.reading ?? NOT_READING).residents.length;
  const m = mailOf(ctx.handles, reads.doorsteps);
  if (!m && stillOut) return;              // no doorstep has answered yet, and some are still coming: the box stays hidden
  const ul = listOf(box, "[data-hx-mail-list]");
  if (!m) { said(ul, "The house’s mail could not be read just now."); box.hidden = false; return; }
  const line = (n, text) => { if (n > 0) ul.appendChild(el("li", null, text)); };
  line(m.newInbound, plural(m.newInbound, "new inbound letter"));
  line(m.awaitingStance, plural(m.awaitingStance, "mark") + " awaiting the house’s word");
  line(m.bounced, plural(m.bounced, "letter") + " that never arrived");
  line(m.waiting, plural(m.waiting, "letter") + " waiting for the crossing");
  if (!ul.children.length) ul.appendChild(el("li", "hd-calm", "Nothing is new, and nothing waits on a word."));
  if (stillOut) said(ul, `Still reading ${plural(stillOut, "resident")}, so these counts may be short.`);
  else if (!m.complete) said(ul, "Not every resident’s doorstep answered, so these counts may be short.");
  box.hidden = false;
}

export function paintTown(root, reads, ctx) {
  if ((ctx.reading ?? NOT_READING).house.includes("calendar")) return;   // not landed: the slot keeps "reading the calendar…"
  const ul = listOf(root, "[data-hx-town-events]");
  if (!ul) return;
  const events = townEventsOf(reads.calendar);
  if (events == null) { said(ul, "The calendar could not be read just now."); return; }
  if (!events.length) { said(ul, "Nothing is on the calendar."); return; }
  for (const e of events) {
    const li = el("li", "hx-event");
    const a = el("a", null, e.title || e.id);
    a.href = "/calendar/" + e.id.split("/").map(encodeURIComponent).join("/") + "/";
    li.appendChild(a);
    const when = e.starts != null ? dayWordOf(e.starts, ctx.now) + ", " + new Date(e.starts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
    li.appendChild(el("span", "hx-when", " · " + [when, e.place, e.host && "hosted by " + nameOf(ctx.faces, e.host)].filter(Boolean).join(" · ")));
    ul.appendChild(li);
  }
}

export function paintMap(root, reads, ctx) {
  const box = root.querySelector("[data-hx-map]");
  if (!box) return;
  if ((ctx.reading ?? NOT_READING).house.includes("walkers")) return;    // not landed: the slot keeps "reading the world…"
  box.textContent = "";
  const places = placesOf(ctx.handles, reads.walkers);
  if (places == null) { box.appendChild(el("p", "hd-empty", "The walkers’ roll could not be read just now.")); return; }
  for (const p of places) {
    const tile = el("div", "hx-place" + (p.place ? "" : " is-unknown"));
    tile.appendChild(el("p", "hx-place-name", p.place ? (p.moving ? "on the way to " : "") + p.place : "not on the roll"));
    const row = el("p", "hx-place-who");
    p.who.forEach((h, i) => { if (i) row.append(" "); row.appendChild(resident(ctx.faces, h, ctx.seatHref)); });
    tile.appendChild(row);
    box.appendChild(tile);
  }
}

export function paintChart(root, reads, ctx) {
  const box = root.querySelector("[data-hx-chart]");
  if (!box) return;
  const out = (ctx.reading ?? NOT_READING).residents;
  const rows = chartOf(ctx.handles, reads.doorsteps);
  if (rows == null && out.length) return;   // no doorstep has answered yet and some are coming: the slot keeps "reading the stamps…"
  box.textContent = "";
  if (rows == null) { box.appendChild(el("p", "hd-empty", "The stamps could not be read just now.")); return; }
  for (const r of rows) {
    const row = el("div", "hx-bar-row");
    row.appendChild(resident(ctx.faces, r.handle, ctx.seatHref));
    const track = el("div", "hx-bar");
    track.setAttribute("role", "img");
    // a resident still out is not "not read" yet: their bar says it is coming, and a failed read keeps the old words
    const label = r.held != null ? `${r.held} stamps` : out.includes(r.handle) ? "still reading" : "not read";
    track.setAttribute("aria-label", `${nameOf(ctx.faces, r.handle)}: ${label}`);
    const fill = el("i");
    fill.style.width = r.held == null ? "0%" : Math.max(r.held > 0 ? 2 : 0, Math.round(r.share * 100)) + "%";
    if (ctx.faces[r.handle]?.accent) fill.style.background = ctx.faces[r.handle].accent;
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el("span", "hx-bar-n", r.held == null ? "—" : String(r.held)));
    box.appendChild(row);
  }
}

/** Starts the countdown's ticking; returns a stop function. The dashboard's paintClocks fills the clocks' words. */
export function startCountdown(root, reads, ctx) {
  const box = root.querySelector("[data-hd-clocks][data-hearth-slot]");
  const c = countdownOf(ctx.handles, reads.doorsteps);
  if (!box || !c) return () => {};
  const tick = () => {
    const now = Date.now();
    for (const key of ["crossing", "settlement"]) {
      const at = c[key]?.at;
      const out = box.querySelector(`[data-hx-left="${key}"]`);
      if (!out || at == null) continue;
      const left = leftWords(at, now);
      out.textContent = left ? `in ${left}` : "now";
    }
  };
  tick();
  const t = setInterval(tick, 1000);
  return () => clearInterval(t);
}

/** Everything this file draws, in one call. `reads` is readHouse's answer, `extras` readHearthExtras'. */
export function paintExtras(root, reads, extras, ctx) {
  const items = feedOf(ctx.handles, reads, ctx.now);
  paintPosts(root, extras, ctx);
  paintMarks(root, items, ctx);
  paintMail(root, reads, ctx);
  paintTown(root, reads, ctx);
  paintMap(root, reads, ctx);
  paintChart(root, reads, ctx);
}
