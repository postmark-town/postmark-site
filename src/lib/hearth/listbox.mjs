// listbox.mjs — the Hearth dropdown as a small listbox, so a design that runs its own script carries a badge beside its name (Darko, 2026-11-13).
//
// THE RULING (Darko, 2026-11-13 13:24 EST): "any hearths that have any scripting in it needs to be disclosed ... via a little badge next to the hearth's
// name in the dropdown. Let's put it to the right. And on hover ... not using the browser Chrome hover, I mean like an actual site UI pane hover ...
// super concise ... the site has other scripts. Postmark does review them, but use at your own risk."
//
// WHY NOT THE NATIVE <select>: an <option> holds text only, so it cannot carry a badge or a pane of its own. So the dropdown is drawn as a select-only
// combobox (WAI-ARIA's pattern: a button with role="combobox", a role="listbox" of role="option"s, focus kept on the button and the active option named by
// aria-activedescendant). THE NATIVE SELECT STAYS, hidden, as the one source of truth: choosing an option sets `select.value` and fires its `change`, which
// picker.mjs already hears, and whatever sets `select.value` (picker.mjs's paint, stage.mjs's compose) calls paintListbox(root) after. So the picker's
// logic and its tests are unchanged; this file only draws the select differently.
//
// THE BADGE is on every design whose script the page would run (script.mjs § scriptUrlOf: the same test that decides whether it runs), never on one
// without: in the list beside the design's name, and beside the current design's name outside the list. Hover, keyboard focus or a tap opens one small
// pane in the site's own colours (not a `title`); a tap elsewhere, Escape or moving away closes it. In the list, an option's badge is hidden from a screen
// reader and the option is described by the pane's sentence instead, so it is read once, in words.
//
// Two halves, so the keys are testable without a browser: createListbox (the state machine, PURE) and bindListbox (the DOM).

import { scriptUrlOf } from "./script.mjs";

/** The sentence the pane says (Darko 13:24: "super concise"). One copy: HearthPicker.astro renders it, a test reads it. */
export const SCRIPT_NOTE = "This design runs its own script. Postmark reviews every line, but use it at your own risk.";
/** The badge's one word. */
export const SCRIPT_BADGE = "script";

/** Does this design carry the badge? Exactly when its script would run on the page (scriptUrlOf answers an address). */
export function isScripted(entry) {
  return scriptUrlOf(entry) !== null;
}

const PAGE = 10;
const TYPE_PAUSE_MS = 600;

/**
 * The listbox's state: which option is active, whether the list is open, and what a key does. `options` is [{ id, title, scripted }], `value` the
 * chosen id. key(k, { alt, now }) answers { handled, chose } where `chose` is an id to choose (the caller sets the select) or null.
 */
export function createListbox({ options = [], value = null } = {}) {
  const ids = options.map((o) => o.id);
  const at = (id) => Math.max(0, ids.indexOf(id));
  let open = false;
  let active = at(value);
  let typed = "", typedAt = -Infinity;
  const clamp = (i) => Math.min(Math.max(i, 0), Math.max(ids.length - 1, 0));

  const view = () => ({ open, active, activeId: ids[active] ?? null, value, options });
  const show = (i = at(value)) => { open = ids.length > 0; active = clamp(i); };
  const close = () => { open = false; active = at(value); };
  function typeahead(ch, now) {
    typed = now - typedAt > TYPE_PAUSE_MS ? ch : typed + ch;
    typedAt = now;
    const want = typed.toLowerCase();
    const repeat = want.length > 1 && [...want].every((c) => c === want[0]);   // "ggg" cycles the g's, as a native select does
    const needle = repeat ? want[0] : want;
    const from = repeat || want.length === 1 ? active + 1 : active;
    for (let k = 0; k < ids.length; k++) {
      const i = (from + k) % ids.length;
      if (String(options[i].title ?? options[i].id).toLowerCase().startsWith(needle)) return i;
    }
    return active;
  }

  function pick(i) { const id = ids[clamp(i)] ?? null; if (id) value = id; close(); return { chose: id }; }

  return {
    view,
    setValue(id) { if (ids.includes(id)) value = id; if (!open) active = at(value); return view(); },
    toggle() { if (open) close(); else show(); return view(); },
    openAt(i) { show(i); return view(); },
    close() { close(); return view(); },
    /** Choose option `i` (a click): the list closes; the caller sets the select when `chose` differs from the value. */
    pick,
    key(k, { alt = false, now = Date.now() } = {}) {
      const printable = typeof k === "string" && k.length === 1 && k !== " ";
      if (!open) {
        if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") { show(); return { handled: true, chose: null }; }
        if (k === "Home") { show(0); return { handled: true, chose: null }; }
        if (k === "End") { show(ids.length - 1); return { handled: true, chose: null }; }
        if (printable) { show(); active = typeahead(k, now); return { handled: true, chose: null }; }
        return { handled: false, chose: null };
      }
      if (k === "ArrowUp" && alt) return { handled: true, chose: pick(active).chose };
      switch (k) {
        case "ArrowDown": active = clamp(active + 1); return { handled: true, chose: null };
        case "ArrowUp": active = clamp(active - 1); return { handled: true, chose: null };
        case "Home": active = 0; return { handled: true, chose: null };
        case "End": active = clamp(ids.length - 1); return { handled: true, chose: null };
        case "PageDown": active = clamp(active + PAGE); return { handled: true, chose: null };
        case "PageUp": active = clamp(active - PAGE); return { handled: true, chose: null };
        case "Enter": case " ": return { handled: true, chose: pick(active).chose };
        case "Escape": close(); return { handled: true, chose: null };
        case "Tab": close(); return { handled: false, chose: null };   // focus moves on, as it would from a native select; nothing is chosen
        default:
          if (printable) { active = typeahead(k, now); return { handled: true, chose: null }; }
          return { handled: false, chose: null };
      }
    },
  };
}

const BOUND = new WeakMap();

/** The parts of a picker root (HearthPicker.astro). Any may be missing (a page with one design has no list). */
function partsOf(root) {
  const q = (s) => root?.querySelector?.(s) ?? null;
  return {
    select: q("[data-hearth-pick]"), wrap: q("[data-hearth-lb]"), btn: q("[data-hearth-lb-btn]"), label: q("[data-hearth-lb-label]"),
    list: q("[data-hearth-lb-list]"), now: q("[data-hearth-script-now]"), tip: q("[data-hearth-script-tip]"),
    opts: [...(root?.querySelectorAll?.("[data-hearth-lb-list] [data-value]") ?? [])],
  };
}

/**
 * Draw the listbox from the select (its value, whether it is enabled, whether a save marked it), or, before it is bound, at least the current design's
 * name and badge. Called after anything sets the select's value. Safe on a root with no listbox.
 */
export function paintListbox(root) {
  const bound = BOUND.get(root);
  if (bound) { bound.paint(); return; }
  const p = partsOf(root);
  if (!p.select) return;
  const cur = p.opts.find((o) => o.dataset.value === p.select.value);
  if (p.label && cur) p.label.textContent = cur.dataset.title ?? cur.textContent;
  if (p.now) p.now.hidden = !(cur && cur.hasAttribute("data-scripted"));
}

/**
 * Bind a picker root's listbox to its select. Returns the instance ({ model, paint, tip }) or null when the root has no listbox. Binding twice returns the
 * first. The select is hidden here (it ships visible for a reader without scripts, disabled, as before).
 */
export function bindListbox(root, { doc = globalThis.document, win = globalThis.window } = {}) {
  if (BOUND.has(root)) return BOUND.get(root);
  const p = partsOf(root);
  if (!p.select || !p.wrap || !p.btn || !p.list || !p.opts.length) return null;
  const options = p.opts.map((o) => ({ id: o.dataset.value, title: o.dataset.title ?? o.textContent, scripted: o.hasAttribute("data-scripted") }));
  const model = createListbox({ options, value: p.select.value });

  // THE PANE: one, shared by every badge. `pinned` holds it open after a tap or click until a tap elsewhere or Escape.
  let tipFor = null, pinned = false, keyboard = false;
  const inList = (el) => !!el && p.opts.some((o) => o.contains?.(el));
  // under the current design's badge; for a badge in the open list, beside the list (so it covers no option), else under the list's badge
  function placeTip(badge) {
    if (!p.tip || !badge?.getBoundingClientRect || !root.getBoundingClientRect) return;
    const b = badge.getBoundingClientRect(), band = root.getBoundingClientRect();
    const w = p.tip.offsetWidth || 240;
    const vw = win?.innerWidth ?? 1024;
    let left = Math.min(Math.max(b.left, 8), Math.max(8, vw - w - 8)), top = b.bottom + 6;
    if (inList(badge) && p.list.getBoundingClientRect) {
      const l = p.list.getBoundingClientRect();
      if (l.right + 8 + w <= vw - 8) { left = l.right + 8; top = b.top - 4; }
      else if (l.left - 8 - w >= 8) { left = l.left - 8 - w; top = b.top - 4; }
    }
    p.tip.style.left = `${Math.round(left - band.left)}px`;
    p.tip.style.top = `${Math.round(top - band.top)}px`;
  }
  function showTip(badge, { pin = false } = {}) {
    if (!p.tip) return;
    tipFor = badge; pinned = pin;
    p.tip.hidden = false;
    placeTip(badge);
  }
  function hideTip() { if (!p.tip) return; p.tip.hidden = true; tipFor = null; pinned = false; }

  function placeList() {
    if (!p.list.getBoundingClientRect) return;
    p.list.style.left = "0px";
    const r = p.list.getBoundingClientRect();
    const vw = win?.innerWidth ?? 1024;
    if (r.right > vw - 8) p.list.style.left = `${Math.round(vw - 8 - r.right)}px`;
  }

  function paint() {
    model.setValue(p.select.value);
    const v = model.view();
    p.btn.disabled = !!p.select.disabled;
    if (p.select.getAttribute?.("aria-invalid") === "true") p.btn.setAttribute("aria-invalid", "true"); else p.btn.removeAttribute("aria-invalid");
    p.btn.setAttribute("aria-expanded", v.open ? "true" : "false");
    const cur = v.options.find((o) => o.id === v.value);
    if (p.label && cur) p.label.textContent = cur.title;
    if (p.now) p.now.hidden = !cur?.scripted;
    if (tipFor === p.now && p.now?.hidden) hideTip();
    p.list.hidden = !v.open;
    p.opts.forEach((o, i) => {
      o.setAttribute("aria-selected", o.dataset.value === v.value ? "true" : "false");
      o.classList?.toggle("is-active", v.open && i === v.active);
    });
    const act = v.open ? p.opts[v.active] : null;
    if (act) { p.btn.setAttribute("aria-activedescendant", act.id); act.scrollIntoView?.({ block: "nearest" }); placeList(); }
    else p.btn.removeAttribute("aria-activedescendant");
    // the keyboard's way to the pane in the list: while the list is worked by keys, the active option's badge shows it, until the active option moves to one
    // without (a pointer has hover and the tap instead, so a click that opens the list opens no pane over it)
    const actBadge = keyboard ? act?.querySelector?.("[data-hearth-script]") ?? null : null;
    if (actBadge && !(pinned && tipFor !== actBadge)) showTip(actBadge, { pin: pinned && tipFor === actBadge });
    else if (inList(tipFor) && (!v.open || (keyboard && !pinned))) hideTip();
  }

  function choose(id) {
    if (id && id !== p.select.value) {
      p.select.value = id;
      p.select.dispatchEvent?.(new Event("change", { bubbles: true }));   // picker.mjs hears it, exactly as it heard the native select
    }
    paint();
  }

  p.select.hidden = true;
  p.wrap.hidden = false;

  p.btn.addEventListener("click", (e) => {
    if (p.btn.disabled) return;
    if (e?.detail !== 0) keyboard = false;   // a pointer's click (a key's synthetic click has detail 0, and its keydown already set keyboard)
    model.toggle(); paint();
  });
  p.btn.addEventListener("keydown", (e) => {
    if (p.btn.disabled) return;
    keyboard = true;
    if (e.key === "Escape" && tipFor && !model.view().open) { hideTip(); e.preventDefault(); return; }
    const r = model.key(e.key, { alt: e.altKey });
    if (r.handled) e.preventDefault();   // Enter and Space would otherwise click the button too
    if (r.chose) choose(r.chose); else paint();
  });
  p.btn.addEventListener("blur", () => { if (model.view().open) { model.close(); paint(); } });
  p.opts.forEach((o, i) => {
    o.addEventListener("mousedown", (e) => e.preventDefault());   // keep focus on the button while a click chooses
    o.addEventListener("click", (e) => {
      if (e.target?.closest?.("[data-hearth-script]")) return;   // a click on the badge is the pane's, not a choice
      const r = model.pick(i); choose(r.chose); p.btn.focus?.();
    });
  });

  // the badges: the current design's (a button: hover, focus and a tap) and each option's (a mark: hover and a tap)
  const badges = [p.now, ...p.opts.map((o) => o.querySelector?.("[data-hearth-script]"))].filter(Boolean);
  for (const b of badges) {
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !pinned) showTip(b); });
    b.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !pinned && tipFor === b) hideTip(); });
    b.addEventListener("click", (e) => {
      e.stopPropagation(); e.preventDefault?.();
      if (pinned && tipFor === b) hideTip(); else showTip(b, { pin: true });
    });
  }
  if (p.now) {
    p.now.addEventListener("focus", () => { if (!pinned) showTip(p.now); });
    p.now.addEventListener("blur", () => { if (!pinned && tipFor === p.now) hideTip(); });
    p.now.addEventListener("keydown", (e) => { if (e.key === "Escape" && tipFor) { hideTip(); e.preventDefault(); } });
  }
  // a tap or click anywhere else closes the pane and the list
  doc?.addEventListener?.("pointerdown", (e) => {
    const t = e.target;
    if (tipFor && !badges.some((b) => b.contains?.(t)) && !p.tip?.contains?.(t)) hideTip();
    if (model.view().open && !p.wrap.contains?.(t)) { model.close(); paint(); }
  });
  doc?.addEventListener?.("keydown", (e) => { if (e.key === "Escape" && tipFor) hideTip(); });
  win?.addEventListener?.("resize", () => { if (tipFor) placeTip(tipFor); });

  const inst = { model, paint, tip: { show: showTip, hide: hideTip, get for() { return tipFor; }, get pinned() { return pinned; } } };
  BOUND.set(root, inst);
  paint();
  return inst;
}
