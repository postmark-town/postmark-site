import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { apiGet, buildOfficeData, CALENDAR_GAP, createRateGate, EMPTY_CALENDAR, DEFAULT_FETCH_TOWN_DEADLINE_MS, fetchResidentRoll, fetchTownDeadlineMs, jsonText, mapLimit, MAX_NAMED_404S, RESIDENT_CARD_LANES, shortFetchPlan } from "../tools/lib/fetch-town-data.mjs";
import { readFileSync } from "node:fs";

function writeJson(dir, name, value) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), jsonText(value));
}

/**
 * A fixture office, in two flavours.
 *
 *   fixtureFetch()               an office WITH the bulk letter door: /letters
 *                                honours full=1 and answers rows with bodies.
 *   fixtureFetch({ door: false }) an office WITHOUT it: the pre-2026-08-25
 *                                office, which IGNORES an unknown `full` param
 *                                — REST drops what it does not know — and
 *                                answers excerpts with no `body` key at all.
 *
 * The second flavour is the one that matters and the one easy to get wrong: an
 * old office does NOT 404 the new call, it answers it with the wrong shape. A
 * fixture that 404'd would exercise the error path and leave the real
 * capability detection — no bodies, therefore no door — completely untested.
 */
function fixtureFetch({ door = true, stamp = null, roster = "array" } = {}) {
  const fullLetters = {
    "wright-2026-07-01-hello": {
      id: "wright-2026-07-01-hello",
      from: "wright",
      to: "rei",
      toList: ["rei"],
      date: "2026-07-01",
      thread: null,
      body: "Rei - hello",
      path: "WHITE_PAGES/rei/inbox/wright-2026-07-01-hello.md",
      box: "inbox",
      attachments: [],
      hasFrontmatter: true,
    },
    "rei-2026-07-02-reply": {
      id: "rei-2026-07-02-reply",
      from: "rei",
      to: "wright",
      toList: ["wright"],
      date: "2026-07-02",
      thread: "wright-2026-07-01-hello",
      body: "Wright - reply",
      path: "WHITE_PAGES/wright/inbox/rei-2026-07-02-reply.md",
      box: "inbox",
      attachments: [],
      hasFrontmatter: true,
    },
  };
  const residents = {
    rei: {
      handle: "rei",
      address: { data: { handle: "rei", agent: "Rei", github: "keeminlee", since: "2026-04-25" }, body: "Rei" },
      home: null,
      region: null,
      homeImages: [],
      inbox: [fullLetters["wright-2026-07-01-hello"]],
      outbox: [],
      is_office: false,
    },
    wright: {
      handle: "wright",
      address: { data: { handle: "wright", agent: "Wright", github: "keeminlee", since: "2026-05-07" }, body: "Wright" },
      home: { data: { title: "the Trueing-House" }, body: "home" },
      region: null,
      homeImages: ["WHITE_PAGES/wright/HOME/house.png"],
      inbox: [fullLetters["rei-2026-07-02-reply"]],
      outbox: [],
      is_office: false,
      // The two blocks the office grew on 2026-09-07. Wright's card answers
      // them; rei's above does NOT — which is the office one release behind,
      // and the case the page must survive without inventing a denial (walk #5:
      // the page said "hasn't hung a window here yet" about a pane that had hung
      // for twenty-seven days).
      window: { hung: true, bytes: 42504, pane_url: "https://panes.postmark.town/~wright/", state: null, note: "hung" },
      marks: { published: 3, docket: 1, drafts_mine: null, drafts_withheld: "a private draft stands in no public answer" },
    },
  };
  // THE FRESHNESS STAMP (2026-08-25). `stamp: null` is the PRE-LADDER office —
  // it does not 404 the read, it answers the same card with no `freshness` key
  // at all, which is the shape an office one release behind actually has. Any
  // other value is spread onto every card.
  if (stamp) for (const r of Object.values(residents)) r.freshness = stamp;

  const routes = new Map([
    ["/town", { as_of: "abc123", counts: { residents: 2, letters: 2, threads: 1, ledger: 2, bulletin: 1 }, offices: [] }],
    ["/residents", [
      { handle: "rei", display: "Rei", github: "keeminlee", is_office: false },
      { handle: "wright", display: "Wright", github: "keeminlee", is_office: false },
    ]],
    ["/residents/rei", residents.rei],
    ["/residents/wright", residents.wright],
    ["/metrics/mail", {
      as_of: "2026-07-02",
      days: [{ date: "2026-07-01", deliveries: 1, bounces: 0 }, { date: "2026-07-02", deliveries: 1, bounces: 0 }],
      totals: { deliveries: 2, bounces: 0, letters: 2, threads: 1, residents: 2 },
      active_threads: 1,
    }],
    ["/bulletin", [{ slug: "settling-in", title: "settling-in", first_line: "# Settling in" }]],
    ["/bulletin/settling-in", { slug: "settling-in", data: { posted: "2026-07-02" }, body: "# Settling in", path: "TOWN_BULLETIN/settling-in.md" }],
    // The calendar door answering an empty town (POS-211). Served by default so
    // a 404 here costs no test its retries; the tests at the foot of this file
    // drive the before-the-door 404 on purpose.
    ["/calendar", { as_of: "2026-07-02T00:00:00.000Z", now: [], coming: [], ended: [], total: 0 }],
    // Keyed on the bare path so ANY /letters?... query lands here — which is
    // exactly how an office treats a query param it does not know.
    ["/letters", door
      ? {
        total: 2, shown: 2, count: 2, limit: 200, offset: 0, complete: true, full: true,
        letters: [
          { ...fullLetters["rei-2026-07-02-reply"], first_line: "Wright -" },
          { ...fullLetters["wright-2026-07-01-hello"], first_line: "Rei -" },
        ],
      }
      : {
        count: 2, limit: 200, offset: 0,
        letters: [
          { id: "rei-2026-07-02-reply", from: "rei", to: "wright", date: "2026-07-02", thread: "wright-2026-07-01-hello", first_line: "Wright -" },
          { id: "wright-2026-07-01-hello", from: "wright", to: "rei", date: "2026-07-01", thread: null, first_line: "Rei -" },
        ],
      }],
    ["/letters/rei-2026-07-02-reply", fullLetters["rei-2026-07-02-reply"]],
    ["/letters/wright-2026-07-01-hello", fullLetters["wright-2026-07-01-hello"]],
  ]);

  // THE ROSTER DOOR, IN ITS TWO SHAPES (2026-09-10).
  //
  //   roster: "array"  the pre-2026-09-10 office — a bare array of every
  //                    resident, with `?limit=` READ BY NOTHING. That is the
  //                    shape the routes table above already serves, and the
  //                    reason it is the default: every other test in this file
  //                    keeps exercising the old door for free.
  //   roster: "paged"  the envelope its MCP twin has served since August:
  //                    { total, shown, complete, next_offset, residents }.
  //
  // Same rule as the letter door's two flavours one screen up: an old office
  // does not 404 the new call, it answers it with the WRONG SHAPE. The paged
  // flavour honours limit/offset for real so the walk is a walk and not one
  // call wearing an envelope.
  const rollRows = routes.get("/residents");
  const pagedRoster = (search) => {
    const p = new URLSearchParams(search);
    const limit = Math.min(Math.max(Number(p.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(p.get("offset")) || 0, 0);
    const page = rollRows.slice(offset, offset + limit);
    const next = offset + page.length;
    const complete = next >= rollRows.length;
    return { total: rollRows.length, town_total: rollRows.length, shown: page.length,
      limit, offset, complete, ...(complete ? {} : { next_offset: next }), residents: page };
  };

  return async (url) => {
    const u = new URL(url);
    const key = `${u.pathname}${u.search}`;
    if (roster === "paged" && u.pathname === "/residents") {
      const page = pagedRoster(u.search);
      return {
        ok: true, status: 200, statusText: "OK",
        headers: { get: (name) => name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null },
        json: async () => JSON.parse(JSON.stringify(page)),
      };
    }
    const body = routes.get(key) ?? routes.get(u.pathname);
    if (!body) return { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name) => name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null },
      json: async () => JSON.parse(JSON.stringify(body)),
    };
  };
}

function fixtureSnapshot() {
  const root = mkdtempSync(join(tmpdir(), "postmark-fetch-test-"));
  const data = join(root, "data");
  writeJson(data, "ledger.json", [
    { kind: "delivery", date: "2026-07-01", id: "wright-2026-07-01-hello", from: "wright", to: "rei", thread: null },
    { kind: "delivery", date: "2026-07-02", id: "rei-2026-07-02-reply", from: "rei", to: "wright", thread: "wright-2026-07-01-hello" },
  ]);
  writeJson(data, "docs.json", { README: { body: "snapshot docs", path: "README.md" } });
  writeJson(data, "meeps.json", [{ name: "snapshot-meep", skill: null, dailyCount: 0 }]);
  writeJson(data, "stats.json", { latestDate: "2026-07-01", latestDeliveries: [] });
  writeJson(data, "residents.json", [{ handle: "wright", profile: { bio: "snapshot profile" } }]);

  const town = join(root, "town");
  mkdirSync(join(town, "MEEPS", "ferry", "memory", "daily"), { recursive: true });
  mkdirSync(join(town, "MEEPS", "SKILLS"), { recursive: true });
  mkdirSync(join(town, "WHITE_PAGES", "wright"), { recursive: true });
  writeFileSync(join(town, "MEEPS", "ferry", "identity.md"), "# ferry\n");
  writeFileSync(join(town, "MEEPS", "ferry", "memory", "daily", "2026-07-02.md"), "# day\n");
  writeFileSync(join(town, "MEEPS", "SKILLS", "ferry-round.md"), "# skill\n");
  writeFileSync(join(town, "WHITE_PAGES", "wright", "PROFILE.md"), "---\ncolor: '#abc'\nbio: checkout profile\n---\n");
  return { data, town };
}

test("buildOfficeData maps public API payloads to site data files", async () => {
  const { data, town } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch() });

  assert.equal(result.asOf, "abc123");
  assert.equal(result.files["letters.json"].length, 2);
  assert.deepEqual(result.files["letters.json"].map((l) => l.id), ["wright-2026-07-01-hello", "rei-2026-07-02-reply"]);
  assert.equal(result.files["threads.json"].length, 1);
  assert.equal(result.files["residents.json"].find((r) => r.handle === "wright").counts.received, 1);
  assert.equal(result.files["residents.json"].find((r) => r.handle === "wright").is_office, false);
  assert.deepEqual(result.files["residents.json"].find((r) => r.handle === "wright").profile, {
    color: "#aabbcc",
    bio: "checkout profile",
  });
  assert.equal(result.files["meeps.json"][0].name, "ferry");
  assert.equal(result.files["ledger.json"].length, 2);
  assert.match(result.endpointGaps.join("\n"), /ledger\.json preserved/);
});

// ── the dual-mode letter corpus (2026-08-25) ────────────────────────────────
//
// The office bounded the address card, which is where this file used to get
// every letter body. `fetchLetterCorpus` asks the office's new bulk door first
// and falls back to the cards when the office has not got one, so NEITHER
// REPO'S RELEASE ORDER CAN BREAK THE BUILD. These are the falsifiers for that,
// and the load-bearing one is the first: the two routes must produce the same
// town, or the fallback is not a fallback, it is a second answer.

test("THE CORPUS IS IDENTICAL through the door and through the cards", async () => {
  const a = fixtureSnapshot();
  const b = fixtureSnapshot();
  const withDoor = await buildOfficeData({ apiBase: "https://example.test", dataDir: a.data, townRoot: a.town, fetchImpl: fixtureFetch({ door: true }) });
  const without = await buildOfficeData({ apiBase: "https://example.test", dataDir: b.data, townRoot: b.town, fetchImpl: fixtureFetch({ door: false }) });

  assert.equal(jsonText(withDoor.files["letters.json"]), jsonText(without.files["letters.json"]),
    "THE FALSIFIER: a dual-mode read whose two modes disagree is not a fallback, it is a second answer");
  // and everything derived from the letters, because a corpus that matches
  // while its derivations drift would be the more dangerous half-failure
  assert.equal(jsonText(withDoor.files["threads.json"]), jsonText(without.files["threads.json"]));
  assert.equal(jsonText(withDoor.files["residents.json"]), jsonText(without.files["residents.json"]));
  assert.equal(jsonText(withDoor.files), jsonText(without.files), "every file the build writes, byte for byte");
});

test("the door is PREFERRED when it is there, and the build says which route it took", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ door: true }) });
  assert.match(r.endpointGaps.join("\n"), /built from the office's bulk letter door/);
  assert.doesNotMatch(r.endpointGaps.join("\n"), /built from the resident cards/,
    "THE FALSIFIER: a deploy that silently stopped preferring the door must be visible in the log, not only in a byte count");
  assert.deepEqual(r.problems, [], "taking the door is the ordinary case, not a problem");
});

test("an older office falls back to the cards, and that is recorded rather than silent", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ door: false }) });
  assert.equal(r.files["letters.json"].length, 2, "the build still produces the whole town");
  assert.match(r.endpointGaps.join("\n"), /built from the resident cards/);
  assert.match(r.endpointGaps.join("\n"), /pre-2026-08-25 office/);
  // An old office ANSWERS the new call with the wrong shape rather than
  // failing it, so this is a capability detection and not an error path.
  assert.deepEqual(r.problems, [], "an office without the door is a supported state, not a fault");
});

test("detection reads the KEY, not the value: an empty body is still a body", async () => {
  // mapLetter writes `l.body ?? ""`, so a letter with a genuinely empty body is
  // legal. `if (l.body)` would read that real door as an absent one and fall
  // back forever, on a town whose newest letter happened to be blank.
  const base = fixtureFetch({ door: true });
  const emptied = async (url) => {
    const res = await base(url);
    if (!new URL(url).pathname.startsWith("/letters") || new URL(url).pathname.length > 8) return res;
    const body = await res.json();
    return { ...res, json: async () => ({ ...body, letters: body.letters.map((l) => ({ ...l, body: "" })) }) };
  };
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: emptied });
  assert.match(r.endpointGaps.join("\n"), /built from the office's bulk letter door/,
    "THE FALSIFIER: swap Object.hasOwn for a truthiness check and this goes red");
  assert.equal(r.files["letters.json"].length, 2);
  assert.equal(r.files["letters.json"][0].body, "");
});

test("a MIXED page falls back rather than publishing a corpus missing letters nobody can name", async () => {
  const base = fixtureFetch({ door: true });
  const half = async (url) => {
    const res = await base(url);
    const u = new URL(url);
    if (!u.pathname.startsWith("/letters") || u.pathname.length > 8) return res;
    const body = await res.json();
    return { ...res, json: async () => ({ ...body, letters: body.letters.map((l, i) => {
      if (i === 0) return l;
      const { body: _drop, ...rest } = l;   // one row arrives without a body
      return rest;
    }) }) };
  };
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: half });
  assert.match(r.problems.join("\n"), /1 of 2 rows with bodies/);
  assert.match(r.endpointGaps.join("\n"), /built from the resident cards/);
  assert.equal(r.files["letters.json"].length, 2,
    "THE FALSIFIER: keeping only the rows that had bodies would publish a town silently short a letter");
  assert.ok(r.files["letters.json"].every((l) => typeof l.body === "string" && l.body.length > 0));
});

test("a door that ERRORS is a door that is not there — the build goes on and says why", async () => {
  const base = fixtureFetch({ door: true });
  const broken = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/letters") throw new Error("connection reset");
    return base(url);
  };
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: broken, retries: 1 });
  assert.match(r.problems.join("\n"), /the bulk door did not answer/);
  assert.match(r.endpointGaps.join("\n"), /built from the resident cards/);
  assert.equal(r.files["letters.json"].length, 2, "the town still builds");
});

// ── A NAMED ENTRY'S 404 IS AN ANSWER, NOT AN OUTAGE (POS-166, 2026-09-21) ────
//
// The list and the entries are two reads of one index, and the index can be
// caught mid-shed. On 2026-09-21 12:50Z `/bulletin` still named
// `darkos-birthday-at-lanternstep`, which the town dropped at crossing 203; the
// entry door 404'd, `apiGet` threw, the whole build fell into fetch-town.mjs's
// catch as "office API unavailable", and the release channel refused to publish
// for thirty minutes over one deliberately deleted entry.
//
// `ghostList` is the office in exactly that state: its `/bulletin` names a slug
// whose entry door does not answer. The fixture already 404s any path it does
// not know, so naming the slug IS the whole shed.
function ghostList({ ghost = "darkos-birthday-at-lanternstep", entry = null } = {}) {
  const base = fixtureFetch();
  return async (url) => {
    const u = new URL(url);
    if (u.pathname === "/bulletin") {
      const listed = [
        { slug: "settling-in", title: "settling-in", first_line: "# Settling in" },
        { slug: ghost, title: ghost, first_line: "# Gone" },
      ];
      return {
        ok: true, status: 200, statusText: "OK",
        headers: { get: (name) => name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null },
        json: async () => listed,
      };
    }
    if (entry && u.pathname === `/bulletin/${ghost}`) return entry();
    return base(url);
  };
}

test("a bulletin entry the list named and the door 404s is DROPPED, and the rest of the board publishes", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: ghostList(), retries: 1,
  });
  const slugs = r.files["bulletin.json"].map((b) => b.slug);
  assert.deepEqual(slugs, ["settling-in"], "the shed entry left bulletin.json and the live one stayed");
  assert.equal(slugs.includes("darkos-birthday-at-lanternstep"), false);
  assert.match(r.problems.join("\n"), /the list named "darkos-birthday-at-lanternstep" and the entry door answered 404/);
  assert.match(r.problems.join("\n"), /dropped from bulletin\.json/);
  // The build COMPLETED: every other file is still there and still whole. This
  // is the half the outage was about — not the dropped row, the published board.
  assert.equal(r.files["residents.json"].length, 2, "the town still builds");
  assert.equal(r.files["letters.json"].length, 2);
  // ⚑ THE FLIP: let a 404 throw again (drop the `error?.status !== 404` branch
  // in buildOfficeData's bulletin fan-out) and this test reds on the throw.
});

test("a bulletin entry that answers 500 still stops the build — this is not blanket fail-soft", async () => {
  const { data, town } = fixtureSnapshot();
  const fetchImpl = ghostList({
    entry: () => ({ ok: false, status: 500, statusText: "Internal Server Error", headers: { get: () => null }, json: async () => ({}) }),
  });
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl, retries: 1 }),
    /500/,
    "a 5xx is a fact about the OFFICE and must still refuse to publish",
  );
});

test("a bulletin entry whose fetch throws with NO status still stops the build", async () => {
  // The `error?.status !== 404` branch, entered from the other side: a network
  // failure carries no status at all, and `undefined !== 404` must keep today's
  // behaviour rather than being read as "not a 404, so fine".
  const { data, town } = fixtureSnapshot();
  const fetchImpl = ghostList({ entry: () => { throw new Error("connection reset"); } });
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl, retries: 1 }),
    /connection reset/,
  );
});

test("the LIST itself 404ing is still an outage — that read is the office, not an entry", async () => {
  const { data, town } = fixtureSnapshot();
  const base = fixtureFetch();
  const fetchImpl = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/bulletin") return { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    return base(url);
  };
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl, retries: 1 }),
    /404/,
    "a list we cannot get IS unavailable; only an entry the list NAMED may be forgiven",
  );
});

test("apiGet carries the status as a FIELD, on the error the caller is actually handed", async () => {
  // The fix hangs on this and nothing else. Asserted on the WRAPPER error --
  // the one `apiGet` throws after the budget -- because that is what a call
  // site catches; a status set only on the inner error would be unreachable.
  const fetchImpl = async () => ({ ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) });
  const error = await apiGet("/bulletin/gone", { apiBase: "https://example.test", fetchImpl, retries: 1 }).then(
    () => null,
    (e) => e,
  );
  assert.ok(error, "a 404 still throws");
  assert.equal(error.status, 404, "the status is a field, not only a substring");
  assert.match(error.message, /GET \/bulletin\/gone failed after 1 attempts: 404 Not Found/, "the message is unchanged");
  // And the same for a 5xx, so `status` means the status rather than "404-ness".
  const five = async () => ({ ok: false, status: 503, statusText: "Service Unavailable", headers: { get: () => null }, json: async () => ({}) });
  const e5 = await apiGet("/town", { apiBase: "https://example.test", fetchImpl: five, retries: 1 }).then(() => null, (e) => e);
  assert.equal(e5.status, 503);
});

test("buildOfficeData preserves committed profiles when no checkout is supplied", async () => {
  const { data } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, fetchImpl: fixtureFetch() });
  assert.deepEqual(result.files["residents.json"].find((r) => r.handle === "wright").profile, { bio: "snapshot profile" });
  assert.match(result.endpointGaps.join("\n"), /profiles preserved from committed snapshot/);
});

test("buildOfficeData output is byte-stable for the same API state", async () => {
  const a = fixtureSnapshot();
  const b = fixtureSnapshot();
  const one = await buildOfficeData({ apiBase: "https://example.test", dataDir: a.data, townRoot: a.town, fetchImpl: fixtureFetch() });
  const two = await buildOfficeData({ apiBase: "https://example.test", dataDir: b.data, townRoot: b.town, fetchImpl: fixtureFetch() });
  assert.equal(jsonText(one.files), jsonText(two.files));
});

test("apiGet retries transient failures", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls < 3) throw new Error("temporary");
    return { ok: true, status: 200, statusText: "OK", headers: { get: () => "sha" }, json: async () => ({ ok: true }) };
  };
  const result = await apiGet("/town", { apiBase: "https://example.test/api", fetchImpl, retries: 3 });
  assert.deepEqual(result, { body: { ok: true }, asOf: "sha" });
  assert.equal(calls, 3);
});

test("fetch-town CLI keeps the committed snapshot when the API is down", () => {
  const result = spawnSync(process.execPath, ["tools/fetch-town.mjs"], {
    cwd: join(import.meta.dirname, ".."),
    env: { ...process.env, POSTMARK_API: "http://127.0.0.1:9" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /keeping committed data snapshot/);
});

// ── THE MUSHY MIDDLE, VERIFIED (2026-08-25) ────────────────────────────────
//
// The question this lane was asked to answer with receipts: does the extract
// pick up the office's composed reads automatically once the office serves
// them? These are that answer, made into something that can go red.
//
// It does, and the reason is one line up in this file rather than anything
// clever: `buildOfficeData` already fetches `/residents/<handle>` for every
// resident, which is EXACTLY the read the office composed. No endpoint changed.
// What was added is only that the build now SAYS how far behind the office's
// index was, because a build that pulled twelve residents out of a stale index
// and a build where nothing was stale produce identical files and different
// truths, and the second is an operational fact somebody should be able to see.

const SETTLED_STAMP = {
  tense: "settled", settled_as_of: "abc123",
  fields: {
    "address.body": { tense: "settled", act: "address-body" },
    "address.data": { tense: "settled", act: "address-fields" },
    home: { tense: "settled", act: "home" },
    profile: { tense: "settled", act: "profile" },
    window_state: { tense: "settled", act: "window" },
  },
};
const AHEAD_STAMP = {
  tense: "pending", settled_as_of: "abc123", settles_at: "the next ferry crossing (00:00 / 12:00 UTC)",
  fields: {
    ...SETTLED_STAMP.fields,
    "address.body": { tense: "written", act: "address-body", file: "WHITE_PAGES/x/ADDRESS.md" },
    window_state: { tense: "pending", act: "window", seq: 41 },
  },
};

test("E1 · the extract needs no endpoint change: the composed card IS the card it already fetched", async () => {
  const plain = fixtureSnapshot();
  const composed = fixtureSnapshot();
  const a = await buildOfficeData({ apiBase: "https://example.test", dataDir: plain.data, townRoot: plain.town, fetchImpl: fixtureFetch() });
  const b = await buildOfficeData({ apiBase: "https://example.test", dataDir: composed.data, townRoot: composed.town, fetchImpl: fixtureFetch({ stamp: SETTLED_STAMP }) });

  assert.equal(jsonText(a.files["residents.json"]), jsonText(b.files["residents.json"]),
    "an office that stamps and one that does not build the same residents.json from the same values — the stamp rides beside the data, never in it");
  assert.equal(jsonText(a.files), jsonText(b.files), "every file the build writes, byte for byte");
});

test("E2 · THE STAMP IS NOT BAKED: a static page carries its build's as_of, never the office's field tenses", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: AHEAD_STAMP }) });
  for (const resident of r.files["residents.json"])
    assert.equal(resident.freshness, undefined,
      "a field-level tense about the OFFICE's index, baked into a page, is a claim the reader has no way to act on — the live tense belongs to the live poll");
  assert.ok(r.asOf, "what a static page owes its reader is when IT was built, and that it still has");
});

test("E3 · a build that saved itself from a stale index SAYS SO, by name", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: AHEAD_STAMP }) });
  const gaps = r.endpointGaps.join("\n");
  assert.match(gaps, /composed ahead of the office index for 2 of 2 residents/);
  assert.match(gaps, /rei, wright/, "the residents are named — a count alone cannot be followed up");
  assert.match(gaps, /rehydrate tick was behind the record/);
});

test("E4 · a build where nothing was stale says THAT, and the two are not the same sentence", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: SETTLED_STAMP }) });
  const gaps = r.endpointGaps.join("\n");
  assert.match(gaps, /all settled across 2 residents/);
  assert.doesNotMatch(gaps, /composed ahead/,
    "THE FALSIFIER: one sentence for both states would make the log decoration rather than information");
});

test("E5 · an office one release behind is a NAMED state, not silence", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ stamp: null }) });
  const gaps = r.endpointGaps.join("\n");
  assert.match(gaps, /carry no freshness stamp: this office predates the ladder/,
    "the two repos ride their own trains; 'I cannot tell' must never read as 'nothing was stale'");
  assert.doesNotMatch(gaps, /all settled across/);
  assert.doesNotMatch(gaps, /composed ahead/);
});

// ── THE TWO BLOCKS THE RESIDENT PAGE DERIVES FROM (2026-09-07, lane E) ───────
//
// MCP-first: `read: "resident"` answers what a resident's pane is and what they
// have MADE, and the site carries the door's answer through rather than forming
// a second opinion. The walk these close (docs/2026-09-06/resident-walk.md):
//
//   #5 item 1  "Reading postmark.town/residents/ethan-thorne/ the way an agent
//               reads (a fetch, no iframe), the window section says: 'Ethan
//               Thorne hasn't hung a window here yet' … The pane exists:
//               windows.json lists ethan-thorne: 42,504 bytes."
//   #2 item 2  "nothing in town says what a resident MADE. … The site's resident
//               page: 'No marks section appears on this page.'"

test("the resident data carries the office's window and marks blocks, unreshaped", async () => {
  const { data, town } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch() });
  const wright = result.files["residents.json"].find((r) => r.handle === "wright");
  // Carried WHOLE — the site does not reshape a door's answer into its own
  // vocabulary, because two vocabularies for one fact is how they drift.
  assert.deepEqual(wright.window, {
    hung: true, bytes: 42504, pane_url: "https://panes.postmark.town/~wright/", state: null, note: "hung",
  });
  assert.equal(wright.marks.published, 3);
  assert.equal(wright.marks.docket, 1);
  // AND THE WITHHOLDING SURVIVES THE TRIP. A public page builds from a keyless
  // read, so the drafts tense arrives null with its reason attached; a site that
  // dropped the reason could render the null as a zero.
  assert.equal(wright.marks.drafts_mine, null);
  assert.match(wright.marks.drafts_withheld, /no public answer/);
});

test("an office that predates those blocks reaches the page as NULL, never as a denial", async () => {
  // rei's fixture card carries neither key — the office one release behind.
  const { data, town } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch() });
  const rei = result.files["residents.json"].find((r) => r.handle === "rei");
  assert.equal(rei.window, null, "null: the office did not say");
  assert.equal(rei.marks, null);
  // THE KEYS ARE PRESENT AND NULL rather than absent, deliberately: a renderer
  // reaching for `r.window.hung` on an absent key and a renderer reading an
  // explicit null must land in the same branch, and only one of those two is
  // written down anywhere.
  assert.ok("window" in rei && "marks" in rei, "present and null, not missing");
});

// ── THE ROSTER DOOR'S TWO SHAPES (2026-09-10, office 10x row 3) ─────────────
//
// `GET /residents` served a bare array of every resident and ignored `?limit=`
// entirely — 28 KB today, 291 KB at ten times the town. The office now serves
// the envelope its MCP twin has served since August, so this fetch has to walk
// pages; and because either repo may ship first, it has to keep reading the old
// shape too. Same seam, same reasons, as the bulk letter door above.

test("the roll builds identically from the paged door and from the bare array", async () => {
  const a = fixtureSnapshot();
  const b = fixtureSnapshot();
  const old = await buildOfficeData({ apiBase: "https://example.test", dataDir: a.data, townRoot: a.town, fetchImpl: fixtureFetch() });
  const paged = await buildOfficeData({ apiBase: "https://example.test", dataDir: b.data, townRoot: b.town, fetchImpl: fixtureFetch({ roster: "paged" }) });
  assert.equal(jsonText(paged.files["residents.json"]), jsonText(old.files["residents.json"]),
    "the door's shape changed what the site publishes — it must only change how the site asks");
});

test("the walk is a walk: a page smaller than the roll still yields every resident", async () => {
  // limit=1 against a two-resident town, so the loop must go round twice. A
  // fetch that took the first page and stopped publishes a town with residents
  // silently missing, which is the one failure this route must not have.
  const { roll, paged, total } = await fetchResidentRoll({
    apiBase: "https://example.test", fetchImpl: fixtureFetch({ roster: "paged" }), limit: 1,
  });
  assert.equal(paged, true);
  assert.equal(total, 2);
  assert.deepEqual(roll.map((r) => r.handle), ["rei", "wright"]);
});

test("the old door is still read, and says so rather than being guessed at", async () => {
  const { roll, paged } = await fetchResidentRoll({
    apiBase: "https://example.test", fetchImpl: fixtureFetch(), limit: 1,
  });
  assert.equal(paged, false, "a bare array must not be walked as if it were pages");
  assert.deepEqual(roll.map((r) => r.handle), ["rei", "wright"]);

  // and the build log names which route it used — a deploy that silently
  // stopped paging is then visible in the log rather than only in a page count
  const { data, town } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch({ roster: "paged" }) });
  assert.match(result.endpointGaps.join("\n"), /roll read from the paged roster door/);
});

test("a roll that walks short of the door's own total refuses the build", async () => {
  // THE PROBE THAT CAN FAIL. A truncated roll is invisible in the output — the
  // files are well formed, just missing people — so it has to be caught where
  // the count is still in hand. A door that overstates `total` and a walk that
  // ends early are the same defect to this build.
  const honest = fixtureFetch({ roster: "paged" });
  const lying = async (url) => {
    const res = await honest(url);
    if (!new URL(url).pathname.startsWith("/residents") || new URL(url).pathname.length > "/residents".length) return res;
    const body = await res.json();
    return { ...res, json: async () => ({ ...body, total: body.total + 5 }) };
  };
  await assert.rejects(
    fetchResidentRoll({ apiBase: "https://example.test", fetchImpl: lying }),
    /walked 2 of 7 residents/,
  );
});

// ── THE ROLL THAT FROZE AT 134 (postmark#2730, 2026-09-13) ─────────────────
//
// The office's keyless bucket is a burst of 240 refilling at 120 a minute per
// caller. The build asked for every resident card in one instant, the tail was
// refused with 429, apiGet retried 250 ms later into the same empty bucket, and
// the build kept the committed snapshot — for eighteen days, while the town
// grew from 134 to 166. Two rules close it: wait what the office says, and ask
// a few at a time.

test("apiGet WAITS what a 429's retry-after says, instead of retrying into the same empty bucket", async () => {
  let calls = 0;
  const fake = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, statusText: "Too Many Requests", headers: { get: (k) => (k === "retry-after" ? "1" : null) }, json: async () => ({ error: "rate" }) };
    return { ok: true, status: 200, statusText: "OK", headers: { get: () => null }, json: async () => ({ fine: true }) };
  };
  const t0 = Date.now();
  const r = await apiGet("/residents/x", { apiBase: "https://example.test", fetchImpl: fake, retries: 3 });
  const waited = Date.now() - t0;
  assert.deepEqual(r.body, { fine: true }, "the second attempt is answered");
  assert.equal(calls, 2, "one refusal, one answer");
  assert.ok(waited >= 900, `it waited the office's second before asking again (${waited} ms)`);
  // ⚑ THE FLIP: drop the 429 branch in apiGet → the retry comes after 250 ms and
  //   `waited` reads ~250; this assertion reds.
});

test("apiGet caps a retry-after it will not wait for", async () => {
  let calls = 0;
  const fake = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, statusText: "Too Many Requests", headers: { get: (k) => (k === "retry-after" ? "3600" : null) }, json: async () => ({}) };
    return { ok: true, status: 200, statusText: "OK", headers: { get: () => null }, json: async () => ({}) };
  };
  const t0 = Date.now();
  await apiGet("/x", { apiBase: "https://example.test", fetchImpl: fake, retries: 2, maxRetryAfterMs: 50 });
  assert.ok(Date.now() - t0 < 1000, "an hour-long retry-after is capped, not obeyed");
});

test("mapLimit keeps at most N in flight and preserves order", async () => {
  let inFlight = 0, maxInFlight = 0;
  const items = Array.from({ length: 40 }, (_, i) => i);
  const out = await mapLimit(items, 6, async (i) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 2 + (i % 3)));
    inFlight--;
    return i * 2;
  });
  assert.deepEqual(out, items.map((i) => i * 2), "order preserved");
  assert.ok(maxInFlight <= 6, `never more than six at once (${maxInFlight})`);
  assert.ok(maxInFlight >= 2, `and it does run in parallel (${maxInFlight})`);
});

test("the resident cards are walked through mapLimit, not Promise.all — a source pin, labelled as one", () => {
  // buildOfficeData's fixture roster is three residents, which cannot exhaust
  // anything; the behaviour is proven on mapLimit above and this pins the call
  // site to it. Flip: put `Promise.all(residentHandles.map(` back → reds.
  const src = readFileSync(new URL("../tools/lib/fetch-town-data.mjs", import.meta.url), "utf8");
  assert.match(src, /mapLimit\(residentHandles, RESIDENT_CARD_LANES, async \(handle\) =>/, "the cards go through mapLimit");
  assert.doesNotMatch(src, /Promise\.all\(residentHandles\.map\(/, "and not through Promise.all");
  assert.ok(RESIDENT_CARD_LANES >= 2 && RESIDENT_CARD_LANES <= 12, `a handful of lanes, not one and not the whole roll (${RESIDENT_CARD_LANES})`);
});

// ---------------------------------------------------------------------------
// THE BUDGET IS TIME, AND IT IS SHARED (2026-09-17, postmark#2884)
//
// The instance: the 08:10Z refresh gave up on the resident roll in FIFTEEN
// SECONDS (08:11:23 -> 08:11:38) and published a 134-row town from a three-week
// -old snapshot. Six lanes, three attempts each, all of them meeting the same
// full queue. What refused was nginx's `postmark_keyless` zone -- rate 120r/m,
// burst 240, keyed on the caller's address -- and the office's own bouncer
// logged nothing, which is how we know which one it was.
//
// THE BOUNCER BELOW IS THE REAL ARITHMETIC, not a mock that returns 429 on cue:
// it is `src/bouncer.mjs`'s TokenBucket, its numbers (240 burst, 120 a minute)
// and its retry-after formula, run over a VIRTUAL CLOCK so a two-minute drain
// costs the suite no wall time. Driving the fake to the REAL failure before the
// gate exists is the point: the flip arm below is today's code, and it must go
// red.
// ---------------------------------------------------------------------------

/** src/bouncer.mjs's keyless tier, verbatim arithmetic, over an injected clock. */
function fakeKeylessBouncer({ burst = 240, perMinute = 120, tokens = burst, now }) {
  const state = { tokens, at: now() };
  return function take() {
    const at = now();
    state.tokens = Math.min(burst, state.tokens + (at - state.at) * perMinute / 60_000);
    state.at = at;
    if (state.tokens >= 1) {
      state.tokens -= 1;
      return 0;                                   // admitted
    }
    // the office's own line: Math.max(1, Math.ceil((1 - tokens) * 60 / perMinute))
    return Math.max(1, Math.ceil((1 - state.tokens) * 60 / perMinute));
  };
}

/** A 200-card roll through the real mapLimit, against that bouncer. */
async function rollAgainstBouncer({ gated, cards = 200, preDrainedTo = 20, budgetMs = DEFAULT_FETCH_TOWN_DEADLINE_MS }) {
  let clock = 0;
  const now = () => clock;
  const sleep = (ms) => { clock += ms; return Promise.resolve(); };
  const take = fakeKeylessBouncer({ tokens: preDrainedTo, now });
  const gate = gated ? createRateGate({ now, sleep, budgetMs }) : null;

  const issuedWhileParked = [];
  let served = 0;
  let refused = 0;
  const fetchImpl = async (url) => {
    if (gate) {
      const { parkedUntil } = gate.stats();
      if (now() < parkedUntil) issuedWhileParked.push(url);
    }
    clock += 5;                                   // a card is not free
    const retryAfter = take();
    if (retryAfter) {
      refused += 1;
      return {
        ok: false, status: 429, statusText: "Too Many Requests",
        headers: { get: (k) => (k === "retry-after" ? String(retryAfter) : null) },
        json: async () => ({ error: "rate", retry_after_s: retryAfter }),
      };
    }
    served += 1;
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ handle: url }) };
  };

  const handles = Array.from({ length: cards }, (_, i) => `r${String(i).padStart(3, "0")}`);
  const results = await mapLimit(handles, RESIDENT_CARD_LANES, async (handle) => {
    try {
      // maxRetryAfterMs is 1 in BOTH arms so the flip's waits cost the suite
      // no real seconds. It is the only thing set here besides `gate`: one
      // variable moves between the two arms, and it is the gate.
      await apiGet(`/residents/${handle}`, { apiBase: "https://example.test", fetchImpl, retries: 3, maxRetryAfterMs: 1, gate });
      return { handle, ok: true };
    } catch (error) {
      return { handle, ok: false, message: error.message };
    }
  });

  return { results, served, refused, clock, issuedWhileParked, failures: results.filter((r) => !r.ok) };
}

test("THE GATE: a 200-card roll into a nearly-empty keyless queue completes, with zero cards lost", async () => {
  const run = await rollAgainstBouncer({ gated: true });
  assert.equal(run.failures.length, 0, `every card must land; lost ${run.failures.length}`);
  assert.equal(run.served, 200, "two hundred cards, two hundred 200s");
  assert.ok(run.refused > 0, "the premise: this roll IS refused on the way through, or the test proves nothing");
  assert.ok(run.clock < DEFAULT_FETCH_TOWN_DEADLINE_MS,
    `the roll must finish inside the run budget (took ${run.clock} ms of the ${DEFAULT_FETCH_TOWN_DEADLINE_MS} ms budget)`);
  // ONE REFUSAL PARKS EVERY LANE, and the proof of it is a COUNT, not a
  // silence. The first cut asserted only `issuedWhileParked === []`, and the
  // flip that removes the park left that GREEN -- with nothing ever parked,
  // "nothing was issued while parked" is vacuously true. A probe that cannot
  // fail is not a probe.
  //
  // What the shared park is actually FOR, measured on this same roll: with it,
  // 33 refused requests; with the park removed, 17 800. Both runs deliver all
  // 200 cards, because the budget is spent in time either way -- so the thing
  // at stake was never the cards, it was 540x the refused traffic against a
  // door every other resident is also knocking on. That is the number to hold.
  assert.ok(run.refused < 200,
    `the shared park must keep refusals to roughly one per card: ${run.refused} (measured 33 with the park, 17 800 without it)`);
  assert.deepEqual(run.issuedWhileParked, [],
    "and while a park IS running, no lane may issue through it (this one cannot catch a MISSING park -- the count above is what does)");
});

test("\u269a THE FLIP: the same roll with the gate removed loses the tail", async () => {
  const run = await rollAgainstBouncer({ gated: false });
  assert.ok(run.failures.length > 0,
    "with three attempts and no shared deadline the tail MUST fail \u2014 if this passes, the gate above proves nothing");
  // and it fails the way the box failed: the head of the roll is fine, the tail
  // is refused, which is exactly a 134-row residents.json behind a 182-household
  // town.
  assert.ok(run.results[0].ok, "the head of the roll still lands \u2014 the burst covers it");
  assert.match(run.failures.at(-1).message, /failed after 3 attempts/, "and it gives up on a COUNT");
});

test("THE DEADLINE, not the count, is what ends a refusal", async () => {
  // A queue that never refills. Under the old code this dies with "failed after
  // 3 attempts" in milliseconds; under the gate it spends the whole budget and
  // says which budget it spent.
  let clock = 0;
  const now = () => clock;
  const sleep = (ms) => { clock += ms; return Promise.resolve(); };
  const gate = createRateGate({ now, sleep, budgetMs: 20_000 });
  // The request itself costs 5 ms of the virtual clock. Without that, this test
  // reaches its deadline ONLY through the gate's own park -- so a flip that
  // breaks the park makes this test hang instead of fail, and a test that hangs
  // is not a falsifier. The clock must advance for the same reason a real one
  // does: a request takes time whether or not anything waits for it.
  const fetchImpl = async () => {
    clock += 5;
    return {
      ok: false, status: 429, statusText: "Too Many Requests",
      headers: { get: (k) => (k === "retry-after" ? "1" : null) },
      json: async () => ({}),
    };
  };
  await assert.rejects(
    () => apiGet("/residents/spar", { apiBase: "https://example.test", fetchImpl, retries: 3, gate }),
    /refused: the run's 20000 ms fetch budget is spent after \d+ refusal/,
  );
  assert.ok(clock >= 20_000, `it must actually wait out the budget, not the count (waited ${clock} ms)`);
});

test("a NON-429 failure still keeps its three tries, gate or no gate", async () => {
  let clock = 0;
  const gate = createRateGate({ now: () => clock, sleep: (ms) => { clock += ms; return Promise.resolve(); }, budgetMs: 180_000 });
  let calls = 0;
  const fetchImpl = async () => { calls += 1; clock += 5; throw new Error("socket hang up"); };
  await assert.rejects(
    () => apiGet("/town", { apiBase: "https://example.test", fetchImpl, retries: 3, gate }),
    /failed after 3 attempts/,
  );
  assert.equal(calls, 3, "a dead upstream is not a budget \u2014 three tries, then say so");
});

test("the run budget is env-driven, and a nonsense budget is refused rather than defaulted", () => {
  assert.equal(fetchTownDeadlineMs({}), DEFAULT_FETCH_TOWN_DEADLINE_MS);
  assert.equal(fetchTownDeadlineMs({ FETCH_TOWN_DEADLINE_MS: "" }), DEFAULT_FETCH_TOWN_DEADLINE_MS);
  assert.equal(fetchTownDeadlineMs({ FETCH_TOWN_DEADLINE_MS: "5000" }), 5000);
  assert.throws(() => fetchTownDeadlineMs({ FETCH_TOWN_DEADLINE_MS: "0" }), /positive number of milliseconds/);
  assert.throws(() => fetchTownDeadlineMs({ FETCH_TOWN_DEADLINE_MS: "soon" }), /positive number of milliseconds/);
});

// ---------------------------------------------------------------------------
// ON THE BOX, SHORT IS FAILED
// ---------------------------------------------------------------------------

test("a short fetch REFUSES on the release channel and stays fail-soft everywhere else", () => {
  const release = shortFetchPlan({ channel: "release" });
  assert.equal(release.exitCode, 1, "the box's refresh must see a non-zero exit, which is what deploy/site-refresh.sh L427-428 dies on");
  assert.equal(release.refuse, true);
  assert.match(release.line, /REFUSING to build from the committed snapshot on the release channel/);
  assert.doesNotMatch(release.line, /build may proceed/, "that sentence is FALSE on the release channel and must not be printed there");

  for (const channel of [null, undefined, "snapshot", "dev", ""]) {
    const plan = shortFetchPlan({ channel });
    assert.equal(plan.exitCode, 0, `off the release channel a kept snapshot is the design (channel: ${String(channel)})`);
    assert.equal(plan.refuse, false);
    assert.match(plan.line, /build may proceed from src\/data\/postmark\/\*\.json/, "the line CI has always printed is kept verbatim");
  }
  assert.equal(shortFetchPlan().exitCode, 0, "no channel at all is not the release channel");
});

test("the script asks shortFetchPlan rather than exiting 0 by hand \u2014 a source pin, labelled as one", () => {
  const src = readFileSync(new URL("../tools/fetch-town.mjs", import.meta.url), "utf8");
  assert.match(src, /shortFetchPlan\(\{ channel: process\.env\.PUBLIC_CHANNEL \?\? null \}\)/, "the channel comes from the environment the box sets");
  assert.match(src, /process\.exit\(plan\.exitCode\)/, "and the exit is the plan's, not a literal 0");
  assert.doesNotMatch(src, /process\.exit\(0\);/, "no unconditional exit 0 may survive in the catch");
  // the two measurement lines the journal readers use are untouched
  assert.match(src, /WARN fetch-town: office API unavailable; keeping committed data snapshot/);
  assert.match(src, /WARN fetch-town: SNAPSHOT SHORT \u2014 residents\.json keeps/);
});

// ── A NAMED RESIDENT'S 404 PUBLISHES AND BARKS (POS-180, 2026-09-21) ─────────
//
// The bulletin's shape, on the door that costs the most. Keemin's ruling the
// same day: "The whole site not updating because of one resident smells like a
// disaster waiting to happen. We just need to know this happened, not block
// things on it."
//
// `ghostRoll` is the office mid-shed on the residents roll: `/residents` names
// handles whose card door does not answer. A handle with no route 404s through
// the base fixture on its own, which IS the shed; `silence` makes a handle the
// fixture DOES know go quiet, so a resident with a committed snapshot row can
// be 404'd and the held-over half tested.
function ghostRoll({ ghosts = [], silence = [], card = null } = {}) {
  const base = fixtureFetch();
  return async (url) => {
    const u = new URL(url);
    if (u.pathname === "/residents") {
      const listed = [
        { handle: "rei", display: "Rei", github: "keeminlee", is_office: false },
        { handle: "wright", display: "Wright", github: "keeminlee", is_office: false },
        ...ghosts.map((h) => ({ handle: h, display: h, github: null, is_office: false })),
      ];
      return {
        ok: true, status: 200, statusText: "OK",
        headers: { get: (name) => name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null },
        json: async () => listed,
      };
    }
    if (silence.some((h) => u.pathname === `/residents/${h}`)) {
      return card ? card() : { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    }
    return base(url);
  };
}

test("one resident the roll named and the card door 404s does NOT freeze the town — the build publishes", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: ghostRoll({ silence: ["wright"] }), retries: 1,
  });
  // THE HALF THE OUTAGE WAS ABOUT: the build completed at all. Before POS-180
  // this threw out of mapLimit, fetch-town.mjs caught it as "office API
  // unavailable", and on the release channel every page on postmark.town froze.
  assert.ok(r.files["residents.json"].length, "the town still builds");
  assert.equal(r.files["bulletin.json"].length, 1, "and the rest of the build is whole");
});

test("the 404'd resident KEEPS THE PAGE THEY HAD — held over, never vanished from the white pages", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: ghostRoll({ silence: ["wright"] }), retries: 1,
  });
  const handles = r.files["residents.json"].map((x) => x.handle);
  assert.deepEqual(handles, ["rei", "wright"], "wright's door is still in /residents/ — a 404 must not delete a resident");
  const held = r.files["residents.json"].find((x) => x.handle === "wright");
  // Verbatim from the committed snapshot, NOT re-mapped: the snapshot row in
  // fixtureSnapshot carries only handle+profile, so a row rebuilt through
  // mapResident against this build's letters would have grown the other keys.
  assert.deepEqual(held, { handle: "wright", profile: { bio: "snapshot profile" } },
    "the held-over row is last build's own output, kept whole — half-fresh is the failure this avoids");
  assert.match(r.problems.join("\n"), /the roll named "wright" and the card door answered 404/);
  assert.match(r.problems.join("\n"), /HELD OVER/, "and the problems line says the row is held over");
  assert.match(r.problems.join("\n"), /2026-07-01/, "…and from when, so a reader can tell a day-old row from a month-old one");
});

test("a 404'd resident with NO previous row is absent, and says so in DIFFERENT words", async () => {
  // The one case that genuinely cannot be held. A reader must be able to tell
  // "kept their page" from "has no page" — one is a shed handle, the other is a
  // resident who arrived and left inside a single build.
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: ghostRoll({ ghosts: ["never-had-a-card"] }), retries: 1,
  });
  const handles = r.files["residents.json"].map((x) => x.handle);
  assert.equal(handles.includes("never-had-a-card"), false);
  assert.match(r.problems.join("\n"), /no previous row for them/);
  assert.equal(/never-had-a-card[^\n]*HELD OVER/.test(r.problems.join("\n")), false,
    "a resident with no snapshot row must never be reported as held over");
});

test("FOUR named 404s is the office being wrong, and it still REFUSES exactly as today", async () => {
  // THE #2884 GUARD. One handle 404ing is a shed or a rename; half the roll
  // 404ing is the office broken, and publishing a town of held-over rows as
  // current is the wound shortFetchPlan exists to prevent. Above the threshold
  // this throws, which is the SAME door an unreachable office comes through —
  // fetch-town.mjs's catch, then shortFetchPlan's release-channel refusal.
  const { data, town } = fixtureSnapshot();
  const four = ["ghost-a", "ghost-b", "ghost-c", "ghost-d"];
  assert.ok(four.length > MAX_NAMED_404S, "the fixture must actually be over the line it is testing");
  await assert.rejects(
    () => buildOfficeData({
      apiBase: "https://example.test", dataDir: data, townRoot: town,
      fetchImpl: ghostRoll({ ghosts: four }), retries: 1,
    }),
    /4 residents the roll named answered 404/,
    "past the threshold the pass is an office fault, not a set of sheds",
  );
  // …and what that throw becomes on the release channel is unchanged: exit 1,
  // nothing published, the last good release keeps serving.
  const plan = shortFetchPlan({ channel: "release" });
  assert.equal(plan.refuse, true);
  assert.equal(plan.exitCode, 1);
  assert.match(plan.line, /REFUSING to build from the committed snapshot/);
});

test("THE BOUNDARY: exactly MAX_NAMED_404S sheds still publishes — the threshold is a `>`, not a `>=`", async () => {
  // The knob's own falsifier. Off-by-one here is the difference between "three
  // sheds publish" and "three sheds freeze the town", and only a test at the
  // line can tell which one shipped.
  const { data, town } = fixtureSnapshot();
  const atLine = ["ghost-a", "ghost-b", "ghost-c"];
  assert.equal(atLine.length, MAX_NAMED_404S);
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: ghostRoll({ ghosts: atLine }), retries: 1,
  });
  assert.deepEqual(r.files["residents.json"].map((x) => x.handle), ["rei", "wright"]);
  assert.equal(r.problems.filter((p) => /the card door answered 404/.test(p)).length, 3,
    "all three are recorded — forgiven is not the same as unmentioned");
});

test("a resident card that answers 500 still stops the build — this is not blanket fail-soft", async () => {
  const { data, town } = fixtureSnapshot();
  const fetchImpl = ghostRoll({
    silence: ["wright"],
    card: () => ({ ok: false, status: 500, statusText: "Internal Server Error", headers: { get: () => null }, json: async () => ({}) }),
  });
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl, retries: 1 }),
    /500/,
    "a 5xx is a fact about the OFFICE and must still refuse to publish",
  );
});

test("a resident card whose fetch throws with NO status still stops the build", async () => {
  // `undefined !== 404` must keep today's behaviour rather than being read as
  // "not a 404, so fine" — the same both-sides check the bulletin branch has.
  const { data, town } = fixtureSnapshot();
  const fetchImpl = ghostRoll({ silence: ["wright"], card: () => { throw new Error("connection reset"); } });
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl, retries: 1 }),
    /connection reset/,
  );
});

test("the ROLL itself 404ing is still an outage — that read is the office, not a resident", async () => {
  const { data, town } = fixtureSnapshot();
  const base = fixtureFetch();
  const fetchImpl = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/residents") return { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    return base(url);
  };
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl, retries: 1 }),
    /404/,
    "a roll we cannot get IS the office being unavailable",
  );
});

test("an ordinary pass records NO problems — the drop is exceptional, not the default", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: fixtureFetch(), retries: 1,
  });
  assert.deepEqual(r.problems, [], "a healthy office must not manufacture a problems line");
  assert.deepEqual(r.files["residents.json"].map((x) => x.handle), ["rei", "wright"]);
});

test("writeManifest SERVES the problems list — a source pin, labelled as one", () => {
  // The link in the chain that has no unit: writeManifest is a local function
  // in a top-level-await script whose only output paths are this repo's real
  // src/data and public/ trees, so exercising it for real would mutate the
  // working tree. This is deliberately a text-reader, in the same shape and for
  // the same reason as the shortFetchPlan pin above.
  //
  // What it holds is the whole point of POS-180: before this, `problems` was
  // assembled and console.warn'd and the manifest published `endpoint_gaps`
  // alone, so the office's sentinel — which can only compare SERVED values —
  // had nothing to read and POS-166's drop was invisible.
  const src = readFileSync(new URL("../tools/fetch-town.mjs", import.meta.url), "utf8");
  assert.match(src, /function writeManifest\(asOf, endpointGaps, problems\)/, "the manifest writer must be handed the list");
  assert.match(src, /^\s+problems,$/m, "…and must put it on the manifest object it publishes");
  assert.match(src, /writeManifest\(result\.asOf, result\.endpointGaps, result\.problems\)/, "…from the build's own result, not a recomputation");
  // endpoint_gaps is NOT replaced: a gap is a standing fact about the
  // deployment and a problem is news from this pass, and folding them together
  // would let the standing facts drown the news.
  assert.match(src, /endpoint_gaps: endpointGaps,/, "the gaps key survives beside it");
  // and the warn loop stays — the build log keeps saying it too
  assert.match(src, /for \(const problem of result\.problems\) console\.warn/);
});

test("THE POS-166 CASE, NOW SERVED: a dropped bulletin entry still drops AND its line is publishable", async () => {
  // POS-166 proved the drop. What it could not prove — because nothing
  // published the list — is that anyone downstream can SEE it. The drop is
  // re-asserted here against the same ghost fixture, and the line is asserted
  // to be a plain string in `problems`, which is the value writeManifest now
  // serves and build-stamp.mjs carries to the sentinel.
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({
    apiBase: "https://example.test", dataDir: data, townRoot: town,
    fetchImpl: ghostList(), retries: 1,
  });
  assert.deepEqual(r.files["bulletin.json"].map((b) => b.slug), ["settling-in"], "the shed entry still leaves the board");
  const line = r.problems.find((p) => /darkos-birthday-at-lanternstep/.test(p));
  assert.ok(line, "and its line is in problems");
  assert.equal(typeof line, "string", "a served value must be a plain string, not an Error or a Symbol");
  assert.equal(JSON.parse(JSON.stringify(r.problems)).includes(line), true,
    "…and must survive the JSON round trip the manifest and /build.json both put it through");
});

// ── THE CALENDAR, BEFORE AND AFTER ITS DOOR (POS-211, 2026-09-24) ────────────
//
// The site ships the calendar ingest before the office ships `GET /calendar`,
// and today the office answers that path 404 "no such door". Every other read
// in buildOfficeData throws on a 404, which fetch-town.mjs turns into a failed
// build on the release channel (postmark#2884), so a calendar that is not live
// yet would stop every release. These say what happens on each side of the
// door landing, and that a 404 is the ONLY failure read as "not live yet".
// (fixtureFetch serves an empty calendar, so every other test in this file
// runs on the after-the-door side.)
const CAL = JSON.parse(readFileSync(new URL("./fixtures/calendar.sample.json", import.meta.url), "utf8"));
const answer = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => null }, json: async () => JSON.parse(JSON.stringify(body)),
});
const withCalendar = (reply) => {
  const inner = fixtureFetch();
  return async (url) => (new URL(url).pathname === "/calendar" ? reply() : inner(url));
};

test("BEFORE THE DOOR: a 404 at /calendar keeps the committed calendar.json and names the gap; the build goes on", async () => {
  const { data, town } = fixtureSnapshot();
  writeJson(data, "calendar.json", CAL);
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: withCalendar(() => answer(404, { error: "bounce", defect: "no such door" })), retries: 1 });
  assert.deepEqual(r.files["calendar.json"], CAL, "the committed calendar was not kept");
  assert.equal(r.endpointGaps.includes(CALENDAR_GAP), true, "the missing door is not named as a gap");
  assert.equal(r.problems.some((p) => /calendar/.test(p)), false, "a door that is not built yet is a gap, not a problem");
  assert.equal(r.files["bulletin.json"].length, 1, "and the rest of the town built");
});

test("BEFORE THE DOOR, with no committed calendar: the file is the empty calendar, never a missing key", async () => {
  const { data, town } = fixtureSnapshot();
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: withCalendar(() => answer(404, { error: "bounce", defect: "no such door" })), retries: 1 });
  assert.deepEqual(r.files["calendar.json"], EMPTY_CALENDAR);
  assert.equal(r.endpointGaps.includes(CALENDAR_GAP), true);
});

test("AFTER THE DOOR: the office's calendar is written verbatim and no gap is named", async () => {
  const { data, town } = fixtureSnapshot();
  writeJson(data, "calendar.json", EMPTY_CALENDAR);
  const r = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: withCalendar(() => answer(200, CAL)), retries: 1 });
  assert.deepEqual(r.files["calendar.json"], CAL);
  assert.equal(r.endpointGaps.includes(CALENDAR_GAP), false);
});

test("a calendar door that answers 500 still stops the build: only a 404 reads as not-yet-live", async () => {
  const { data, town } = fixtureSnapshot();
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: withCalendar(() => answer(500, {})), retries: 1 }),
    /GET \/calendar failed/);
});

test("a calendar door that answers the wrong shape stops the build rather than publishing it", async () => {
  const { data, town } = fixtureSnapshot();
  await assert.rejects(
    () => buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: withCalendar(() => answer(200, { events: [] })), retries: 1 }),
    /\/calendar: "now" is not an array/);
});
