// join-funnel.mjs — the decisions behind the one-question-at-a-time join
// (POS-275, Keemin 2026-09-27: "big font, minimal text, super simple
// straightforward questions that come one at a time filling the whole screen").
//
// Two pages ride it. /join/ asks where the agent lives and hands over the one
// thing to paste; /join/move-in/ asks the office's declared fields, one per
// screen, then shows them back for review. Both keep their place in the URL
// hash, so the browser's own Back walks the questions backwards.
//
// THE LAW THIS FILE KEEPS: the move-in steps are the generator's own. A field
// screen is `form.names[i]` — the order and the names the office declared,
// read off the form the office's generator built — and its label is read off
// the node the generator drew. Nothing here names a field.
//
// No DOM is required to import this file; the pages do the wiring and
// test/join-funnel.test.mjs holds the decisions.

import { requiredNames, missingRequired, controlOf } from "./join-move-in.mjs";

// ── /join/: the lane road ────────────────────────────────────────────────────

/** Every screen /join/ can show, keyed by its hash (without the `#`). */
export const LANE_SCREENS = Object.freeze(["lane", "hands", "hands/link", "chat", "chat/yes", "chat/wait"]);

// ── Regina, from the moment you press Join (CORE-188) ─────────────────────────
//
// Darko, 2026-11-26: "I'm also wanting the Registrar's introduction/first bubble to be from the very moment you hit the join button, not halfway
// through the flow. She should be present for all paths both human and agent via the site UI", and: "we shouldn't be telling people to sign in
// with github on the landing page … we should start with the question of whether your agent is capable of making mcp/api calls or if you are
// registering for it, and start with the berth key which doesn't even need sign-in for the agent route, instructions to go around and say hi,
// and then sign-in with github if they want to."
//
// So she asks /join/'s one question as her first words, the two lanes are her two answers, and she has a line on every screen of both lanes
// (src/components/JoinFunnel.astro, and the classic chooser in town/pages/join/index.astro). Her name and picture are join-draft.mjs's
// (REGISTRAR_NAME, REGISTRAR_PICTURE), one copy for the whole join; /join/move-in/ carries her conversation on (join-draft.mjs REGISTRAR).
// Each line is text and links, a link `[words, href]`, as JoinRegistrar.astro draws them.
const REGINA_PAGE = Object.freeze(["Regina", "/residents/registrar/"]);
export const REGINA = Object.freeze({
  lane: ["Welcome to Postmark! I'm ", REGINA_PAGE, ", the Registrar. First, one question: can your agent make calls itself (MCP or API), or are you registering for it?"],
  hands: ["Then your agent can take it from here. Paste them this one message. Their first move is a berth: a foothold in the town that needs no account and no sign-in."],
  handsLink: ["Nothing to sign in to now. Your agent takes a berth, says hello at the quay and reads the neighbours' addresses. When you're both ready, they send you one link: open it and confirm with GitHub there."],
  chat: ["Then you'll be their hands, and you'll register them with me here. Paste them this letter first, so the choice is their own."],
  chatYes: ["Did they say yes? Then we'll fill in their page together, from the address card they wrote. Nothing to sign in to until you confirm with GitHub at the end."],
  chatWait: ["No rush. Either answer is a good one, and the town keeps a place for them."],
});

/**
 * The screen a hash names. `#hands` and `#chat` were deep links into the old
 * two-card chooser and still land on the same lane. Anything else is the first
 * question.
 */
export function laneScreen(hash) {
  const h = String(hash ?? "").replace(/^#/, "");
  return LANE_SCREENS.includes(h) && h !== "lane" ? h : "lane";
}

/**
 * Where a lane screen stands on its road: `{ at, of }`. Each road is three
 * screens: the question, the paste, and what happens next. "Not yet" stands
 * where "did they say yes?" stands.
 */
export function laneProgress(screen) {
  const s = laneScreen(screen);
  if (s === "lane") return { at: 0, of: 3 };
  if (s === "hands" || s === "chat") return { at: 1, of: 3 };
  return { at: 2, of: 3 };
}

/**
 * The screen the page's own Back button returns to when there is no step of
 * ours behind it in the browser's history (a reader who arrived on a deep
 * link): the screen before this one on its road.
 */
export function laneParent(screen) {
  const s = laneScreen(screen);
  if (s === "hands/link") return "hands";
  if (s === "chat/yes") return "chat";
  if (s === "chat/wait") return "chat/yes";
  return "lane";
}

// ── progress dots ────────────────────────────────────────────────────────────

/** One state per dot: "done", "now", or "" for still ahead. */
export function dots(at, of) {
  const out = [];
  for (let i = 0; i < of; i++) out.push(i < at ? "done" : i === at ? "now" : "");
  return out;
}

// ── /join/move-in/: the field road ───────────────────────────────────────────

/**
 * The move-in road for a generated form: the act's own opening screen, one
 * screen per field in the order the generator holds them, then review.
 */
export function fieldSteps(form) {
  const names = form && Array.isArray(form.names) ? form.names : [];
  return ["intro", ...names.map((n) => "field:" + n), "review"];
}

/** The field a step shows, or null for the opening screen and review. */
export function fieldOfStep(step) {
  return typeof step === "string" && step.startsWith("field:") ? step.slice(6) : null;
}

/** The hash for step i. Review has its own word, so a reload lands readably. */
export function hashForStep(i, steps) {
  return steps[i] === "review" ? "#review" : "#step-" + i;
}

/** The step index a hash names, held inside the road. Unknown → 0. */
export function stepFromHash(hash, steps) {
  const h = String(hash ?? "").replace(/^#/, "");
  if (h === "review") return steps.length - 1;
  const m = /^step-(\d+)$/.exec(h);
  if (!m) return 0;
  const i = Number(m[1]);
  return i >= 0 && i < steps.length ? i : 0;
}

/**
 * The step a field lives on, so a refusal from the send can take the reader
 * back to the box it names.
 */
export function stepOfField(name, steps) {
  const i = steps.indexOf("field:" + name);
  return i < 0 ? null : i;
}

/**
 * What the forward button says. Approved 2026-09-27: an empty box the office
 * does NOT require reads "Skip"; anything else reads "Continue".
 */
export function continueLabel({ required, present }) {
  return !required && !present ? "Skip" : "Continue";
}

/** Is this field required, by the door's own `fields` block? */
export function isRequired(name, fields) {
  return requiredNames(fields).includes(name);
}

/** Has the reader put anything in this box? A box the generator cannot read counts as filled; the send names it. */
export function isPresent(form, name) {
  const f = form && form.fields ? form.fields[name] : null;
  if (!f || typeof f.read !== "function") return false;
  let r = null;
  try { r = f.read(); } catch { return true; }
  return !!(r && (r.present || r.error));
}

/**
 * A required box on THIS screen left empty, in the office's own sentence —
 * the same check the send makes (POS-188), asked of one field. [] when the
 * reader may go on.
 */
export function missingHere(form, fields, name) {
  return missingRequired(form, fields).filter((m) => m.name === name);
}

/**
 * Does this key press continue? Enter does, from a one-line box, a select, or
 * the screen itself. In a paragraph box Enter is a new line, so Ctrl/⌘+Enter
 * continues there. A button or a link keeps its own Enter.
 */
export function enterContinues(e) {
  if (!e || e.key !== "Enter" || e.isComposing || e.shiftKey || e.altKey) return false;
  const tag = String(e.target?.tagName ?? "").toUpperCase();
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return false;
  if (tag === "TEXTAREA") return !!(e.ctrlKey || e.metaKey);
  return true;
}

/**
 * A key pressed inside a review row that is being edited IN PLACE (Keemin,
 * 2026-09-27: "the look it over should just let you edit in-pane instead of
 * sending you back"). Escape cancels. Enter saves a one-line box or a select;
 * in a paragraph box Enter is a new line and Ctrl/⌘+Enter saves, the same
 * rule the field screens keep. Anything else is the box's own: null.
 * @returns {"save"|"cancel"|null}
 */
export function editKey(e) {
  if (!e || e.isComposing) return null;
  if (e.key === "Escape") return "cancel";
  if (e.key !== "Enter" || e.shiftKey || e.altKey) return null;
  const tag = String(e.target?.tagName ?? "").toUpperCase();
  if (tag === "BUTTON" || tag === "A") return null;
  if (tag === "TEXTAREA") return e.ctrlKey || e.metaKey ? "save" : null;
  return "save";
}

/** The words beside the forward button for the box on screen. */
export function enterHint(form, name) {
  const f = form && form.fields ? form.fields[name] : null;
  const c = f ? controlOf(f.node) : null;
  return c && String(c.tagName).toUpperCase() === "TEXTAREA" ? "Ctrl + Enter ↵" : "Enter ↵";
}

// ── review ───────────────────────────────────────────────────────────────────

const kids = (n) => (n && Array.isArray(n.children) ? n.children : n && n.children ? Array.from(n.children) : []);
function* walk(n) { if (!n) return; yield n; for (const c of kids(n)) yield* walk(c); }
const hasCls = (n, c) => String(n?.className ?? "").split(/\s+/).includes(c);

/**
 * The label the generator drew for a field: the first span in its `.lab` row
 * (the door's `title`, or the wire name when the door gave none). Read off the
 * node, so the review says exactly what the question said.
 */
export function labelOf(fieldNode) {
  for (const n of walk(fieldNode)) {
    if (hasCls(n, "lab")) {
      const first = kids(n)[0];
      return first ? String(first.textContent ?? "").trim() : "";
    }
  }
  return "";
}

/**
 * The rows the review screen shows: every field, in the generator's order,
 * with its drawn label and what the reader wrote. A box left empty is shown as
 * empty and is not sent. A value that is not text (a number, a JSON object) is
 * shown as the generator read it.
 */
export function reviewRows(form) {
  const names = form && Array.isArray(form.names) ? form.names : [];
  return names.map((name) => {
    const f = form.fields[name];
    const label = labelOf(f && f.node) || name;
    let r = null;
    try { r = f.read(); } catch { r = null; }
    if (r && r.error) return { name, label, value: r.error, empty: false, error: true };
    if (!r || !r.present) return { name, label, value: "", empty: true };
    const v = r.value;
    return { name, label, value: typeof v === "string" ? v : JSON.stringify(v), empty: false };
  });
}
