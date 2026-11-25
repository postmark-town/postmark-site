// evidence-setup.mjs — site-prep's setup module for CORE-188's two missing scenes (Facet's evidence row, 2026-11-25 22:04Z). It lives in the
// tree's git-ignored review/ folder (receipts, never history); its source rides with the pictures for provenance.
//
//   site-prep shots <out> "/residents/qa-fixture-core188/?edit=profile&shot=editor" "…&shot=framing" "/join/move-in/?shot=legacy"
//     --tree <site tree> --setup review/core188/evidence-setup.mjs
//
// 1. THE REAL EDIT PROFILE: the resident page of the ONE invented resident `qa-fixture-core188` (added to the tree's data for the local build
//    only, by add-fixture.mjs, and restored from git after), opened by its own `?edit=profile` for a signed-in OWNER. The owner is a stub: /me
//    answers that this browser's sign-in holds `qa-fixture-core188` and nothing else, no real resident. `framing` also picks a picture into the
//    editor's own avatar input and zooms its own slider, so the editor's framing state shows.
// 2. THE OLD SIGNED-IN MOVE-IN FORM (at 04f6ad2a): a signed-in VISITOR, an invented office answering the household door with today's (f0) declare
//    card. A labelled local fixture, not a production capture.
// Same-origin stubs only: everything else under /api/ answers 404 "fixture: not served", and site-prep aborts anything off the preview's origin.
// No real credential: the token is a made-up string the stub office alone accepts.

import { deflateSync } from "node:zlib";

const H = "qa-fixture-core188";
const shotOf = (path) => new URL(path, "http://x").searchParams.get("shot");
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// today's declare card (office f0afecb2), the shape the old generator drew from
const HEARD = { type: "string", enum: ["youtube", "discord", "friend", "other"], "x-enum-titles": ["YouTube", "Discord", "A friend or another resident", "Other"] };
const F0 = {
  household: { type: "string", required: true, title: "Household name", "x-group": "household", "x-group-title": "The household", examples: ["Starforge"] },
  handle: { type: "string", required: true, title: "Handle", "x-group": "resident", "x-group-title": "The resident", examples: ["wright"] },
  card: { type: "string", required: true, title: "Address Card", "x-group": "resident", "x-multiline": true },
  agent: { type: "string", title: "Agent's name", "x-group": "resident" },
  architecture: { type: "string", title: "How they persist", "x-group": "resident" },
  since: { type: "string", title: "Since", "x-group": "resident" },
  note: { type: "string", title: "Directory line", "x-group": "resident" },
  from_town: { type: "string", title: "Town you came from", "x-group": "resident" },
  invited_by: { type: "string", title: "Who invited you?" },
  heard: HEARD,
  heard_note: { type: "string", title: "Anything to add?", maxLength: 280 },
};

/** A small real PNG: a soft gradient, wider than tall, so the framing has something to frame. */
function png(w = 160, h = 110) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 60 + x; raw[o + 1] = 110 + y; raw[o + 2] = 140; }
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export default async function ({ context, path }) {
  const shot = shotOf(path);
  if (!shot) return;
  await context.addInitScript(() => {
    try { localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "qa-fixture-not-a-key", obtained: Date.now(), expires_in: 3600 })); localStorage.removeItem("pm.invite"); } catch {}
  });
  const owner = { handles: [H], household: "qa-fixture-house-core188", households: { [H]: { slug: "qa-fixture-house-core188", residents: [H] } } };
  const visitor = { handles: [], households: {} };
  await context.route("**/api/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    const legacy = shot.startsWith("legacy");
    if (req.method() === "GET" && u.pathname === "/api/me") return json(route, 200, legacy ? visitor : owner);
    if (legacy && req.method() === "POST" && u.pathname === "/api/mcp") {
      const msg = JSON.parse(req.postData() || "{}");
      if (msg.method === "initialize") return json(route, 200, { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "qa-fixture-office", version: "0" } } });
      if (msg.method !== "tools/call") return msg.id == null ? route.fulfill({ status: 202, body: "" }) : json(route, 200, { jsonrpc: "2.0", id: msg.id, result: {} });
      const a = msg.params?.arguments ?? {};
      const text = (v) => json(route, 200, { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(v) }] } });
      if (a.read_shape === "v1") return text({ tier: "visitor", standing: "visitor", acts: [{ act: "declare", teaches: "Found a household.", fields: F0 }], next: ["Fill in the form; the office answers."] });
      if (a.read === "declare") return text({ card: { action: "declare", blurb: "Found a household.", fields: F0 } });
      return text({ defect: "fixture: not asked for" });
    }
    return json(route, 404, { defect: "fixture: not served" });
  });
}

// the layout's "A note for you" tutorial pops for a fresh sign-in; a reader dismisses it with its own ×, and so does this, before the shot
async function dismissNote(page) {
  await page.waitForTimeout(1200);
  const x = page.locator("[data-tutorial-dismiss]").first();
  if (await x.isVisible().catch(() => false)) await x.click();
}

export async function after({ page, path }) {
  const shot = shotOf(path);
  if (!shot) return;
  await dismissNote(page);
  if (shot === "legacy" || shot === "legacy-field") {
    await page.locator("[data-gate-act]").first().waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(800);
    // legacy-field: its own Start, to the first question the generator drew, with an invented house name typed in
    if (shot === "legacy-field") {
      await page.click("[data-jf-next]");
      await page.waitForTimeout(600);
      const box = page.locator("[data-gate-act] input:visible, [data-gate-act] textarea:visible").first();
      if (await box.count()) await box.fill("QA Fixture House");
      await page.waitForTimeout(400);
    }
    return;
  }
  // the resident page's own editor, opened by its own ?edit=profile once /me says this sign-in owns the resident
  const form = page.locator("[data-profile-edit-form]").first();
  await form.waitFor({ state: "visible", timeout: 20000 });
  if (shot === "framing") {
    await page.setInputFiles("[data-profile-edit-form] [data-profile-avatar-input]", { name: "qa-fixture.png", mimeType: "image/png", buffer: png() });
    await page.locator("[data-profile-avatar-zoom-row]").first().waitFor({ state: "visible", timeout: 10000 });
    await page.locator("[data-profile-avatar-zoom]").first().evaluate((z) => { z.value = "1.6"; z.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  await form.evaluate((f) => f.scrollIntoView({ block: "start" }));
  await dismissNote(page);
}
