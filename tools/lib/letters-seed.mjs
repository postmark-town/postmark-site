// letters-seed.mjs — THE LAST PUBLISHED letters.json, AS THE HELD STATE OF THE LETTER CORPUS (CORE-180).
//
// The release lane on Actions has no letter cache and a clean checkout has no letters, so it read the whole corpus every build (118 of the 182 office requests in the counted pass
// at cf319245, all bulk-priced). Wright, 2026-11-25: "A delivered letter never changes either. So fetch letters incrementally, keeping what the last snapshot has and fetching only
// letters newer than it, with no key and no higher limit." The snapshot kept between builds is the one the build ALREADY publishes: `<town base>/data/letters.json`, which every
// publishing pass writes (public/atelier/postmark/data) and the browser already reads; it survives every checkout and reset, and reading it is one static GET outside the office's
// limit zones (Jetto, 2026-11-25). The reads that use it are fetchLettersFromPublished (tools/lib/fetch-town-data.mjs); this file only reads and checks the seed.
//
// ONLY WHAT THE SITE ALREADY PUBLISHES. The file is mapLetter's projection of the office's rows, deduplicated, with no digest and no raw row: nothing private is read from it and no
// new field is written to it. It is the site's own output, shape-checked here, and a SEED, never a substitute for the office's inventory, which is read every pass.
//
// OFF FOR ANOTHER OFFICE. The default is production's published file and only when the build reads the production API (defaultLettersSeedUrl): another office's build is never
// seeded with production's letters.

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** An explicit POSTMARK_LETTERS_SEED_URL wins (the empty string is none); otherwise the site's own published file, and only when the build reads the default (production) API. */
export function defaultLettersSeedUrl({ env = {}, api, defaultApi, townBase } = {}) {
  if (env.POSTMARK_LETTERS_SEED_URL !== undefined) return env.POSTMARK_LETTERS_SEED_URL || null;
  return api === defaultApi && townBase ? `${townBase}/data/letters.json` : null;
}

/** A letter the build can hold: an object with a string id and a `body` key (an empty body is legal; an absent one is a row that was never the bulk door's). */
const isHeldLetter = (l) => isObj(l) && typeof l.id === "string" && l.id !== "" && Object.hasOwn(l, "body");

/**
 * The last published letters.json. One try, a generous timeout (the file is tens of megabytes): a static file, not the office's keyless API. A 404 is a first build ("none"); a file
 * that cannot be fetched or parsed, is not an array, or holds a row that is not a letter is "unreadable" (the caller then reads the whole corpus, as every build without a seed
 * always has, and says so). An empty array is a valid seed that holds nothing.
 * @returns {Promise<{ state: "unset"|"none"|"ok"|"unreadable", letters?: object[], reason?: string }>}
 */
export async function readLettersSeed({ url = null, fetchImpl = fetch, timeoutMs = 120_000 } = {}) {
  if (!url) return { state: "unset" };
  let res;
  try {
    res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return { state: "unreadable", reason: String(error?.message ?? error).slice(0, 160) };
  }
  if (res.status === 404) return { state: "none" };
  if (!res.ok) return { state: "unreadable", reason: `${res.status} ${res.statusText ?? ""}`.trim() };
  let body;
  try { body = await res.json(); } catch (error) { return { state: "unreadable", reason: `not JSON (${String(error?.message ?? error).slice(0, 100)})` }; }
  if (!Array.isArray(body)) return { state: "unreadable", reason: "it is not an array of letters" };
  if (!body.every(isHeldLetter)) return { state: "unreadable", reason: "a row is not a letter (an id and a body)" };
  return { state: "ok", letters: body };
}
