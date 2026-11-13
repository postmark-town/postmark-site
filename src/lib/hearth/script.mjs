// script.mjs — the house's own scripted part, run ON THE HEARTH PAGE (POS-1024/a, /d; POS-1028).
//
// THE RULING (Darko, 2026-11-13 09:21 EST): "make sure we aren't drifting and doing some weird sandboxing for thee scripted portions. the 100
// stamp min and our close manual pr review is the security that precisely lets us AVOID the sandboxing friction of iframes or whatever. DONT
// do that". And POS-1024/d: "just let them script it however they want, it's their thing".
//
// SO: NO FRAME, NO SEPARATE ORIGIN, NO SANDBOX. An entry's `hearth.js` (a file in its town folder, merged only by pull request, from a house
// with at least 100 lifetime stamps, every line read by hand: PROJECTS/household-hearths/README.md) is copied into the site by
// tools/sync-hearths.mjs, served from the site's own origin at /hearths/<id>.js (town/pages/hearths/[id].js.js), and imported here as an
// ordinary module of this page. The page's security policy already admits the site's own scripts ('self', tools/lib/hearth-csp.mjs): nothing is
// added to it and nothing is taken away. The review is the gate, not this file.
//
// WHAT THE SCRIPT IS HANDED, the one object below (`hearth`):
//   hearth.pane      the <hearth-pane> box, if the design placed one (else null); the script may draw anywhere it likes
//   hearth.root      the design's stage
//   hearth.house     { slug, key, handles, residents: [{ handle, name, accent, avatar }] }: the public faces the page draws
//   hearth.bundle    the office's PUBLIC Hearth bundle (household { read: "hearth" }), or null until it lands; read signed out, so it is
//                    public data only (POS-1024: "the bundle a script gets is public data only")
//   hearth.parts     the same bundle folded into the site's own rows (bundle.mjs § partsFor): { pairs, ties, went, feed, days, humanLog },
//                    each null until its part lands. A script reads these, so the office's row shapes live in one file
//   hearth.view      "owner" when the reader's sign-in holds a resident of this house, else "public"
//   hearth.on(ev,fn) "bundle" (it landed or changed), "view" (the sign-in changed); returns an unsubscribe
//   hearth.read(p)   a public office read by path ("/mail/wright?box=outbox"), signed out; the answer or null
//   hearth.act(a)    { door: "household"|"world"|"town", do, args }: one act through that door's web twin, the same call MCP makes, as the
//                    site (office-write.mjs). Only the house's OWN signed-in human acts: on anyone else's sign-in it refuses and sends nothing.
//   hearth.api       the office's address
//
// A script exports a default function (or `mount`) taking `hearth`; it may return a function, called when the reader switches to another design.
// A script that throws is said in the console and takes nothing else down: the design and the site's slots stay drawn.

import { sendAct } from "../office-write.mjs";
import { partsFor } from "./bundle.mjs";

/** The address an entry's script is served at, versioned by its content so a new merge is never read from a stale cache. null without a script. */
export function scriptUrlOf(entry) {
  const s = entry?.script;
  if (!s || typeof s.hash !== "string" || !/^[a-f0-9]{8,64}$/.test(s.hash)) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(String(entry.id ?? ""))) return null;
  return `/hearths/${entry.id}.js?v=${s.hash.slice(0, 12)}`;
}

export const NOT_YOUR_HOUSE = Object.freeze({
  ok: false, status: 403, refused: true,
  body: { defect: "only this house's own signed-in human acts from its Hearth", hint: "sign in with GitHub as this house's human" },
});

/**
 * The object a script is handed. `state` is the stage's live view of the page: { bundle, owner, token }, read through getters so the script
 * always sees the newest; `listeners` is where on() keeps its callbacks.
 */
export function hearthApi({ entryId, stage, house, api, state, listeners, fetchImpl = globalThis.fetch }) {
  const on = (event, fn) => {
    if (typeof fn !== "function" || !listeners[event]) return () => {};
    listeners[event].add(fn);
    return () => listeners[event].delete(fn);
  };
  return Object.freeze({
    entry: entryId,
    root: stage,
    get pane() { return stage.querySelector('[data-hearth-slot="pane"]'); },
    house,
    get bundle() { return state.bundle ?? null; },
    // the bundle's parts, folded into the site's own row shapes (bundle.mjs; the town README's rule 7), so a script never parses the office's rows
    get parts() { return partsFor(state.bundle ?? null, house?.handles ?? []); },
    get view() { return state.owner ? "owner" : "public"; },
    on,
    api,
    async read(path) {
      if (typeof path !== "string" || !/^\/(?!\/)/.test(path)) return null;
      try {
        const r = await fetchImpl(api + path, { headers: { accept: "application/json" } });   // signed out: never the reader's bearer
        return r.ok ? await r.json() : null;
      } catch { return null; }
    },
    async act({ door, do: verb, args } = {}) {
      if (!state.owner) return NOT_YOUR_HOUSE;
      const token = state.token?.();
      if (!token) return NOT_YOUR_HOUSE;
      return sendAct({ base: api, door, body: { do: verb, args: args ?? {} }, token, fetchImpl });
    },
  });
}

/** Tell every listener of `event`; a listener that throws is said and skipped. */
export function emit(listeners, event, value) {
  for (const fn of listeners[event] ?? []) {
    try { fn(value); } catch (err) { console.error(`hearth script: a "${event}" listener threw`, err); }
  }
}

/**
 * Import and run an entry's script on this page. Resolves to a stop function (never rejects). `load` is the importer (the page's own dynamic
 * import; a test hands a fake).
 */
export async function runEntryScript(entry, hearth, { load = (url) => import(/* @vite-ignore */ url) } = {}) {
  const url = scriptUrlOf(entry);
  if (!url) return () => {};
  try {
    const mod = await load(url);
    const start = typeof mod?.default === "function" ? mod.default : typeof mod?.mount === "function" ? mod.mount : null;
    if (!start) { console.warn(`hearth script: ${entry.id} exports no default function or mount; nothing ran`); return () => {}; }
    const stop = await start(hearth);
    return typeof stop === "function" ? () => { try { stop(); } catch (err) { console.error(`hearth script: ${entry.id}'s stop threw`, err); } } : () => {};
  } catch (err) {
    console.error(`hearth script: ${entry.id} did not run`, err);
    return () => {};
  }
}
