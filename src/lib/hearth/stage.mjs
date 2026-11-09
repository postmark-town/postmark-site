// stage.mjs — the Hearth page's script: compose an entry, read the house, paint the slots (POS-959).
//
// The page is server-rendered with the default entry, so the house's baked public face is there
// without a script. This runs after, and does four things:
//
//   COMPOSE  puts a registered entry's sanitized markup on the stage and each slot's own part in
//            its place (the same markup HearthSlot.astro rendered into a <template> per slot),
//            sets the entry's sanitized stylesheet, and mounts the approved behaviors. The preview
//            picker and `?entry=<id>` call it: ANY registered entry on ANY household. A preview is
//            only that: nothing is saved, no office write is made, the URL is the whole state.
//   READ     the reads the household page already makes (reads.mjs), with the reader's bearer only
//            on the doorsteps of residents the reader's own sign-in holds, never anyone else's.
//   PAINT    the dashboard's own paintHouse for the parts it already draws (feed, Needs you, the
//            numbers, the cards, the clocks), then hearth/paint.mjs for the rest.
//   BEHAVE   behaviors.mjs on the template's own markup.
//
// The stage root carries `data-hd` and the house's slug so paintHouse works on it unchanged; its
// `data-hd-view` is `public` until the reader's sign-in holds a resident of this house.

import { KEYS, tokenIsFresh } from "../auth.mjs";
import { readHouse, readHearthExtras } from "../household-dashboard/reads.mjs";
import { paintHouse, writeLook } from "../household-dashboard/paint.mjs";
import { paintExtras, startCountdown } from "./paint.mjs";
import { mountBehaviors } from "./behaviors.mjs";
import { whichDesign } from "./which-design.mjs";
import { notYours, meAnswered } from "./not-yours.mjs";
import { DEFAULT_ENTRY as DEFAULT } from "./slots.mjs";

export function mountHearth(root) {
  const stage = root.querySelector("[data-hearth-stage]");
  if (!stage) return;
  // the site's own band (HouseBand.astro) sits above the stage, outside every template: painted from the same reads
  const band = root.querySelector("[data-hband]");
  const json = (sel) => { try { return JSON.parse(root.querySelector(sel)?.textContent || "null"); } catch { return null; } };
  const data = json("[data-hearth-faces]") ?? {};
  const entries = json("[data-hearth-entries]") ?? [];
  const handles = data.handles ?? [];
  const faces = data.faces ?? {};
  const slug = root.dataset.hearthSlug || handles.join("+");
  const seatHref = (h) => (root.dataset.hearthSlug ? `/households/${root.dataset.hearthSlug}/?resident=${encodeURIComponent(h)}` : `/residents/${encodeURIComponent(h)}/`);
  const styleEl = root.querySelector("[data-hearth-css]");
  const note = root.querySelector("[data-hearth-note]");
  const picker = root.querySelector("[data-hearth-pick]");
  const holoNote = root.querySelector("[data-hearth-holo]");

  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  const token = () => {
    try {
      const t = JSON.parse(storage?.getItem(KEYS.token) || "null");
      return tokenIsFresh(t) ? t.access_token : null;
    } catch { return null; }
  };
  const held = () => {
    try { return JSON.parse(sessionStorage.getItem("pm.oauth.handles") || storage?.getItem("pm.oauth.handles.cache") || "[]"); }
    catch { return []; }
  };
  const mine = () => (token() ? held().filter((h) => handles.includes(h)) : []);

  const phone = window.matchMedia("(max-width: 760px)");
  const ctx = { handles, faces, slug, seatHref, storage, filter: { kind: "all", who: "all" }, expanded: false };
  let reads = null, extras = null, readFor = "", stopCount = () => {};

  function draw() {
    if (!reads) return;
    ctx.now = Date.now();
    ctx.phone = phone.matches;
    ctx.mine = mine();
    ctx.owner = ctx.mine.length > 0;
    for (const b of root.querySelectorAll("[data-hd-signin]")) b.hidden = !document.querySelector("[data-auth-signin]") || !!token();
    // signed in, but not as anyone of this house: say so, rather than an unanswered question (the band's own line)
    // (not before /me has answered: a first sign-in's owner would see it flash, lib/hearth/not-yours.mjs)
    for (const n of root.querySelectorAll("[data-hband-notyours]")) n.hidden = !notYours({ signedIn: !!token(), answered: meAnswered(sessionStorage), owner: ctx.owner });
    if (band) paintHouse(band, reads, ctx);
    paintHouse(stage, reads, ctx);
    paintExtras(stage, reads, extras, ctx);
    stopCount();
    stopCount = startCountdown(stage, reads, ctx);
    // the page's one holo expansion shows when the stamps slot shows a holo count
    const wrap = stage.querySelector("[data-hd-n-holo-wrap]");
    if (holoNote) holoNote.hidden = !wrap || wrap.hidden;
  }

  async function load() {
    const own = mine();
    const key = own.join(",");
    if (reads && key === readFor) { draw(); return; }
    readFor = key;
    [reads, extras] = await Promise.all([
      readHouse(handles, { token: own.length ? token() : null, mine: own }),
      extras ? Promise.resolve(extras) : readHearthExtras(),
    ]);
    draw();
  }

  function say(text) { if (note) { note.textContent = text ?? ""; note.hidden = !text; } }

  function compose(id, { asked = null } = {}) {
    const entry = whichDesign(entries, { entry: id });
    if (!entry) { say("No Hearth entry is registered."); return; }
    if (styleEl) styleEl.textContent = entry.css;
    const tpl = document.createElement("template");
    tpl.innerHTML = entry.html;
    for (const ph of [...tpl.content.querySelectorAll("[data-hearth-slot]")]) {
      const part = root.querySelector(`template[data-hearth-slot-tpl="${ph.getAttribute("data-hearth-slot")}"]`);
      if (part) ph.replaceWith(part.content.cloneNode(true)); else ph.remove();
    }
    stage.dataset.hearthEntry = entry.id;
    stage.replaceChildren(tpl.content);
    mountBehaviors(stage);
    if (picker) picker.value = entry.id;
    root.dataset.hearthShowing = entry.id;
    say(asked && asked !== entry.id ? `No Hearth entry is registered as “${asked.slice(0, 40)}”; showing ${entry.title}.` : "");
    ctx.expanded = false;
    draw();
  }

  // the stage's controls are replaced with each entry, so they are heard from the stage itself
  stage.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const chip = t.closest("[data-hd-filter]");
    if (chip) { ctx.filter.kind = chip.dataset.hdFilter; draw(); return; }
    if (t.closest("[data-hd-more]")) { ctx.expanded = true; draw(); return; }
    if (t.closest("[data-hd-seen]")) { writeLook(storage, slug, Date.now()); ctx.expanded = false; draw(); return; }
    if (t.closest("[data-hd-signin]")) document.querySelector("[data-auth-signin]")?.click();
  });
  band?.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-hd-signin]")) document.querySelector("[data-auth-signin]")?.click();
  });
  stage.addEventListener("change", (e) => {
    const sel = e.target instanceof Element ? e.target.closest("[data-hd-who]") : null;
    if (sel) { ctx.filter.who = sel.value; draw(); }
  });
  picker?.addEventListener("change", () => {
    const id = picker.value;
    try {
      const url = new URL(location.href);
      if (id === DEFAULT) url.searchParams.delete("entry"); else url.searchParams.set("entry", id);
      history.replaceState(null, "", url);
    } catch { /* the preview still shows; only the address is not kept */ }
    compose(id);
  });
  phone.addEventListener?.("change", draw);
  document.addEventListener("pm:lens", () => { load(); });
  // the household page keeps this seat and a tab per resident: coming back to the seat draws it against the clock again
  document.addEventListener("pm:tab", (e) => { if (e.detail?.handle === "__house") draw(); });

  let asked = null;
  try { asked = new URL(location.href).searchParams.get("entry"); } catch { asked = null; }
  // the page was drawn on the server with the entry it opens on; asked for that same one, there is nothing to redraw
  const first = whichDesign(entries, { entry: asked });
  if (first && stage.dataset.hearthEntry === first.id) {
    mountBehaviors(stage);
    if (picker) picker.value = first.id;
    root.dataset.hearthShowing = first.id;
    say(asked && asked !== first.id ? `No Hearth entry is registered as “${asked.slice(0, 40)}”; showing ${first.title}.` : "");
  } else compose(asked, { asked });   // whichDesign answers for "nothing asked": the default today, a saved choice later (POS-962 folds it into the one function)
  load();
}
