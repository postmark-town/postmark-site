// shots-setup.mjs — site-prep's setup module for CORE-175's before/after pictures (sheet names on the appearance page). It lives in the tree's
// git-ignored review/ folder (receipts, never history); its source rides with the pictures for provenance.
//
//   site-prep shots <out> "/residents/qa-fixture-solo-core175/appearance/?shot=solo" "/residents/qa-fixture-core175/appearance/?shot=named" …
//     --tree <site tree> --setup review/core175/shots-setup.mjs
//
// The two residents are INVENTED (add-fixture.mjs puts them in the tree's data for the local build only; restored from git after):
// qa-fixture-core175 is one handle that is three people; qa-fixture-solo-core175 is one person. An invented office answers their card and sheet
// reads, /me and the profile PATCH under POS-1202's contract; the sheets are fixture images. The owner is a stub: /me says this browser's sign-in
// holds the invented handle and nothing else. No real resident, no real credential (the token is a made-up string only this stub accepts).
//
// shots: solo (visitor, one unnamed sheet) · named (visitor: two named, one town-made unnamed) · owner (the owner's boxes and the upload's name box)
//        · edit (the owner corrects sheet 1's name and saves) · toolong (81 characters, refused before the network) · refused (the office's 503 on a
//        save, the typed text kept) · upload (the upload's optional name typed) · upload-refused (the keep answers 503: the typed name kept)
//        · unavailable (the sheet read answers 503)

import { deflateSync } from "node:zlib";

const MANY = "qa-fixture-core175", SOLO = "qa-fixture-solo-core175";
const shotOf = (path) => new URL(path, "http://x").searchParams.get("shot");
const handleOf = (path) => /\/residents\/([^/]+)\//.exec(path)?.[1];
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

/** A fixture "sheet": a soft field with six lighter panels, 3 by 2, tinted per sheet. */
function sheetPng(tint, w = 600, h = 340) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3;
    const px = x % (w / 3), py = y % (h / 2);
    const panel = px > 14 && px < w / 3 - 14 && py > 14 && py < h / 2 - 14;
    const [r, g, b] = tint;
    raw[o] = panel ? Math.min(255, r + 70) : r; raw[o + 1] = panel ? Math.min(255, g + 70) : g; raw[o + 2] = panel ? Math.min(255, b + 70) : b;
  }
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (bb) => { let c = 0xffffffff; for (const x of bb) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const TINTS = { "julian.png": [92, 120, 150], "vex.png": [150, 110, 92], "town.png": [110, 140, 110], "one.png": [140, 125, 95] };
const media = (h, f) => `https://media.postmark.town/media/${h}/${f}`;

function sheetsFor(handle, shot) {
  if (handle === SOLO) return [{ id: "s1", url: media(SOLO, "one.png"), made_by: SOLO, made_at: "2026-11-20T10:00:00Z", own: true }];
  // the owner's states start with sheet 1 named and sheet 2 not, so a Clear and an unnamed box both show
  const owned = !["named"].includes(shot);
  return [
    { id: "s1", url: media(MANY, "julian.png"), made_by: MANY, made_at: "2026-11-20T10:00:00Z", own: true, name: "Julian" },
    { id: "s2", url: media(MANY, "vex.png"), made_by: MANY, made_at: "2026-11-21T10:00:00Z", own: true, ...(owned ? {} : { name: "Vex" }) },
    { id: "s3", url: media("the-town", "town.png"), made_by: "the-town", made_at: "2026-11-01T10:00:00Z", own: false },
  ];
}
const OWNER_SHOTS = new Set(["owner", "edit", "toolong", "refused", "upload", "upload-refused"]);

export default async function ({ context, path }) {
  const shot = shotOf(path), handle = handleOf(path);
  if (!shot || !handle) return;
  const owner = OWNER_SHOTS.has(shot);
  await context.addInitScript((signedIn) => {
    try {
      if (signedIn) localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "qa-fixture-not-a-key", obtained: Date.now(), expires_in: 3600 }));
      else localStorage.removeItem("pm.oauth.token");
    } catch {}
  }, owner);
  const sheets = sheetsFor(handle, shot);
  const shape = (s) => ({ id: s.id, url: s.url, made_by: s.made_by, made_at: s.made_at, own: s.own, ...(s.name ? { name: s.name } : {}) });
  await context.route("https://media.postmark.town/**", (route) => {
    const f = new URL(route.request().url()).pathname.split("/").pop();
    return route.fulfill({ status: 200, contentType: "image/png", body: sheetPng(TINTS[f] ?? [120, 120, 120]) });
  });
  await context.route("**/api/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    const h = encodeURIComponent(handle);
    if (req.method() === "GET" && u.pathname === `/api/residents/${h}`)
      return json(route, 200, { handle, appearance: { body: handle === SOLO ? "A single figure in a long coat, for the fixture." : "Three people share this fixture handle: Julian, Vex and Alaric." } });
    if (req.method() === "GET" && u.pathname === `/api/residents/${h}/sheet`) {
      if (shot === "unavailable") return json(route, 503, { defect: "the sheet names can't be read just now", hint: "try again in a minute" });
      return json(route, 200, { read: "sheet", handle, household: "qa-fixture-house", likeness: handle === SOLO ? "not given" : "given", sheets: sheets.map(shape), held_until_yes: 0,
        anchor: sheets[0].url, template: "Make ONE image: six views of the resident on a plain backdrop (a fixture template).", how: "fixture" });
    }
    if (req.method() === "GET" && u.pathname === "/api/me")
      return owner ? json(route, 200, { handles: [handle], household: "qa-fixture-house", households: { [handle]: { slug: "qa-fixture-house" } } }) : json(route, 401, { defect: "fixture: signed out" });
    if (req.method() === "PATCH" && u.pathname === `/api/profile/${h}`) {
      if (shot === "refused" || shot === "upload-refused") return json(route, 503, { defect: "the sheet names can't be read just now", hint: "try again in a minute" });
      const body = JSON.parse(req.postData() || "{}");
      const s = sheets.find((x) => x.url === body.sheet);
      if (!s) return json(route, 422, { defect: "fixture: no such kept sheet" });
      if ("sheet_name" in body) s.name = String(body.sheet_name).trim() || undefined;
      return json(route, 200, { updated: ["sheet"], sheet: shape(s) });
    }
    if (req.method() === "POST" && u.pathname === "/api/media") return json(route, 200, { url: media(MANY, "alaric.png"), via: "fixture" });
    return json(route, 404, { defect: "fixture: not served" });
  });
}

// the layout's "A note for you" tutorial pops for a fresh sign-in; a reader dismisses it with its own ×, and so does this, before the shot
async function dismissNote(page) {
  await page.waitForTimeout(1000);
  const x = page.locator("[data-tutorial-dismiss]").first();
  if (await x.isVisible().catch(() => false)) await x.click();
}

export async function after({ page, path }) {
  const shot = shotOf(path);
  if (!shot) return;
  await dismissNote(page);
  if (shot === "unavailable") { await page.locator("[data-ap-sheets-unread]:not([hidden])").first().waitFor({ timeout: 15000 }).catch(() => {}); }
  else await page.locator("[data-ap-sheets] figure").first().waitFor({ timeout: 15000 });
  if (OWNER_SHOTS.has(shot)) await page.locator("[data-ap-set]:not([hidden])").first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const fig0 = page.locator("[data-ap-sheets] figure").first();
  if (shot === "edit") {
    await page.fill("#ap-name-0", "Julian and Vex");
    await page.focus("#ap-name-0"); await page.keyboard.press("Enter");
    await fig0.locator("[data-ap-name-status]").filter({ hasText: "Saved." }).waitFor({ timeout: 10000 });
    await page.focus("#ap-name-0");
  }
  if (shot === "toolong") {
    await page.fill("#ap-name-1", "Alaric, the one in the long coat, who is the eldest of the three and the one who wrote this");
    await page.focus("#ap-name-1"); await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  if (shot === "refused") {
    await page.fill("#ap-name-0", "Julian Ashby");
    await page.focus("#ap-name-0"); await page.keyboard.press("Enter");
    await fig0.locator("[data-ap-name-status]").filter({ hasText: "503" }).waitFor({ timeout: 10000 });
  }
  // the train (before) has no name box: its upload section is shown as it stands
  if ((shot === "upload" || shot === "upload-refused") && await page.locator("#ap-sheet-name").count()) {
    await page.fill("#ap-sheet-name", "Alaric");
    await page.focus("#ap-sheet-name");
  }
  if (shot === "upload-refused") {
    await page.fill("#ap-link", "https://example.org/alaric.png");
    await page.click("[data-ap-send-link]");
    await page.locator("[data-ap-set-status]").filter({ hasText: "503" }).waitFor({ timeout: 10000 });
  }
  // frame the state being shown: the edited sheet, the second sheet's refusal, the upload section; the -full copy has the whole page
  const target = { edit: "[data-ap-sheets] figure", refused: "[data-ap-sheets] figure", toolong: "[data-ap-sheets] figure:nth-of-type(2)", upload: "[data-ap-set]", "upload-refused": "[data-ap-set]", owner: "[data-ap-sheets]", named: "[data-ap-sheets]", solo: "#ap-sheet-h", unavailable: "#ap-sheet-h" }[shot];
  if (target) await page.locator(target).first().evaluate((e) => e.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
}
