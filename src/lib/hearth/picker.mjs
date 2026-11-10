// picker.mjs — the Hearth picker for the signed-in human, composable (POS-962).
//
// Two halves, so the logic is testable without a browser and the band host can wire the parts it wants:
//
//   createPicker(opts)        a small state machine: what is previewed, what is saved, what the controls say. PURE: the one write is the
//                             `save` function it is handed (choice.mjs § saveHearth), and only `confirm()` ever calls it.
//   mountHearthPicker(root)   binds a `[data-hearth-picker]` element (components/hearth/HearthPicker.astro draws it) to a picker.
//
// A PREVIEW IS NEVER A SAVE. preview(id) changes only what is drawn; saving takes two more steps by the human, ask() and then confirm(), in the
// site's own words (the site confirms the human's act: "Make X the Hearth everyone sees…?"). Who may save is the OFFICE's decision, made on the
// server at the write; `signedIn` here only decides whether the controls show, and a refused write puts the office's words on the page.
//
// CALLER CONTRACT, for the household page's band host (POS-984):
//   const picker = createPicker({ entries, slug, saved, save, onDraw });       // saved: id | null | undefined (choice.mjs § readSavedHearth)
//   picker.preview(id)            -> draw `id` (not saved)           picker.ask() -> the confirm question      picker.confirm() -> the save
//   picker.clear()                -> ask to go back to the default   picker.view() -> { ...labels and flags to render }
//   `onDraw(id)` is called whenever the drawn entry changes (a preview, a successful save, a clear): redraw the house with whichDesign.

import { DEFAULT_ENTRY } from "./slots.mjs";
import { saveHearth } from "./choice.mjs";

const titleOf = (entries, id) => entries.find((e) => e.id === id)?.title ?? id;

export function createPicker({ entries = [], slug, saved = null, save, onDraw = () => {}, signedIn = false } = {}) {
  const isIn = () => (typeof signedIn === "function" ? Boolean(signedIn()) : Boolean(signedIn));   // the sign-in can change under a mounted picker
  let savedId = saved && saved !== DEFAULT_ENTRY && entries.some((e) => e.id === saved) ? saved : null;   // what is actually saved
  let shown = savedId ?? DEFAULT_ENTRY;                                                                     // what is drawn
  let asking = null;                                                                                        // { id } while the human is being asked
  let busy = false;
  let said = "";                                                                                            // the office's word, or ours, after an act

  const view = () => {
    const previewing = shown !== (savedId ?? DEFAULT_ENTRY);
    return {
      slug, shown, savedId, previewing, asking: asking ? { id: asking.id, title: asking.id === null ? "the default" : titleOf(entries, asking.id) } : null,
      busy, said,
      savedLine: savedId ? `This house’s Hearth: ${titleOf(entries, savedId)}.` : "No Hearth chosen: this house uses the default.",
      previewLine: previewing ? `Previewing ${titleOf(entries, shown)}. It is not saved, and nothing is written.` : "",
      canSave: isIn() && previewing && !busy,
      canClear: isIn() && savedId !== null && !busy,
      controls: isIn(),
      question: asking ? (asking.id === null
        ? `Go back to the default Hearth for everyone who visits /households/${slug}/? You can choose again any time.`
        : `Make ${titleOf(entries, asking.id)} the Hearth everyone sees at /households/${slug}/? You can change it any time.`) : "",
    };
  };

  return {
    view,
    /** Draw `id` (a registered entry) as a preview. Nothing is saved, nothing is sent. */
    preview(id) {
      if (!entries.some((e) => e.id === id)) return view();
      shown = id; asking = null; said = "";
      onDraw(shown);
      return view();
    },
    /** The human asks to save what is previewed: only a question is raised. */
    ask() {
      if (!isIn() || busy || shown === (savedId ?? DEFAULT_ENTRY)) return view();
      asking = { id: shown === DEFAULT_ENTRY ? null : shown };
      return view();
    },
    /** The human asks to go back to the default: only a question is raised. */
    clear() {
      if (!isIn() || busy || savedId === null) return view();
      asking = { id: null };
      return view();
    },
    cancel() { asking = null; return view(); },
    /** The human confirms: the ONE write. */
    async confirm() {
      if (!asking || busy) return view();
      const id = asking.id;
      busy = true; said = "";
      const r = await save({ slug, id });
      busy = false; asking = null;
      if (r.ok) {
        savedId = r.hearth && entries.some((e) => e.id === r.hearth) ? r.hearth : null;
        shown = savedId ?? DEFAULT_ENTRY;
        said = savedId ? `Saved. ${titleOf(entries, savedId)} is now this house’s Hearth.` : "Saved. This house now uses the default Hearth.";
        onDraw(shown);
      } else {
        // an unconfirmed save may have landed: its words say so, never "Not saved" (POS-962 lead FIX)
        said = r.unconfirmed ? r.message : r.status === 403 ? `Not saved: ${r.message}` : `Not saved. ${r.message}`;
      }
      return view();
    },
  };
}

/** Bind a `[data-hearth-picker]` element (HearthPicker.astro) to a picker. Returns the picker and a `refresh()`. */
export function mountHearthPicker(root, { entries, slug, saved, token, api, signedIn, onDraw, fetchImpl } = {}) {
  const picker = createPicker({
    entries, slug, saved, signedIn, onDraw,
    save: ({ slug: s, id }) => saveHearth({ slug: s, id, token: typeof token === "function" ? token() : token, api, fetchImpl }),
  });
  const q = (sel) => root.querySelector(sel);
  const select = q("[data-hearth-pick]");
  const $ = {
    owner: q("[data-hearth-owner]"), savedLine: q("[data-hearth-saved]"), previewLine: q("[data-hearth-preview-line]"),
    save: q("[data-hearth-save]"), clear: q("[data-hearth-clear]"), confirm: q("[data-hearth-confirm]"), question: q("[data-hearth-question]"),
    yes: q("[data-hearth-confirm-yes]"), no: q("[data-hearth-confirm-no]"), said: q("[data-hearth-said]"),
  };
  const set = (el, text) => { if (el) { el.textContent = text; el.hidden = !text; } };
  const paint = () => {
    const v = picker.view();
    if (select) select.value = v.shown;
    if ($.owner) $.owner.hidden = !v.controls;
    set($.savedLine, v.savedLine); set($.previewLine, v.previewLine); set($.said, v.said);
    if ($.save) { $.save.hidden = !v.canSave; $.save.disabled = !v.canSave; }
    if ($.clear) { $.clear.hidden = !v.canClear; $.clear.disabled = !v.canClear; }
    if ($.confirm) $.confirm.hidden = !v.asking;
    if ($.question) $.question.textContent = v.question;
    for (const b of [$.yes, $.no]) if (b) b.disabled = v.busy;
    root.dataset.hearthSaved = v.savedId ?? "";
  };
  select?.addEventListener("change", () => { picker.preview(select.value); paint(); });
  $.save?.addEventListener("click", () => { picker.ask(); paint(); });
  $.clear?.addEventListener("click", () => { picker.clear(); paint(); });
  $.no?.addEventListener("click", () => { picker.cancel(); paint(); });
  $.yes?.addEventListener("click", async () => { const p = picker.confirm(); paint(); await p; paint(); });
  paint();
  return { picker, refresh: paint };
}
