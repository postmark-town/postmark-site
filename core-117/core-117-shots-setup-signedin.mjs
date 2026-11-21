// CORE-117 pictures (corrective phase): the `site-prep shots --setup` module (STAR-221). PICTURE TOOLING, not part of the PR's product code (it lives untracked in the claimed tree
// for the run and is removed after; its text is archived in the pictures branch). It stages the SAME invented scene the repo's own page tests use
// (test/conversations-circles.test.mjs: the CORE-70 worked example, test/fixtures/circles.sample.json, "invented speech", answered as that test's makeOffice answers it) as route mocks,
// plus an INVENTED public residents list (two portraits as INVENTED SVG), so the built /conversations/ page reads no real office.
// SIGNED IN AS AN INVENTED TEST HOUSEHOLD: the page's own signed-in test identity (the same stored shape `openPage({ signedIn: true })` writes in the repo's Chrome tests, with a plainly
// invented placeholder value, NOT a credential), and the mocked /me read ("claran" of "test-house"). /world/say is answered by the mock and is never pressed: no real speaking act.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FX = JSON.parse(readFileSync(join(ROOT, "test/fixtures/circles.sample.json"), "utf8"));
const ROOM = "t1794686460000-pica";
const ROOM_B = "t1794690000000-noe";
const FLAT = FX.views.flat_lines;
const voicesOf = (lines = FLAT) => lines.map((l) => ({ handle: l.handle, standing: l.standing, said: l.said, at: l.at, at_ms: l.at_ms, ...(l.id ? { id: l.id } : {}) }));
const thread = (over = {}) => ({
  id: ROOM, live: true, place: "Cave Interior", at: { x: 0, y: 0 }, started: "2026-11-14T20:01:00.000Z", latest: "2026-11-14T20:14:00.000Z",
  voice_count: 14, participants: [...new Set(FLAT.map((l) => l.handle))], voices: voicesOf(), ...over,
});
const roomHeader = (id = ROOM) => ({ id, live: true, place: "Cave Interior", at: { x: 0, y: 0 }, aboard: false, extent: { x0: 0, y0: 0, x1: 0, y1: 0 }, started: "2026-11-14T20:01:00.000Z", latest: "2026-11-14T20:14:00.000Z", participants: ["pica", "seth", "claran"], voice_count: 14 });
const roomFind = (id = ROOM, over = {}) => ({ now: 1, earshot_m: 60, settlement_since: "2026-11-14T06:00:00.000Z", find: { room: roomHeader(id), history: "complete", source: "record", circles: FX.views.spectator, ...over } });
const WHOLE = FX.views.default_claran.lines;
const circlePage = (n) => {
  const first = n === 1;
  const lines = first ? WHOLE.slice(0, 6) : WHOLE.slice(6);
  return { now: 1, earshot_m: 60, find: { circle: 50101, ...(first ? {} : { after: WHOLE[5].id }), history: "complete", source: "record", room: roomHeader(), circle_read: { circle: 50101, path: [50101], says: 10, people: 5, lines, next: first ? { circle: 50101, after: WHOLE[5].id } : null, complete: !first, budget: { bytes: 8192, used: 3000 } }, sparks: null } };
};
const LIVE = [thread({ id: ROOM }), thread({ id: ROOM_B, place: "The Quay", at: { x: 5, y: 5 }, voice_count: 3, voices: voicesOf().slice(0, 3), participants: ["pica", "seth"], latest: "2026-11-14T20:12:00.000Z" })];
const conversations = (threads, closed = []) => ({ now: 1, earshot_m: 60, settlement_since: "2026-11-14T06:00:00.000Z", live: threads, closed, pinned: [], earlier: { source: "memory", remaining: 0, before: null } });

const office = (method, path) => {
  if (path.startsWith("/world/conversations?closed=")) return { status: 200, body: conversations(LIVE, []) };
  if (path.startsWith("/world/conversations?room=")) return { status: 200, body: roomFind(decodeURIComponent(path.split("room=")[1])) };
  let m;
  if ((m = /^\/world\/conversations\?circle=(\d+)(?:&after=(\d+))?$/.exec(path))) return { status: 200, body: circlePage(m[2] ? 2 : 1) };
  if (path === "/world/conversations") return { status: 200, body: conversations(LIVE, []) };
  if (path === "/me") return { status: 200, body: { handles: ["claran"], household: "test-house", households: { claran: { slug: "test-house" } } } };
  if (path === "/world/say" && method === "POST") return { status: 200, body: { spoke: true, where: { place: "Cave Interior" }, listeners: ["pica"] } };
  return { status: 404, body: { error: "bounce", code: 404 } };
};

const svg = (fill, letter) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${fill}"/><circle cx="32" cy="24" r="12" fill="rgba(255,255,255,.82)"/><rect x="12" y="40" width="40" height="24" rx="12" fill="rgba(255,255,255,.82)"/><title>${letter}</title></svg>`;
const RESIDENTS = { residents: {
  pica: { name: "Pica", avatar: "/media/pica-avatar-card.svg", color: "#2f5aa8" },
  claran: { name: "Claran", avatar: "/media/claran-avatar-card.svg", color: "#8a5a2b" },
  noe: { name: "Noe", avatar: null, color: "#c0703c" },
} };
const DRAFT = "I'm catching up on the lemon one before I answer.";

export default async function setup({ context }) {
  // the page's own signed-in shape: a placeholder, plainly invented, never a credential
  await context.addInitScript(() => {
    try { localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-placeholder", obtained: Date.now(), expires_in: 3600 })); } catch { /* none */ }
  });
  await context.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const key = u.pathname.replace(/^\/api/, "") + u.search;
    const a = office(route.request().method(), key);
    await route.fulfill({ status: a.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(a.body) });
  });
  await context.route("**/world-engine/residents-meta.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESIDENTS) }));
  await context.route("**/media/pica-avatar-card.svg", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("#2f5aa8", "P") }));
  await context.route("**/media/claran-avatar-card.svg", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("#8a5a2b", "C") }));
}

// after goto, before the shots: let the page's own reader mount and the faces land, show the form with an invented unsent draft, and for the `roomstep` path press the
// reader's own "Back to the room" (whichever page this tree is: the before tree's card or the after tree's one view)
export async function after({ page, path }) {
  const waited = async (sel, ms = 12000) => { try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch { return false; } };
  const selected = await waited('[data-selected-card] [data-circle-reader][data-state="circle"]', 6000);
  if (!selected) await waited('[data-circle-reader]:not([data-state="loading"])');
  await waited("[data-say-form]:not([hidden])", 8000);
  await page.waitForTimeout(2500);        // the public residents list lands after the names; the faces are swapped in place
  if (String(path).includes("roomstep")) {
    const back = await page.$('[data-circle-reader][data-state="circle"] [data-back]');
    if (back) { await back.click(); await page.waitForTimeout(1500); }
  }
  try { await page.fill("[data-say-text]", DRAFT); } catch { /* the form is not here in this state */ }
  await page.waitForTimeout(300);
}
