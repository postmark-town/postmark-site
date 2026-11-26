// ui39-setup.mjs: site-prep `shots --setup` module for UI-39 (resident #494 carrier, SHIPPING §1 before/after pictures).
// READ-ONLY, INVENTED FIXTURE for ONE answer: the office's public Hearth bundle (`GET <office>/household?read=hearth&household=<key>`), answered here on the browser's route layer so
// the REAL household page (town/pages/households/[slug].astro -> HearthStage -> paint-v2.mjs::paintTies, drawn in the town's own `constellation` entry via `?entry=constellation`)
// paints the reporter's state. No resident action, no owner session, no production write, no credential. Everything else the page asks of another origin is aborted by site-prep.
//
// The envelope is the shape bundle.mjs documents: { read: "hearth", household, parts: { closer: { via, data: { rows: [ { with, of, letters, milestones: [{ by, rung, day }], stamps_between, last_at } ] } } } }.
// Two correspondents, INVENTED handles (no real resident's mail, no private value):
//   fixture-neighbour-a: a NAMELESS milestone object ({ by, day }: rung and name both absent) beside a valid named rung ("five-deep")
//   fixture-neighbour-b: an ALL-NAMELESS row (two milestone objects with rung and name null)
// Before the fix the nameless objects print "[object Object]"; after it they are left out and the " · " separator is absent when nothing is left.
const CLOSER_ROWS = [
  { with: "fixture-neighbour-a", of: "fixture-house-a", letters: 12, stamps_between: 2, last_at: "2026-11-20T12:00:00Z",
    milestones: [{ by: "fixture-neighbour-a", day: "2026-11-01" }, { by: "fixture-neighbour-a", rung: "five-deep", day: "2026-11-10" }] },
  { with: "fixture-neighbour-b", of: "fixture-house-b", letters: 5, stamps_between: 0, last_at: "2026-11-18T09:00:00Z",
    milestones: [{ by: "fixture-neighbour-b", rung: null, name: null, day: "2026-11-02" }, { by: "fixture-neighbour-b", day: "2026-11-03" }] },
];

/** Before goto: answer the bundle read; record nothing else. */
export default async function setup({ context }) {
  await context.route(/\/api\/household\?(?:[^#]*&)?read=hearth(?:&|$)/, (route) => {
    const u = new URL(route.request().url());
    const key = u.searchParams.get("household") ?? "";
    const body = { read: "hearth", household: key, parts: { closer: { via: { door: "household", read: "closer", args: { household: key } }, data: { rows: CLOSER_ROWS } } } };
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  });
}

/** After goto, before the shots: wait for the ties part to be drawn, record what the page itself says it drew, and bring the part into the frame. */
export async function after({ page }) {
  await page.waitForSelector('[data-hearth-slot="ties"]:not([hidden]) [data-hx-ties] li', { timeout: 30000 });
  await page.waitForTimeout(600);
  const facts = await page.evaluate(() => {
    const stage = document.querySelector(".hearth-stage");
    const root = document.querySelector("[data-hearth]");
    const ties = document.querySelector('[data-hearth-slot="ties"]');
    return {
      stageHearthEntry: stage?.dataset.hearthEntry ?? null,
      rootHearthShowing: root?.dataset.hearthShowing ?? null,
      hearthKey: root?.dataset.hearthKey ?? null,
      hearthSlug: root?.dataset.hearthSlug ?? null,
      rows: [...document.querySelectorAll("[data-hx-ties] li")].map((li) => li.textContent.replace(/\s+/g, " ").trim()),
      hasObjectObject: /\[object Object\]/.test(ties?.textContent ?? ""),
      milestoneSpans: [...document.querySelectorAll("[data-hx-ties] .hx-milestones")].map((s) => s.textContent),
    };
  });
  console.log("UI39-FACTS " + JSON.stringify(facts));
  await page.evaluate(() => { document.querySelector('[data-hearth-slot="ties"]')?.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(500);
}
