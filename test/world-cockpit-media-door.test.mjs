// The world cockpit reads a resident's `avatar_url` at RUNTIME, in the browser.
// postmark#2950 closed the hole on the BUILT pages — a settled avatar_url is
// admitted onto a resident's page only when it is the town's own media door —
// and left this reader taking the field verbatim, so the same question had two
// answers and only one of them was checked.
//
// This suite is about the ruled half: the predicate has ONE owner, and the
// cockpit applies it. Each test carries the sentence it falsifies.
//
// A NOTE ON THE IMPORTS. Everything that asserts a BEHAVIOUR imports only
// world-cockpit.mjs, which exists at the base — so at the base those cases fail
// for their own reason and say which. The one case that asserts the shared
// module EXISTS uses a dynamic import inside itself; a static one would be a
// load error at the base and would red every case here for a reason none of
// them is about.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faceImageFor, residentAvatar, TOWN_RAW } from "../src/lib/world-cockpit.mjs";

// Real values, read off the live door 2026-09-19 (all 182 residents swept:
// five carry avatar_url, every one of them at this host; none carries token_url).
const SOLIN = "https://media.postmark.town/media/sozlin/7037bcfb63718579a618e7bfc31eef790dd067d7f17d66b00fa07e726ca1fe21.webp";

test("#2950: an off-door avatar_url is not a picture this surface has — it falls through, it is not drawn", () => {
  // "off-door → fall through to the local-file branch / monogram, exactly as an
  // invalid value does today". A resident writes avatar_url into their own
  // PROFILE.md; taken verbatim it is this page's <img> pointed at any host.
  const noBasename = faceImageFor(
    { kind: "resident", handle: "solin-sunraven", label: "solin" },
    { "solin-sunraven": { avatar_url: "https://example.test/r.png" } });
  assert.equal(noBasename.src, null, "an off-door URL with no basename behind it draws nothing");
  assert.equal(noBasename.from, "monogram");
  assert.equal(noBasename.monogram, "S", "and the letter tile every face already had is what is drawn");

  // and the same value with a basename behind it falls THROUGH, rather than
  // being refused outright — the basename is still a real picture.
  const withBasename = residentAvatar("rei", { avatar: "avatar.jpg", avatar_url: "https://example.test/r.png" });
  assert.equal(withBasename.src, `${TOWN_RAW}/WHITE_PAGES/rei/avatar.jpg`);
  assert.equal(withBasename.from, "the town repo");
});

test("#2950: the town's own media door is admitted, and wins over the derived URL", () => {
  const given = residentAvatar("solin-sunraven", { avatar: "avatar.jpg", avatar_url: SOLIN });
  assert.equal(given.src, SOLIN, "the settled URL is the resident's actual picture");
  assert.equal(given.from, "the door");

  // through the one call every face in the dock goes through, which is where it
  // actually reaches a pixel
  const face = faceImageFor({ kind: "resident", handle: "solin-sunraven", label: "solin" },
    { "solin-sunraven": { avatar_url: SOLIN } });
  assert.equal(face.src, SOLIN);
  assert.equal(face.from, "the door");
});

test("#2950: only the URL branch gained a check — the basename branch is untouched", () => {
  // The local-file branch keeps every rule it had; this change is about the two
  // URL-bearing fields and nothing else.
  assert.equal(residentAvatar("rei", { avatar: "avatar.jpg" }).src, `${TOWN_RAW}/WHITE_PAGES/rei/avatar.jpg`);
  assert.equal(residentAvatar("rei", { avatar: "avatar.jpg" }).from, "the town repo");
  assert.equal(residentAvatar("rei", { avatar: "../../etc/passwd" }), null);
  assert.equal(residentAvatar("rei", { avatar: "a/b.png" }), null);
  assert.equal(residentAvatar("rei/../x", { avatar: "avatar.png" }), null);
  assert.equal(residentAvatar("rei", null), null);

  // and a roster row that names its own picture is still believed — that is a
  // DIFFERENT reader with a different shape (it legitimately carries rooted
  // local paths), and this lane did not touch it.
  const fromRow = faceImageFor({ kind: "resident", handle: "rei", label: "rei", token_url: "/x.png" },
    { rei: { avatar: "avatar.jpg" } });
  assert.equal(fromRow.src, "/x.png");
  assert.equal(fromRow.from, "the roster row");
});

test("#2950: the near-miss shapes are refused, so the check is the door and not the hostname", () => {
  const monogram = (avatar_url) =>
    faceImageFor({ kind: "resident", handle: "solin-sunraven", label: "solin" },
      { "solin-sunraven": { avatar_url } }).from;
  assert.equal(monogram("http://media.postmark.town/media/x.webp"), "monogram", "plain http is not the door");
  assert.equal(monogram("//media.postmark.town/media/x.webp"), "monogram", "protocol-relative is not a URL here");
  assert.equal(monogram("https://media.postmark.town.evil.test/media/x.webp"), "monogram", "a suffix is not the host");
  assert.equal(monogram("https://media.postmark.town/other/x.webp"), "monogram", "the door is /media/");
  assert.equal(monogram("https://media.postmark.town/media/"), "monogram", "and it has to name an object");
  assert.equal(monogram("/media/solin-avatar-card.jpg"), "monogram",
    "a rooted path is a different claim — this reader has no origin to resolve it against");
});

test("#2950: the predicate has ONE owner, and it is pure enough for the browser", async () => {
  // world-cockpit.mjs ships inside a client <script> (src/components/
  // WorldCockpit.astro), so the module it takes this rule from cannot reach a
  // node builtin. Asserted on the source, because a node test would load a
  // node-only import perfectly happily and say nothing.
  const source = readFileSync(new URL("../src/lib/media-door.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']node:/, "the shared module must not import a node builtin");
  assert.doesNotMatch(source, /require\s*\(/, "nor reach one through require");

  const mod = await import("../src/lib/media-door.mjs");
  assert.equal(typeof mod.atTownMediaDoor, "function", "the predicate is exported from the shared module");
  assert.equal(mod.atTownMediaDoor(SOLIN), true);
  assert.equal(mod.atTownMediaDoor("https://example.test/r.png"), false);

  // and BOTH readers take it from there rather than keeping a copy — the whole
  // point of the hoist. Asserted as "imports it AND no longer spells the rule",
  // so a second copy pasted back in reds here.
  for (const path of ["../src/lib/world-cockpit.mjs", "../tools/lib/town.mjs"]) {
    const text = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(text, /import\s*\{[^}]*\batTownMediaDoor\b[^}]*\}\s*from\s*["'][^"']*media-door\.mjs["']/,
      `${path} imports the predicate from the shared module`);
    assert.doesNotMatch(text, /function\s+atTownMediaDoor\s*\(/,
      `${path} does not keep its own copy of the rule`);
  }
});
