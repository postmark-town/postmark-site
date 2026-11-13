// picker.mjs — the Hearth dropdown, for every reader, and the house's own save (POS-962; the dropdown alone by POS-999 round 3).
//
// Darko, 2026-11-12 08:56 EST: "we also need to streamline/simplify the UI for hearth selection flow. there is a LOT of unnecessary ceremony and words. please
// reduce it to just the dropdown -> if you select a different one, green checkbox vs red x. we don't need words explaining obvious things". 08:57: "it's missing
// the arguably ONE important thing: listing Designed by {author}".
//
// Two halves, so the logic is testable without a browser:
//
//   createPicker(opts)        a small state machine: what is drawn, what is kept. PURE: the one write is the `save` function it is handed (choice.mjs §
//                             saveHearth), and only `keep()`, the green check, ever calls it.
//   mountHearthPicker(root)   binds a `[data-hearth-picker]` element (components/hearth/HearthPicker.astro draws it) to a picker.
//
// A CHOICE IN THE DROPDOWN IS A PREVIEW, NEVER A SAVE: it changes only what is drawn. While the dropdown shows a design other than the kept one, the house's own
// signed-in human has two buttons beside it: the check (keep(), the one write) and the x (back(), the dropdown and the drawing go back to the kept design).
// Who may save is the OFFICE's decision, made at the write; `signedIn` here only decides whether the two buttons show. No sentence explains any of it: the one
// line of words is the design's credit, `author` from its own record, for the design the dropdown shows. A save that does not land keeps the two buttons and
// marks the dropdown, with its reason in a status (and the check's title); a refusal the owner must read (401, 403: the office's own words) is also one line.
//
// CALLER CONTRACT, for the household page's strip (stage.mjs § mountPicker):
//   const picker = createPicker({ entries, slug, saved, save, onDraw, signedIn, shown }); // saved: id | null (choice.mjs § readSavedHearth); shown: the design on screen now
//   picker.preview(id) -> draw `id` (not saved)    picker.keep() -> the save    picker.back() -> draw the kept design again    picker.view() -> what to paint
//   `onDraw(id)` is called whenever the drawn entry changes (a preview, a successful save, a back): redraw the house with whichDesign.

import { DEFAULT_ENTRY } from "./slots.mjs";
import { saveHearth } from "./choice.mjs";

// the words an owner must read when the office refuses: who may choose (403), and signing in (401)
const MUST_READ = new Set([401, 403]);

// `slug` is the house's registry KEY: the save goes to it.
export function createPicker({ entries = [], slug, saved = null, save, onDraw = () => {}, signedIn = false, shown: drawn = null } = {}) {
  const isIn = () => (typeof signedIn === "function" ? Boolean(signedIn()) : Boolean(signedIn));   // the sign-in can change under a mounted picker
  const known = (id) => entries.some((e) => e.id === id);
  let savedId = saved && saved !== DEFAULT_ENTRY && known(saved) ? saved : null;   // what is actually kept
  // what is drawn: the design the page is already showing when the picker mounts (a `?entry=` preview is on screen before the picker binds), else the kept one
  let shown = drawn && known(drawn) ? drawn : (savedId ?? DEFAULT_ENTRY);
  let busy = false;
  let failed = null;   // { message, say }: the last save did not land (say: the line an owner must read, or "")

  const kept = () => savedId ?? DEFAULT_ENTRY;
  const view = () => {
    const changed = shown !== kept();
    return {
      slug, shown, savedId, changed, busy, failed,
      author: entries.find((e) => e.id === shown)?.author || null,
      controls: isIn(),
      pending: isIn() && changed,          // the check and the x show
      canKeep: isIn() && changed && !busy,
    };
  };

  return {
    view,
    /** Draw `id` (a registered entry) as a preview. Nothing is saved, nothing is sent. */
    preview(id) {
      if (!known(id) || busy) return view();
      shown = id; failed = null;
      onDraw(shown);
      return view();
    },
    /** The green check: the ONE write, of what the dropdown shows. */
    async keep() {
      if (!isIn() || busy || shown === kept()) return view();
      busy = true; failed = null;
      const r = await save({ slug, id: shown === DEFAULT_ENTRY ? null : shown });
      busy = false;
      if (r.ok) {
        savedId = r.hearth && known(r.hearth) ? r.hearth : null;
        shown = kept();
        onDraw(shown);
      } else {
        // not landed, or not known to have landed (an unconfirmed save says so in its own words, never "not saved": POS-962 lead FIX)
        failed = { message: r.message, say: !r.unconfirmed && MUST_READ.has(r.status) ? r.message : "" };
      }
      return view();
    },
    /** The red x: the dropdown and the drawing go back to the kept design. Nothing is sent. */
    back() {
      if (busy || shown === kept()) return view();
      shown = kept(); failed = null;
      onDraw(shown);
      return view();
    },
  };
}

/** Bind a `[data-hearth-picker]` element (HearthPicker.astro) to a picker. Returns the picker and a `refresh()`. */
export function mountHearthPicker(root, { entries, slug, saved, token, api, signedIn, onDraw, shown, fetchImpl } = {}) {
  const picker = createPicker({
    entries, slug, saved, signedIn, onDraw, shown,
    save: ({ slug: s, id }) => saveHearth({ slug: s, id, token: typeof token === "function" ? token() : token, api, fetchImpl }),
  });
  const q = (sel) => root.querySelector(sel);
  const select = q("[data-hearth-pick]");
  const $ = { by: q("[data-hearth-by]"), acts: q("[data-hearth-acts]"), keep: q("[data-hearth-keep]"), back: q("[data-hearth-back]"), refused: q("[data-hearth-refused]"), said: q("[data-hearth-said]") };
  if (select) select.disabled = false;   // the page ships it disabled: it answers a change only once the picker is bound (HearthPicker.astro)
  const paint = () => {
    const v = picker.view();
    if (select) {
      select.value = v.shown;
      if (v.failed) select.setAttribute("aria-invalid", "true"); else select.removeAttribute("aria-invalid");
    }
    if ($.by) { $.by.textContent = v.author ? `Designed by ${v.author}` : ""; $.by.hidden = !v.author; }
    if ($.acts) $.acts.hidden = !v.pending;
    for (const b of [$.keep, $.back]) if (b) b.disabled = v.busy;
    if ($.keep) { if (v.failed) $.keep.title = v.failed.message; else $.keep.removeAttribute("title"); }
    if ($.refused) { $.refused.textContent = v.failed?.say ?? ""; $.refused.hidden = !v.failed?.say; }
    if ($.said) $.said.textContent = v.failed?.message ?? "";
    root.dataset.hearthSaved = v.savedId ?? "";
  };
  select?.addEventListener("change", () => { picker.preview(select.value); paint(); });
  $.keep?.addEventListener("click", async () => { const p = picker.keep(); paint(); await p; paint(); });
  $.back?.addEventListener("click", () => { picker.back(); paint(); });
  paint();
  return { picker, refresh: paint };
}
