// stage.mjs — the Hearth page's script: compose an entry, read the house, paint the slots (POS-959).
//
// The page is server-rendered with the default entry, so the house's baked public face is there
// without a script. This runs after, and does four things:
//
//   CHOOSE   asks the ONE selector, which-design.mjs § whichDesign, which entry to draw: a preview (`?entry=`, the picker), else the house's SAVED
//            choice (the office keeps it; read signed out, choice.mjs), else the default. A preview is never saved; the picker's save is the one write (POS-962).
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
import { readHouse, readHearthExtras, officeOrigin } from "../household-dashboard/reads.mjs";
import { paintHouse, writeLook } from "../household-dashboard/paint.mjs";
import { paintExtras, startCountdown } from "./paint.mjs";
import { mountBehaviors } from "./behaviors.mjs";
import { whichDesign } from "./which-design.mjs";
import { notYours, meAnswered } from "./not-yours.mjs";
import { mountBandBallots } from "./band-ballots.mjs";
import { designNote, readSavedHearth } from "./choice.mjs";
import { mountHearthPicker } from "./picker.mjs";

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
  let ballots = null;   // the band's open ballots and their stake form (band-ballots.mjs): mounted once, for the house's own sign-in only
  // THE SAVED CHOICE (POS-962). `baked` is the build's own copy (Hearth.astro bakes house.hearth from households.json, the registry readSavedHearth reads): the first
  // draw starts from it, so a house with a saved choice does not flash the default. The browser read corrects a stale one. `mounted` is the signed-in human's picker.
  const baked = root.dataset.hearthBaked || null;
  let knownSaved = baked;
  let mounted = null, readOk = false, savedRead, savedDone = false;

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
    // POS-502 in the band: only the house's own human loads the ballots and the stake form; a visitor never does
    if (band && ctx.owner && !ballots) {
      const section = band.querySelector("[data-hband-ballots]");
      if (section) ballots = mountBandBallots(section);
    }
    mountPicker();
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
  band?.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-hd-signin]")) document.querySelector("[data-auth-signin]")?.click();
  });
  stage.addEventListener("change", (e) => {
    const sel = e.target instanceof Element ? e.target.closest("[data-hd-who]") : null;
    if (sel) { ctx.filter.who = sel.value; draw(); }
  });
  // THE PICKER (POS-962): a preview draws another entry and keeps only the address (never a save); the save is picker.mjs's, behind a second yes.
  const pickerRoot = root.querySelector("[data-hearth-picker]");
  const api = officeOrigin();
  // The picker is the house's signed-in human's, and MOUNTS only for them, the way the ballots do (draw(), behind the owner, and again on pm:lens through load()):
  // for anyone else it is never bound, so a forced change or click does nothing. It also waits for the choice read to have answered: on a failed read there is no picker.
  function mountPicker() {
    if (mounted || !pickerRoot || !savedDone || !readOk || mine().length === 0) return;
    const section = pickerRoot.closest("[data-hband-hearth]");
    if (section) section.hidden = false;
    mounted = mountHearthPicker(pickerRoot, { entries, slug, saved: savedRead ?? null, token, api, signedIn: () => readOk && mine().length > 0, onDraw });
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
  document.addEventListener("pm:lens", () => { load(); mounted?.refresh(); });
  // a confirmed stake (the form raises pm:ballot-staked, bubbling): the band re-reads the ballot's stamps in place, and the house is
  // read again so Needs you, the cards and the numbers show the resident's new balance
  root.addEventListener("pm:ballot-staked", () => { ballots?.refresh(); readFor = ""; load(); });
  // the household page keeps this seat and a tab per resident: coming back to the seat draws it against the clock again
  document.addEventListener("pm:tab", (e) => { if (e.detail?.handle === "__house") draw(); });

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
  readSavedHearth({ handles, slug, api }).then((read) => {
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
