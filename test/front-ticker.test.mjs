// front-ticker.test.mjs — the front page's ticker keeps punctuation and shows
// more of the town (POS-855).
//
//   node --test test/front-ticker.test.mjs
//
// Falsifiers: take the per-sender cap out of spreadDeliveries (the "cap" and
// "order" tests fail), or make restoreApostrophes return its input (the
// "punctuation" tests fail), or point the page back at slice(0, 8) /
// threadTitle (the "wiring" test fails).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { spreadDeliveries, deliveryTitle, restoreApostrophes } from "../src/lib/front-ticker.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "front-ticker.sample.json"), "utf8"));

test("cap: no sender fills more than 2 of the 8 slots, and the strip still fills", () => {
  const picked = spreadDeliveries(FIX.latestDeliveries);
  const per = {};
  for (const d of picked) per[d.from] = (per[d.from] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(per)) <= 2, JSON.stringify(per));
  // the fixture has four senders, so 2 + 2 + 2 + 1 = 7 is the most the cap allows
  assert.equal(picked.length, 7);
  assert.deepEqual(per, { alder: 2, birch: 2, cedar: 2, dune: 1 });
});

test("order: newest first is kept, and the first two of a dominant sender are the newest two", () => {
  const picked = spreadDeliveries(FIX.latestDeliveries);
  assert.deepEqual(picked.map((d) => d.id), [
    "alder-2026-10-30-you-d-like-one",
    "alder-2026-10-30-it-s-the-third-lamp",
    "birch-2026-10-28-don-t-forget-the-ferry",
    "cedar-2026-10-27-a-plain-title",
    "cedar-2026-10-27-i-m-here",
    "dune-2026-10-26-vitamin-d-for-the-lamps",
    "birch-2026-10-25-second-from-birch",
  ]);
});

test("size: never more than 8, and the cap is a parameter", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}-x`, from: `s${i}`, date: "2026-10-01" }));
  assert.equal(spreadDeliveries(many).length, 8);
  assert.equal(spreadDeliveries(FIX.latestDeliveries, { perSender: 1 }).length, 4);
  assert.deepEqual(spreadDeliveries(null), []);
  assert.deepEqual(spreadDeliveries([]), []);
});

const T = (title) => restoreApostrophes(title);
const A = "’";

test("punctuation: a dropped apostrophe comes back, curly like the page's quotes", () => {
  const t = (id) => deliveryTitle({ id });
  assert.equal(t("alder-2026-10-30-you-d-like-one"), `you${A}d like one`);
  assert.equal(t("alder-2026-10-30-it-s-the-third-lamp"), `it${A}s the third lamp`);
  assert.equal(t("alder-2026-10-29-we-ll-need-more-rope"), `we${A}ll need more rope`);
  assert.equal(t("birch-2026-10-28-don-t-forget-the-ferry"), `don${A}t forget the ferry`);
  assert.equal(t("cedar-2026-10-27-i-m-here"), `i${A}m here`);
  assert.equal(T("let s go, who s there, where s the lamp"), `let${A}s go, who${A}s there, where${A}s the lamp`);
  assert.equal(T("they re sure you ve seen it and she ll know"), `they${A}re sure you${A}ve seen it and she${A}ll know`);
});

test("whitelist: every n't pair and pronoun pair restores, whole pairs only", () => {
  for (const w of ["can", "don", "won", "isn", "aren", "wasn", "weren", "didn", "doesn", "hasn", "haven", "hadn", "couldn", "shouldn", "wouldn", "mustn", "ain"]) {
    assert.equal(T(`${w} t`), `${w}${A}t`, w);
  }
  for (const p of ["i m", "i ll", "i ve", "you re", "you ll", "you ve", "you d", "we re", "we ll", "we ve", "we d", "they re", "they ll", "they ve", "they d", "he ll", "she ll", "it ll", "he d", "she d"]) {
    const [a, b] = p.split(" ");
    assert.equal(T(p), `${a}${A}${b}`, p);
  }
  for (const w of ["it", "that", "what", "there", "here", "let", "who", "where", "he", "she"]) {
    assert.equal(T(`${w} s`), `${w}${A}s`, w);
  }
});

test("D19, a missing apostrophe beats a wrong one: lone letters after other words stay as written", () => {
  // Truey's blocking finding on 78010a6: the old rule made these false text
  assert.equal(T("p s your bag"), "p s your bag", "a P.S., not p's");
  assert.equal(T("u s a visa"), "u s a visa");
  assert.equal(T("model s review"), "model s review", "never a possessive");
  assert.equal(T("gen z s"), "gen z s", "never after a single letter");
  assert.equal(T("little m s birthday"), "little m s birthday");
  // and the non-blocking ones
  assert.equal(T("i d card"), "i d card", "i d is left out: it is as likely an ID card");
  assert.equal(T("vitamin d for the lamps"), "vitamin d for the lamps");
  assert.equal(T("plan t is a go"), "plan t is a go");
  assert.equal(T("re entry"), "re entry");
  assert.equal(T("kai s garden"), "kai s garden");
  // residue the whitelist accepts: a whole pair that happens to be a different phrase
  assert.equal(T("can t shirt"), `can${A}t shirt`);
  assert.equal(T("you re do it"), `you${A}re do it`);
  // a restored word is not matched again, and an empty title stays empty
  assert.equal(T("it s s"), `it${A}s s`);
  assert.equal(T(""), "");
  assert.equal(T(null), "");
});

test("fallback: no title field exists, so the slug carries it; an id with no slug is itself", () => {
  assert.equal(deliveryTitle({ id: "alder-2026-10-29-more-from-alder" }), "more from alder");
  assert.equal(deliveryTitle({ id: "alder-2026-10-29" }), "alder-2026-10-29", "threadTitle's own fallback is unchanged");
  assert.equal(deliveryTitle({ id: "dune-2026-10-26-vitamin-d-for-the-lamps" }), "vitamin d for the lamps");
});

test("wiring: the front page's ticker reads these helpers, and keeps arrivals and the all-deliveries link", () => {
  const page = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");
  assert.match(page, /spreadDeliveries\(stats\.latestDeliveries\)/);
  assert.match(page, /deliveryTitle\(d\)/);
  assert.doesNotMatch(page, /latestDeliveries\.slice\(0, 8\)/);
  assert.match(page, /stats\.arrivals\.slice\(0, 3\)/);
  assert.match(page, /href: letterHref\(d\.id, letterBook\)/);
  assert.match(page, /all \{stats\.deliveries\} deliveries →/);
});
