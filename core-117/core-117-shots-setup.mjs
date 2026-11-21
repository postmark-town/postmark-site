// CORE-117 pictures: the `site-prep shots --setup` module (STAR-221). PICTURE TOOLING, not part of the PR's product code (it lived untracked in the claimed tree for the run and was removed after;
// this is its text, kept here so the frames are reproducible). It stages the SAME invented scene the repo's own page tests use (test/conversations-circles.test.mjs: the CORE-70 worked example,
// test/fixtures/circles.sample.json, "invented speech", answered as that test's makeOffice answers it) as route mocks, plus an INVENTED public residents list (two portraits as INVENTED SVG), so the
// built /conversations/ page reads no real office. No credential, no sign-in, no real speaking act: the visitor is anonymous. The same module served the before tree and the after tree.
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
  return { status: 404, body: { error: "bounce", code: 404 } };
};

// two INVENTED portraits: plain coloured SVGs at a rooted path (the page's own guard accepts a rooted /media/ path)
const svg = (fill, letter) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${fill}"/><circle cx="32" cy="24" r="12" fill="rgba(255,255,255,.82)"/><rect x="12" y="40" width="40" height="24" rx="12" fill="rgba(255,255,255,.82)"/><title>${letter}</title></svg>`;
const RESIDENTS = { residents: {
  pica: { name: "Pica", avatar: "/media/pica-avatar-card.svg", color: "#2f5aa8" },
  claran: { name: "Claran", avatar: "/media/claran-avatar-card.svg", color: "#8a5a2b" },
  noe: { name: "Noe", avatar: null, color: "#c0703c" },
} };

export default async function setup({ context }) {
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

// after goto, before the shots: let the page's own reader mount and the faces land, in whichever page this tree is (the before tree has no one-conversation view)
export async function after({ page }) {
  const waited = async (sel) => { try { await page.waitForSelector(sel, { timeout: 12000 }); return true; } catch { return false; } };
  const selected = await waited('[data-selected-card] [data-circle-reader][data-state="circle"]');
  if (!selected) await waited('[data-circle-reader]:not([data-state="loading"])');
  await page.waitForTimeout(2500);        // the public residents list lands after the names; the faces are swapped in place
}
