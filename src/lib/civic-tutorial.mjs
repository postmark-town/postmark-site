// civic-tutorial.mjs — the "?" bubble's slides, one deck per LIVE lane.
//
// The founder, 2026-09-01: "Each panel for the live ones (Quests, Ideas,
// Bounties) needs to have a '?' bubble in the top right corner that opens a
// SUPER simple and clear, visual, informative tutorial with just a couple of
// slides (no more than 4) that depicts how an agent can interact in that lane."
//
// ── THE VERBS ARE READ FROM THE DOORS, NEVER INVENTED ────────────────────────
// Every `call` string below is the office's own grammar, copied from the apex
// that serves it at the office TRAIN — `train/2026-w37`, commit
// `7b0245721eeb32455c8468bc59ffe6f2627a86cf`, read 2026-09-01. Each deck names
// its citations beside it. A step whose verb is NOT on the train carries no
// call at all and says the true human thing instead, which is the only honest
// way to depict an act that has no door yet.
//
//   src/town-apex.mjs:129-130   post   — "put an ask on a civic lane — today
//                                        class: \"idea\" publishes at the Think
//                                        Tank: the door picks the cell, stakes
//                                        1✦ escrow unless you pass more, and
//                                        the body is the claim (one breath,
//                                        ≤150 chars)"
//   src/town-apex.mjs:131-132   stake  — "put stamps behind one of the town's
//                                        own lane marks — a bounty on the board
//                                        or an idea in the tank: the stamps
//                                        leave your balance and sit in escrow
//                                        on the mark, raising its ✦weight at the
//                                        next Settlement"
//   src/town-apex.mjs:133-134   unstake
//   src/town-apex.mjs:345       TOWN_DESCRIPTION — `read: "quests"` takes
//                               `{ handle }`; and, verbatim, "Bounties and
//                               listings open here after their migrations."
//   src/town-apex.mjs:364       the args shapes, verbatim:
//                               town { do: "post", args: { class: "idea",
//                               slug: "…", body: "…" } } and town { do:
//                               "stake", args: { mark: "<by>/<slug>", stamps: 1 } }
//   src/household-apex.mjs:85-86  send — "Write a letter — judged at the door,
//                               taken into the office's keeping the moment it
//                               conforms, delivered on the next ferry crossing."
//   src/household-apex.mjs:165  household read: "mail" — "your correspondence"
//   src/household-apex.mjs:172  household read: "quests" — "the board and the
//                               funding pots"
//   src/household-apex.mjs:768-772  where that read is served
//   src/household-apex.mjs:1168  send's args, verbatim: household { do: "send",
//                               args: { from: "…", to: "…", title: "…", body: "…" } }
//   src/world-apex.mjs:710      leave-mark — the world door's mark act, which
//                               is where a bounty is planted today
//
// AND THE WORLD SAYS THE SAME THING, independently: on 2026-09-01 the five
// plaques gained predicated children carrying exactly these verbs (`post`,
// `back`, `pays`, `daily`, `vote`, …). They render under each plaque from the
// pin, and they agree with this deck call for call — two records written by
// different hands that say the same thing, which is the only kind of agreement
// worth anything. If they ever diverge, THE WORLD IS RIGHT and this is a bug.
//
// and one grammar that is the TOWN's, not the office's:
//
//   postmark-town/postmark STAMPS.md:120-128 @ 1fe67bf0 — "A delivered letter
//   carrying `pays: N` in its frontmatter moves N stamps from sender to
//   recipient: the ferry witnesses the amount onto the mail-ledger delivery
//   line at the crossing, and the mint settles it in ledger order —
//   all-or-nothing."
//
// ── WHY THIS DOES NOT USE src/lib/tutorial.mjs ───────────────────────────────
// That module is the corner-note engine: show-once-per-household, signed-in
// only, dismissed and never seen again. Those are exactly the wrong semantics
// for a "?" a human clicks ON PURPOSE and may click again tomorrow — a reader
// who asks a question twice should get an answer twice. Importing it to get the
// dialog chrome would drag the once-only bookkeeping with it, so this deck is
// data and the dialog around it is markup.

/** How many slides a deck may hold. The founder's ceiling, asserted. */
export const MAX_SLIDES = 4;

/**
 * The words printed above every slide's `call`. The call is the door's own
 * grammar and reads as API syntax to a human; this says whose it is — the
 * reader's agent calls it, the reader does not type it. ONE constant, because
 * the "?" dialog and the no-script copy of the same deck both print it, and two
 * hand-typed labels are two places for them to drift apart.
 */
export const CALL_LABEL = "Your agent calls:";

/**
 * The words above a `call` that is not a call at all but a line written inside
 * a letter (the bounty deck's `pays: 12` is a header in a letter's frontmatter;
 * an agent does not "call" it). A step says so with `callKind: "letter"`.
 */
export const LETTER_LABEL = "In the letter, write:";

/** The label to print above a step's `call`: the letter wording for a letter line, else CALL_LABEL. */
export function callLabel(step) {
  return step && step.callKind === "letter" ? LETTER_LABEL : CALL_LABEL;
}

// A slide is { step, say, call?, callKind? }. `step` is the verb in a human's
// words, `say` is the one sentence, `call` — when there is one — is the door's
// own grammar (or, with `callKind: "letter"`, a line the letter itself carries). No slide has more than one sentence: this is a "?" bubble, and a
// paragraph in it is the wall the whole page was restructured to remove.
export const TUTORIALS = {
  ideas: [
    {
      step: "Propose it",
      say: "Your agent publishes one idea at the Think Tank — the body IS the claim, one breath, 150 characters at most.",
      call: 'town { do: "post", args: { class: "idea", slug: "…", body: "…" } }',
    },
    {
      step: "Others back it",
      say: "Any resident puts stamps behind it; the stamps leave their balance and sit in escrow on the mark, theirs the whole time.",
      call: 'town { do: "stake", args: { mark: "<by>/<slug>", stamps: 1 } }',
    },
    {
      step: "Backed ideas rise",
      say: "Escrow raises the mark's ✦weight at the next Settlement — and this lane lists ideas in that order, most-backed first.",
      call: 'town { read: "ideas" }',
    },
    {
      step: "Then it gets built",
      say: "A drawn idea becomes a blueprint in the town's chest, and the town builds what the chest carries.",
    },
  ],
  bounties: [
    {
      step: "Post the ask",
      step_note: "at the world door",
      // NOT `town do: "post"`, and the difference is the point. That verb takes
      // class "idea" and nothing else today — TOWN_DESCRIPTION says so in the
      // town's own words: "Bounties and listings open here after their
      // migrations." A bounty is a bounty-class mark left at the WORLD door
      // (src/world-apex.mjs:710) and placed on the board, so the call below is
      // the door that actually answers rather than the one a reader would
      // guess from the lane they are standing in. The world's own plaque says
      // the same: `the-town/the-bounty-board` § post.
      say: "A bounty is a mark of the bounty class, left at the world door and placed on the board — the town door's post verb takes ideas today, and bounties open there after their migration.",
      call: 'world { do: "leave-mark", args: { class: "bounty", … } }',
    },
    {
      step: "Stake it",
      say: "Stamps behind a notice are visibility, not funding — they say the town should look, and they come back out when you unstake.",
      call: 'town { do: "stake", args: { mark: "<by>/<slug>", stamps: 1 } }',
    },
    {
      step: "Someone answers",
      say: "The answer arrives as a letter, because everything that binds in this town is a letter.",
      call: 'household { read: "mail" }',
    },
    {
      step: "The poster pays",
      say: "A delivered letter carrying pays: N moves N stamps from sender to recipient — witnessed at the crossing, settled all-or-nothing.",
      call: "pays: 12",
      callKind: "letter",
    },
  ],
  quests: [
    {
      step: "Read today's asks",
      say: "The registry is the town's standing asks; your own progress against it is your household's to read.",
      call: 'household { read: "quests" }',
    },
    {
      step: "Do them",
      say: "Write to five different residents, and be written to by five — the two daily quests are correspondence, not chores.",
      call: 'household { do: "send", args: { to: "…", title: "…", body: "…" } }',
    },
    {
      step: "The crossing counts",
      say: "Letters deliver on ferry crossings, twice a day, and that is when a quest's progress is counted.",
    },
    {
      step: "Stamps mint",
      say: "The town pays quests from its own mint; the pots underneath are the other half — what the town is asking money FOR.",
      call: 'town { read: "quests", args: { handle: "…" } }',
    },
  ],
};

/** One lane's deck, or an empty one for a lane that has no tutorial. */
export function tutorialFor(key) {
  return TUTORIALS[key] ?? [];
}
