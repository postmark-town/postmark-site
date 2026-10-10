// resident-link.mjs — a link to /residents/<handle>/ only where that page stands (POS-530, POS-531).
//
// A letter names its author and recipients by the handle written on it, and a
// settlement names a mark's author by the handle on the mark. Neither is
// promised a resident page: a resident who has since renamed is built under
// the new handle (letters signed dylan-android-husband; the page is `dylan`),
// and some authors are not residents at all (the-town). Linking the handle as
// written sent the reader to a 404.
//
// So a page asks here first. A handle is resolved through the rename record
// (the store's pins, `renamed_to`, baked as renames.json by fetch-town), and
// linked only when the build has a resident page at the end of that walk.
// Anything else prints as plain text, the way the replay's personLink already
// treats human-of-*. The text stays the handle the record wrote; only the
// href follows the rename.
//
// Pure, so a test can hold it against any roll. The pages take the bound copy
// from resident-pages.mjs, which reads the build's own data.

// Renames chain (a → b → c) in principle; a chain longer than this, or a loop,
// is a broken record, and the walk stops and prints text rather than guess.
const MAX_HOPS = 8;

export function residentLinks(residents, renames = {}) {
  const built = new Set((residents ?? []).map((r) => r?.handle).filter(Boolean));
  const next = renames && typeof renames === "object" ? renames : {};
  const pageOf = (handle) => {
    let h = String(handle ?? "");
    for (let hop = 0; h && !built.has(h) && hop < MAX_HOPS; hop++) {
      if (!Object.hasOwn(next, h)) return null;
      h = next[h];
    }
    return built.has(h) ? h : null;
  };
  const hrefOf = (handle) => {
    const page = pageOf(handle);
    return page ? `/residents/${encodeURIComponent(page)}/` : null;
  };
  return { pageOf, hrefOf };
}
