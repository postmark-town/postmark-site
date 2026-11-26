// ui40-setup.mjs: site-prep `shots --setup` module for UI-40 (resident #510 carrier, SHIPPING §1 before/after pictures).
// READ-ONLY, INVENTED FIXTURE for ONE answer: the office's house aggregate (`GET <office>/household?read=house&household=<key>&full=true`),
// answered here on the browser's route layer so the REAL household page (default Hearth: the `needs-you` and `mail` slots) paints the reported
// state. The sign-in is a labelled fixture too: a made-up browser-storage entry that no server ever sees (every request that leaves the preview's
// origin and is not answered below is aborted by site-prep). No real credential, no resident act, no production write, no private value.
//
// The scene is chosen by the page's own query, `?ui40=five`, `?ui40=partial` or (UI-40 FIX) `?ui40=unavailable`; the house is the registry's `reeves` (five residents),
// so five doorsteps repeat the same household-wide marks, which is the reporter's #4679. The counts and mark ids below are INVENTED.
const HOUSE = "reeves";
const HANDLES = ["caelum-reeves", "callan-reeves", "isaiah-reeves", "lumen-reeves", "sage-reeves"];
const MARKS = ["fixture/mark-1", "fixture/mark-2", "fixture/mark-3", "fixture/mark-4", "fixture/mark-5"];

const base = () => ({ awaiting: { summary: { new_inbound: 0 } }, stamps: {} });

// five: every doorstep carries the SAME five complete household-wide marks (the office repeats a household's scope on each resident)
const five = () => Object.fromEntries(HANDLES.map((h) => [h, {
  ...base(),
  stances: { stances_awaiting: 5, stances_awaiting_ground: "household", awaiting: MARKS.map((mark) => ({ mark })), complete: true },
}]));

// partial: two doorsteps report the household's five but carry a SHORT page (one mark each, complete: false); the other three carry no stance count at all
const partial = () => Object.fromEntries(HANDLES.map((h, i) => [h, i < 2
  ? { ...base(), stances: { stances_awaiting: 5, stances_awaiting_ground: "household", awaiting: [{ mark: MARKS[i] }], complete: false } }
  : { ...base() }]));

// unavailable (UI-40 FIX, at 38b74200): the same five residents, every doorstep ANSWERED, none carrying a stance count. Not "still reading":
// no read is outstanding, so the page says the count is unavailable (its zero-disclosure line), not "Still reading the house's record…"
const unavailable = () => Object.fromEntries(HANDLES.map((h) => [h, { ...base() }]));

const SCENES = { five, partial, unavailable };
const sceneOf = (path) => (new URL(path, "https://preview.invalid").searchParams.get("ui40")) || "five";

/** Before goto: a fixture sign-in (browser storage only) and the one house answer. */
export default async function setup({ context, path }) {
  await context.addInitScript((handles) => {
    try {
      window.localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "ui40-invented-fixture-signin", obtained: Date.now(), expires_in: 86400 }));
      window.sessionStorage.setItem("pm.oauth.handles", JSON.stringify(handles));
    } catch { /* storage refused: the page then draws its signed-out view */ }
  }, HANDLES);
  const residents = SCENES[sceneOf(path)]();
  await context.route(/\/api\/household\?(?:[^#]*&)?read=house(?:&|$)/, (route) =>
    route.fulfill({
      status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ read: "house", household: HOUSE, residents, outboxes: {}, quests: {} }),
    }));
}

/** After goto, before the shots: wait for both views to be drawn, record what the page itself says, and bring Needs you into the frame. */
export async function after({ page, path }) {
  await page.waitForSelector('[data-hearth-slot="needs-you"]:not([hidden])', { timeout: 30000 });
  await page.waitForSelector('[data-hearth-slot="mail"]:not([hidden])', { timeout: 30000 });
  // the answered state, never the in-flight one: wait until Needs you no longer says it is still reading
  await page.waitForFunction(() => !/still reading/i.test(document.querySelector('[data-hearth-slot="needs-you"]')?.textContent ?? ""), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const facts = await page.evaluate(() => {
    const root = document.querySelector("[data-hearth]");
    const t = (sel) => (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      hearthKey: root?.dataset.hearthKey ?? null,
      hearthShowing: root?.dataset.hearthShowing ?? null,
      needsYou: t('[data-hearth-slot="needs-you"]'),
      mail: t('[data-hearth-slot="mail"]'),
    };
  });
  console.log("UI40-FACTS " + JSON.stringify({ scene: sceneOf(path), ...facts }));
  // UI-40 FIX: a bounded computed-style reading of the note inside the Needs you card, on this real default Hearth: its colour and opacity,
  // the card paper behind it, and the WCAG contrast of the blended ink. Then the same reading with the FIX's one rule
  // (`.hearth-stage .hd-needs .hd-empty`) taken out of the live stylesheet (the revert control), and again after it is put back at its index.
  // The shots below are taken after the rule is restored; the reading prints in UI40-INK.
  const ink = await page.evaluate(() => {
    const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
    const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const read = () => [...document.querySelectorAll('[data-hearth-slot="needs-you"] .hd-empty')].map((el) => {
      const cs = getComputedStyle(el);
      let op = 1, bgEl = el, bg = null;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = getComputedStyle(n), b = rgba(c.backgroundColor);
        if (n !== el && b && b.a === 1) { bgEl = n; bg = b; break; }
        op *= Number(c.opacity);
      }
      const fg = rgba(cs.color), a = fg.a * op;
      const shown = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
      const [hi, lo] = [lum(shown), lum(bg)].sort((x, y) => y - x);
      return { text: el.textContent.trim(), color: cs.color, opacity: cs.opacity, effectiveAlpha: +a.toFixed(3), fontSize: cs.fontSize, fontStyle: cs.fontStyle,
        background: getComputedStyle(bgEl).backgroundColor, backgroundOf: bgEl.className, shown: `rgb(${shown.r.toFixed(1)}, ${shown.g.toFixed(1)}, ${shown.b.toFixed(1)})`,
        contrast: +((hi + 0.05) / (lo + 0.05)).toFixed(2) };
    });
    const SEL = ".hearth-stage .hd-needs .hd-empty";
    // the build merges the FIX selector into the meta line's rule (same declarations): take out only the FIX selector, keep the rest
    let sheet = null, index = -1, text = null, others = null;
    for (const s of document.styleSheets) { let rules; try { rules = s.cssRules; } catch { continue; }
      for (let i = 0; i < rules.length; i++) { const sels = (rules[i].selectorText ?? "").split(",").map((x) => x.trim());
        if (sels.includes(SEL)) { sheet = s; index = i; text = rules[i].cssText; others = sels.filter((x) => x !== SEL); break; } }
      if (sheet) break; }
    const fixed = read();
    if (!sheet) return { fixed, control: "the FIX rule was not found in the live stylesheets" };
    sheet.deleteRule(index);
    if (others.length) sheet.insertRule(text.replace(/^[^{]*/, others.join(", ") + " "), index);
    const reverted = read();
    if (others.length) sheet.deleteRule(index);
    sheet.insertRule(text, index);
    return { rule: text, fixed, reverted, restored: read() };
  });
  console.log("UI40-INK " + JSON.stringify({ scene: sceneOf(path), ...ink }));
  // `&view=mail` brings the Mail slot into the frame instead (the two views sit apart on the page)
  const slot = new URL(path, "https://preview.invalid").searchParams.get("view") === "mail" ? "mail" : "needs-you";
  await page.evaluate((s) => { document.querySelector(`[data-hearth-slot="${s}"]`)?.scrollIntoView({ block: "start" }); }, slot);
  await page.waitForTimeout(400);
}
