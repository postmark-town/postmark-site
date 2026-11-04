// world-feed.mjs — the rail's feed, as sentences.
//
// PURE. No DOM, no fetch, no clock of its own: every function here takes what it
// is told and returns entries. The mount draws them; the component fetches for
// it. That split is what lets the fight's whole grammar be tested against
// fixtures without a browser, which is the only way to read a combat log before
// there is a combat.
//
// THE FOUNDER'S RULING (2026-08-29), and it is one ruling, not two:
//
//   "the action log can just replace the Lately section in the side rail
//    instead of needing a whole separate panel … tweak the 'lately' section so
//    it's a newest-at-the-bottom chat-like feed, that you can scroll UP to see
//    older things (and we should use this same thing for the log in combat)"
//
// So there is ONE feed. Outside a fight it carries the rail's record and what
// the town is saying; inside one it also carries the fight. A second panel for
// combat would be the thing he ruled against, and a second component would be
// two scroll contracts to keep in step.
//
// ── WHERE THE LINES COME FROM, and why there are two derivations ────────────
//
// YOUR OWN ACTS arrive whole. The apex's act half answers `beat` (the fold's
// row for what you just did), `then` (the hostile turns your act drove), and
// `joined` / `opened` — office src/arena.mjs § 8, "the answer". Those carry the
// actor, the die, the damage and the consequence, so `beatLine` can write a
// real sentence with a real subject.
//
// EVERYBODY ELSE'S ARRIVE BY ONE OF TWO ROADS, and which one is the door's
// choice rather than ours.
//
// ① THE TAIL, where the door sends one. `encounter_detail.beats_tail` is the
// last stretch of the fold's own beats in the same shape as your own, so
// `beatsFromTail` writes WHOLE, ATTRIBUTED lines for everybody in the room —
// "the unlit cake strikes rei — 7. rei is down; the good lighter clatters to
// the floor." This is the road, wherever it exists.
//
// ② THE DELTA, where it does not. The office's public encounter block (its
// `publicState`, in the arena the office has since closed — office dd402ca1,
// 2026-09-30) — the block the read half answered until the tail existed — said
// out loud that it withholds beats:
// "`beats`, `ignored` and `rolls` are the fold's full working and they are NOT
// carried here: an answer that hands back every roll ever thrown in the room is
// an answer nobody reads." Against such a door another player's turn reaches
// this page only as a CHANGE IN STATE, and `beatsFromDelta` writes what the
// change can honestly support: an effect with no hand on it.
//
// ⚑ WHICH IS WHY THE DELTA'S LINES ARE IN THE RECEIVING VOICE. "rei takes 7" is
// what two reads can prove; "the cake strikes rei for 7" is not — the hand is
// not in the answer, and a log that guessed at it would be inventing the one
// fact a player most wants to trust.
//
// THE DELTA IS DEMOTED, NOT DELETED. Its own header used to say it was what
// would get deleted the day the read carried beats. It is kept as the fallback
// instead, because dev may deploy the site before or after the office in either
// order, and a page that went silent on the wrong deploy order would be worse
// than one that reads thin for an afternoon. It stands down the moment a tail
// appears, and it is the tail's PRESENCE that decides — never a version number,
// never a flag anybody has to remember to set.

/** The leaf of a world id, deslugged — the one spelling of a mark's name on
 *  this surface. Re-exported through world-cockpit.mjs, which is where the
 *  wheel and the map ring read it from, so the log cannot call the cake
 *  something the ring beside it does not. */
export function leafName(id) {
  const s = String(id ?? "").trim();
  if (!s) return "";
  return s.split("/").pop().replace(/-/g, " ");
}

/** A hand is named by its handle, which IS its name in this town. A mark is
 *  named by its leaf. The join key tells them apart: a handle has no slash. */
export function actorName(id) {
  const s = String(id ?? "").trim();
  if (!s) return "somebody";
  return s.includes("/") ? leafName(s) : s;
}

const num = (n) => (Number.isFinite(n) ? n : null);

/**
 * ONE BEAT, AS A SENTENCE.
 *
 * Reads the office's own beat shape (src/encounter.mjs — the rows pushed into
 * `beats`) and nothing else. Every branch is keyed on a field the fold writes;
 * an act this file has never heard of still gets a line, because a verb the
 * ground grows tomorrow must not fall silently out of the log.
 *
 * Returns `{ text, tone }` — tone is a class, never a colour: "hit", "miss",
 * "down", "lift", "join", "loot", "wipe", "turn", "plain".
 */
export function beatLine(beat, opts = {}) {
  if (!beat || typeof beat !== "object") return null;
  const act = typeof beat.act === "string" ? beat.act : null;
  if (!act) return null;
  const who = actorName(beat.actor);
  // LOWER CASE THROUGHOUT, and it is not a slip. Every subject in this log is a
  // handle or a mark's leaf, and both are lowercase by the world's own naming;
  // capitalising only the sentences that happen to start with prose would make
  // the log look like two writers took turns. The founder's own sample line
  // reads this way: "the-unlit-cake strikes rei — 7. rei is down; the
  // good-lighter clatters to the floor."

  if (act === "join") {
    const init = num(beat.initiative);
    const round = num(beat.joins_round);
    return {
      tone: "join",
      // ⚑ "STEPS IN", NOT THE FERRY WORD (founder-ruled: never that word for
      // going through a door). It was printing in the live combat feed. And it
      // is "steps in" rather than "enters" because the sentence for going the
      // other way, four lines down, is already "steps out" — one pair, read
      // together in the same scrolling column, so they had better rhyme.
      text: `${who} steps in${init == null ? "" : ` — initiative ${init}`}${round && round > 1 ? `, at round ${round}` : ""}.`,
    };
  }
  if (act === "leave") {
    const kept = num(beat.kept_hp);
    return { tone: "plain", text: `${who} steps out${kept == null ? "" : ` at ${kept}`}.` };
  }
  if (act === "pass") return { tone: "plain", text: `${who} passes.` };
  if (act === "guard") return { tone: "plain", text: `${who} guards — the next hit lands at half.` };
  if (act === "loot") return { tone: "loot", text: `${who} takes something home.` };
  if (act === "lift") {
    const to = num(beat.to);
    return {
      tone: "lift",
      text: `${who} lifts ${actorName(beat.lifted)}${to == null ? "" : ` — back up at ${to}`}.`,
    };
  }
  if (act === "wipe") {
    const by = beat.actor ? `${who} puts the last of them down. ` : "";
    return {
      tone: "wipe",
      text: `${by}everyone is down — the party wakes in the antechamber and it stands again${num(beat.attempt) ? ` (attempt ${beat.attempt})` : ""}.`,
    };
  }

  // ── strike and cast: the two that throw ──────────────────────────────────
  //
  // A MISS IS A LINE. The die was thrown and the reader watched it; a log that
  // printed only landings would make a whiffed turn look like a dropped one.
  if (act === "strike" || act === "cast") {
    const swung = act === "cast" ? "casts at" : "swings at";
    // WHOM A HAND SWUNG AT IS NOT IN ITS OWN BEAT. The office writes `at` on a
    // creature's row (the hand it chose) and leaves it off a player's, because
    // on this ground a player's blow lands on the one thing standing — so the
    // caller passes that thing's name in rather than the line saying "strikes"
    // with nothing after it. Absent an adversary the sentence simply has no
    // object, which is what it had before and is still true.
    const target = beat.at
      ? actorName(beat.at)
      : (beat.kind !== "hostile" && typeof opts.adversary === "string" && opts.adversary ? leafName(opts.adversary) : null);
    if (beat.missed === "nobody to hit") {
      return { tone: "miss", text: `${who} ${act}s at nothing — there is nobody left standing to hit.` };
    }
    if (beat.missed) {
      const hit = num(beat.to_hit);
      return {
        tone: "miss",
        text: `${who} ${swung}${target ? ` ${target}` : ""} and misses${hit == null ? "" : ` — ${hit}`}.`,
      };
    }
    const dmg = num(beat.damage);
    const bits = [];
    // The weapon says its own name when it made a difference. A bonus with no
    // thing behind it still gets said: the number is the fact, the name is the
    // garnish, and the office sends the two separately.
    const bonus = num(beat.weapon_bonus);
    const withWhat = typeof beat.with === "string" && beat.with ? leafName(beat.with) : null;
    let head = `${who} ${act}s${target ? ` ${target}` : ""}`;
    if (dmg != null) head += ` — ${dmg}`;
    if (bonus) head += ` (${withWhat ? `${withWhat}, ` : ""}+${bonus})`;
    bits.push(head + ".");
    if (beat.guarded) bits.push(`the guard holds — half of it.`);
    const left = num(beat.boss_left);
    if (left != null) bits.push(left > 0 ? `${left} left.` : `it is spent.`);
    if (beat.downed) bits.push(`${target ?? "they"} is down.`);
    if (beat.dropped) bits.push(`${leafName(beat.dropped)} clatters to the floor.`);
    return { tone: beat.downed ? "down" : "hit", text: bits.join(" ") };
  }

  // A VERB THIS FILE HAS NEVER HEARD OF IS STILL A TURN. Same rule the bar
  // keeps for an unknown act: name it plainly rather than drop it.
  const at = beat.at ? ` ${actorName(beat.at)}` : "";
  return { tone: "plain", text: `${who} ${act}s${at}.` };
}

/**
 * ONE BEAT AS A FEED ENTRY. Shared by the act answer and the tail, so a beat
 * cannot read one way when it is yours and another when it arrives in the
 * door's window of the log.
 *
 * ⚑ THE ID IS THE SEQ, and that is what makes the two roads safe to both walk.
 * The same beat reaches this page twice by design — whole from your own act
 * answer, then again in the next tail — and `mergeFeed` drops the second by id.
 * Nothing upstream has to coordinate; the log's own row number does it.
 */
function entryFor(beat, now, opts = {}, i = 0) {
  const line = beatLine(beat, { adversary: opts.adversary });
  if (!line) return null;
  const seq = num(beat.seq);
  return {
    id: seq == null ? `b:${now}:${i}` : `b:${seq}`,
    seq,
    at: now,
    kind: "beat",
    who: typeof beat.actor === "string" ? beat.actor : null,
    text: line.text,
    tone: line.tone,
  };
}

/**
 * THE ENTRIES ONE ACT ANSWER CARRIES — yours, then whatever your act drove.
 *
 * Order is the log's own: `beat` is your row, `then` is the hostile rows the
 * door wrote after it, and `joined` / `opened` are the two things that can
 * happen on the way in. Seq is the fold's row number and is the dedupe key, so
 * the same beat arriving twice (act answer, then a delta) is one line.
 *
 * `at` is when this reached the reader, not when the row was written: no beat
 * carries a timestamp, and stamping one from the wall clock is the only honest
 * thing left. Within a single answer the seq breaks the tie, so the order the
 * fight happened in survives even though the clock cannot see it.
 */
export function beatsFromAct(body, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const out = [];
  const push = (beat) => {
    const e = entryFor(beat, now, opts, out.length);
    if (e) out.push(e);
  };
  // The open is the room's own event, not anybody's act — said first because it
  // is what makes every line under it a fight rather than a room.
  if (body?.opened) {
    out.push({
      id: `o:${num(body.opened.seq) ?? now}`,
      seq: num(body.opened.seq),
      at: now,
      kind: "beat",
      who: null,
      text: `something in here has been counting the years — the wheel turns.`,
      tone: "join",
    });
  }
  if (body?.joined) push({ ...body.joined, act: "join", actor: body.joined.who ?? body.joined.actor ?? opts.acting ?? null, joins_round: body.joined.round });
  if (body?.beat) push(body.beat);
  for (const b of Array.isArray(body?.then) ? body.then : []) push(b);
  return out.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/**
 * THE FOLD'S OWN BEATS, WHEN THE DOOR SENDS THEM.
 *
 * `encounter_detail.beats_tail` — the last stretch of the fold's beats, in the
 * same shape the act answer's `beat` and `then` already carry (seq, actor, act,
 * damage, downed, dropped, round). It is being added on the office's bday-law
 * branch; SITE-DEFINED CONTRACT UNTIL IT LANDS, and named as one, because at the
 * time of writing the field does not exist on that branch yet (checked
 * 2026-08-29 against origin/bday-law 883e77d — the office's public encounter
 * block carried no tail then; the office has since closed its arena, office
 * dd402ca1, 2026-09-30).
 *
 * ⚑ THIS IS THE DELETION `beatsFromDelta` WAS WRITTEN EXPECTING. Its own header
 * says so: "The day the read carries beats, `beatsFromDelta` is what gets
 * deleted, and `beatLine` already writes the better sentence." That day is
 * arriving, so the delta is not deleted — it is DEMOTED to the fallback, because
 * dev may deploy the site before or after the office in either order and a page
 * that went silent on the wrong deploy order would be worse than one that reads
 * thin for a few hours.
 *
 * WHERE THE TAIL IS PRESENT the lines are WHOLE and ATTRIBUTED — "the unlit cake
 * strikes rei — 7. rei is down; the good lighter clatters to the floor." — which
 * is the sentence the receiving voice was standing in for.
 *
 * Answers `null` when the door sends no tail, and that is deliberately different
 * from an empty one: "this door does not carry beats" and "nothing has happened"
 * are different sentences, and only the first should send the caller to the
 * fallback.
 *
 * `since` is the highest seq already turned into a line FROM A TAIL. Absent (or
 * null) every beat in the window is returned, which is what a caller seeding its
 * watermark wants and is why the caller, not this function, decides whether a
 * first sight is narrated.
 */
export function beatsFromTail(detail, opts = {}) {
  const tail = Array.isArray(detail?.beats_tail) ? detail.beats_tail : null;
  if (!tail) return null;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const since = Number.isFinite(opts.since) ? opts.since : null;
  // THE WHOLE WINDOW IS WALKED, not only the fresh part of it — because a round
  // boundary is a fact about two ADJACENT beats, and the beat on the far side of
  // it may already have been drawn. Walking only the new arrivals would put a
  // round rule at the top of every batch, or at none of them, depending on where
  // the poll happened to cut.
  const all = tail
    .filter((b) => b && Number.isFinite(b.seq))
    .sort((a, b) => a.seq - b.seq);
  const entries = [];
  let prevRound = null;
  for (const b of all) {
    const round = num(b.round);
    const fresh = since == null || b.seq > since;
    // The round rule, on the beat that opens a round. Never on the window's
    // first beat: nothing here knows whether it opened its round or merely
    // happens to be the oldest thing the door still remembers.
    if (fresh && prevRound != null && round != null && round !== prevRound) {
      // ⚑ THE DELTA'S OWN TAG. Both roads spell a round rule the same way, so a
      // deploy that flips between them mid-fight cannot draw the same divider
      // twice — mergeFeed drops it by id.
      entries.push({ id: `d:r${round}`, seq: b.seq, at: now, kind: "beat", who: null, tone: "turn", text: `— round ${round} —` });
    }
    if (round != null) prevRound = round;
    if (!fresh) continue;
    const e = entryFor(b, now, opts, entries.length);
    if (e) entries.push(e);
  }
  return { entries, watermark: tailWatermark(detail) };
}

/** The highest seq the window holds, or null where the door sends no tail (and
 *  where it sends an empty one — an empty window has no row to stand on). */
export function tailWatermark(detail) {
  const tail = Array.isArray(detail?.beats_tail) ? detail.beats_tail : null;
  if (!tail) return null;
  let max = null;
  for (const b of tail) if (Number.isFinite(b?.seq) && (max == null || b.seq > max)) max = b.seq;
  return max;
}

/**
 * WHAT CHANGED BETWEEN TWO READS, as lines — everybody else's turns, THE
 * FALLBACK ROAD.
 *
 * Walked only where the door sends no `beats_tail` (see the header). It is a
 * derivation and it is deliberately narrow: it says only what two
 * `encounter_detail` blocks together prove, in the receiving voice, with no
 * hand attached.
 *
 * `unseen` is the honest remainder, and it belongs to THIS road alone. The
 * block carries `acts` — a COUNT of this ground's rows — so when the count
 * moves further than the lines account for, the difference is a number of turns
 * this page could not read. It is returned rather than narrated, because "3
 * acts went by" is a fact about the reader's connection, not about the fight,
 * and the drawing decides how loudly to say it. (See the site's own standing
 * rule for the rail: a record this page could not read is NAMED, never guessed
 * at.)
 *
 * ⚑ AND IT HAS NO COUNTERPART ON THE TAIL ROAD, deliberately. A tail carries
 * every beat in its window, so there is nothing left over to confess — and the
 * arithmetic that would look like a gap there cannot prove one: seq numbers the
 * ground's ROWS, not its beats, and the fold ignores rows (`ignored`), so a
 * jump between two tail seqs is the ordinary case rather than evidence of loss.
 * A line claiming turns were missed on that road would be exactly the guess
 * this file refuses everywhere else.
 */
export function beatsFromDelta(prev, next, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const lines = [];
  if (!prev || !next || typeof next !== "object") return { entries: [], unseen: 0 };

  const key = (s) => `${s}`;
  const say = (tone, text, tag) => lines.push({ tone, text, tag });

  const pRound = num(prev.wheel?.round);
  const nRound = num(next.wheel?.round);
  if (pRound != null && nRound != null && nRound > pRound) say("turn", `— round ${nRound} —`, `r${nRound}`);

  // WHO ARRIVED. Stepping in IS joining on this ground, so a new row on the
  // wheel is somebody who just came through the door.
  const pOrder = new Set((prev.wheel?.order ?? []).map((j) => key(j.who)));
  for (const j of next.wheel?.order ?? []) {
    if (pOrder.has(key(j.who))) continue;
    const init = num(j.initiative);
    say("join", `${actorName(j.who)} steps in${init == null ? "" : ` — initiative ${init}`}.`, `j${j.who}`);
  }

  // WHAT THE HANDS TOOK. `hands` is the fold's per-hand block; a drop in hp is
  // a blow landing, whoever threw it.
  const pHands = prev.hands ?? {};
  const nHands = next.hands ?? {};
  for (const [who, h] of Object.entries(nHands)) {
    const before = pHands[who];
    if (!before) continue;
    const lost = num(before.hp) != null && num(h.hp) != null ? before.hp - h.hp : null;
    if (lost != null && lost > 0) say("hit", `${actorName(who)} takes ${lost}.`, `d${who}${h.hp}`);
    // Back on their feet: the lift is the only thing that raises a downed hand,
    // so this is safe to name as one — the fold has no other door to that state.
    if (before.downed && !h.downed) say("lift", `${actorName(who)} is lifted — back up at ${num(h.hp) ?? "their feet"}.`, `u${who}${h.hp}`);
    if (!before.gone && h.gone) say("plain", `${actorName(who)} steps out.`, `g${who}`);
  }
  const pDown = new Set(prev.downed ?? []);
  for (const who of next.downed ?? []) {
    if (pDown.has(who)) continue;
    say("down", `${actorName(who)} is down.`, `x${who}`);
  }

  // WHAT THE CAKE TOOK, and the bar under it.
  const pHp = num(prev.adversary?.hp);
  const nHp = num(next.adversary?.hp);
  if (pHp != null && nHp != null && nHp < pHp) {
    const name = next.adversary?.id ? leafName(next.adversary.id) : "it";
    say("hit", `${name} takes ${pHp - nHp} — ${nHp} left.`, `a${nHp}`);
  }

  // WHAT FELL, AND WHAT WAS TAKEN. Both are lists on the block, so a new member
  // is the event; neither carries a hand, and neither line claims one.
  const pDropped = new Set((prev.dropped ?? []).map((d) => `${d?.thing ?? d}|${d?.at_seq ?? ""}`));
  for (const d of next.dropped ?? []) {
    const k = `${d?.thing ?? d}|${d?.at_seq ?? ""}`;
    if (pDropped.has(k)) continue;
    say("down", `${leafName(d?.thing ?? d)} clatters to the floor.`, `p${k}`);
  }
  const pLooted = new Set(prev.looted ?? []);
  for (const t of next.looted ?? []) {
    if (pLooted.has(t)) continue;
    say("loot", `${leafName(t)} is taken home.`, `l${t}`);
  }

  // THE TWO ENDINGS.
  if (num(prev.attempts) != null && num(next.attempts) != null && next.attempts > prev.attempts) {
    say("wipe", `everyone is down — the party wakes in the antechamber and it stands again.`, `w${next.attempts}`);
  }
  if (prev.phase !== "spent" && next.phase === "spent") {
    const name = next.adversary?.id ? leafName(next.adversary.id) : "it";
    say("loot", `${name} is spent. the loot is open.`, `s`);
  }

  const entries = lines.map((l, i) => ({
    id: `d:${l.tag}`,
    seq: null,
    at: now + i, // one tick apart, so the order derived is the order drawn
    kind: "beat",
    who: null,
    text: l.text,
    tone: l.tone,
  }));

  const moved = num(next.acts) != null && num(prev.acts) != null ? next.acts - prev.acts : 0;
  // A round marker is not an act, so it does not count against the remainder.
  const accounted = entries.filter((e) => e.tone !== "turn").length;
  return { entries, unseen: Math.max(0, moved - accounted) };
}

/**
 * WHAT IS BEING SAID, as feed entries.
 *
 * The voices already reach this page for the map's speech bubbles
 * (`recentVoices`), carrying the moment each line was said. Nothing is fetched
 * twice: the feed reads the same list the bubbles do, which is also why a line
 * can sit in the feed after its bubble has faded off the map — the bubble is a
 * sound, the feed is a record of one.
 */
export function voiceEntries(voices, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  return (Array.isArray(voices) ? voices : [])
    .filter((v) => v && typeof v.said === "string" && v.said)
    .map((v) => {
      const at = Number.isFinite(v.ageMs) ? now - v.ageMs : now;
      return {
        id: `s:${v.handle}:${at}:${v.said}`,
        seq: null,
        at,
        kind: "say",
        who: typeof v.handle === "string" ? v.handle : null,
        text: v.said,
        tone: "say",
      };
    });
}

/**
 * FOLD NEW ENTRIES INTO THE FEED — and this is where the chat contract lives.
 *
 * Newest LAST, because that is what the founder ruled and what a chat is. Keyed
 * by id, so the same beat arriving down two roads (your act answer, then the
 * poll's delta) is one line — which is the whole reason ids are seq-derived
 * where a seq exists.
 *
 * ⚑ AN ARRIVAL NEVER REORDERS WHAT IS ALREADY DRAWN. A say polled seven seconds
 * late is genuinely older than the beat above it, and inserting it back into
 * the middle would move lines a reader has already read — the one thing a chat
 * must never do. So the sort is applied to the INCOMING batch only, and the
 * batch is appended. The feed's order is the order things became knowable here,
 * and that is the order a reader watched them arrive in.
 */
export function mergeFeed(feed, incoming, opts = {}) {
  const cap = Number.isFinite(opts.cap) ? opts.cap : 200;
  const seen = new Set((feed ?? []).map((e) => e.id));
  const add = (Array.isArray(incoming) ? incoming : [])
    .filter((e) => e && e.id && !seen.has(e.id))
    .sort((a, b) => a.at - b.at);
  if (!add.length) return feed ?? [];
  const out = [...(feed ?? []), ...add];
  return out.length > cap ? out.slice(out.length - cap) : out;
}

/**
 * IS THE READER AT THE BOTTOM?
 *
 * The whole of the chat-feed contract in one predicate: at the bottom, the feed
 * follows; scrolled up, it holds still. The slack is because a scrollport is
 * rarely at an exact integer — a feed that only followed at a perfect zero
 * would stop following the first time a sub-pixel row height put it at 0.5.
 */
export function atBottom(el, slack = 24) {
  if (!el) return true;
  const top = Number(el.scrollTop) || 0;
  const client = Number(el.clientHeight) || 0;
  const total = Number(el.scrollHeight) || 0;
  return total - (top + client) <= slack;
}
