// non-residents.mjs — WHO THE SITE NEVER COUNTS AS A RESIDENT (CORE-187).
//
// Darko, 2026-11-25: "postmark-pen shouldn't appear under residents (as it isn't one)." The Pen is the office's committer: an actor in the town's history (authorship, auth, Git),
// not a resident, so it is on no residents roll, in no resident data, on no resident page and in no house's member list. This is the ONE place the site says so, and a handle is
// the key: the Pen is excluded whatever its `is_office` flag says (it has been served with either), and the office-role flag is NOT the rule. The real meeps (the Architect, the
// Bugcatcher, the Illuminator, the Postmaster, the Worldkeeper, ...) are residents who are offices, and stay in every roll and path; so does the Registrar. Nothing here is a
// whitelist of today's meeps, and nothing here erases the actor from history: letters, quest posts and commits that name it are untouched; only RESIDENT POPULATION is.
//
// PURE, with no import: the build (tools/), the fold (houses.mjs) and the static routes (town/pages) all read it.

/** the handles that are not residents */
export const NON_RESIDENT_HANDLES = Object.freeze(["postmark-pen"]);

/** True for a handle that may be a resident of the town. */
export const isResidentHandle = (handle) => !NON_RESIDENT_HANDLES.includes(typeof handle === "string" ? handle.toLowerCase() : handle);

/** The resident rows of a list of rows (each `{ handle, ... }`): the Pen's row is dropped, every other row is passed through as it is, in its order. A non-array is returned as it is. */
export const residentsOnly = (rows) => (Array.isArray(rows) ? rows.filter((row) => isResidentHandle(row?.handle)) : rows);

/** The resident handles of a list of handles. A non-array is returned as it is. */
export const residentHandlesOnly = (handles) => (Array.isArray(handles) ? handles.filter(isResidentHandle) : handles);
