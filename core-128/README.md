# CORE-128 MOCK-UP (PROPOSED, not built), revision 2: speaker faces on every reader line + a place picture at the card's top right

Two pictures, desktop 1280 and phone 390: `core-128-mockup-desktop-1280.png`, `core-128-mockup-phone-390.png`. Each says MOCK-UP / PROPOSED on the picture itself. Revision 2 of 17401aea (Facet's FIX after opening both frames).

What changed from 17401aea:
- The speaker's face is the page's EXISTING small face (20px `c-face`) placed INLINE at the start of each reader byline, so no ancestor adds an avatar gutter and deep replies keep their width: on the phone the narrowest statement text is 174px wide (it was one-word columns). The reader's ancestry lines and disclosure circles are exactly the reader's own (no depth cap, no layout policy).
- The head reserves the picture's space (padding-right) and wraps all its text; nothing is under the picture (measured: 0 head text rects overlap it, desktop and phone) and no page overflows sideways.

What is real, what is the proposal:
- REAL: the built conversations page of site `76c817eb9` (CORE-121's reviewed artifact, not merged), with the REAL circle reader from World `47ad6380d828fb8b342d1c421b9058f455467987` (S180), drawing the opened "pica's statement" circle with its nested replies, headless Chromium over the real built `dist-town`.
- INVENTED: the Office answers (`test/fixtures/circles.sample.json`, "invented speech", the CORE-70 worked example), the speakers' handles and the residents-meta.
- STAND-INS: existing public avatar images (`/media/*-avatar-card.jpg`) for the speakers' real pictures; an existing public region image for the room's mark picture. One invented line is a house's human (`human-of-pica`), drawn with the page's existing dashed monogram chip: no human photo, no new lookup.
- THE PROPOSAL (drawn by a scratch overlay in the screenshot script, NOT product code): the inline face on every reader line at every depth; one place picture at the TOP RIGHT of the conversation/room card (84px, 64px on a phone), none when no picture exists (no empty box). The corner placement is a PROPOSAL for Darko, not a settled interpretation.
- Not shown: the monogram fallback (every speaker in the opened circle has a stand-in picture); it is the same `c-face is-mono` the page already draws.

Unresolved seam (nothing invented): which mark's picture a room card shows; the card knows place words and `at`, not a mark id (no inference by title or point).

`core-128-mockup-states.json`: 6 lines, 6 faces (5 pictures + 1 dashed human chip), narrowest statement width, head text under the picture = 0, page overflow = 0.
