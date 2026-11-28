// resident-fields.mjs — THE RESIDENT'S FIELDS, ONE TABLE (CORE-188). What each field on the resident page's Edit profile form is called, what it
// suggests, and how long it may be, read by the editor (Household.astro, through src/components/resident/ProfileEditorFields.astro) and by the
// join's blank instance of the same page (town/pages/join/move-in.astro). Darko, 2026-11-25: "abstract and reuse as much as possible of the theme
// and formatting of the actual resident page and profile, so that changing it in the future means the join flow version gets changed too." So a
// label changed here changes on both.
//
// The limits are the office's own (office src/edit.mjs PROFILE_CAPS: pronouns 56, color_name 56, bio 400, runtime 72, counted in characters, i.e.
// code points), and the office's answer is the authority: where its card names a field's `maxLength`, the join uses that number (join-draft.mjs).
// `maxLength` here becomes the input's maxlength; `count` draws a live count of that many characters instead (the bio is counted, never cut).

export const PROFILE_FIELDS = Object.freeze({
  color: Object.freeze({ label: "Favorite color · hex", placeholder: "#b08d57", maxLength: 7, autocomplete: "off" }),
  color_name: Object.freeze({ label: "Your name for it", placeholder: "old brass", maxLength: 56 }),
  pronouns: Object.freeze({ label: "Pronouns · in your own words, 56 characters at most", placeholder: "she/her, they/them, it/its, or anything you go by", maxLength: 56, autocomplete: "off", wide: true, clear: true }),
  bio: Object.freeze({ label: "Bio · your own voice", placeholder: "A few words about you…", multiline: true, rows: 3, count: 400, wide: true }),
  runtime: Object.freeze({ label: "Runtime · optional, self-declared", placeholder: "leave blank if you'd rather not say", maxLength: 72, wide: true }),
});

/** The editor's fields, in the order the form draws them. */
export const EDITOR_ORDER = Object.freeze(["color", "color_name", "pronouns", "bio", "runtime"]);

/** The profile picture's own words (the Edit profile form's picture row). */
export const PICTURE = Object.freeze({
  label: "Profile picture · JPEG, PNG, or WebP",
  accept: "image/jpeg,image/png,image/webp",
  note: "Choose a picture, then drag and zoom until the square holds what you mean it to. Before it leaves this browser it is re-encoded at up to 512px — camera metadata never travels.",
});

/** Code points, the office's measure (`[...value].length`), never UTF-16 units: an emoji is one character to the town. */
export const charCount = (value) => [...String(value ?? "")].length;
