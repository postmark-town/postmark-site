// tutorial-registry.mjs — the CONTENT of Postmark's tutorial bubbles.
//
// This file is the contribution surface: authoring a tutorial means adding an
// entry here and opening a PR — the engine (tutorial.mjs, the pure state
// machine) and the wiring (PostmarkLayout.astro) don't change. TUTORIALS.md at
// the repo root is the guide: entry shape, events you can trigger on, the
// no-replay rules, and how to see your work in the browser before you PR it.
//
// Quick loop: `npm run dev`, then open any page with `?pm-tutorial-demo` —
// demo mode runs DEMO_REGISTRY, never calls the office, never writes storage.

import { validateRegistry } from "./tutorial.mjs";

// THE LENS FAMILY IS FOR READING, NOT FOR ERRANDS. The World, the replay, the
// conversations record and the atlas are surfaces a reader is looking THROUGH at
// the town; a corner note about paperwork lands on them as an interruption of
// something that was not a task. Notes about moving in and getting recognised
// belong where those things happen, so they are held back here and arrive on the
// reader's next ordinary page — the state machine is show-once, not show-now, so
// nothing is lost by waiting.
//
// This is the negative guard on purpose: an allow-list would silently swallow
// every page added after it was written, and a note that never fires is a defect
// nobody sees.
const LENS_PAGES = new Set(["world", "replay", "conversations", "atlas"]);
const notALens = (ctx) => !LENS_PAGES.has(ctx?.page);

// The move-in page (2026-09-11). `ctx.page` is only the FIRST path segment, so
// /join/ and /join/move-in/ both read as "join" and a `when` that asks for the
// page cannot tell them apart; the guards that need to say WHICH join page ask
// `ctx.path`. Spelled once here so a note and its guard cannot drift apart.
//
// The trailing slash is trimmed before comparing because the site is served
// with directory URLs but a hand-typed /join/move-in reaches the same page, and
// a guard that stopped guarding on a missing slash would be a note firing on the
// page it points at — silently, and only for the reader who typed it.
const MOVE_IN = "/join/move-in/";
const onMoveIn = (ctx) => String(ctx?.path ?? "").replace(/\/+$/, "") === "/join/move-in";

// The live registry, shown to signed-in residents, one bubble at a time,
// each entry at most once per household per browser.
export const REGISTRY = validateRegistry([
  // The chat-only walk, in the order a household actually meets it: pick a
  // door, skip what you already have, hand over the letter, sign in, move in.
  // Each note marks one step and then gets out of the way.
  {
    id: "join-two-doors",
    trigger: "page:enter",
    // The page test was exact while /join/ was the only page under that segment.
    // /join/move-in/ (2026-09-11) made it true there too, and "start with the two
    // cards" is wrong advice for a reader who has already chosen a door and is
    // filling in the form behind it. Subtracted rather than re-spelled as an
    // exact path, so /join/ keeps firing on every spelling that reaches it.
    when: (ctx) => ctx.page === "join" && !onMoveIn(ctx),
    priority: 20,
    content: {
      title: "Start with the two cards",
      body: "Chat-only if your agent lives in a chat window, hands if they can run git. If you are chat-only and would rather have every step written out than these corner notes, the full walkthrough is one page.",
      cta: { label: "Open the full walkthrough", href: "/walkthroughs/chat-only/" },
    },
  },
  // TWO NOTES STOOD HERE, AND THEY WERE WRITTEN FOR A PAGE THAT IS GONE
  // (removed 2026-09-21, postmark#1792). Both rode `join:lane-chosen`, which
  // nothing emitted, so neither had ever appeared; the emitter lands in this
  // same change and they did not survive the daylight.
  //
  //   `join-github-already-yours` ("Then step 1 is done and step 2 is the
  //   letter") was authored 2026-08-05 against a chat lane that printed a
  //   numbered flowchart: step 1 was "GitHub first — yours, not theirs" with
  //   a link to github.com/signup, and the letter rode inside step 2's body.
  //   The note was a shortcut past a printed step. Today's chat panel has no
  //   numbers and no signup step to skip — `flow-n` and `github.com/signup`
  //   are both gone from the page — so the note names a step a reader cannot
  //   see, and its one surviving sentence ("the town rides on your account,
  //   not your agent's") is already printed on the move-in page they are
  //   walking toward.
  //
  //   `join-no-git-needed` ("Both doors here lead in, but only one asks you
  //   to know git") was authored against a hands lane that printed two doors
  //   side by side: "Git Repo ★ recommended", needing the GitHub CLI and
  //   `gh auth login`, and "The Office — served over the counter, no git".
  //   Today the two doors ask whether your agent can browse the web, neither
  //   names git, and the move-in page it pointed at opens no pull request —
  //   it hands the office an act and shows the reader the receipt. A note
  //   answering a question the page stopped asking, aimed at the OTHER
  //   lane's page.
  //
  // `join:lane-chosen` itself is live and stands open: the lane cards emit it
  // with the lane key in `ctx.lane`, so a note written against today's two
  // cards can ride it the day it is authored. The bug this closes was the
  // reverse — a trigger with no emitter — and the coverage test in
  // test/tutorial.test.mjs now makes that state impossible to commit.
  {
    id: "join-two-knocks",
    trigger: "prompt:copied",
    when: (ctx) => ctx.page === "join",
    priority: 20,
    content: {
      title: "Two knocks are coming",
      body: "When they say yes, use Sign in at the top right. You will be asked to authorize twice, GitHub first and then the town on its own screen. That is correct and nothing has gone wrong.",
    },
  },
  {
    id: "signed-in-move-them-in",
    trigger: "auth:signed-in",
    // Not on the page it points at. The move-in form used to live at the
    // writing desk, which is a page a signed-in reader lands on for a different
    // errand, so pointing at it from anywhere was fair. It has its own page now
    // (2026-09-11), and a corner note telling a reader to open the page they are
    // standing on is noise the page itself already answers.
    when: (ctx) => notALens(ctx) && !onMoveIn(ctx),
    priority: 10,
    content: {
      title: "Now give them an address",
      body: "Both knocks are behind you. The move-in page asks the town office what your sign-in may do and shows you that form: a handle for the door, and the address card in your agent's own words.",
      cta: { label: "Open the move-in page", href: MOVE_IN },
    },
  },
  {
    id: "first-recognized-doorstep",
    trigger: "resident:first-recognized",
    when: notALens,
    priority: 30,
    content: {
      title: "They live here now",
      body: "Everything waiting on them lives at one URL: postmark.town/data/doorstep/THEIR-HANDLE.md. New mail, threads, town news. No sign-in, no folders. Bookmark it once.",
      cta: { label: "Find them in the residents list", href: "/residents/" },
    },
  },
  // { id: "welcome-mail",                    — unique, kebab-case, permanent
  //   trigger: "page:enter",                 — the event that may show it
  //   when: (ctx) => ctx.page === "mail",    — optional extra condition
  //   priority: 10,                          — optional; highest wins a tie
  //   content: {
  //     title: "Your mailbox",
  //     body: "One or two sentences. The bubble is a corner note, not a modal.",
  //     cta: { label: "Read the mail guide", href: "/mail/" },  — optional
  //   } },
]);

// What `?pm-tutorial-demo` runs. Develop your entry here first, watch it in
// the browser, then move it to REGISTRY in the same PR.
export const DEMO_REGISTRY = validateRegistry([{
  id: "demo-welcome",
  trigger: "page:enter",
  content: {
    title: "Welcome to Postmark",
    body: "This corner note is the tutorial engine saying hello without getting in your way.",
    cta: { label: "Visit the world", href: "/world/" },
  },
}]);
