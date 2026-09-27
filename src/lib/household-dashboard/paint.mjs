// paint.mjs — the household page's live half, drawn into the static page
// (POS-260). It takes fold.mjs's answers and writes them into the elements
// HouseDashboard.astro rendered. It never fetches (reads.mjs does) and never
// decides anything fold.mjs can decide.
//
// TEXT ONLY. Every string a resident wrote — a letter's first line, a said
// line, a mark id, a handle — goes in through textContent. The only markup
// built here is elements this file creates itself.

import {
  feedOf, splitAtLook, countKinds, lastActOf, standsAtOf, hungOf, cardNumbersOf,
  clocksOf, needsOf, comingUpOf, questsOf, numbersOf, readLook, writeLook, whenOf, dayWordOf,
} from "./fold.mjs";

const TOWN_REPO = "https://github.com/postmark-town/postmark/blob/main/";
const TOWN_HISTORY = "https://github.com/postmark-town/postmark/commits/main/";
const FEED_MAX = 14;       // fresh lines shown before "N more"
const BEFORE_MAX = 3;      // lines under "before you last looked"
const PUBLIC_MAX = 12;     // the signed-out feed: the house lately

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const clip = (s, max) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

/** A resident's name as every line wears it: their face, their colour. */
function who(faces, handle, seatHref) {
  const f = faces[handle];
  const a = el("a", "hd-who");
  a.href = seatHref(handle);
  if (f?.accent) a.style.setProperty("--hd-c", f.accent);
  else a.classList.add("is-neutral");
  const dot = el("span", "hd-who-face");
  dot.setAttribute("aria-hidden", "true");
  if (f?.avatar) { const img = el("img"); img.src = f.avatar; img.alt = ""; img.loading = "lazy"; dot.appendChild(img); }
  else dot.textContent = f?.monogram ?? "·";
  a.appendChild(dot);
  a.appendChild(document.createTextNode(f?.name ?? handle));
  return a;
}

// someone outside the house, by handle, to their own page
function other(handle) {
  const a = el("a", "hd-other", handle);
  a.href = "/residents/" + encodeURIComponent(handle) + "/";
  return a;
}

function feedLine(it, ctx) {
  const li = el("li", "hd-line is-" + it.kind);
  li.dataset.kind = it.kind;
  li.dataset.who = it.who;
  const f = ctx.faces[it.who];
  if (f?.accent) li.style.setProperty("--hd-c", f.accent);
  li.appendChild(el("span", "hd-t", whenOf(it.at, ctx.now)));
  const glyph = { letter: "✉", said: "❝", mark: it.verdict === "refused" ? "✕" : "◆", stamps: "✦" }[it.kind];
  li.appendChild(el("span", "hd-g g-" + (it.kind === "mark" ? it.verdict : it.kind), glyph));
  const line = el("span", "hd-l");
  const me = who(ctx.faces, it.who, ctx.seatHref);
  if (it.kind === "letter" && it.dir === "out") {
    line.append(me, " wrote to ", other(it.other ?? "someone"));
  } else if (it.kind === "letter") {
    line.append(other(it.other ?? "someone"), " wrote to ", me);
  } else if (it.kind === "said") {
    line.append(me, " said" + (it.place ? ", in " + it.place : ""));
  } else if (it.kind === "mark") {
    line.append(me, "’s mark ", el("b", "hd-mark", it.mark.split("/").pop()));
    if (it.verdict === "refused") line.append(" was refused" + (it.window != null ? " at window " + it.window : "") + (it.cause ? " — " + it.cause : ""));
    else if (it.verdict === "locked") { line.append(" was "); line.append(el("span", "hd-ok", "locked")); line.append(it.window != null ? " at window " + it.window : ""); }
    else line.append(" — " + it.summary);
  } else if (it.kind === "stamps") {
    line.append(me, ` earned ${plural(it.n, "stamp")} for “${it.quest}” today — ${it.names.join(", ")}`);
  }
  if (it.text) line.appendChild(el("span", "hd-q", "“" + clip(it.text, 170) + "”"));
  if (it.kind === "mark" && it.words) line.appendChild(el("span", "hd-why", "the crossing’s words: " + it.words));
  li.appendChild(line);
  return li;
}

/** The whole live page, drawn from one readHouse() answer. */
export function paintHouse(root, reads, ctx) {
  const { handles, faces, slug, owner } = ctx;
  const now = ctx.now;
  const items = feedOf(handles, reads, now);
  root.dataset.hdView = owner ? "owner" : "public";

  paintClocks(root, clocksOf(handles, reads.doorsteps), now);
  paintFeed(root, items, ctx);
  if (owner) paintNeeds(root, needsOf(handles, reads.doorsteps), ctx);
  paintCards(root, items, reads, ctx);
  paintComing(root, comingUpOf(reads.calendar, handles), ctx);
  paintShare(root, questsOf(handles, reads.quests), handles);
  paintNumbers(root, numbersOf(handles, reads.doorsteps), handles, reads, ctx);
  root.querySelector("[data-hd-loading]")?.remove();
  return items;
}

function paintClocks(root, clocks, now) {
  const box = root.querySelector("[data-hd-clocks]");
  if (!box || !clocks) return;
  const set = (key, v, n) => {
    const c = box.querySelector(`[data-hd-clock="${key}"]`);
    if (!c) return;
    c.querySelector(".v").textContent = v;
    c.querySelector(".n").textContent = n;
    c.hidden = false;
  };
  const t = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const s = clocks.settlement;
  if (s?.at) set("settlement", dayWordOf(s.at, now) + ", " + t(s.at),
    !s.complete ? "not every resident’s stakes answered"
      : s.atRisk > 0 ? plural(s.atRisk, "mark") + " of the house’s at risk" : "nothing of the house’s at risk");
  const c = clocks.crossing;
  if (c?.at) set("crossing", (c.n != null ? "No. " + c.n + " · " : "") + t(c.at), "a letter written before then rides it");
  box.hidden = false;
}

function paintFeed(root, items, ctx) {
  const list = root.querySelector("[data-hd-feed]");
  if (!list) return;
  const filterKind = ctx.filter?.kind ?? "all";
  const filterWho = ctx.filter?.who ?? "all";
  const pass = (i) => (filterKind === "all" || i.kind === filterKind) && (filterWho === "all" || i.who === filterWho);

  const looked = ctx.owner ? readLook(ctx.storage, ctx.slug) : null;
  // A first look from this browser has no watermark; it reads the last day as
  // new rather than calling the house's whole record "since you last looked".
  const splitAt = looked ?? ctx.now - 86_400_000;
  const { fresh, before } = ctx.owner ? splitAtLook(items, splitAt) : { fresh: items.slice(0, PUBLIC_MAX * 4), before: [] };
  const counted = ctx.owner ? fresh : fresh.slice(0, PUBLIC_MAX);

  // the chips count what the reader is looking at: the fresh lines signed in,
  // the house lately signed out
  const n = countKinds(counted);
  for (const chip of root.querySelectorAll("[data-hd-filter]")) {
    const k = chip.dataset.hdFilter;
    const c = chip.querySelector("[data-hd-count]");
    if (c) c.textContent = k === "all" ? "" : " · " + (n[k] ?? 0);
    chip.classList.toggle("is-on", k === filterKind);
    chip.setAttribute("aria-pressed", k === filterKind ? "true" : "false");
  }

  const meta = root.querySelector("[data-hd-looked]");
  if (meta && ctx.owner) {
    meta.textContent = looked == null
      ? `a first look from this browser · ${fresh.length} in the last day`
      : `you looked ${whenOf(looked, ctx.now)} · ${fresh.length} new`;
  }

  list.textContent = "";
  const shown = (ctx.owner ? fresh : counted).filter(pass);
  // a phone shows the newest five, so Needs you is one scroll away, not twelve
  const cap = ctx.expanded ? shown.length : ctx.phone ? 5 : FEED_MAX;
  shown.slice(0, cap).forEach((i) => list.appendChild(feedLine(i, ctx)));
  if (!shown.length) {
    list.appendChild(el("li", "hd-empty", ctx.owner
      ? (looked == null ? "Nothing on the house’s record in the last day." : "Nothing new since you last looked.")
      : "Nothing on the house’s record lately."));
  }
  const oldies = ctx.owner ? before.filter(pass).slice(0, BEFORE_MAX) : [];
  if (oldies.length) {
    const sep = el("li", "hd-sep");
    sep.appendChild(el("span", null, looked == null ? "before that" : "before you last looked"));
    list.appendChild(sep);
    oldies.forEach((i) => { const li = feedLine(i, ctx); li.classList.add("is-old"); list.appendChild(li); });
  }
  const more = root.querySelector("[data-hd-more]");
  if (more) {
    const rest = shown.length - Math.min(cap, shown.length);
    more.hidden = rest <= 0;
    more.textContent = rest > 0 ? `${rest} more ▾` : "";
  }
}

function paintNeeds(root, needs, ctx) {
  const ul = root.querySelector("[data-hd-needs]");
  if (!ul) return;
  ul.textContent = "";
  const item = (k, calm) => {
    const li = el("li");
    li.appendChild(el("span", "k" + (calm ? " calm" : ""), k));
    return li;
  };
  if (needs.stances.total > 0) {
    const li = item("awaiting the house’s word · " + needs.stances.total);
    const p = el("p", null, "Marks set down over ground your house holds, waiting for a stance: ");
    needs.stances.by.forEach((x, i) => {
      if (i) p.append(", ");
      const w = who(ctx.faces, x.handle, ctx.seatHref);
      p.append(w, " " + x.n);
    });
    p.append(".");
    li.appendChild(p);
    ul.appendChild(li);
  }
  for (const b of needs.bounces) {
    const li = item("a letter that never arrived");
    const p = el("p");
    p.append(who(ctx.faces, b.handle, ctx.seatHref), `’s letter of ${b.date} is still unplaced`
      + (b.ageDays != null ? `, ${b.ageDays} days on` : "") + ". The office’s words: " + b.reason + ".");
    li.appendChild(p);
    // The letter's HISTORY, not its file: the ferry moves or clears an outbox
    // file, so a blob link 404s (Keemin, 2026-09-27); GitHub serves a path's
    // commits even after the file is gone.
    if (b.path) { const a = el("a", null, "its history →"); a.href = TOWN_HISTORY + b.path.split("/").map(encodeURIComponent).join("/"); li.appendChild(a); }
    ul.appendChild(li);
  }
  if (needs.pending.length) {
    const li = item("written, not yet sailed · " + needs.pending.length);
    const p = el("p");
    needs.pending.forEach((x, i) => {
      if (i) p.append("; ");
      p.append(who(ctx.faces, x.handle, ctx.seatHref), " to " + (x.to || "someone") + (x.title ? ` — “${clip(x.title, 60)}”` : ""));
    });
    p.append(". They ride the next crossing.");
    li.appendChild(p);
    ul.appendChild(li);
  }
  const risk = item("at the keeper’s settlement", needs.atRisk === 0);
  risk.appendChild(el("p", null, needs.atRisk > 0
    ? `${plural(needs.atRisk, "mark")} of the house’s ${needs.atRisk === 1 ? "is" : "are"} at risk: published without stamps behind ${needs.atRisk === 1 ? "it" : "them"}.`
    : "Nothing of the house’s is at risk: every published mark has stamps behind it."));
  ul.appendChild(risk);
  root.querySelector("[data-hd-needs-box]")?.removeAttribute("hidden");
}

function paintCards(root, items, reads, ctx) {
  const looked = ctx.owner ? readLook(ctx.storage, ctx.slug) : null;
  for (const h of ctx.handles) {
    const card = root.querySelector(`[data-hd-card="${CSS.escape(h)}"]`);
    if (!card) continue;
    const act = lastActOf(h, items);
    const stands = standsAtOf(h, reads.walkers);
    const live = card.querySelector("[data-hd-live]");
    const set = (sel, text) => { const e = card.querySelector(sel); if (e) { e.textContent = text ?? ""; } return e; };
    const row = (key, text) => {
      const dd = card.querySelector(`[data-hd-${key}]`);
      const dt = card.querySelector(`[data-hd-${key}-dt]`);
      if (dd) { dd.textContent = text ?? ""; dd.hidden = !text; }
      if (dt) dt.hidden = !text;
    };
    if (act) {
      const what = act.kind === "said" ? "said" + (act.place ? ", in " + act.place : "") : "a letter to " + (act.other ?? "someone");
      set("[data-hd-last]", whenOf(act.at, ctx.now) + " — " + what);
    } else set("[data-hd-last]", "nothing on the record lately");
    row("stands", stands ? (stands.moving ? "walking toward " : "") + stands.place : null);
    row("doing", act?.text ? "“" + clip(act.text, 120) + "”" : null);
    if (live) live.hidden = false;

    const nums = cardNumbersOf(reads.doorsteps?.[h]);
    const foot = card.querySelector("[data-hd-foot]");
    if (nums && foot) {
      const put = (sel, text) => { const e = foot.querySelector(sel); if (e) { e.textContent = text ?? ""; e.hidden = !text; } };
      put("[data-hd-held]", nums.held != null ? String(nums.held) : null);
      put("[data-hd-inbound]", nums.newInbound ? "✉ " + nums.newInbound + " new inbound" : null);
      put("[data-hd-stance]", nums.awaitingStance ? nums.awaitingStance + " awaiting a stance" : null);
      put("[data-hd-pending]", ctx.owner && nums.pending ? plural(nums.pending, "letter") + " waiting for the crossing" : null);
      foot.hidden = false;
    }
    const pill = card.querySelector("[data-hd-new]");
    if (pill) {
      const since = looked ?? ctx.now - 86_400_000;
      const fresh = ctx.owner ? items.filter((i) => i.who === h && i.sort > since).length : 0;
      pill.textContent = fresh ? fresh + " new" : "";
      pill.hidden = !fresh;
    }
    // the office's live answer outranks the build's: a pane taken down since
    // the build leaves no empty frame behind
    const fig = root.querySelector(`[data-hd-window="${CSS.escape(h)}"]`);
    if (fig) {
      const live = hungOf(reads.doorsteps?.[h], ctx.faces[h]?.windowHung);
      fig.hidden = live !== true;
      fig.closest("[data-hd-row]")?.classList.toggle("is-unhung", live !== true);
      const frame = fig.querySelector("iframe");
      if (live === true && frame && !frame.getAttribute("src")) frame.src = frame.dataset.hdSrc;
    }
  }
}

function paintComing(root, events, ctx) {
  const sec = root.querySelector("[data-hd-coming]");
  if (!sec) return;
  if (events == null) { sec.hidden = true; return; } // the calendar did not answer
  const list = sec.querySelector("[data-hd-events]");
  list.textContent = "";
  if (!events.length) list.appendChild(el("p", "hd-empty", "Nothing on the calendar that the house is hosting or going to."));
  for (const e of events) {
    const row = el("div", "hd-event");
    const date = el("div", "hd-date");
    const at = e.starts != null ? new Date(e.starts) : null;
    date.appendChild(el("div", "m", at ? at.toLocaleDateString(undefined, { weekday: "short" }) : ""));
    date.appendChild(el("div", "d", at ? String(at.getDate()) : "?"));
    date.appendChild(el("div", "m", e.phase === "announced" ? "" : e.phase.replace("-", " ")));
    row.appendChild(date);
    const body = el("div");
    const h3 = el("h3");
    const link = el("a", null, e.title);
    link.href = "/calendar/" + e.id.split("/").map(encodeURIComponent).join("/") + "/";
    h3.appendChild(link);
    body.appendChild(h3);
    const time = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    body.appendChild(el("p", null, [
      e.doorsOpen != null ? "doors at " + time(e.doorsOpen) : e.starts != null ? time(e.starts) : null,
      e.place,
      "hosted by " + (ctx.faces[e.host]?.name ?? e.host),
    ].filter(Boolean).join(" · ")));
    row.appendChild(body);
    const going = el("div", "hd-going");
    e.going.forEach((h) => going.appendChild(who(ctx.faces, h, ctx.seatHref)));
    row.appendChild(going);
    list.appendChild(row);
  }
  sec.hidden = false;
}

// The day's quest cards are the house's board, drawn by Household.astro into
// the dashboard's `quests` slot; what the dashboard keeps is the plate's line.
function paintShare(root, q, handles) {
  const share = q?.shareSize;
  const plate = root.querySelector("[data-hd-share-sub]");
  if (plate && share != null && share < handles.length) { plate.textContent = `${share} of them share the daily mint`; plate.hidden = false; }
}

function paintNumbers(root, n, handles, reads, ctx) {
  const box = root.querySelector("[data-hd-numbers]");
  if (!box) return;
  const hung = handles.filter((h) => hungOf(reads.doorsteps?.[h], ctx.faces[h]?.windowHung) === true).length;
  const set = (sel, v) => { const e = box.querySelector(sel); if (e) e.textContent = v; };
  set("[data-hd-n-windows]", String(hung));
  const line = root.querySelector("[data-hd-hung-line]");
  if (line) line.textContent = `${hung} ${hung === 1 ? "has" : "have"} hung a window`;
  if (n) {
    set("[data-hd-n-held]", String(n.held));
    set("[data-hd-n-minted]", String(n.minted));
    if (n.holo > 0) {
      set("[data-hd-n-holo]", n.holo + "✧");
      box.querySelector("[data-hd-n-holo-wrap]")?.removeAttribute("hidden");
      box.querySelector("[data-dash-holo-note]")?.removeAttribute("hidden");
    }
  }
  box.hidden = false;
}

export { readLook, writeLook };
