// stage.mjs — the household page's script: compose a design, read the house, paint the slots (POS-959; the one page, POS-984).
//
// The page is server-rendered with the design it opens on, so the house's baked public face is there
// without a script. This runs after, and does five things:
//
//   CHOOSE   asks the ONE selector, which-design.mjs § whichDesign, which entry to draw: a preview (`?entry=`, the dropdown), else the house's SAVED
//            choice (the office keeps it; read signed out, choice.mjs), else the default. A preview is never saved; the dropdown's save is the one write (POS-962).
//   COMPOSE  puts a registered entry's sanitized markup on the stage and each slot's own part in
//            its place (the same markup HearthSlot.astro rendered into a <template> per slot),
//            sets the entry's sanitized stylesheet, and mounts the approved behaviors. The dropdown
//            and `?entry=<id>` call it: ANY registered entry on ANY household, for ANY reader. A preview is
//            only that: nothing is saved, no office write is made, the URL is the whole state.
//   READ     the reads the household page already makes (reads.mjs), with the reader's bearer only
//            on the doorsteps of residents the reader's own sign-in holds, never anyone else's. The first
//            read paints as each resident's reads arrive (POS-984), not once, at the slowest.
//   PAINT    the dashboard's own paintHouse for the parts it already draws (feed, Needs you, the
//            numbers, the cards, the clocks), then hearth/paint.mjs for the rest.
//   BEHAVE   behaviors.mjs on the template's own markup.
//
// THE STRIP (`[data-hearth-bar]`, Hearth.astro) is the site's, above the stage and outside every design. It holds the Hearth dropdown, the
// house's-own-human links (add a resident, the likeness answer) and the one line that says the page is part-read. This file wires it: the
// dropdown binds for every reader, the save controls and the links show for the house's own sign-in only.
//
// The stage root carries `data-hd` and the house's slug so paintHouse works on it unchanged; its
// `data-hd-view` is `public` until the reader's sign-in holds a resident of this house.

import { KEYS, tokenIsFresh } from "../auth.mjs";
import { readHouse, readHearthExtras, officeOrigin } from "../household-dashboard/reads.mjs";
import { paintHouse, paintReading, writeLook } from "../household-dashboard/paint.mjs";
import { readingOf } from "../household-dashboard/fold.mjs";
import { paintExtras, startCountdown } from "./paint.mjs";
import { mountBehaviors } from "./behaviors.mjs";
import { whichDesign } from "./which-design.mjs";
import { notYours, meAnswered } from "./not-yours.mjs";
import { designNote, readSavedHearth } from "./choice.mjs";
import { mountHearthPicker } from "./picker.mjs";

import { DEFAULT_ENTRY as DEFAULT } from "./slots.mjs";

export function mountHearth(root) {
  const stage = root.querySelector("[data-hearth-stage]");
  if (!stage) return;
  // the site's own strip (Hearth.astro) sits above the stage, outside every template
  const bar = root.querySelector("[data-hearth-bar]");
  const json = (sel) => { try { return JSON.parse(root.querySelector(sel)?.textContent || "null"); } catch { return null; } };
  const data = json("[data-hearth-faces]") ?? {};
  const entries = json("[data-hearth-entries]") ?? [];
  const handles = data.handles ?? [];
  const faces = data.faces ?? {};
  const slug = root.dataset.hearthSlug || handles.join("+");
  // the registry KEY, which the office knows the house by: the saved choice is read under it and PATCHed to it. `slug` above is the page's path, which for a key over 96 bytes is a hash.
  const key = root.dataset.hearthKey || slug;
  // a resident's card, name and mentions go to that resident's own page: the household page draws each resident once and carries no pages of theirs
  const seatHref = (h) => `/residents/${encodeURIComponent(h)}/`;
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
  let reads = null, extras = null, extrasAsked = false, readFor = "", stopCount = () => {};
  // THE SAVED CHOICE (POS-962). `baked` is the build's own copy (Hearth.astro bakes house.hearth from households.json, the registry readSavedHearth reads): the first
  // draw starts from it, so a house with a saved choice does not flash the default. The browser read corrects a stale one. `mounted` is the dropdown, bound.
  const baked = root.dataset.hearthBaked || null;
  let knownSaved = baked;
  let mounted = null, readOk = false, savedRead, savedDone = false;

  // THE STRIP'S OWN PARTS, for the house's own human only: "+ add a resident" and the likeness answer ship hidden. They do not wait for the
  // reads (which can be slow): the reader's sign-in is known as soon as the layout's /me has answered. The office is still the enforcer of every act.
  function paintStrip() {
    const owner = mine().length > 0;
    for (const e of bar?.querySelectorAll("[data-hearth-own]") ?? []) e.hidden = !owner;
  }

  function draw() {
    paintStrip();
    if (!reads) return;
    ctx.now = Date.now();
    ctx.phone = phone.matches;
    ctx.mine = mine();
    ctx.owner = ctx.mine.length > 0;
    ctx.reading = readingOf(reads);       // what is still out: every painter says "still reading" for it, never "nothing" or "did not answer"
    for (const b of root.querySelectorAll("[data-hd-signin]")) b.hidden = !document.querySelector("[data-auth-signin]") || !!token();
    // signed in, but not as anyone of this house: say so, rather than an unanswered question (the house slot's own line)
    // (not before /me has answered: a first sign-in's owner would see it flash, lib/hearth/not-yours.mjs)
    for (const n of root.querySelectorAll("[data-hx-notyours]")) n.hidden = !notYours({ signedIn: !!token(), answered: meAnswered(sessionStorage), owner: ctx.owner });
    if (bar) paintReading(bar, ctx.reading);
    mountPicker();
    paintHouse(stage, reads, ctx);
    paintExtras(stage, reads, extras, ctx);
    stopCount();
    stopCount = startCountdown(stage, reads, ctx);
    // the page's one holo expansion shows when the stamps slot shows a holo count
    const wrap = stage.querySelector("[data-hd-n-holo-wrap]");
    if (holoNote) holoNote.hidden = !wrap || wrap.hidden;
  }

  // THE FIRST READ PAINTS AS IT ARRIVES (POS-984). The reads are one per resident, and on a busy box the slowest decides when a page that waits for all of them
  // shows anything, so the stage paints each time a resident's reads settle or a house-wide read lands (readHouse's onProgress). A resident whose read failed
  // is drawn as not read and never holds the others back. A read of a page that is already whole (a sign-in) is swapped in once, when it finishes, so
  // nothing that was on the page empties meanwhile; one that replaces a part-read page starts over, as the page has nothing complete to keep.
  let loadSeq = 0;
  async function load() {
    const own = mine();
    const key = own.join(",");
    if (reads && key === readFor) { draw(); return; }
    readFor = key;
    const seq = ++loadSeq;
    const still = readingOf(reads);
    const progressive = !reads || still.residents.length > 0 || still.house.length > 0;
    // the posts are read once, beside the house's reads, and painted when they land; the part keeps its placeholder until then
    if (!extras && !extrasAsked) { extrasAsked = true; readHearthExtras().then((x) => { extras = x; draw(); }); }
    const done = await readHouse(handles, {
      token: own.length ? token() : null, mine: own,
      onProgress: progressive ? (snapshot) => { if (seq === loadSeq) { reads = snapshot; draw(); } } : null,
    });
    if (seq !== loadSeq || progressive) return;   // a newer read has taken over (this one's answer is stale), or the last progress was this answer and is drawn
    reads = done;
    draw();
  }

  function say(text) { if (note) { note.textContent = text ?? ""; note.hidden = !text; } }

  function compose(id, { asked = null } = {}) {
    const entry = whichDesign(entries, { entry: id, saved: knownSaved });
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
  stage.addEventListener("change", (e) => {
    const sel = e.target instanceof Element ? e.target.closest("[data-hd-who]") : null;
    if (sel) { ctx.filter.who = sel.value; draw(); }
  });
  // THE DROPDOWN (POS-962): a preview draws another entry and keeps only the address (never a save); the save is picker.mjs's, behind a second yes.
  // It binds for EVERY reader, once, after the choice read has answered (or failed): anyone may preview. What only the house's own human has is the SAVE
  // controls, which picker.mjs shows when `signedIn()` holds: a sign-in that holds one of this house's residents, and never on a failed read (the kept
  // choice is not known then, so nothing is offered to save over it). A visitor's ask() and clear() do nothing.
  const pickerRoot = root.querySelector("[data-hearth-picker]");
  const api = officeOrigin();
  function mountPicker() {
    if (mounted || !pickerRoot || !savedDone) return;
    mounted = mountHearthPicker(pickerRoot, {
      entries, slug: key, path: slug, saved: readOk ? (savedRead ?? null) : baked, token, api,
      shown: root.dataset.hearthShowing,
      signedIn: () => readOk && mine().length > 0, onDraw,
    });
  }
  const onDraw = (id) => {
    try {
      const url = new URL(location.href);
      const savedId = mounted?.picker.view().savedId ?? null;
      if (id === (savedId ?? DEFAULT)) url.searchParams.delete("entry"); else url.searchParams.set("entry", id);
      history.replaceState(null, "", url);
    } catch { /* the entry still shows; only the address is not kept */ }
    compose(id);
  };
  phone.addEventListener?.("change", draw);
  document.addEventListener("pm:lens", () => { load(); mounted?.refresh(); paintStrip(); });
  paintStrip();

  let asked = null;
  try { asked = new URL(location.href).searchParams.get("entry"); } catch { asked = null; }
  // the page was drawn on the server with the entry it opens on (the default); asked for that same one, there is nothing to redraw
  const first = whichDesign(entries, { entry: asked, saved: baked });
  if (first && stage.dataset.hearthEntry === first.id) {
    mountBehaviors(stage);
    root.dataset.hearthShowing = first.id;
    say(asked && asked !== first.id ? `No Hearth entry is registered as “${asked.slice(0, 40)}”; showing ${first.title}.` : "");
  } else compose(asked, { asked });   // whichDesign answers for "nothing asked": the default today, a saved choice later (POS-962 folds it into the one function)
  load();

  // THE SAVED CHOICE: the office keeps it and reads it signed out, so a reload (and every other visitor) draws what the house chose.
  // whichDesign answers which entry to draw; a preview in the address still wins on this visit, and is not saved.
  readSavedHearth({ handles, slug: key, api }).then((read) => {
    readOk = read !== undefined;
    savedRead = read; savedDone = true;
    // a FAILED read keeps what the build carried (else the default, which whichDesign answers for nothing), and says so
    const saved = readOk ? read : baked;
    knownSaved = saved;
    const drawn = whichDesign(entries, { entry: asked, saved });
    if (drawn && drawn.id !== root.dataset.hearthShowing) compose(drawn.id);
    const note = designNote(entries, { entry: asked, saved: read });
    if (note) say(!readOk && baked && drawn?.id === baked ? "The house's saved Hearth could not be read just now; showing the one this page was built with." : note);
    mountPicker();
    if (picker && drawn) picker.value = drawn.id;
  });
}
