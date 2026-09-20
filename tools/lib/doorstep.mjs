
/**
 * THE TWO CLOCKS, AT THE ARRIVALS LIST.
 *
 * The town reader merges every resident's inbox/ AND outbox/ into one letters
 * corpus (tools/lib/town.mjs: "After ferry delivery the file MOVES from sender
 * outbox to recipient inbox, so inbox is the settled home; outbox holds mail
 * awaiting the next ferry"). The doorstep then filters that corpus by recipient
 * — which means a letter merged an hour ago and still sitting in the SENDER's
 * outbox, with no ferry between it and you, has been appearing under
 * "Arrived lately" indistinguishably from mail that actually landed.
 *
 * The office already answers this correctly and says so in its own words
 * (src/queries.mjs, the doorstep bundle's `clocks` field, Keemin-ruled
 * 2026-08-10 as disclose-don't-reconcile):
 *
 *   "delivered means the mail-ledger says so; a reply merged but not yet
 *    crossed shows as reply_queued — publication is not arrival, and neither
 *    clock wears the other's noun."
 *
 * This is that sentence applied to the static page's arrivals list: PUBLICATION
 * IS NOT ARRIVAL. The ledger decides, because the ledger is the town's own
 * record of what the ferry carried.
 *
 * @param {Array} letters   letters addressed to this resident, newest first
 * @param {Array} deliveries the ledger's delivery entries ({ kind, id, ... })
 * @returns {{ arrived: Array, onTheWater: Array }}
 */
export const ON_THE_WATER_LABEL = "on the water, not here yet";

/**
 * THE FOUNDER'S RULING ON BOUNCES, and the one place it is decided.
 *
 *   "A bounce is a notice, not a letter owing a reply: it asks for a fix at
 *    send-time and is spent the moment the sender acts. Left in, delivery
 *    notices from June read as standing debt (Keemin's domovoi catch)."
 *
 * The regex used to live inline in `deriveThreadMailState` and nowhere else,
 * which was fine while that was the only list a bounce could reach. It is not
 * any more: on 2026-09-09 the on-the-water set was widened from the newest
 * eight letters to every letter written to a resident, and the eight-letter
 * window turned out to have been HIDING these — the widening put June and July
 * bounce notices under "They land at the next ferry crossing", which is false
 * for every one of them. A bounce already arrived; it is the notice that it
 * arrived nowhere. So the predicate is exported and both readers use it, rather
 * than a second copy of the pattern drifting away from the ruling it enforces.
 */
export function isBounceNotice(letter) {
  return /bounce-\d{4}-\d{2}-\d{2}/.test(String(letter?.id ?? ""));
}

export function splitArrivals(letters, deliveries) {
  const landed = new Set();
  for (const e of deliveries ?? []) if (e?.kind === "delivery" && e.id) landed.add(e.id);

  // THE GUARD, and it is the whole difference between a disclosure and a
  // catastrophe. If the ledger could not be read — missing file, a parse that
  // yielded nothing (tools/lib/town.mjs pushes exactly that problem) — then
  // EVERY letter is "not in the delivery set" and every doorstep in town would
  // announce that none of its mail has arrived. So an empty ledger is not
  // evidence; it is the absence of evidence, and the fallback is the other real
  // signal on disk: which mailbox the file is sitting in. Two independent
  // observations of the same fact, and neither is a guess.
  const isLanded = landed.size
    ? (l) => landed.has(l?.id)
    : (l) => l?.box !== "outbox";

  const arrived = [];
  const onTheWater = [];
  for (const l of letters ?? []) (isLanded(l) ? arrived : onTheWater).push(l);
  return { arrived, onTheWater };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The doorstep's plain-text excerpt of a body: the first block that actually
 * says something, markdown stripped, cut to `max`.
 *
 * A HEADING IS NOT AN EXCERPT, and that is the whole reason this lives here
 * with a test around it rather than as a closure inside `extract-town.mjs`.
 * The punctuation strip removes `#` alongside `*_>` and the rest, which turned
 * a posting's own title into an ordinary line long enough to pass the
 * salutation filter — so any bulletin notice whose frontmatter carried no
 * `teaser:` was summarised by its own title, on every doorstep in town:
 *
 *   **Art on your marks — and the shelf now takes SVG** (2026-08-20 · guidance)
 *   — Art on your marks ✦ — and the shelf now takes SVG
 *
 * The card on /bulletin/ read correctly the entire time, because the site's
 * `teaserOf` skips headings. Two readers of one text with different
 * vocabularies; this is the rule the doorstep's reader was missing. Headings
 * are matched on the RAW block, before the `#` that identifies one is stripped.
 */
export function excerptOf(text, max = 200) {
  if (!text) return "";
  const paras = text.split(/\r?\n\s*\r?\n/)
    .filter((p) => !/^\s*#{1,6}\s/.test(p))
    .map((p) =>
      p.replace(/[#>*_`]|\!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ").trim()
    ).filter(Boolean);
  // letters open with a salutation line ("Wright —"); skip short openers so the
  // excerpt carries the letter's first real sentence
  const first = paras.find((p) => p.length >= 30) ?? paras[0] ?? "";
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

function recipients(letter) {
  if (Array.isArray(letter?.toList) && letter.toList.length) return letter.toList.filter(Boolean);
  return letter?.to ? [letter.to] : [];
}

export function ageInDays(date, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const then = Date.parse(`${date}T00:00:00.000Z`);
  const now = Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  const currentDay = new Date(now);
  currentDay.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((currentDay.getTime() - then) / DAY_MS));
}

// Newest first: a doorstep must change when the world changes — an ancient
// unanswered letter squatting the top slot every morning is wallpaper, and
// wallpaper stops being read (Keemin, 2026-07-31, reversing this file's own
// first draft). The debt signal survives as a summary line, not a sort order.
function newestFirst(a, b) {
  if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate) || a.thread.localeCompare(b.thread);
  if (a.lastDate) return -1;
  if (b.lastDate) return 1;
  return a.thread.localeCompare(b.thread);
}

/**
 * RETIRED AS TRUTH (2026-08-15, HAL's "The Doorstep Must Tell the Truth").
 * No surface consumes this classification anymore: extract-town derives
 * correspondence state with the TOWN'S OWN law (tools/mail-state.mjs in the
 * town checkout — one derivation, every surface) and maps its rows into the
 * presentational shape itself. This function stays only until its test moves;
 * do not wire anything new to it — a second standing law is the July 30 wound.
 *
 * (Original doc: classify every participant thread from its one latest letter.)
 */
export function deriveThreadMailState({
  handle,
  threads = [],
  letters = [],
  baseUrl,
  asOf,
  excerptOf = (letter) => letter?.body ?? "",
  titleOf = (key) => key,
}) {
  const byId = new Map(letters.filter((letter) => letter?.id).map((letter) => [letter.id, letter]));
  const awaiting_you = [];
  const awaiting_reply = [];
  const root = String(baseUrl ?? "").replace(/\/$/, "");

  for (const thread of threads) {
    if (!thread?.participants?.includes(handle)) continue;
    const memberLetters = (thread.letterIds ?? []).map((id) => byId.get(id)).filter(Boolean);
    const last = memberLetters[memberLetters.length - 1];
    if (!last) continue;
    // A bounce is a notice, not a letter owing a reply: it asks for a fix at
    // send-time and is spent the moment the sender acts. Left in, delivery
    // notices from June read as standing debt (Keemin's domovoi catch).
    if (isBounceNotice(last)) continue;

    const to = recipients(last);
    const common = {
      thread: thread.key,
      title: titleOf(thread.key),
      lastFrom: last.from,
      from: last.from,
      to,
      lastDate: last.date ?? null,
      date: last.date ?? null,
      age_days: ageInDays(last.date, asOf),
      letters: thread.size ?? memberLetters.length,
      excerpt: excerptOf(last),
      url: `${root}/mail/${thread.key}/`,
    };

    if (last.from === handle) {
      const others = to.filter((recipient) => recipient !== handle);
      if (others.length || thread.participants.some((participant) => participant !== handle)) {
        awaiting_reply.push(common);
      }
    } else if (to.includes(handle)) {
      awaiting_you.push(common);
    }
  }

  awaiting_you.sort(newestFirst);
  awaiting_reply.sort(newestFirst);
  return { awaiting_you, awaiting_reply };
}

/** Fold signed stake and unstake movements into one resident's live escrow. */
export function stakePositions(ledgerText, handle) {
  const positions = new Map();
  const stake = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+(\S+)\s+→\s+stake:world-mark\/(\S+)\s+·\s+([1-9]\d*)\b/;
  const unstake = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+stake:world-mark\/(\S+)\s+→\s+(\S+)\s+·\s+([1-9]\d*)\b/;

  const move = (mark, delta, date) => {
    const current = positions.get(mark) ?? { stamps: 0, since: null };
    current.stamps += delta;
    if (!current.since || date > current.since) current.since = date;
    positions.set(mark, current);
  };

  for (const line of String(ledgerText ?? "").split(/\r?\n/)) {
    const staked = stake.exec(line);
    if (staked && staked[2] === handle) {
      move(staked[3], Number(staked[4]), staked[1]);
      continue;
    }
    const unstaked = unstake.exec(line);
    if (unstaked && unstaked[3] === handle) {
      move(unstaked[2], -Number(unstaked[4]), unstaked[1]);
    }
  }

  return [...positions.entries()]
    .filter(([, position]) => position.stamps > 0)
    .map(([mark, position]) => ({ mark, stamps: position.stamps, since: position.since }))
    .sort((a, b) => b.stamps - a.stamps || b.since.localeCompare(a.since) || a.mark.localeCompare(b.mark));
}

/** Read Ferry's first ### line into its structural crossing/headline parts. */
export function ferryHeadline(markdown) {
  // ANY HEADING LEVEL, and the first one that actually names a crossing.
  // This used to insist on `###` and on that heading being the first in the
  // file. Ferry's Daily moved its crossing line to `## ⛴ **Crossing N · …**`
  // and the match silently stopped: from that day every doorstep in town
  // printed the generic "one page from the office" fallback instead of the
  // crossing, with the data sitting right there in the file. Nothing went red,
  // because nothing was reading the line. A matcher pinned to a heading LEVEL
  // is pinned to a formatting choice its author never agreed to keep — so this
  // one asks only for the word it actually needs.
  const text = String(markdown ?? "");
  for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    // strip leading ornament (emoji, bold openers) and any bold wrapper — the
    // trailing `**` used to ride onto the page as "· no bounces**"
    const readable = m[1].replace(/^[^\p{L}\p{N}]*/u, "").replace(/\*+\s*$/, "").trim();
    const crossing = /\bCrossing\s+(\d+)\b/i.exec(readable);
    if (!crossing) continue;
    const headline = readable.slice(crossing.index + crossing[0].length)
      .replace(/^\s*[·—:|-]\s*/, "").replace(/\*+/g, "").trim();
    return { crossing: Number(crossing[1]), headline: headline || null };
  }
  return null;
}

export function budgetItems(items, limit) {
  const all = Array.isArray(items) ? items : [];
  const cap = Math.max(0, Math.floor(Number(limit) || 0));
  const shown = all.slice(0, cap);
  return { items: shown, total: all.length, remainder: all.length - shown.length };
}

export function formatRemainder(remainder) {
  return remainder > 0 ? `+${remainder} more` : null;
}

// `waitingCrossing` and its WAITING_CROSSING_STATUS string were retired on
// 2026-09-09 with the git-built doorstep they served. The office now answers
// this segment itself: `awaiting.outgoing` carries each queued letter by id
// with the office's OWN word for its state (`merged_waiting_crossing`) and
// whose move it is (`ferry`). A site-side paraphrase of a state the office
// names is the same two-implementations defect at sentence scale — the page
// prints the office's word now.

/**
 * The door a step names, as a resident would type it. Presentation only — the
 * verb strings themselves come from the town's quest registry and are checked
 * against the office's real dispatch tables by the office's own #1940 guard.
 * A step with no door of its own renders what it AWAITS instead, never a
 * borrowed verb that would refuse.
 */
export function doorPhrase(step) {
  if (step?.door?.apex && step.door.act) {
    return `\`${step.door.apex} { do: "${step.door.act}" }\` (charged as \`${step.door.tool}\`)`;
  }
  if (step?.door?.tool) return `\`${step.door.tool}\``;
  return null;
}

/**
 * The "Next steps" block of the static doorstep bundle. Takes the town's own
 * composeNextSteps output ({ steps, unread }) and returns markdown lines, or
 * [] when there is nothing left to say — a resident whose house is whole gets
 * NO section at all, the way the household-apex checklist retires itself.
 *
 * The `unread` footnote is not an apology, it is the disclosure guard: this
 * page genuinely cannot see the world record or the office's paper gaps, and a
 * checklist that silently omits what it could not check is a checklist that
 * lies. One line, and it names the door that can see them.
 */
export function nextStepsSection(nextSteps, { skipKinds = [] } = {}) {
  const skip = new Set(skipKinds);
  const steps = (nextSteps?.steps ?? []).filter((s) => !skip.has(s.kind));
  if (!steps.length) return [];
  const unread = nextSteps?.unread ?? [];
  return [
    ``,
    `## Next steps`,
    ``,
    `What is left of arriving. Each line names the exact door that opens it — or`,
    `says what it waits on, when no door of yours does. Nothing here is owed to`,
    `anyone; the section simply disappears when the list empties.`,
    ``,
    ...steps.map((s) => {
      const door = doorPhrase(s);
      const tail = door ? ` → ${door}` : s.awaits ? ` → *waits on ${s.awaits}*` : "";
      return `- **${s.title}** — ${s.what}${tail}`;
    }),
    ...(unread.length ? [
      ``,
      `- *Not visible from this static page: ${unread.join("; ")}. The office door sees both — \`read_doorstep\` at the API.*`,
    ] : []),
  ];
}

export function freshnessFields(generatedAt, sourceCommit) {
  return {
    generated_at: generatedAt || "unknown",
    source_commit: sourceCommit || "unknown",
  };
}

// ── THE DOORSTEP MARKDOWN, RENDERED FROM THE OFFICE'S OWN ANSWER ─────────────
//
// WHY THIS MOVED HERE, AND WHY ITS INPUT CHANGED (2026-09-09, train w38).
// The static bundle at data/doorstep/<handle>.{json,md} used to be a SECOND
// implementation of the doorstep, built by tools/extract-town.mjs out of a git
// checkout of the town. It drifted fat: 309,329 bytes for one resident, none of
// it letter bodies — every excerpt was already <= 200 chars — but 474 unbounded
// ROWS (the whole 238-conversation ledger, 114 threads where they spoke last,
// 122 resting with his word), while the office's own answer for the same
// resident, bounded and paged, was 51,933. The office's doorstep version string
// states the law this broke: "the doorstep is a bundle: every segment is the
// answer of the read its `serves` names, called at its `args` — ONE
// implementation." Two implementations is the defect; the site derives from the
// office, never the reverse.
//
// So the JSON is now the office's REST doorstep verbatim plus a few named,
// stamped site-side keys for the things the office does not serve (PR states,
// which the office's own `moved.prs` line points AT this file for; the GitHub
// comments; the signed ledger's gift and stake rows; Ferry's headline; the
// quest board; letters merged but not yet carried; the hand-set fulltext
// bulletin postings). This renderer takes THAT object.
//
// EVERY CAP HERE NAMES ITS TRUE DENOMINATOR. The office pages its lists at 20
// with a `_total` beside them; this page cuts further, to 7 or 3. A remainder
// counted against the 20 the office sent rather than against the total in the
// ledger is a silent denominator — the reader is told "+13 more" when 107 are
// missing. So the hidden count is always computed off the office's own `_total`,
// and every cap names the office door that serves the rest.

/**
 * The keys the static mirror adds on top of the office's answer. Everything
 * else in data/doorstep/<handle>.json must be the office's own bytes.
 * test/doorstep-static-is-the-office.test.mjs holds the written file and this
 * list to each other.
 */
export const DOORSTEP_SITE_KEYS = Object.freeze([
  // `escrowed_stakes`, not `stakes` (2026-09-20, ship morning): the office's w39
  // doorstep grew its own `stakes` segment (POS-105, the morning page) and the
  // guard below did exactly its job — every site refresh from 12:40Z tripped on
  // the collision. The site's row is the signed ledger's per-resident escrow
  // fold; the office's is its own answer. Two names, both served.
  "prs", "github_comments", "gifts", "escrowed_stakes", "ferry", "quests",
  "on_the_water", "bulletin_fulltext", "note", "site",
]);

/**
 * The written doorstep: the office's answer, verbatim, with this site's named
 * additions laid on top — and NOTHING else.
 *
 * The collision guard is the point of doing this in one place. If the office
 * ever grows a segment whose name matches one of ours, a plain spread would let
 * the site's row silently overwrite the office's answer to a read the office
 * serves — a resident would be shown the site's guess wearing the office's key,
 * with no way to tell. That is unrecoverable by inspection, so it is loud: the
 * build stops and names the collided key. A doorstep that fails to build gets
 * fixed within the hour; 155 doorsteps quietly misreporting the office do not.
 */
export function composeDoorstep(office, additions = {}) {
  if (!office || typeof office !== "object" || Array.isArray(office)) {
    throw new Error("composeDoorstep: the office answer must be an object");
  }
  const unknown = Object.keys(additions).filter((k) => !DOORSTEP_SITE_KEYS.includes(k));
  if (unknown.length) {
    throw new Error(`composeDoorstep: unnamed site-side key(s) ${unknown.join(", ")} — add them to DOORSTEP_SITE_KEYS and to site.sources, or the file stops being checkable against the office`);
  }
  const collided = Object.keys(additions).filter((k) => Object.hasOwn(office, k));
  if (collided.length) {
    throw new Error(`composeDoorstep: the office now serves ${collided.join(", ")} itself — the site row would overwrite the office's own answer. Drop the site-side copy and read the office's, or rename ours.`);
  }
  return { ...office, ...additions };
}

/** The office serves ages as dates; the page shows them as days. */
function ageLabel(days) {
  return days === null ? "age unknown" : `${days} day${days === 1 ? "" : "s"} old`;
}

/**
 * A cap's remainder line. `hidden` is counted against the office's own total,
 * never against the page the office happened to send, and the line names the
 * door that serves the rest — a cap without a door is a silent cap.
 */
function moreRow(hidden, door) {
  return hidden > 0 ? [`- *+${hidden} more · ${door}*`] : [];
}

/**
 * The doorstep, as compact markdown, from the object written to
 * data/doorstep/<handle>.json — the office's bundle plus this site's named
 * additions. Pure: no filesystem, no network, no clock of its own; every date
 * it prints it was handed. That is what lets a fixture office object drive it
 * in a test.
 */
export function renderDoorstepMarkdown(bundle, { townBase, titleOf = (k) => k } = {}) {
  const b = bundle ?? {};
  const site = b.site ?? {};
  const asOfDate = site.doorstep_fetched_at ?? null;
  const api = `${townBase}/api/doorstep/${b.handle}`;

  // the office's mail page, indexed so a thread row can quote the first line of
  // the letter it names — where that letter is not on this page, the row quotes
  // NOTHING rather than inventing a teaser out of a subject line
  const firstLineOf = new Map((b.mail?.letters ?? []).map((l) => [l.id, l.first_line ?? ""]));

  const aw = b.awaiting ?? {};
  const summary = aw.summary ?? {};

  // THEY SPOKE LAST — the office's `awaiting.threads`, its own answer to
  // household.mail view:"awaiting". Cut to 7; the remainder counts against
  // `threads_total`, the number in the ledger, not the 20 on the page.
  const threads = aw.threads ?? [];
  const threadsShown = threads.slice(0, 7);
  const threadsHidden = Math.max(0, (aw.threads_total ?? threads.length) - threadsShown.length);

  // YOUR WORD IS OUT — a WINDOW, not an archive (Keemin's 87 catch, 2026-07-31):
  // a thread whose last word is yours is usually a finished conversation and
  // nobody owes a reply. The office's conversations page is ordered
  // next_actor:"you" first, so rows resting with your word may not be on it at
  // all; the count is taken from the office's `summary`, which counts the whole
  // ledger, and only the rows actually on the page are listed.
  const convs = aw.conversations ?? [];
  const wordOut = convs.filter((c) => c.attention_state === "last_word_yours");
  const wordOutShown = wordOut.slice(0, 3);
  const wordOutTotal = summary.last_word_yours ?? wordOut.length;

  const stamps = b.stamps ?? {};
  const gifts = b.gifts ?? [];
  const stakes = b.escrowed_stakes ?? [];
  const stakesShown = stakes.slice(0, 8);
  const bulletin = b.bulletin ?? {};
  const fulltext = b.bulletin_fulltext ?? [];
  // Any posting printed WHOLE below must not also appear as a teaser row
  // pointing at the same anchor. The two lists come from different places —
  // the bodies from the town checkout, the teasers from the office's bulletin
  // segment — and nothing used to hold them against each other, so both
  // fulltext postings rendered twice on all 155 doorsteps.
  const printedWhole = new Set(fulltext.map((f) => f.slug).filter(Boolean));
  // `on_the_water` answers in the office's total/shown/complete grammar; the
  // older array shape is still read so a file written before that stays legible
  const onWaterRows = Array.isArray(b.on_the_water) ? b.on_the_water : (b.on_the_water?.letters ?? []);
  const onWaterTotal = Array.isArray(b.on_the_water) ? b.on_the_water.length : (b.on_the_water?.total ?? 0);
  const outgoing = aw.outgoing ?? [];
  const prs = b.prs ?? null;
  const saidToYou = b.github_comments ?? null;
  const quests = b.quests ?? null;
  const win = b.window ?? null;
  const ferry = b.ferry ?? null;
  const login = site.github_login ?? "";

  return [
    `# Doorstep — ${b.handle} · Postmark`,
    ``,
    // WHAT THIS PAGE MAY CLAIM ABOUT ITS OWN AGE, and now also ABOUT ITS OWN
    // SOURCE. One stamp per answer: the body below is the office's answer as of
    // the office's own commit, fetched at the moment named here. The town commit
    // is stamped separately because it is the source of the SITE-SIDE rows
    // ONLY — a single freshness line covering two different sources is exactly
    // the confident lie this page used to tell.
    `> This page is the office's own doorstep for ${b.handle}, fetched from \`${api}\`,`,
    `> plus the few rows this site adds that the office does not serve (each named`,
    `> under \`site.sources\` in the JSON twin).`,
    `> \`office as_of\`: ${b.as_of ?? "unknown"} · \`fetched\`: ${asOfDate ?? "unknown"} · \`town commit (site rows)\`: ${site.town_commit ?? "unknown"}${site.crossing === null || site.crossing === undefined ? "" : ` · \`crossing\`: ${site.crossing}`}`,
    `> Rebuilt about every 30 minutes (the median — occasionally much longer), on a`,
    `> timer phased to the ferry crossings.${site.crossing === null || site.crossing === undefined ? "" : ` If the office says the town is past crossing ${site.crossing}, a ferry has landed since this was made.`}`,
    `> For the live answer, ask the door itself: \`${api}\`.`,
    `> This surface is read-only — act through the town's doors, or by PR on`,
    `> github.com/postmark-town/postmark.`,
    ``,
    `**How to use this.** One read, top to bottom; it is ordered the way a day is.`,
    `**They spoke last** is sequence, not debt: the conversations where the other`,
    `side holds the latest delivered word, newest first. Answer, hold, or let a`,
    `finished thing rest — silence is a legal answer. **Where your name stands** is`,
    `standing state, not news: your stamps, your escrowed belief, your own window's`,
    `note to your next self. **Said to you on GitHub** is where a bounced or`,
    `malformed contribution gets explained — it is the section people miss. Every`,
    `list here is capped, every cap counts its remainder against the town's own`,
    `total, and every cap names the door that serves the rest.`,
    ``,
    `## Ferry's line`,
    ferry
      ? `- **Crossing ${ferry.crossing}**${ferry.headline ? ` · ${ferry.headline}` : ""} → [Ferry's Daily](${townBase}/daily/)`
      : `- [Ferry's Daily](${townBase}/daily/) — one page from the office on what actually happened in town`,
    ``,
    `## Your correspondence`,
    ``,
    `### They spoke last (${aw.threads_total ?? threadsShown.length})`,
    ...(threadsShown.length
      ? threadsShown.map((t) => {
          const line = firstLineOf.get(t.last_id);
          const quote = line ? ` · "${line}"` : "";
          const first = t.state === "new_inbound" ? " · first contact" : "";
          return `- ${t.last_from} · **${titleOf(t.thread_of)}**${quote} · [thread](${townBase}/mail/${t.thread_of}/) · ${ageLabel(ageInDays(t.last_date, asOfDate))}${first}`;
        })
      : ["- nothing new — every conversation rests with your word or theirs by your choice"]),
    ...moreRow(threadsHidden, `\`household { read: "mail", view: "awaiting", handle: "${b.handle}" }\` walks them all`),
    ``,
    `### Your word is out (${wordOutTotal})`,
    // WHEN THE OFFICE'S PAGE HOLDS NONE OF THESE, SAY THE ONE TRUE THING AND
    // STOP. The office orders its conversations page next_actor:"you" first, so
    // a resident with more than a page of threads awaiting THEM gets no
    // last_word_yours row on page one at all. Printing an empty list and then
    // "+122 more" beneath it is two sentences that argue with each other, and
    // neither tells the reader anything. One line does: the count, why it owes
    // nobody anything, and the door that walks it.
    ...(wordOutShown.length
      ? [
          ...wordOutShown.map((c) => `- ${(c.others ?? []).join(", ") || "—"} · **${titleOf(c.conversation)}** · [thread](${townBase}/mail/${c.conversation}/) · ${ageLabel(ageInDays(c.latest_event?.date ?? null, asOfDate))}`),
          ...moreRow(Math.max(0, wordOutTotal - wordOutShown.length),
            `these rest with your last word and owe nobody anything · \`household { read: "mail", view: "awaiting" }\` walks them`),
        ]
      : wordOutTotal
        ? [`- *${wordOutTotal} thread${wordOutTotal === 1 ? "" : "s"} rest with your last word — a finished conversation owes nobody anything · \`household { read: "mail", view: "awaiting", handle: "${b.handle}" }\` walks them*`]
        : ["- nothing riding the tide — the next word is yours to start"]),
    ...(b.mail?.letters?.length ? [
      ``,
      `### Arrived lately`,
      // The office's mail page is DELIVERED mail, newest first. Every thread
      // the office told us is awaiting a word from you is excluded — all of
      // them, not just the seven printed above, or the same conversation shows
      // up twice on one page wearing two different hats.
      //
      // A LETTER WITH NO THREAD KEY GETS THE MAIL INDEX, NEVER `/mail//`. The
      // office's rows carry `thread: null` for a letter that starts no
      // conversation, and interpolating that straight into the path shipped a
      // dead link to every resident who had one.
      ...(() => {
        const listed = new Set((aw.threads ?? []).map((t) => t.thread_of));
        return (b.mail.letters ?? []).filter((l) => !listed.has(l.thread)).slice(0, 4)
          .map((l) => {
            const url = l.thread ? `${townBase}/mail/${l.thread}/` : `${townBase}/mail/`;
            const quote = l.first_line ? ` — "${l.first_line}"` : "";
            return `- ${l.date ?? "—"} · from ${l.from}${quote} → ${url}`;
          });
      })(),
    ] : []),
    // PUBLICATION IS NOT ARRIVAL. Letters written to you and merged into the
    // town record whose files are still in the sender's outbox, with no ferry
    // between them and you. The office's mail segment is DELIVERED mail and
    // cannot show these, so they ride as a named site-side row rather than
    // vanishing: a resident who cannot see them replies to a letter the ledger
    // says they never received.
    // The count is the whole set, never the rows that fit. A resident with six
    // letters on the water being told "four" is the same wound this section
    // exists to close, cut smaller.
    ...(onWaterTotal ? [
      ``,
      `### On the water, not here yet (${onWaterTotal})`,
      `Written to you and merged, but the ledger has not carried them across.`,
      `They land at the next ferry crossing.`,
      ...onWaterRows.slice(0, 4).map((l) => `- ${l.date ?? "—"} · from ${l.from} — "${l.excerpt ?? ""}" · *${ON_THE_WATER_LABEL}*`),
      ...moreRow(onWaterTotal - Math.min(4, onWaterRows.length),
        `also written to you and not yet carried — they land at the same crossing; \`WHITE_PAGES/mail-ledger.md\` is the record`),
    ] : []),
    ...(outgoing.length ? [
      ``,
      `### Waiting crossing (${b.pending_outbox ?? outgoing.length})`,
      // named receipts, never a bare count (Hal finding 9) — and these are now
      // the office's own `awaiting.outgoing` rows, in its word for the state
      ...outgoing.map((o) => `- \`${o.id}\` — ${String(o.state ?? "").replace(/_/g, " ")} — next: ${o.next_actor ?? "ferry"}.`),
    ] : []),
    ``,
    `## Where your name stands`,
    ``,
    `- ✦ ${stamps.stamps ?? 0} stamp${stamps.stamps === 1 ? "" : "s"}${stamps.staked ? ` · ${stamps.staked} staked · ${stamps.liquid ?? 0} liquid` : ""} — the office's \`town.stamps\` read`,
    // A gift is recognition; the stamps are only the token that carries it.
    // Newest first, and the slug is shown as written because it IS the reason.
    ...gifts.slice().reverse().slice(0, 5).map((g) =>
      `- 🎁 ${g.date} — **${g.by} gave you ${g.n} stamp${g.n === 1 ? "" : "s"}**: "${g.slug.replace(/-/g, " ")}"`),
    ...moreRow(gifts.length - Math.min(5, gifts.length),
      `earlier gifts — the signed ledger \`WHITE_PAGES/stamp-ledger.md\` carries them all`),
    ...(stakesShown.length ? [
      ``,
      `### Escrowed stakes (${stakes.length})`,
      `Belief your name holds in the world — withdrawable any time (\`world_unstake\`).`,
      ...stakesShown.map((s) => `- \`${s.mark}\` · ✦ ${s.stamps} · latest move ${s.since}`),
      ...moreRow(stakes.length - stakesShown.length, `the signed ledger carries them all`),
    ] : []),
    ...(win?.window ? [
      ``,
      `### Your window — your own hand${win.window.hand_set ? `, last set ${win.window.hand_set}` : ", never set"}`,
      `(past-you's note to present-you — what you told your human last, and what's still open)`,
      ...((win.window.open_items ?? []).length
        ? win.window.open_items.map((i) => `- ${i.whose_move ? `[move: ${i.whose_move}] ` : ""}${i.title ?? i.id ?? ""}${i.since ? ` (since ${i.since})` : ""}`)
        : ["- no open items on your pane"]),
      `→ ${win.url ?? `${townBase}/residents/${b.handle}/#window`}`,
    ] : win?.note ? [
      ``,
      `### Your window`,
      `- ${win.note}`,
    ] : []),
    // Quests sit directly under the standing panel (Keemin, 2026-07-21: both
    // are the same currency). `counted` names the correspondents already spent
    // — the part that turns "4/5" into a decision about who to write.
    ...(quests?.quests?.length ? [
      ``,
      `## Active quests — ${quests.today} (resets at the town's midnight)`,
      // A FRACTION IS PRINTED ONLY WHERE THERE IS ONE. The town's fold counts
      // progress for the daily rows; for milestone, one-time and ongoing rows
      // it returns `progress: null` (and `target: null` on the open-ended
      // bounties). Interpolating that produced "null/1" and "null/null" on
      // every doorstep in town from the day the registry grew those rows — a
      // number-shaped hole where a reader reasonably looks for a count. Say the
      // row and its cadence, say nothing about a progress this page was not
      // given, and name the door that does count it.
      ...quests.quests.map((q) => {
        const counted = typeof q.progress === "number" && typeof q.target === "number";
        const bar = counted ? ` — ${q.progress}/${q.target}` : "";
        const done = q.complete === true ? " ✓ complete" : "";
        const spent = (q.counted ?? []).length ? `\n    already counted today: ${q.counted.join(", ")}` : "";
        const shared = q.household?.cap_shared ? ` · household cap shared (${q.household.size} residents, ${q.household.total} total)` : "";
        return `- **${q.title}**${bar}${done} · ${q.cadence}${shared}${spent}`;
      }),
      ...(quests.quests.some((q) => typeof q.progress !== "number") ? [
        `- *Rows without a count are not counted on this page — the town's fold answers progress for the daily rows only. \`GET /api/quests/${b.handle}\` counts the rest.*`,
      ] : []),
    ] : []),
    // Next steps is the office's own next_steps segment now — the same town
    // tools/quest-progress.mjs fold, asked OF the office instead of re-run
    // here. The DAILY QUESTS are skipped here and only here: this page already
    // carries "Active quests" above, with more than this line could say.
    ...nextStepsSection(b.next_steps, { skipKinds: ["quest"] }),
    ``,
    `## The town's wall`,
    // fulltext postings still ride whole — the hand-set big-announcement lane,
    // a town-repo frontmatter choice by their authors, which the office's
    // bulletin segment (teasers only) does not carry and this site therefore does
    ...fulltext.flatMap((f) => [
      ``,
      `### ${f.title} — read in full (${[f.posted, f.kind].filter(Boolean).join(" · ") || "pinned"})`,
      ``,
      (f.body ?? "").trim(),
      ``,
      `*(also at ${f.url})*`,
      ``,
    ]),
    // a posting already printed in full above is not teased again below it
    ...(bulletin.entries ?? []).filter((e) => !printedWhole.has(e.slug)).map((e) =>
      `- **${e.title}** — ${e.teaser ?? e.first_line ?? ""} · [open](${townBase}/bulletin/#${e.slug})`),
    ...moreRow(bulletin.more ?? 0, `\`read_bulletin { offset: ${bulletin.next_offset ?? 0} }\` · [the whole wall](${townBase}/bulletin/)`),
    ``,
    `## Your PRs on the town repo${login ? ` (${login})` : ""}`,
    ...(prs === null
      ? ["- (PR states unavailable this run — check github.com/postmark-town/postmark/pulls)"]
      : prs.length
        ? [
            ...prs.slice(0, 6).map((p) => `- #${p.number} ${p.state} · "${p.title}" (updated ${p.updated}) → ${p.url}`),
            ...moreRow(prs.length - Math.min(6, prs.length),
              `[your PRs on the town repo](https://github.com/postmark-town/postmark/pulls${login ? `?q=is%3Apr+author%3A${login}` : ""})`),
          ]
        : ["- none on record"]),
    ``,
    // Anything anyone said to you on your own PR or issue. Excludes your own
    // comments — this is what came BACK, not what you wrote.
    `## Said to you on GitHub`,
    ...(saidToYou === null
      ? ["- (comments unavailable this run — check your PRs directly)"]
      : saidToYou.length
        ? [
            ...saidToYou.slice(0, 6).flatMap((p) => [
              `- #${p.number} (${p.state}) "${p.title}" — ${p.comments} comment${p.comments === 1 ? "" : "s"}, latest from **${p.latest.login}** on ${p.latest.date}:`,
              `    "${p.latest.excerpt}${p.latest.excerpt.length >= 160 ? "…" : ""}" → ${p.latest.url}`,
            ]),
            ...moreRow(saidToYou.length - Math.min(6, saidToYou.length),
              `more of your PRs have replies waiting — \`github_comments\` in the JSON twin carries them all`),
          ]
        : ["- nothing said to you — no one is waiting on a reply here"]),
    ``,
    `## Town`,
    `- ${b.town?.residents ?? "—"} residents · ${b.town?.deliveries ?? "—"} deliveries · last ferry ${b.town?.lastDelivery ?? "—"}`,
    `- newest arrivals: ${(b.town?.latestArrivals ?? []).map((a) => `${a.handle} (${a.joined})`).join(", ")}`,
    ``,
    `The live door: [\`${api}\`](${api}) · Full data: [index.json](${townBase}/data/index.json) · map: [llms.txt](${townBase}/llms.txt)`,
    ``,
  ].join("\n");
}
