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
//   v2       (POS-1024, POS-1028) reads the office's PUBLIC Hearth bundle once, signed out, and the panes origin's list of hung windows, and paints
//            the v2 slots from them (paint-v2.mjs); runs the drawn entry's own script ON THIS PAGE, handing it the same public bundle (script.mjs),
//            and stops it when another entry is drawn. Sets `data-hearth-view` (owner | public) on the stage, a design's styling hook.
//
// THE STRIP (`[data-hearth-bar]`, Hearth.astro) is the site's, above the stage and outside every design. It holds the household's sub-rail
// (HouseRail.astro) with its "+" (add a resident) and its mark for reads still in flight, and in the rail's corner the Hearth dropdown and the
// settings (the likeness answer). This file wires it: the dropdown binds for every reader; the "+", the settings and the save controls show for
// the house's own sign-in only.
//
// The stage root carries `data-hd` and the house's slug so paintHouse works on it unchanged; its
// `data-hd-view` is `public` until the reader's sign-in holds a resident of this house.

import { KEYS, tokenIsFresh } from "../auth.mjs";
import { readHouse, readHearthExtras, readHearthBundle, readHungWindows, officeOrigin } from "../household-dashboard/reads.mjs";
import { paintV2 } from "./paint-v2.mjs";
import { hearthApi, runEntryScript, emit } from "./script.mjs";
import { paintHouse, paintReadingMark, writeLook } from "../household-dashboard/paint.mjs";
import { readingOf } from "../household-dashboard/fold.mjs";
import { paintExtras, startCountdown } from "./paint.mjs";
import { mountBehaviors } from "./behaviors.mjs";
import { whichDesign } from "./which-design.mjs";
import { notYours, meAnswered } from "./not-yours.mjs";
import { designNote, readSavedHearth } from "./choice.mjs";
import { mountHearthPicker } from "./picker.mjs";
import { bindListbox, paintListbox } from "./listbox.mjs";

import { DEFAULT_ENTRY as DEFAULT } from "./slots.mjs";

// `loadScript` is the importer for a design's own script (script.mjs § runEntryScript's `load`): the page passes nothing and gets the real import; a
// test hands a fake, so it can run this whole stage with a house script on it.
export function mountHearth(root, { loadScript } = {}) {
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
  const ctx = { handles, faces, slug, seatHref, residentHref: seatHref, storage, filter: { kind: "all", who: "all" }, expanded: false, feedSort: "newest" };

  // v2: THE PUBLIC BUNDLE, THE HUNG WINDOWS AND THE HOUSE'S OWN SCRIPT. The bundle is read once, signed out (reads.mjs § readHearthBundle), and the
  // same answer paints the site's v2 slots and is handed to the entry's script. `scriptState` is what the script's getters read (hearthApi).
  let bundle = null, hung = null, stopScript = () => {}, scriptSeq = 0;
  const listeners = { bundle: new Set(), view: new Set() };
  // `saved` is the house's saved Hearth choice as this page knows it (knownSaved, below): a design that is not it is only a preview, and its script's
  // acts are refused (script.mjs § isChosenDesign; POS-1029/a, "Where chosen; previews read-only").
  const scriptState = { bundle: null, owner: false, token, saved: () => knownSaved };
  const house = Object.freeze({
    slug, key, handles: [...handles],
    residents: handles.map((h) => Object.freeze({ handle: h, name: faces[h]?.name ?? h, accent: faces[h]?.accent ?? null, avatar: faces[h]?.avatar ?? null })),
  });
  function drawV2() {
    ctx.now = Date.now();
    const owner = mine().length > 0;
    ctx.owner = owner;
    stage.dataset.hearthView = owner ? "owner" : "public";
    paintV2(stage, { bundle, hung }, ctx);
    if (scriptState.owner !== owner) { scriptState.owner = owner; emit(listeners, "view", owner ? "owner" : "public"); }
  }
  function startScript(entry) {
    stopScript();
    stopScript = () => {};
    for (const set of Object.values(listeners)) set.clear();
    const seq = ++scriptSeq;
    if (!entry?.script) return;
    const hearth = hearthApi({ entryId: entry.id, stage, house, api: officeOrigin(), state: scriptState, listeners });
    runEntryScript(entry, hearth, { load: loadScript }).then((stop) => { if (seq === scriptSeq) stopScript = stop; else stop(); });
  }
  let reads = null, extras = null, extrasAsked = false, readFor = "", stopCount = () => {};
  // THE SAVED CHOICE (POS-962). `baked` is the build's own copy (Hearth.astro bakes house.hearth from households.json, the registry readSavedHearth reads): the first
  // draw starts from it, so a house with a saved choice does not flash the default. The browser read corrects a stale one. `mounted` is the dropdown, bound.
  const baked = root.dataset.hearthBaked || null;
  let knownSaved = baked;
  let mounted = null, readOk = false, savedRead, savedDone = false;

  // THE STRIP'S OWN PARTS, for the house's own human only: the sub-rail's "+" (add a resident) and the settings (the likeness answer) ship hidden.
  // They do not wait for the reads (which can be slow): the reader's sign-in is known as soon as the layout's /me has answered. The office is still
  // the enforcer of every act.
  function paintStrip() {
    const owner = mine().length > 0;
    for (const e of bar?.querySelectorAll("[data-hearth-own], [data-house-add]") ?? []) e.hidden = !owner;
    if (!owner && settings) settings.open = false;
  }
  // the settings panel is a <details>: it opens and closes by itself; a click elsewhere or Escape closes it too
  const settings = bar?.querySelector("[data-hearth-settings]") ?? null;
  if (settings) {
    document.addEventListener("click", (e) => { if (settings.open && !settings.contains(e.target)) settings.open = false; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && settings.open) { settings.open = false; settings.querySelector("summary")?.focus(); } });
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
    if (bar) paintReadingMark(bar, ctx.reading);
    mountPicker();
    paintHouse(stage, reads, ctx);
    paintExtras(stage, reads, extras, ctx);
    drawV2();
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
    startScript(entry);
    if (picker) { picker.value = entry.id; paintListbox(pickerRoot); }
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
    const sort = t.closest("[data-hx-feed-sort]");
    if (sort) { ctx.feedSort = sort.getAttribute("data-hx-feed-sort"); drawV2(); }
  });
  // A RESIDENT'S WINDOW ASKS, THE PAGE DECIDES (the resident page's own bridge, Household.astro): a pane in the windows slot may ask to move the page to a
  // site path. Its sandbox makes its origin opaque, so it is known by SOURCE: only one of this stage's own window frames is heard.
  window.addEventListener?.("message", (ev) => {
    const frames = [...stage.querySelectorAll('[data-hearth-slot="windows"] [data-win-frame]')];
    if (!frames.some((f) => ev.source === f.contentWindow)) return;
    const d = ev.data;
    if (!d || d.type !== "nav" || typeof d.path !== "string") return;
    if (!/^\/[a-zA-Z0-9._~\/-]*(\?[a-zA-Z0-9=&._~-]*)?$/.test(d.path) || d.path.startsWith("//")) return;
    window.location.href = d.path;
  });
  stage.addEventListener("change", (e) => {
    const sel = e.target instanceof Element ? e.target.closest("[data-hd-who]") : null;
    if (sel) { ctx.filter.who = sel.value; draw(); }
  });
  // THE DROPDOWN (POS-962): a preview draws another entry and keeps only the address (never a save); the save is picker.mjs's green check.
  // It binds for EVERY reader, once, after the choice read has answered (or failed): anyone may preview. What only the house's own human has is the
  // check and the x, which picker.mjs shows when `signedIn()` holds: a sign-in that holds one of this house's residents, and never on a failed read (the kept
  // choice is not known then, so nothing is offered to save over it). A visitor's keep() does nothing.
  const pickerRoot = root.querySelector("[data-hearth-picker]");
  // the dropdown is drawn as a listbox, so a scripted design carries its badge (listbox.mjs): bound now, disabled until the picker mounts (it mirrors the select)
  if (pickerRoot) bindListbox(pickerRoot);
  const api = officeOrigin();
  function mountPicker() {
    if (mounted || !pickerRoot || !savedDone) return;
    mounted = mountHearthPicker(pickerRoot, {
      entries, slug: key, saved: readOk ? (savedRead ?? null) : baked, token, api,
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
    // the picker's kept design is the saved choice now (a green check moves it): a design the house just kept acts at once, without a reload
    if (mounted) knownSaved = mounted.picker.view().savedId ?? null;
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
    startScript(first);
    root.dataset.hearthShowing = first.id;
    say(asked && asked !== first.id ? `No Hearth entry is registered as “${asked.slice(0, 40)}”; showing ${first.title}.` : "");
  } else compose(asked, { asked });   // whichDesign answers for "nothing asked": the default today, a saved choice later (POS-962 folds it into the one function)
  load();
  // v2: the public bundle and the hung windows, each once; a part draws when its answer lands, and the script hears "bundle"
  readHearthBundle(key).then((b) => { bundle = b; scriptState.bundle = b; drawV2(); if (b) emit(listeners, "bundle", b); });
  readHungWindows(handles).then((h) => { hung = h; drawV2(); });

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
    if (picker && drawn) { picker.value = drawn.id; paintListbox(pickerRoot); }
  });
}
