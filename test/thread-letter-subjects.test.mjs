// thread-letter-subjects.test.mjs — a thread page's letters each wear their own subject (POS-855).
//
//   node --test test/thread-letter-subjects.test.mjs
//
// A cold walk found the letters of a conversation blurring together: nothing
// told one from the next but sender and date. The subject is in the id; the
// pair page's rail already derives it with threadTitle(l.id). Synthetic
// letters only, so this reads no data.

import test from "node:test";
import assert from "node:assert/strict";
import { letterHtml, threadLettersHtml, pairLettersHtml } from "../src/lib/mail-letter.mjs";
import { threadTitle } from "../src/lib/pm.mjs";

const KEY = "ada-2031-01-02-lantern-repairs";
const letter = (id, from, to) => ({ id, from, to, date: "2031-01-02", body: "Body of " + id });
const FIRST = letter(KEY, "ada", "bo");
const REPLY = letter("bo-2031-01-03-oil-and-wicks", "bo", "ada");
const SAME = letter("bo-2031-01-04-lantern-repairs", "bo", "ada");
const opts = { media: {}, threadKey: KEY };

test("a letter wears its own subject, the label threadTitle gives its id, unchanged", () => {
  const html = threadLettersHtml([REPLY], opts);
  assert.equal(threadTitle(REPLY.id), "oil and wicks");
  assert.match(html, /<div class="fr-subject">oil and wicks<\/div>/);
  assert.ok(html.indexOf("fr-subject") < html.indexOf("pm-letterhead"), "the subject heads the paper");
});

test("each letter of a part has its own subject line, in its own article", () => {
  const html = threadLettersHtml([REPLY, letter("ada-2031-01-05-a-second-lamp", "ada", "bo")], opts);
  const articles = html.split("<article").slice(1);
  assert.equal(articles.length, 2);
  assert.match(articles[0], /fr-subject">oil and wicks</);
  assert.match(articles[1], /fr-subject">a second lamp</);
});

test("a letter whose subject is the thread's own title is not repeated under the <h1>", () => {
  for (const l of [FIRST, SAME]) {
    assert.doesNotMatch(threadLettersHtml([l], opts), /fr-subject/, l.id);
  }
});

test("the subject is escaped, and an id with no slug falls back to threadTitle's own answer", () => {
  const html = threadLettersHtml([letter("bo-2031-01-06-fish-<b>", "bo", "ada")], opts);
  assert.match(html, /fr-subject">fish &lt;b&gt;</);
  assert.match(threadLettersHtml([letter("bo-2031-01-07", "bo", "ada")], opts), /fr-subject">bo-2031-01-07</);
});

test("nothing else of the letter changes: the same paper with the subject line taken out", () => {
  const withSubject = threadLettersHtml([REPLY], opts);
  const plain = letterHtml(REPLY, { media: {} });
  assert.equal(withSubject.replace(/<div class="fr-subject">[^<]*<\/div>/, ""), plain);
  assert.match(plain, /<article class="pm-letter pm-paper" id="bo-2031-01-03-oil-and-wicks">/);
  assert.match(plain, /bo → ada/);
  assert.match(plain, /Body of bo-2031-01-03-oil-and-wicks/);
  assert.match(plain, /<div class="pm-letterfoot"><span>bo-2031-01-03-oil-and-wicks<\/span>/);
});

test("the pair page's cards and a bare letterHtml call carry no subject line", () => {
  assert.doesNotMatch(letterHtml(REPLY), /fr-subject/);
  const view = { markOf: new Map([[REPLY.id, { tkey: KEY, hue: 200, divider: null }]]) };
  assert.doesNotMatch(pairLettersHtml(view, [REPLY], { media: {}, deliveredOn: new Map() }), /fr-subject/);
});

test("without the thread's key every letter wears its subject", () => {
  assert.match(threadLettersHtml([FIRST], { media: {} }), /fr-subject">lantern repairs</);
});
