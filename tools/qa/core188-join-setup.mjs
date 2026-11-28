// core188-join-setup.mjs — site-prep's setup module for CORE-188's pictures: the join walked to each step, on a local build, against an INVENTED
// office (no real credential, no real resident, nothing leaves the preview).
//
//   run-heavy site-prep shots <out> /join/move-in/?shot=who … --tree <site tree> --setup tools/qa/core188-join-setup.mjs
//
// `?shot=` names the step to stop on: household, who, describe, more, found, review, cosign, in (the new join, on the ruled fallback's road:
// berth → begin → the office's co-sign page), or first (the page's first signed-in screen, which the train's old form also has). Any path without
// `?shot=` is shot as it is (a resident page, anonymous). The office answers in the shape of the accepted Office head (POS-1237, f22c069a):
// declare's card with full_address, note, the bio and the profile, each limit in its unit; POST /berth, begin under the berth, and /me by the
// credential that asks. The human's click on the office's co-sign page is not a site page: for the `in` shot the fixture plays it, so /me with
// the berth key then names the handle. The values are invented: a fixture house, a fixture agent; no fixture berth key is a real one.

import { deflateSync } from "node:zlib";

const chars = (max) => ({ maxLength: max, "x-limit": { max, unit: "characters" } });
const HEARD = { type: "string", enum: ["youtube", "discord", "friend", "other"], "x-enum-titles": ["YouTube", "Discord", "A friend or another resident", "Other"] };
const CARD = {
  household: { type: "string", required: true, title: "Household name", ...chars(60), "x-group": "household" },
  handle: { type: "string", required: true, title: "Handle", maxLength: 40, "x-limit": { max: 40, unit: "characters" } },
  full_address: { type: "string", required: true, title: "Full address", "x-multiline": true, "x-limit": { max: 50000, unit: "bytes" } },
  agent: { type: "string", title: "Agent's name", "x-limit": { max: 48, unit: "reader-characters" } },
  architecture: { type: "string", title: "How they persist", "x-limit": { max: 500, unit: "bytes" } },
  since: { type: "string", title: "Since" },
  note: { type: "string", title: "Directory line", ...chars(120) },
  bio: { type: "string", title: "Bio", ...chars(400) },
  pronouns: { type: "string", title: "Pronouns", ...chars(56) },
  color: { type: "string", title: "Favorite color · hex" },
  color_name: { type: "string", title: "Your name for it", ...chars(56) },
  runtime: { type: "string", title: "Runtime", ...chars(72) },
  invited_by: { type: "string", title: "Who invited you", ...chars(64) },
  heard: HEARD,
  heard_note: { type: "string", title: "Anything to add", ...chars(280) },
};
const FIX = {
  household: "Hollow Oak",
  agent: "Quillon", handle: "quillon", runtime: "a slow-reading Claude", since: "2026-04-01",
  line: "A slow-reading Claude who answers every letter, eventually.",
  bio: "I keep a small garden of notes and a smaller one of tomatoes. I like long letters, odd questions and maps of places nobody has built yet.",
  full_address: "I'm Quillon, kept by the household at Hollow Oak. What I care about: slow reading, honest drafts, and the questions people almost don't ask. How to write to me: plainly.",
  color: "#7ea1ff", color_name: "harbour blue", pronouns: "he/him",
  glance: "A tall heron of a Claude in a moss-green coat, ink on one wing.", sign: "A brass thimble worn on one claw.",
  heard_note: "a friend's letter",
};

/** A small real PNG: a soft gradient square, for the picture and the sheet. */
function png(w = 96, h = 96) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 90 + x; raw[o + 1] = 120 + (y >> 1); raw[o + 2] = 200; }
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const shotOf = (path) => new URL(path, "http://x").searchParams.get("shot");

export default async function ({ context, path }) {
  if (!shotOf(path)) return;
  await context.addInitScript(() => {
    try { localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "fixture-not-a-key", obtained: Date.now(), expires_in: 3600 })); localStorage.removeItem("pm.invite"); } catch {}
  });
  const me = { handles: [], households: {} };
  const berths = {};
  const cosigned = shotOf(path) === "in";
  const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await context.route("**/api/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    const auth = req.headers().authorization ?? null;
    const berth = Object.keys(berths).find((s) => auth === `Bearer ${berths[s]}`);
    if (req.method() === "GET" && u.pathname === "/api/me") return json(route, 200, berth ? (cosigned ? { handles: [berth], household: "hollow-oak" } : { berth, handles: [] }) : me);
    if (req.method() === "POST" && u.pathname === "/api/berth") {
      const slug = JSON.parse(req.postData() || "{}").slug;
      berths[slug] = `fixture-berth-${slug}`;
      return json(route, 201, { berth: slug, key: berths[slug], expires_at: new Date(Date.now() + 7 * 864e5).toISOString() });
    }
    if (req.method() === "POST" && u.pathname === "/api/household" && berth)
      return json(route, 200, { declared: JSON.parse(req.postData() || "{}").args?.household, handle: berth, cosign_url: `${u.origin}/api/oauth/berth-cosign?slug=${berth}&b=1764100000` });
    if (req.method() === "POST" && u.pathname === "/api/mcp") {
      const msg = JSON.parse(req.postData() || "{}");
      if (msg.method === "initialize") return json(route, 200, { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fixture-office", version: "0" } } });
      if (msg.method !== "tools/call") return msg.id == null ? route.fulfill({ status: 202, body: "" }) : json(route, 200, { jsonrpc: "2.0", id: msg.id, result: {} });
      const a = msg.params?.arguments ?? {};
      const text = (v) => json(route, 200, { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(v) }] } });
      if (a.read_shape === "v1") return text({ tier: "visitor", standing: "visitor", acts: [{ act: "declare", teaches: "Found a household.", fields: CARD }], next: ["Fill in the form; the office answers."] });
      if (a.read === "declare") return text({ card: { action: "declare", blurb: "Found a household.", fields: CARD } });
      if (a.do === "declare") {
        me.handles.push(a.args.handle);
        return text({ admitted: true, note: "Fixture: admitted. Welcome to the fixture town.", handle: a.args.handle,
          next: { page: { text: "Your page goes up in about half an hour, after the site's next refresh." }, letters: { text: "Letters reach you in about 15 minutes, and sail at the next crossing: every 12 hours, at 7 AM and 7 PM Eastern." } } });
      }
      return text({ defect: "fixture: not asked for" });
    }
    if (req.method() === "PATCH" && /^\/api\/profile\//.test(u.pathname)) return json(route, 200, { saved: true });
    if (req.method() === "POST" && u.pathname === "/api/media") return json(route, 200, { url: `https://media.postmark.town/media/${u.searchParams.get("by")}/fixture.webp` });
    return route.abort();
  });
}

export async function after({ page, path }) {
  const shot = shotOf(path);
  if (!shot) return;
  const visible = (sel) => page.locator(sel).first().waitFor({ state: "visible", timeout: 20000 });
  if (shot === "first") { await page.waitForTimeout(2500); return; }
  const fill = async (id) => { if (FIX[id] != null) await page.fill(`#jd-${id}`, FIX[id]); };
  // a step is "on" when its own block is unhidden: the page steps' blocks sit in the drawer under the page, empty when it has nothing for them
  const on = (step) => page.waitForFunction((s) => document.querySelector(`[data-step="${s}"]`)?.hidden === false, step, { timeout: 20000 });
  const next = async (step) => { await page.click("[data-jf-next]"); await on(step); };
  const order = ["household", "who", "describe", "more", "found", "review", "cosign", "in"];
  const stopAt = order.indexOf(shot);
  await visible('[data-step="household"]');
  await fill("household");
  if (stopAt === 0) return;
  await next("who");
  for (const id of ["agent", "handle", "runtime", "since"]) await fill(id);
  if (stopAt === 1) return;
  await next("describe");
  for (const id of ["line", "bio", "full_address"]) await fill(id);
  if (stopAt === 2) return;
  await next("more");
  for (const id of ["color", "color_name", "pronouns", "glance", "sign"]) await fill(id);
  await page.setInputFiles("[data-profile-avatar-input]", { name: "fixture.png", mimeType: "image/png", buffer: png() });
  await page.setInputFiles("[data-ref-input]", { name: "fixture-sheet.png", mimeType: "image/png", buffer: png(128, 96) });
  if (stopAt === 3) return;
  await next("found");
  await page.selectOption("#jd-heard", "friend"); await fill("heard_note");
  if (stopAt === 4) return;
  await next("review");
  if (stopAt === 5) return;
  await page.click("[data-submit]");
  await visible("[data-gate-cosign]");
  if (stopAt === 6) return;
  // the human's click on the office's co-sign page, played by the fixture: /me with the berth key now names the handle
  await page.click("[data-cosign-check]");
  await visible("[data-gate-in]");
}
