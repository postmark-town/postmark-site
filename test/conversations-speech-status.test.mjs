// conversations-speech-status.test.mjs — a refused speech read is never drawn as "nobody spoke" on the household page (POS-779 candidate).
//
//   node --test test/conversations-speech-status.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { speechUnknown, saidChipCount, emptyFeedWords, noActWords } from "../src/lib/household-dashboard/speech-status.mjs";

const unavailable = { conversationsStatus: { state: "unavailable", http: 503, partial: false, legacy: false, cut: [] }, conversations: null };
const ok = { conversationsStatus: { state: "ok", http: 200, partial: false, legacy: false, cut: [] }, conversations: { live: [], closed: [] } };
const partial = { conversationsStatus: { state: "partial", http: 200, partial: true, legacy: false, cut: ["live"] }, conversations: { live: [], closed: [] } };
const legacy = { conversationsStatus: { state: "legacy", http: 200, partial: false, legacy: true, cut: [] }, conversations: { live: [], closed: [] } };

test("only a refused or failed read makes speech unknown; ok, partial and legacy keep their zeros and words", () => {
  assert.equal(speechUnknown(unavailable), true);
  for (const r of [ok, partial, legacy, {}, null, undefined]) assert.equal(speechUnknown(r), false);
  assert.equal(saidChipCount(0, true), " · ?", "a question mark, never a zero");
  assert.equal(saidChipCount(3, true), " · ?");
  assert.equal(saidChipCount(0, false), " · 0", "a true empty is still zero");
  assert.equal(saidChipCount(2, false), " · 2");
  assert.equal(emptyFeedWords(ok), null, "a true empty town keeps its ordinary words");
  assert.equal(emptyFeedWords(partial), null);
  assert.equal(emptyFeedWords(legacy), null);
  assert.match(emptyFeedWords(unavailable), /can't be read just now\. Nothing here means it could not be read, not that nobody spoke\./);
  assert.equal(noActWords(ok), "nothing on the record lately");
  assert.equal(noActWords(partial), "nothing on the record lately");
  assert.equal(noActWords(unavailable), "what they said can't be read just now");
});

test("the paint path uses them: the chip, the empty feed, the card's last-active line, and one primary message instead of a second note", () => {
  const paint = readFileSync(new URL("../src/lib/household-dashboard/paint.mjs", import.meta.url), "utf8");
  assert.match(paint, /import \{ speechUnknown, saidChipCount, emptyFeedWords, noActWords \} from "\.\/speech-status\.mjs";/);
  assert.match(paint, /k === "said" \? saidChipCount\(n\.said, unknown\)/);
  assert.match(paint, /const unreadable = filterKind === "all" \|\| filterKind === "said" \? emptyFeedWords\(reads\) : null;/);
  assert.match(paint, /set\("\[data-hd-last\]", noActWords\(reads\)\)/);
  assert.match(paint, /const drewWords = paintFeed\(root, items, ctx, reads\);\s*\n\s*paintReadNote\(root, reads, drewWords\);/);
  assert.match(paint, /alreadySaid \? null : readNoteOf/);
  assert.doesNotMatch(paint, /: "nothing on the record lately"\)/, "the card's unconditional 'nothing on the record' claim is gone");
});

test("other activity is untouched: only the said chip and the empty and last-active sentences consult the speech status", () => {
  const paint = readFileSync(new URL("../src/lib/household-dashboard/paint.mjs", import.meta.url), "utf8");
  assert.equal((paint.match(/speechUnknown\(/g) ?? []).length, 1, "one place computes it");
  assert.match(paint, /: " · " \+ \(n\[k\] \?\? 0\)/, "letters, marks and stamps keep their counts");
});
