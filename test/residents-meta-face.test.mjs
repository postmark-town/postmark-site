// residents-meta-face.test.mjs — the faces the map draws come from the field
// the office actually writes (postmark#2950, the producer half).
//
// The map's viewer admits the town's media door since postmark-world #111; the
// site's island builds `residents-meta.json`, the record the viewer reads. This
// asserts the island EMITS the settled `avatar_url` — local claimed file first
// (the older road), then the media-door URL, then nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { residentsMeta } from "../town/scripts/world-engine-island.mjs";

const SOLIN = "https://media.postmark.town/media/sozlin/7037bcfb63718579a618e7bfc31eef790dd067d7f17d66b00fa07e726ca1fe21.webp";

function projectWith({ residents, media = {}, households = {} }) {
  const root = mkdtempSync(join(tmpdir(), "residents-meta-"));
  const dir = join(root, "src", "data", "postmark");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "residents.json"), JSON.stringify(residents));
  writeFileSync(join(dir, "media.json"), JSON.stringify(media));
  writeFileSync(join(dir, "households.json"), JSON.stringify(households));
  return root;
}

test("a profile carrying only the settled avatar_url puts that URL on the map's record", () => {
  const root = projectWith({ residents: [
    { handle: "solin-sunraven", address: { agent: "Solin" }, profile: { avatar_url: SOLIN, color: "#dbb662" } },
  ] });
  const meta = residentsMeta(root);
  assert.equal(meta.residents["solin-sunraven"].avatar, SOLIN, "the island emits the field the office writes");
});

test("a claimed local avatar still wins over avatar_url (the older road, unchanged)", () => {
  const root = projectWith({
    residents: [{ handle: "kai", address: { agent: "Kai" }, profile: { avatar: "kai.jpg", avatar_url: SOLIN } }],
    media: { "WHITE_PAGES/kai/kai.jpg": { card: "/media/kai-avatar-card.jpg" } },
  });
  assert.equal(residentsMeta(root).residents.kai.avatar, "/media/kai-avatar-card.jpg");
});

test("a local avatar the media map never claimed falls through to avatar_url, not to nothing", () => {
  const root = projectWith({ residents: [
    { handle: "mari", address: { agent: "Mari" }, profile: { avatar: "missing.jpg", avatar_url: SOLIN } },
  ] });
  assert.equal(residentsMeta(root).residents.mari.avatar, SOLIN);
});

test("no picture at all → no avatar, and a resident with nothing to add has no row", () => {
  const root = projectWith({ residents: [
    { handle: "plain", address: { agent: "plain" }, profile: {} },
    { handle: "named", address: { agent: "Named" }, profile: {} },
  ] });
  const meta = residentsMeta(root);
  assert.equal(meta.residents.plain, undefined, "nothing to add → no row (unchanged)");
  assert.equal(meta.residents.named.avatar, null);
});
