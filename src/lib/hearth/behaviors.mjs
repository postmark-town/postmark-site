// behaviors.mjs — the Hearth's approved behaviors that wrap a template's own markup (POS-959).
//
// A template cannot carry script (sanitize-html.mjs strips it, and its CSS cannot load any). What
// it CAN do is ask for one of the site's own reviewed behaviors by an attribute the sanitizer
// allows: `data-hearth-behavior="tabs" | "accordion" | "sort"`. This file is those behaviors, and
// the only script a Hearth runs besides the slots'. The three that draw the house's live data
// (the residents map, the stamps chart, the crossing countdown) are slots, drawn by paint.mjs.
//
//   tabs       children with data-tab="Title" become tabs, one panel showing; arrow keys, Home, End
//   accordion  children with data-panel="Title" become panels that open and close; data-single keeps one open
//   sort       children carry data-sort-<key>; data-sort-keys="a,b" adds a switcher that reorders them
//
// Residents may propose a new behavior by PR, reviewed as site code (Darko, 2026-11-01 20:21 EST:
// "yes"): it joins this file, BEHAVIORS in slots.mjs, the sanitizer's allowlist and the README.
//
// Nothing here reads a template's text as markup: titles and values are set by textContent.

let uid = 0;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export function mountTabs(box) {
  const panels = [...box.children].filter((c) => c.hasAttribute("data-tab"));
  if (panels.length < 2) return false;
  const n = ++uid;
  const list = el("div", "hx-tablist");
  list.setAttribute("role", "tablist");
  const tabs = panels.map((p, i) => {
    const b = el("button", "hx-tab", p.getAttribute("data-tab"));
    b.type = "button";
    b.setAttribute("role", "tab");
    b.id = `hx-tab-${n}-${i}`;
    p.id = `hx-panel-${n}-${i}`;
    p.setAttribute("role", "tabpanel");
    p.setAttribute("aria-labelledby", b.id);
    b.setAttribute("aria-controls", p.id);
    list.appendChild(b);
    return b;
  });
  const show = (k, focus = false) => {
    tabs.forEach((b, i) => {
      const on = i === k;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[k].focus();
  };
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => show(i));
    b.addEventListener("keydown", (e) => {
      const last = tabs.length - 1;
      const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
        : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
        : e.key === "Home" ? 0 : e.key === "End" ? last : null;
      if (to == null) return;
      e.preventDefault();
      show(to, true);
    });
  });
  box.insertBefore(list, box.firstChild);
  box.classList.add("is-tabbed");
  show(0);
  return true;
}

export function mountAccordion(box) {
  const panels = [...box.children].filter((c) => c.hasAttribute("data-panel"));
  if (!panels.length) return false;
  const single = box.hasAttribute("data-single");
  const n = ++uid;
  const items = panels.map((p, i) => {
    const head = el("button", "hx-acc-head", p.getAttribute("data-panel"));
    head.type = "button";
    head.id = `hx-acc-${n}-${i}`;
    p.id = `hx-accp-${n}-${i}`;
    p.setAttribute("role", "region");
    p.setAttribute("aria-labelledby", head.id);
    head.setAttribute("aria-controls", p.id);
    box.insertBefore(head, p);
    return { head, p };
  });
  const set = (it, open) => { it.head.setAttribute("aria-expanded", open ? "true" : "false"); it.p.hidden = !open; };
  items.forEach((it, i) => {
    set(it, i === 0);
    it.head.addEventListener("click", () => {
      const open = it.head.getAttribute("aria-expanded") !== "true";
      if (open && single) items.forEach((o) => { if (o !== it) set(o, false); });
      set(it, open);
    });
  });
  box.classList.add("is-accordion");
  return true;
}

export function mountSort(box) {
  const keys = (box.getAttribute("data-sort-keys") || "").split(",").filter(Boolean);
  const rows = [...box.children].filter((c) => keys.some((k) => c.hasAttribute("data-sort-" + k)));
  if (!keys.length || rows.length < 2) return false;
  const original = rows.slice();
  const wrap = el("label", "hx-sort");
  wrap.appendChild(el("span", "hx-sort-label", "Sort by "));
  const sel = el("select", "hx-sort-select");
  const add = (value, text) => { const o = el("option", null, text); o.value = value; sel.appendChild(o); };
  add("", "as listed");
  for (const k of keys) { add(k, k); add(k + ":desc", k + " ↓"); }
  wrap.appendChild(sel);
  box.parentNode?.insertBefore(wrap, box);
  const val = (r, k) => r.getAttribute("data-sort-" + k) ?? "";
  sel.addEventListener("change", () => {
    const [k, dir] = sel.value.split(":");
    let order = original;
    if (k) {
      const numeric = original.every((r) => val(r, k) !== "" && Number.isFinite(Number(val(r, k))));
      const cmp = numeric ? (a, b) => Number(val(a, k)) - Number(val(b, k)) : (a, b) => val(a, k).localeCompare(val(b, k));
      order = original.slice().sort((a, b) => (dir ? -cmp(a, b) : cmp(a, b)));
    }
    for (const r of order) box.appendChild(r);
  });
  return true;
}

/** Mount every behavior marker under `stage`. Safe to call on a freshly composed stage. */
export function mountBehaviors(stage) {
  for (const box of stage.querySelectorAll('[data-hearth-behavior="tabs"]')) mountTabs(box);
  for (const box of stage.querySelectorAll('[data-hearth-behavior="accordion"]')) mountAccordion(box);
  for (const box of stage.querySelectorAll('[data-hearth-behavior="sort"]')) mountSort(box);
}
