# CORE-128 MOCK-UP (PROPOSED, not built): speaker faces on every reader line + a place picture at the card's top right

Two pictures, desktop 1280 and phone 390: `core-128-mockup-desktop-1280.png`, `core-128-mockup-phone-390.png`. Each says MOCK-UP / PROPOSED on the picture itself.

What is real, what is the proposal:
- REAL: the built conversations page of site `76c817eb9` (CORE-121's reviewed artifact, not merged), with the REAL circle reader from World `47ad6380d828fb8b342d1c421b9058f455467987` (S180's `spectator/circle-reader.mjs`), drawing the opened "pica's statement" circle with its nested replies (line + circle disclosure controls unchanged), headless Chromium over the real built `dist-town`.
- INVENTED: the Office answers (`test/fixtures/circles.sample.json`, "invented speech", the CORE-70 worked example), the speakers' handles, and the residents-meta (invented handles).
- STAND-INS: existing public avatar images (`/media/*-avatar-card.jpg`) stand for the speakers' real pictures; an existing public region image stands for the room's mark picture. One invented line is a house's human (`human-of-pica`), drawn with the page's existing dashed monogram chip: no human photo, no new lookup.
- THE PROPOSAL (drawn by a scratch overlay in the screenshot script, NOT product code): a 24px face (the page's own `c-face` idiom: safe public picture, monogram fallback, dashed human chip) at the start of every reader line, at every nesting depth; and, at the TOP RIGHT of the conversation/room card, one 84px place picture (68px on a phone), with the card's head given room beside it. A room whose place has no picture shows nothing there (no empty box). The corner placement is a PROPOSAL for Darko, not a settled interpretation.
- Not shown in this thread: the monogram fallback for a speaker with no public picture (every speaker in the opened circle has a stand-in picture); it is the same `c-face is-mono` the page already draws in the card's participants row.
- Seen on the phone frame, and worth saying: at depth 4 the reader's own indentation leaves the line very narrow (a face plus ~40px of text). That is the reader's existing nesting, which a face makes more noticeable; a depth cap on a phone would be a decision for the World's reader (Bevel), not drawn here.

Unresolved seam (not invented here): which mark's picture a room's card shows. The card knows the room by its `place` words and `at`, not by a mark id, and nothing here infers a mark from a title. Facet's question to Bevel on CORE-128 asks where the shared reader/Office supplies the place identity and its public picture.

`core-128-mockup-states.json`: what the overlay read (6 reader lines, 6 faces: 5 pictures + 1 dashed human chip, no horizontal overflow).
