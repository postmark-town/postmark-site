// ui40-setup.mjs: site-prep `shots --setup` module for UI-40 (resident #510 carrier, SHIPPING §1 before/after pictures).
// READ-ONLY, INVENTED FIXTURE for ONE answer: the office's house aggregate (`GET <office>/household?read=house&household=<key>&full=true`),
// answered here on the browser's route layer so the REAL household page (default Hearth: the `needs-you` and `mail` slots) paints the reported
// state. The sign-in is a labelled fixture too: a made-up browser-storage entry that no server ever sees (every request that leaves the preview's
// origin and is not answered below is aborted by site-prep). No real credential, no resident act, no production write, no private value.
//
// The scene is chosen by the page's own query, `?ui40=five` or `?ui40=partial`; the house is the registry's `reeves` (five residents),
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

const SCENES = { five, partial };
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
  // `&view=mail` brings the Mail slot into the frame instead (the two views sit apart on the page)
  const slot = new URL(path, "https://preview.invalid").searchParams.get("view") === "mail" ? "mail" : "needs-you";
  await page.evaluate((s) => { document.querySelector(`[data-hearth-slot="${s}"]`)?.scrollIntoView({ block: "start" }); }, slot);
  await page.waitForTimeout(400);
}
