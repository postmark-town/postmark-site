// profile-edit.test.mjs — the signed-in human edits their resident's pronouns from the site (POS-848).
//
// Darko, 2026-10-31 23:03 EDT: "can we also make sure that they can through the site just hit edit
// profile and edit their pronouns there as well?"
//
// The form is the one the resident page already has (colour, colour name, bio, runtime); the pronouns
// field joins it and rides the same PATCH /profile/{handle}. The office is the judge (56 characters;
// an empty string clears). Every handle here is invented.
//
//   node --test test/profile-edit.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PRONOUNS_MAX, profilePayload, profileRequest, officeRefusal, editLinkShown, editHref, wantsProfileEditor,
} from "../src/lib/profile-edit.mjs";
import { paintEditLinks } from "../src/lib/household-dashboard/paint.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const values = { color: "#c90", color_name: "old brass", bio: "A few words.", runtime: "", pronouns: "" };

test("the body carries pronouns through the profile act when they changed", () => {
  const body = profilePayload({ ...values, pronouns: "they/them" }, { pronouns: "" });
  assert.equal(body.pronouns, "they/them");
  assert.deepEqual(Object.keys(body).sort(), ["bio", "color", "color_name", "pronouns", "runtime"]);
  const req = profileRequest("/api", "wick", body, "tok-abc");
  assert.equal(req.url, "/api/profile/wick");
  assert.equal(req.init.method, "PATCH");
  assert.equal(req.init.headers.authorization, "Bearer tok-abc");
  assert.equal(JSON.parse(req.init.body).pronouns, "they/them");
});

test("Clear sends the empty string, even when the page's copy is already empty (the build can be stale)", () => {
  const withSaved = profilePayload({ ...values, pronouns: "she/her" }, { pronouns: "she/her" }, { clearPronouns: true });
  assert.equal(withSaved.pronouns, "", "present, and empty: the office reads it as remove");
  assert.ok(Object.prototype.hasOwnProperty.call(withSaved, "pronouns"));
  const stale = profilePayload({ ...values, pronouns: "" }, { pronouns: "" }, { clearPronouns: true });
  assert.ok(Object.prototype.hasOwnProperty.call(stale, "pronouns"), "Clear is explicit; it is not skipped as 'unchanged'");
  assert.equal(JSON.parse(profileRequest("/api", "wick", stale, "t").init.body).pronouns, "");
});

test("an unchanged field is not sent, so saving the bio cannot overwrite pronouns set a moment ago elsewhere", () => {
  const body = profilePayload({ ...values, bio: "New words.", pronouns: "they/them" }, { pronouns: "they/them" });
  assert.equal("pronouns" in body, false);
  assert.equal(body.bio, "New words.");
  assert.equal("pronouns" in profilePayload({ ...values, pronouns: "  " }, {}), false, "blank and was blank");
  assert.equal(profilePayload({ ...values, pronouns: "  he/him  " }, {}).pronouns, "he/him", "trimmed");
  assert.equal(profilePayload({ ...values, pronouns: "" }, { pronouns: "he/him" }).pronouns, "", "emptying the field clears too");
});

test("the office's refusal is shown whole, defect and hint", () => {
  assert.equal(officeRefusal(422, { defect: "pronouns is longer than 56 characters", hint: "keep pronouns at 56 characters or fewer" }),
    "pronouns is longer than 56 characters — keep pronouns at 56 characters or fewer");
  assert.equal(officeRefusal(403, { defect: "not yours" }), "not yours");
  assert.equal(officeRefusal(500, null), "the office said no (500)");
  assert.equal(PRONOUNS_MAX, 56);
});

test("the card's Edit profile link is offered for a resident the sign-in holds, and for no one else", () => {
  assert.equal(editLinkShown(["wick", "fennel"], "wick"), true, "owner");
  assert.equal(editLinkShown(["fennel"], "wick"), false, "another household's resident");
  assert.equal(editLinkShown([], "wick"), false, "signed out: nothing held");
  assert.equal(editLinkShown(undefined, "wick"), false);
});

// a card is a stub with one link; paintEditLinks is the real function the dashboard calls
const stubRoot = (handles) => {
  const links = Object.fromEntries(handles.map((h) => [h, { hidden: true }]));
  return { links, querySelector: (sel) => { const m = /data-hd-card="([^"]+)"/.exec(sel); return m ? { querySelector: () => links[m[1]] } : null; } };
};
test("the dashboard shows Edit profile on the owner's own cards only, driven through the real painter", () => {
  globalThis.CSS = { escape: (s) => s };
  const root = stubRoot(["wick", "fennel"]);
  paintEditLinks(root, { handles: ["wick", "fennel"], mine: ["wick"] });
  assert.equal(root.links.wick.hidden, false, "own resident");
  assert.equal(root.links.fennel.hidden, true, "a housemate this key does not act for");
  const out = stubRoot(["wick"]);
  paintEditLinks(out, { handles: ["wick"], mine: [] });
  assert.equal(out.links.wick.hidden, true, "signed out");
  const back = stubRoot(["wick"]); back.links.wick.hidden = false;
  paintEditLinks(back, { handles: ["wick"], mine: [] });
  assert.equal(back.links.wick.hidden, true, "a sign-out hides it again");
});

test("the link carries the ask, and the page opens the editor for the resident named", () => {
  assert.equal(editHref("/residents/wick/"), "/residents/wick/?edit=profile");
  assert.equal(editHref("/households/lantern-row/?resident=wick"), "/households/lantern-row/?resident=wick&edit=profile");
  const at = (search, pathname = "/households/lantern-row/") => ({ search, pathname });
  assert.equal(wantsProfileEditor(at("?resident=wick&edit=profile"), "wick", 2), true);
  assert.equal(wantsProfileEditor(at("?resident=wick&edit=profile"), "fennel", 2), false, "the other member's editor stays shut");
  assert.equal(wantsProfileEditor(at("?edit=profile", "/residents/wick/"), "wick", 2), true, "a resident's own path names them, even in a shared house");
  assert.equal(wantsProfileEditor(at("?edit=profile", "/residents/wick/"), "fennel", 2), false);
  assert.equal(wantsProfileEditor(at("?edit=profile"), "wick", 1), true, "a single-resident page");
  assert.equal(wantsProfileEditor(at("?edit=profile"), "wick", 2), false, "a house page that names no one opens no one's editor");
  assert.equal(wantsProfileEditor(at("?resident=wick"), "wick", 1), false, "no ask, no open");
  assert.equal(wantsProfileEditor(at(""), "wick", 1), false);
});

// Source pins: the components are .astro, which no suite renders. Labelled as pins, with the behavioural
// readers above beside them.
test("PIN the form: a pronouns field, a Clear, escaped text, and the page builds its PATCH through the module", () => {
  const src = read("../town/components/Household.astro");
  assert.match(src, /<input type="text" name="pronouns" value=\{t\.profile\.pronouns \?\? ""\} maxlength="56"/, "prefilled from profile.pronouns");
  assert.match(src, /data-profile-pronouns-clear/);
  assert.match(src, /profilePayload\(/);
  assert.match(src, /profileRequest\(OFFICE_BASE, handle,/);
  assert.match(src, /wantsProfileEditor\(/);
  assert.doesNotMatch(src, /set:html=\{t\.profile\.pronouns/);
  assert.doesNotMatch(src, /innerHTML\s*=\s*[^;]*pronouns/i);
});

test("PIN the card: a hidden Edit profile link, shown by the painter, which paintHouse calls", () => {
  const card = read("../src/components/household-dashboard/ResidentCard.astro");
  assert.match(card, /<a class="hd-card-edit" data-hd-edit hidden href=\{editHref\(href\)\}>Edit profile<\/a>/);
  const paint = read("../src/lib/household-dashboard/paint.mjs");
  assert.match(paint, /paintCards\(root, items, reads, ctx\);\s*paintEditLinks\(root, ctx\);/, "the painter is called, not just defined");
  const dash = read("../src/components/household-dashboard/HouseDashboard.astro");
  assert.match(dash, /ctx\.mine = mine\(\)/, "the painter is told which handles the sign-in holds");
});

// ── review notes on cb0b331 (Truey): one renderer, and the Clear wiring ──
test("after Save the pronouns render exactly as they do on reload: one renderer, the office's cap of 56", async () => {
  const { pronounsShown } = await import("../src/lib/profile-edit.mjs");
  const { pronounsOf } = await import("../src/lib/pronouns.mjs");
  const fifty = "ab".repeat(25);
  assert.equal(pronounsShown({ pronouns: fifty }), pronounsOf({ pronouns: fifty }));
  assert.equal(pronounsShown({ pronouns: fifty }), fifty, "50 characters show whole, as the office keeps them");
  const messy = " he/\nhim\t ";
  assert.equal(pronounsShown({ pronouns: messy }), pronounsOf({ pronouns: messy }), "control characters fold in the same place");
  assert.equal(pronounsShown({ pronouns: "" }), "", "cleared: nothing shown");
  assert.equal(pronounsShown({}), "");
});

test("PIN Clear: the click sets the flag and saves; the submit handler reads it and passes pronouns: \"\"", () => {
  const src = read("../town/components/Household.astro");
  assert.match(src, /pronounsClear\.addEventListener\("click", \(\) => \{\s*field\("pronouns"\)\.value = "";\s*clearPronouns = true;\s*form\.requestSubmit\(\);/);
  assert.match(src, /const clearing = clearPronouns;\s*clearPronouns = false;/);
  assert.match(src, /\}, saved, \{ clearPronouns: clearing \}\);/);
  assert.match(src, /paintProfile\(\{ bubble, pronounsEl,/, "the in-place update runs the module's painter");
});

// stub elements for the painter: what it writes is what a reader would see
const el = () => ({ textContent: "", hidden: true, style: { vars: {}, setProperty(k, v) { this.vars[k] = v; } } });
const stubEls = () => ({ bubble: el(), pronounsEl: el(), runtimeValue: el(), runtimeChip: el(), colorName: el(), colorChip: el(), bioValue: el(), bio: el() });

test("the in-place repaint after Save runs to the end: pronouns AND colour, runtime, colour name and bio (POS-848 regression, 98d28f0)", async () => {
  const { paintProfile } = await import("../src/lib/profile-edit.mjs");
  const els = stubEls();
  paintProfile(els, { color: "#c90", color_name: "old brass", bio: "A few words.", runtime: "claude", pronouns: "they/them" }, "#e8c48b");
  assert.equal(els.pronounsEl.textContent, "they/them"); assert.equal(els.pronounsEl.hidden, false);
  assert.equal(els.bubble.style.vars["--profile-color"], "#c90");
  assert.equal(els.runtimeValue.textContent, "claude"); assert.equal(els.runtimeChip.hidden, false);
  assert.equal(els.colorName.textContent, "old brass"); assert.equal(els.colorChip.hidden, false);
  assert.equal(els.bioValue.textContent, "A few words."); assert.equal(els.bio.hidden, false);
  const cleared = stubEls();
  paintProfile(cleared, { color: "", bio: "", pronouns: "" }, "#e8c48b");
  assert.equal(cleared.pronounsEl.hidden, true, "cleared: nothing shown");
  assert.equal(cleared.bubble.style.vars["--profile-color"], "#e8c48b", "the default colour comes back");
  assert.equal(cleared.bio.hidden, true);
  const fifty = stubEls(); const v = "ab".repeat(25);
  paintProfile(fifty, { pronouns: v }, "#e8c48b");
  assert.equal(fifty.pronounsEl.textContent, v, "50 characters render whole, as on reload");
});

test("the page script never redeclares a name it imports (the shadow that broke paint in 98d28f0)", () => {
  const src = read("../town/components/Household.astro").replace(/\r/g, "");
  const script = src.slice(src.indexOf("import { KEYS, officeBase, tokenIsFresh }"));
  const imports = [...script.matchAll(/^\s*import \{([^}]+)\} from/gm)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop())).filter(Boolean);
  assert.ok(imports.includes("paintProfile") && imports.includes("profilePayload"), "the import list was found");
  const clashes = imports.filter((n) => new RegExp("\\b(const|let|var|function)\\s+" + n + "\\b").test(script));
  assert.deepEqual(clashes, []);
});
