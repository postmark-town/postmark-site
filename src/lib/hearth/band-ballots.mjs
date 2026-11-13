// RETIRED, and listed for deletion with test/band-ballots.test.mjs (POS-984, rebuilt 2026-11-10): no page imports this. The household page has no band
// and no ballots any more (Darko, 2026-11-10 17:14–17:28 EST: the theme is the page); the Hearth contest's stake form is on /votes/ (src/lib/ballot-stake.mjs,
// mounted by town/pages/votes/index.astro), where it always was. A lane may not delete a file, so this stays, unchanged, until it is `git rm`'d.
//
// band-ballots.mjs — the open ballots in the household page's band, with the stake form (POS-984, hosting POS-502).
//
// Darko, 2026-11-09 15:38 EST (POS-684 call 4): "The human stakes from the site (POS-502), in the band from call 2." The band
// (HouseBand.astro) is the signed-in human's, so this runs for the house's own sign-in only (stage.mjs mounts it when the reader
// turns out to be an owner): a visitor never reads the ballot here and never loads the form.
//
// WHAT IT DRAWS. One block per STAKING ballot the office lists (GET /votes, public): its name, its window, each choice's stamps as
// they stand, the cap, and the stake form POS-502 publishes (`mountBallotStake`, src/lib/ballot-stake.mjs). Nothing here judges a
// stake: the form posts to the office's household door, and the office judges.
//
// WHAT A STAKE REFRESHES. The form raises `pm:ballot-staked` ({ topic, candidate, from }, bubbling). `refresh()` re-reads the
// ballot and rewrites each choice's stamps IN PLACE: the form and its receipt are never rebuilt, so the receipt stays on screen.
// (stage.mjs also re-reads the house on the same event, so Needs you, the cards and the numbers follow.)
//
// EVERY WORD FROM THE OFFICE GOES IN AS TEXT. No innerHTML, no inline handler, no inline script: the page's security policy
// (tools/lib/hearth-csp.mjs) trusts the host's scripts and nothing an entry carries, and this is the host's. The form's own look
// (BALLOT_STAKE_CSS) is put in the document as a <style> once by the form, which `style-src 'unsafe-inline'` allows.

import { officeBase } from "../auth.mjs";
import { mountBallotStake } from "../ballot-stake.mjs";

/** The staking ballots in GET /votes' answer, in the office's order. */
export const stakingTopics = (data) => (Array.isArray(data?.topics) ? data.topics : [])
  .filter((t) => t && t.status === "staking" && typeof t.topic === "string" && t.topic);

/** A topic slug as a name: "hearth-contest" is "Hearth Contest" (the same rule /votes/ uses). */
export const topicTitle = (slug) => String(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** A ballot's choices as `{ name, staked }`. */
export const choiceRows = (t) => (Array.isArray(t?.candidates) ? t.candidates : [])
  .map((c) => (typeof c === "string" ? { name: c, staked: 0 } : { name: String(c?.candidate ?? ""), staked: Number(c?.staked) || 0 }))
  .filter((c) => c.name);

/**
 * Fill `host` (the band's ballots section) with the open ballots and their stake forms. Returns `{ ready, refresh }`:
 * `ready` settles once the first read has drawn; `refresh()` re-reads and updates each choice's stamps in place.
 * The section stays `hidden` when the office lists no staking ballot, or cannot be read.
 */
export function mountBandBallots(host, { doc = globalThis.document, fetchImpl = globalThis.fetch, storage = globalThis.localStorage, base, mount = mountBallotStake } = {}) {
  if (!host || !doc) return { ready: Promise.resolve(), refresh: async () => {} };
  const office = () => base ?? officeBase(storage);
  const el = (tag, attrs = {}, text) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  const stamps = new Map();   // topic -> Map(choice -> the element showing its stamps)

  async function read() {
    try {
      const res = await fetchImpl(`${office()}/votes`, { headers: { accept: "application/json" } });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  function draw(topics) {
    for (const t of topics) {
      const block = el("article", { class: "hb-ballot", "data-hb-ballot": t.topic });
      block.append(el("h3", { class: "hb-name" }, topicTitle(t.topic)));
      if (t.window) block.append(el("p", { class: "hb-window" }, String(t.window)));
      const list = el("ul", { class: "hb-choices" });
      const shown = new Map();
      for (const c of choiceRows(t)) {
        const n = el("span", { class: "hb-n", "data-hb-staked": c.name }, String(c.staked));
        const li = el("li", { class: "hb-choice" });
        li.append(el("span", { class: "hb-cname" }, c.name), n);
        list.append(li);
        shown.set(c.name, n);
      }
      stamps.set(t.topic, shown);
      block.append(list);
      if (t.cap_per_household_per_candidate) block.append(el("p", { class: "hb-cap" }, `cap ${t.cap_per_household_per_candidate} per household per choice · stakes are escrow, returned at close`));
      const slot = el("div", { class: "hb-stake", "data-hb-stake": t.topic });
      block.append(slot);
      host.append(block);
      mount(slot, { topic: t.topic, choices: t.candidates, doc, storage, fetchImpl, base });
    }
  }

  const ready = (async () => {
    const topics = stakingTopics(await read());
    host.hidden = topics.length === 0;
    if (topics.length) draw(topics);
  })();

  async function refresh() {
    await ready;
    for (const t of stakingTopics(await read())) {
      const shown = stamps.get(t.topic);
      if (!shown) continue;
      for (const c of choiceRows(t)) { const n = shown.get(c.name); if (n) n.textContent = String(c.staked); }
    }
  }
  return { ready, refresh };
}
