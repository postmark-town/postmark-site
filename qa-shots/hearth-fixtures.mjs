// hearth-fixtures.mjs — synthetic live data for the Hearth walk (POS-959).
//
// Invented residents' activity, shaped like the office's answers (household-dashboard/reads.mjs):
// nothing here is a real letter, stamp count or post, and no request in the walk reaches the live
// office: qa-shots/hearth-walk.mjs routes every /api and postmark.town call to these functions.

const now = () => Date.now();
const ago = (min) => new Date(now() - min * 60_000).toISOString();

/** What the office's doorstep says for `handle`; with the owner's bearer it adds the owner-only block. */
export function doorstep(handle, { owner = false, n = 0 } = {}) {
  const base = {
    handle,
    stamps: { assets: 40 + n * 25, mint_count: 90 + n * 10, holo: n === 0 ? 3 : 0 },
    mail: { letters: [{ id: `fx-in-${handle}-1`, from: "an-outside-friend", delivered_at: ago(40 + n), first_line: "A synthetic hello from outside the house." }] },
    awaiting: { summary: { new_inbound: 1 + n }, unplaced_bounces: n === 1 ? [{ date: "2026-11-03", path: "LETTERS/fx.md", reason: "addressee not found", age_days: 5 }] : [] },
    stances: { stances_awaiting: n === 0 ? 2 : 0 },
    stakes: { at_risk: n === 0 ? 1 : 0, next_settlement: { at: new Date(now() + 3 * 3600_000).toISOString() } },
    next_crossing: { crossing: 216, at: new Date(now() + 75_000).toISOString() },
    window: { pane: { hung: false } },
    rulings: { events: [
      { yours: true, kind: "mark-locked", mark: `${handle}/a-synthetic-mark`, at: ago(120), window: 215, cause_row: "stamps-behind-it" },
      ...(n === 1 ? [{ yours: true, kind: "mark-refused", mark: `${handle}/a-refused-synthetic-mark`, at: ago(300), window: 214, cause_row: "superseded" }] : []),
    ] },
  };
  if (owner) base.your_pending_letters = { standing: [{ to: "an-outside-friend", title: "A letter waiting for the crossing", written_at: ago(10) }] };
  return base;
}

export const outbox = (handle) => [{ id: `fx-out-${handle}-1`, to: "an-outside-friend", delivered_at: ago(25), first_line: `A synthetic note from ${handle}.` }];
export const quests = () => ({ today: { day: "2026-11-08" }, quests: [] });
export const walkers = (handles) => ({ walkers: handles.map((h, i) => ({ handle: h, mark_id: i % 2 ? "current-the-reader/the-snug-harbour" : "current-the-reader/the-long-wharf", moving: false })) });
export const conversations = (handles) => ({ live: [{ id: "fx-talk", place: "the snug harbour", voices: [{ handle: handles[0], said: "A synthetic line, said aloud.", at_ms: now() - 15 * 60_000 }] }], closed: [] });
export const calendar = (hostHandle) => ({
  now: [],
  coming: [
    { id: "fx-host/a-synthetic-gathering", title: "A synthetic gathering", host: hostHandle, phase: "announced", starts: new Date(now() + 26 * 3600_000).toISOString(), place: { name: "the-snug-harbour" }, rsvps: { residents: [hostHandle] } },
    { id: "fx-stranger/the-town-meeting", title: "The synthetic town meeting", host: "a-stranger", phase: "announced", starts: new Date(now() + 50 * 3600_000).toISOString(), place: { name: "the-long-wharf" }, rsvps: { residents: [] } },
  ],
  ended: [], total: 2,
});
export const posts = (cls, handles) => ({
  class: cls, total: 2,
  posts: [
    { class: cls, id: `${handles[0]}/a-synthetic-${cls}`, title: `A synthetic ${cls} from the house`, author: handles[0], household: "hh:fx", state: cls === "bug" ? "reported" : "posted", latest: { act: "post", at: ago(200) }, responses: 0 },
    { class: cls, id: "a-stranger/not-this-house", title: "A post that is not this house's", author: "a-stranger", household: "hh:elsewhere", state: "posted", latest: { act: "post", at: ago(100) }, responses: 0 },
  ],
});
