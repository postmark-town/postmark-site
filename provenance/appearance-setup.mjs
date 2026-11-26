// appearance-setup.mjs — site-prep's setup module for CORE-188's appearance delta (Wright's three companions, 2026-11-26). It lives in the tree's
// git-ignored review/ folder (receipts, never history); its source rides with the pictures for provenance.
//
//   site-prep shots <out> "/join/move-in/?shot=more" "/join/move-in/?shot=review" "/join/move-in/?shot=in" "/join/move-in/?shot=in-refused"
//     --tree <site tree> --setup review/core188/appearance-setup.mjs
//
// An INVENTED settled keeper (`qa-fixture-keeper-core188`, house `qa-fixture-keep-core188`) adds an invented resident (`qa-fixture-looked-core188`)
// through the household door's add-resident act, so the walk needs no berth: the invented office answers the bare read, the act's card, the send,
// /me (which holds the new handle once the act admits it) and the world door's describe. `in-refused` plays the harbor's own refusal of the glance
// (office harbor-gate.mjs § HARBOR_BOUNCE). No real resident, no real credential: the token is a made-up string only this stub accepts.
// Before (train 23d0b5e8) has only the two sentences; the hook fills only the boxes the page draws.

const KEEPER = "qa-fixture-keeper-core188", NEW = "qa-fixture-looked-core188";
const shotOf = (path) => new URL(path, "http://x").searchParams.get("shot");
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
const ADD = { handle: { type: "string", required: true, maxLength: 40 }, card: { type: "string", required: true, title: "Address Card", "x-multiline": true }, agent: { type: "string" }, note: { type: "string" } };

export default async function ({ context, path }) {
  const shot = shotOf(path);
  if (!shot) return;
  await context.addInitScript(() => {
    try { localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "qa-fixture-not-a-key", obtained: Date.now(), expires_in: 3600 })); localStorage.removeItem("pm.invite"); localStorage.removeItem("mcp-proto.history"); } catch {}
  });
  let admitted = false;
  await context.route("**/api/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === "GET" && u.pathname === "/api/me")
      return json(route, 200, { handles: admitted ? [KEEPER, NEW] : [KEEPER], household: "qa-fixture-keep-core188", households: { [KEEPER]: { slug: "qa-fixture-keep-core188" } } });
    if (req.method() === "POST" && u.pathname === "/api/mcp") {
      const msg = JSON.parse(req.postData() || "{}");
      if (msg.method === "initialize") return json(route, 200, { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "qa-fixture-office", version: "0" } } });
      if (msg.method !== "tools/call") return msg.id == null ? route.fulfill({ status: 202, body: "" }) : json(route, 200, { jsonrpc: "2.0", id: msg.id, result: {} });
      const a = msg.params?.arguments ?? {};
      const text = (v) => json(route, 200, { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(v) }] } });
      if (a.read_shape === "v1") return text({ tier: "resident", standing: "resident", acts: [{ act: "add-resident", teaches: "Add a resident to your house.", fields: ADD }], next: ["Fill in the form; the office answers."] });
      if (a.read === "add-resident") return text({ card: { action: "add-resident", blurb: "Add a resident to your house.", fields: ADD } });
      if (a.do === "add-resident") { admitted = true; return text({ admitted: true, note: "Fixture: admitted. Welcome to the fixture town.", handle: a.args?.handle ?? null }); }
      return text({ defect: "fixture: not asked for" });
    }
    if (req.method() === "POST" && u.pathname === "/api/world/apex") {
      if (shot === "in-refused") return json(route, 403, { defect: "the harbor is read + ephemeral", hint: "durable acts come ashore with settlement" });
      const x = JSON.parse(req.postData() || "{}").args ?? {};
      return json(route, 200, { described: x.slot === "appearance" ? `${x.handle}/appearance` : `${x.handle}/appearance.${x.slot}`, canon: "live" });
    }
    return json(route, 404, { defect: "fixture: not served" });
  });
}

async function dismissNote(page) {
  await page.waitForTimeout(1000);
  const x = page.locator("[data-tutorial-dismiss]").first();
  if (await x.isVisible().catch(() => false)) await x.click();
}
const visible = (page, sel) => page.locator(sel).first().waitFor({ state: "visible", timeout: 20000 });
async function fillIf(page, sel, value) { if (await page.locator(sel).count()) await page.fill(sel, value); }

export async function after({ page, path }) {
  const shot = shotOf(path);
  if (!shot) return;
  await dismissNote(page);
  await visible(page, '[data-step="who"]');
  await page.fill("#jd-handle", NEW);
  await fillIf(page, "#jd-agent", "QA Looked");
  await page.click("[data-jf-next]");
  await visible(page, '[data-step="describe"]');
  await page.fill("#jd-full_address", "An invented resident for CORE-188's appearance pictures. Not a resident of the town.");
  await page.click("[data-jf-next]");
  await visible(page, '[data-step="more"]');
  await page.fill("#jd-glance", "A fixture lantern with a cracked pane, glowing amber.");
  await fillIf(page, "#jd-glance_value", "a fixture lantern");
  await page.fill("#jd-sign", "The crack runs corner to corner across the front pane.");
  await fillIf(page, "#jd-sign_slot", "Front Pane");
  await fillIf(page, "#jd-sign_value", "cracked glass");
  if (shot === "more") {
    await page.locator("#jd-glance").evaluate((e) => e.closest("label").scrollIntoView({ block: "start" }));
    await page.focus("#jd-sign_slot").catch(() => {});
    await page.waitForTimeout(300);
    return;
  }
  await page.click("[data-jf-next]");
  await visible(page, '[data-step="review"]');
  if (shot === "review") {
    await page.locator("[data-review-after]").evaluate((e) => e.scrollIntoView({ block: "start" })).catch(() => {});
    await page.waitForTimeout(300);
    return;
  }
  await page.click("[data-submit]");
  await visible(page, "[data-gate-reply]");
  await page.click("[data-show-in]");
  await visible(page, "[data-gate-in]");
  await page.locator("[data-in-after]").evaluate((e) => e.scrollIntoView({ block: "start" })).catch(() => {});
  await page.waitForTimeout(300);
}
