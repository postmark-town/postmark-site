// mail-routes.mjs — the routes of the mail pages that build incrementally (POS-1085).
//
// The pages under town/pages/mail/ named here read NOTHING but their props. Every
// lookup they used to make in the page body (the opener in letters.json, the
// portrait a share card wears, a handle's page, the letters' attachments) happens
// here, in getStaticPaths, and rides in as a prop. That is what makes a route's
// key (incremental.mjs: the hash of its params and props) the whole of what the
// page can show. test/incremental-pages.test.mjs holds the pages to it.
import letters from "@/data/postmark/letters.json";
import threads from "@/data/postmark/threads.json";
import media from "@/data/postmark/media.json";
import residents from "@/data/postmark/residents.json";
import { fmtDate } from "./pm.mjs";
import ledger from "@/data/postmark/ledger.json";
import friendships from "@/data/postmark/friendships.json";
import { pairViews, pairLettersHtml, deliveredOnOf, threadViews, threadLettersHtml } from "./mail-letter.mjs";
import { residentHref } from "./resident-pages.mjs";
import { handlesPreview, openerFirst, sectionCard } from "./og-image.mjs";
import { letterAddresses } from "./mail.mjs";
import { MOVED } from "./nav.mjs";
import { incremental } from "./incremental.mjs";

let threadBook = null;

/** Every conversation, once per build: the thread, its parts, its share card, its links. */
function threadsBook() {
  if (threadBook) return threadBook;
  const byHandle = new Map(residents.map((r) => [r.handle, r]));
  const opened = new Map(letters.map((l) => [l.id, l]));
  threadBook = threadViews(threads, letters).map(({ thread, parts }) => {
    const opener = opened.get(thread.letterIds[0])?.from;
    const { image, card } = handlesPreview(openerFirst(thread.participants, opener), byHandle, sectionCard("mail"), { media });
    return {
      thread,
      parts,
      // a plain { image, card }: what the page's <head> and share card are made from
      preview: { image, card },
      // each participant's own page, or null where none stands (resident-pages.mjs)
      links: thread.participants.map((handle) => ({ handle, href: residentHref(handle) ?? null })),
    };
  });
  return threadBook;
}

const lettersHtml = (ls, thread) => threadLettersHtml(ls, { media, hrefOf: residentHref, threadKey: thread.key });

// mail/[thread]/index.html
export function threadPagePaths() {
  const routes = threadsBook().map(({ thread, parts, preview, links }) => ({
    params: { thread: thread.key },
    props: {
      thread,
      preview,
      links,
      olderIds: parts.slice(1).map((part) => part.map((l) => l.id)),
      html: lettersHtml(parts[0], thread),
    },
  }));
  return incremental("mail-thread", routes, { files: (p) => [`mail/${p.thread}/index.html`] });
}

// mail/[thread]/older/[part]/index.html
export function threadOlderPagePaths() {
  const routes = threadsBook().flatMap(({ thread, parts, preview }) =>
    parts.slice(1).map((ls, i) => ({
      params: { thread: thread.key, part: String(i + 2) },
      props: {
        thread,
        preview,
        part: i + 2,
        parts: parts.length,
        count: ls.length,
        firstDate: fmtDate(ls[0].date),
        lastDate: fmtDate(ls[ls.length - 1].date),
        html: lettersHtml(ls, thread),
      },
    })));
  return incremental("mail-thread-older", routes, { files: (p) => [`mail/${p.thread}/older/${p.part}/index.html`] });
}

// mail/[thread]/older/[part].json
export function threadOlderJsonPaths() {
  const routes = threadsBook().flatMap(({ thread, parts }) =>
    parts.slice(1).map((ls, i) => ({
      params: { thread: thread.key, part: String(i + 2) },
      props: { part: i + 2, parts: parts.length, ids: ls.map((l) => l.id), html: lettersHtml(ls, thread) },
    })));
  return incremental("mail-thread-older-json", routes, { files: (p) => [`mail/${p.thread}/older/${p.part}.json`] });
}

// ── a correspondence: mail/with/[pair] ──────────────────────────────────────

let pairBook = null;

/** Every correspondence, once per build, folded to plain data (no Maps, no functions). */
function pairsBook() {
  if (pairBook) return pairBook;
  const byHandle = new Map(residents.map((r) => [r.handle, r]));
  const deliveredOn = deliveredOnOf(ledger);
  const friendActive = !!(friendships && friendships.active);
  const friendPairs = new Map((friendships?.pairs ?? []).map((p) => [`${p.a}|${p.b}`, p]));
  pairBook = [...pairViews(letters, threads, ledger).values()].map((view) => {
    const { key, a, b, pairLetters, threadOrder, tkeyOf, hueOf, parts } = view;
    const { image, card } = handlesPreview([a, b], byHandle, sectionCard("mail"), { media });
    const entry = friendActive ? friendPairs.get(`${a}|${b}`) ?? null : null;
    return {
      key, a, b, parts, view, deliveredOn,
      preview: { image, card },
      links: { a: residentHref(a) ?? null, b: residentHref(b) ?? null },
      // the milestone the page may show: the pair's own entry, or null (qualifies is the page's law, read as data)
      friendship: entry && entry.qualifies ? entry : null,
      friendStart: friendships?.startDate ?? null,
      threadOrder,
      // the correspondence, oldest first, as the page folds it: nothing but what the heatmap, the rail and the facts read
      rows: pairLetters.map((l) => ({ id: l.id, date: l.date, from: l.from, tkey: tkeyOf(l), hue: hueOf(tkeyOf(l)) })),
    };
  });
  return pairBook;
}

const pairHtml = (p, ls) => pairLettersHtml(p.view, ls, { media, deliveredOn: p.deliveredOn, hrefOf: residentHref });

// mail/with/[pair]/index.html. `today` is the one clock the page reads (its
// heatmap runs to today and it counts days known), so it is a prop: the key of
// every pair page moves once a day, at UTC midnight, and not otherwise.
export function pairPagePaths() {
  const today = new Date().toISOString().slice(0, 10);
  const routes = pairsBook().map((p) => ({
    params: { pair: p.key },
    props: {
      key: p.key, a: p.a, b: p.b, rows: p.rows, threadOrder: p.threadOrder, today,
      preview: p.preview, links: p.links, friendship: p.friendship, friendStart: p.friendStart,
      olderIds: p.parts.slice(1).map((part) => part.map((l) => l.id)),
      html: pairHtml(p, p.parts[0]),
    },
  }));
  return incremental("mail-pair", routes, { files: (p) => [`mail/with/${p.pair}/index.html`] });
}

// mail/with/[pair]/older/[part]/index.html
export function pairOlderPagePaths() {
  const routes = pairsBook().flatMap((p) =>
    p.parts.slice(1).map((ls, i) => ({
      params: { pair: p.key, part: String(i + 2) },
      props: {
        key: p.key, a: p.a, b: p.b, preview: p.preview,
        part: i + 2, parts: p.parts.length, count: ls.length,
        firstDate: fmtDate(ls[0].date), lastDate: fmtDate(ls[ls.length - 1].date),
        html: pairHtml(p, ls),
      },
    })));
  return incremental("mail-pair-older", routes, { files: (p) => [`mail/with/${p.pair}/older/${p.part}/index.html`] });
}

// mail/with/[pair]/older/[part].json
export function pairOlderJsonPaths() {
  const routes = pairsBook().flatMap((p) =>
    p.parts.slice(1).map((ls, i) => ({
      params: { pair: p.key, part: String(i + 2) },
      props: { part: i + 2, parts: p.parts.length, ids: ls.map((l) => l.id), html: pairHtml(p, ls) },
    })));
  return incremental("mail-pair-older-json", routes, { files: (p) => [`mail/with/${p.pair}/older/${p.part}.json`] });
}

// ── [...moved]: a forwarding page per moved URL and per letter's own address ──
// Its page reads only its props already (from, to, letter) and nothing else but
// the site's address, so it needs no new props: only the routes, here.
export function movedPaths() {
  const moved = Object.entries(MOVED).map(([from, to]) => ({
    params: { moved: from.split("/").filter(Boolean).join("/") },
    props: { from, to },
  }));
  const letterForwards = [...letterAddresses(threads, letters)]
    .filter(([id, at]) => id !== at.thread)
    .map(([id, at]) => ({
      params: { moved: `mail/${id}` },
      props: { from: `/mail/${id}/`, to: at.href, letter: true },
    }));
  return incremental("moved", [...moved, ...letterForwards], { files: (p) => [`${p.moved}/index.html`] });
}
