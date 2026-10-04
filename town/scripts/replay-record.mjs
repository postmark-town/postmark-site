// replay-record — the town's history, cut into frames the /replay/ page can scrub.
//
// The world engine already keeps a durable, committed record of every crossing:
// STATE/log/<n>.jsonl (the events that happened inside it) and
// STATE/snapshot/<n>/entities.json (where all 49 residents stood as it opened).
// Both ship inside the postmark-world package, so this repo reads them the same
// way world-engine-island reads world-state.json — from node_modules, at build.
//
// This module DERIVES rather than copies, following the residents-meta.json
// precedent next door: the jsonl is an engine-internal format, and shipping it
// verbatim would freeze it into a public contract by accident. What goes out is
// one small index for the scrubber and one JSON frame per crossing.
//
// It re-implements no law. Positions are read from the snapshot the engine wrote,
// place words are read off the emission the engine recorded, and mark names are
// deslugged in the browser by the viewer's OWN exported helper. Nothing here
// recomputes where anyone was.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REPLAY_DIR = "/world-engine/replay";

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

// One event per line; a partly-written line is skipped rather than throwing —
// the newest crossing is still being appended to while the site builds.
function readEvents(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed)); } catch { /* torn tail — the record, not a defect */ }
  }
  return out;
}

export function crossingNumbers(pkg) {
  const dir = join(pkg, "STATE", "log");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => /^(\d+)\.meta\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

// The snapshot's entity shape and the office's live walkers shape are nearly the
// same object — deliberately, since both answer "who is where". Translating here
// means the viewer receives a past crossing in exactly the shape it already eats
// from /world/walkers, and no drawing code learns that it is looking at history.
export function walkerFromEntity(entity) {
  const departure = entity?.departure ?? null;
  return {
    handle: entity.handle,
    x: entity.x,
    y: entity.y,
    source: "walk",
    // the snapshot states both halves; a walker is moving when it is neither
    moving: !entity.arrived && !entity.standing,
    toward: departure?.toward ?? null,
    remaining_m: entity.remaining_m ?? 0,
    eta_crossings: entity.eta_crossings ?? 0,
    mark_id: departure?.to ?? null,
  };
}

// The legs of everyone mid-walk when the snapshot was taken, keyed by handle,
// in the shape the walk law reads (the snapshot's own departure fields).
// Arrived and standing walkers have nothing left to derive.
export function openLegs(entities) {
  const out = {};
  for (const entity of entities) {
    const d = entity?.departure;
    if (entity?.arrived || entity?.standing || !d?.from || !d?.toward || !Number.isFinite(d.at)) continue;
    out[entity.handle] = { from: d.from, toward: d.toward, at: d.at, targetExtent: d.within ?? null, pace: d.pace ?? null, to: d.to ?? null };
  }
  return out;
}

// A voice, exactly as the record has it. `place` is the engine's own place words
// ("the Looking Room, the Lanternseed Gardens") — read, never derived here.
function voiceFromEmission(event) {
  const p = event.payload ?? {};
  return {
    handle: p.spoken_by ?? event.actor,
    said: p.text ?? "",
    at: event.at,
    at_ms: Date.parse(event.at),
    x: p.x,
    y: p.y,
    place: p.place ?? null,
    aboard: !!p.aboard,
    human: !!p.human,
  };
}

function moveFromDeparture(event) {
  const p = event.payload ?? {};
  const from = p.from ?? null;
  const toward = p.toward ?? null;
  // A stop is recorded as a zero-distance departure (WORLD/walk-ledger.md), so
  // the record distinguishes "set off" from "stopped" by distance, not by type.
  const dist = from && toward
    ? Math.round(Math.hypot(Number(toward.x) - Number(from.x), Number(toward.y) - Number(from.y)))
    : null;
  return {
    handle: event.actor,
    at: event.at,
    at_ms: Date.parse(event.at),
    from,
    toward,
    to: p.to ?? null,        // the mark that was ASKED FOR, deslugged in the browser
    distance_m: dist,
    stopped: dist === 0,
    // What the walk law needs to place this walker at any later instant
    // (tools/walk.mjs positionAt): the fractional crossing the leg was declared
    // at, the target's extent frozen at departure, and the leg's own stride.
    // Read off the record, never derived; absent on an older record, and the
    // page then places the leg by its instant.
    crossing: Number.isFinite(p.crossing) ? p.crossing : null,
    within: p.within ?? null,
    pace: Number.isFinite(p.pace) ? p.pace : null,
  };
}

export function buildFrame(pkg, n) {
  const meta = readJson(join(pkg, "STATE", "log", `${n}.meta.json`));
  if (!meta) return null;
  const snapshot = readJson(join(pkg, "STATE", "snapshot", String(n), "entities.json"));
  const events = readEvents(join(pkg, "STATE", "log", `${n}.jsonl`));

  const moves = events.filter((e) => e.type === "departure").map(moveFromDeparture);
  const voices = events.filter((e) => e.type === "emission").map(voiceFromEmission);
  // The schema carries a third type. It has never once occurred, so the page is
  // built to show it rather than to assume it away.
  const attachments = events.filter((e) => e.type === "attachment");

  return {
    crossing: n,
    from: meta.covers_from,
    to: meta.covers_to,
    complete: !!meta.complete,
    as_of_world: meta.as_of_world ?? null,
    // the snapshot is the world as the crossing OPENED; the events happened inside it
    evaluated_at: snapshot?.evaluated_at ?? meta.covers_from,
    omits: snapshot?.omits ?? [],
    walkers: (snapshot?.entities ?? []).map(walkerFromEntity),
    // Anyone still walking as the crossing opened, with the leg they were on,
    // so the page can say where that leg had carried them at any moment of it.
    legs: openLegs(snapshot?.entities ?? []),
    moves,
    voices,
    attachments,
  };
}

export function buildIndex(pkg, numbers) {
  const crossings = [];
  for (const n of numbers) {
    const meta = readJson(join(pkg, "STATE", "log", `${n}.meta.json`));
    if (!meta) continue;
    const snapshot = readJson(join(pkg, "STATE", "snapshot", String(n), "entities.json"));
    crossings.push({
      n,
      from: meta.covers_from,
      to: meta.covers_to,
      complete: !!meta.complete,
      event_count: meta.event_count ?? 0,
      counts: meta.counts ?? { departure: 0, attachment: 0, emission: 0 },
      entity_count: snapshot?.entity_count ?? 0,
    });
  }
  return {
    generated: new Date().toISOString(),
    // What the page must never overstate: this record begins where it begins.
    record_begins_at: crossings[0]?.n ?? null,
    crossings,
  };
}

// Every file the replay serves, as {publicPath, body} — the caller writes them
// in build and answers them from memory in dev, exactly like residents-meta.json.
export function replayFiles(pkg) {
  const numbers = crossingNumbers(pkg);
  if (!numbers.length) return [];
  const files = [{ publicPath: `${REPLAY_DIR}/index.json`, body: JSON.stringify(buildIndex(pkg, numbers)) }];
  for (const n of numbers) {
    const frame = buildFrame(pkg, n);
    if (frame) files.push({ publicPath: `${REPLAY_DIR}/${n}.json`, body: JSON.stringify(frame) });
  }
  return files;
}
