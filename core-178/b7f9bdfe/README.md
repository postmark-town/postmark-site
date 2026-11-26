# CORE-178 pictures: the resident mention, before and after

Every place the Site names a resident, before CORE-178 and after it, at **390** and **1440** px. These pictures go with postmark-site #491, which is still a draft.

- **Before:** `train/2026-w49` at `269f145b`, #491's base.
- **After:** #491's head **`b7f9bdfe`**. CI is green there: `test` 2,667 pass, 0 fail, 194 skipped; `built-pages` 2,860 pass, 0 fail, 1 skipped; `build` and `ship-guard` pass.
- **World viewer:** settlement S192 (`postmark-world` `45ec53ea`), whose served `spectator/viewer.mjs` hashes sha256 `7e601c0a…dfb60a`.
- **Data, the same on both sides:** the production site's public data mirrors (`postmark.town/data/*.json`), plus 10 files at their committed versions. The office API (`/api`) was live, through the dev server's proxy.
- **How they were taken:** each side's dev server, driven by a headless Chromium over the DevTools protocol, through the pool's heavy-run queue. Long pages are shot in whole 6,000 px segments, so lazy pictures load: `name.jpg`, then `name.s2.jpg`, `name.s3.jpg`… beside it.

`index.html` is the same gallery as a page (before beside after, with each surface's numbers). These files are JPEG viewing copies. The measurements were taken on the PNG originals, which the lane keeps with its `report.json`.

## What the after frames measure (`b7f9bdfe`)

- **Drawn** means a reader could see the name now: laid out, not inside a closed fold (`checkVisibility`), inside the viewport across, and not clipped by an ancestor. Folded and off-screen names are counted apart and are **not** measured.
- For every drawn name, the probe reads two things:
  - its computed ink, checked against its own inks (`--rm-ink-n`, `--rm-ink-p`, `--rm-ink`);
  - its contrast, with any opacity, against the median background pixel inside its own box, read from the frame's pixels.
- **On every route and every opened state below, at both widths:**
  - 0 names wear another colour;
  - 0 measure below 4.5:1;
  - every drawn picture loaded.
  - The lowest are: bulletin 4.50, ledger 4.70, pair page 4.81, window street 4.83, Hearth tab 4.83.
- **Textured samples.** Where a box's worst background pixels read below 4.5:1, its non-ink pixels were split into edge pixels (within 2 px of a stroke) and field pixels (the rest):
  - in most of those rows the low pixels are antialiased glyph or underline edges, and the field passes;
  - in 119 rows, all residents with no colour chosen, they are the neutral mention's own faint underline, `rgba(205,194,171,0.45)`;
  - in one row, Wright in the pair page's wrapped heading at 390, they are Ferry's glyphs inside the two-line box.
- **The World column with a conversation open** is opened through the viewer's own path, after its first-visit tour is closed with "skip":
  - at 390, a press on a conversation badge opens its chooser, and its "a conversation" row opens the thread;
  - at 1440, a press on a badge disc at a spot the viewer itself marks as reaching the thread.
  - The page's `setViewerIdentityForSpeaker` is the served viewer's own export.
- **Opened states:** one representative of each folded template, opened by its own control with a real press and confirmed open, before and after.
- **Not walked, as bounded:** the households page at 390 past the 24-segment cap (83 names); the other records of each folded template.

## The pictures

Links are relative, so they resolve inside this commit.

| Surface | 390 before | 390 after | 1440 before | 1440 after | measured after (390 · 1440) |
|---|---|---|---|---|---|
| Front page | [before](img/before/390/front.jpg) | [after](img/after/390/front.jpg) | [before](img/before/1440/front.jpg) | [after](img/after/1440/front.jpg) | 17 drawn, lowest 5.05 · 20 drawn, lowest 5.05 |
| Households | [before](img/before/390/households.jpg) | [after](img/after/390/households.jpg) | [before](img/before/1440/households.jpg) | [after](img/after/1440/households.jpg) | 325 drawn, lowest 5.82 · 408 drawn, lowest 5.73 |
| A household (default Hearth) | [before](img/before/390/household.jpg) | [after](img/after/390/household.jpg) | [before](img/before/1440/household.jpg) | [after](img/after/1440/household.jpg) | 35 drawn, lowest 4.83 · 36 drawn, lowest 4.87 |
| A household (ledger Hearth) | [before](img/before/390/household-ledger.jpg) | [after](img/after/390/household-ledger.jpg) | [before](img/before/1440/household-ledger.jpg) | [after](img/after/1440/household-ledger.jpg) | 36 drawn, lowest 4.76 · 44 drawn, lowest 4.74 |
| A resident | [before](img/before/390/resident.jpg) | [after](img/after/390/resident.jpg) | [before](img/before/1440/resident.jpg) | [after](img/after/1440/resident.jpg) | 9 drawn, lowest 5.75 · 9 drawn, lowest 5.74 |
| Calendar | [before](img/before/390/calendar.jpg) | [after](img/after/390/calendar.jpg) | [before](img/before/1440/calendar.jpg) | [after](img/after/1440/calendar.jpg) | 29 drawn, lowest 5.04 · 29 drawn, lowest 5.04 |
| An event (reader bylines) | [before](img/before/390/event.jpg) | [after](img/after/390/event.jpg) | [before](img/before/1440/event.jpg) | [after](img/after/1440/event.jpg) | 21 drawn, lowest 5.01 · 21 drawn, lowest 5.01 |
| Sparks (pictured cards carry no credit, by Darko's image-first ruling) | [before](img/before/390/sparks.jpg) | [after](img/after/390/sparks.jpg) | [before](img/before/1440/sparks.jpg) | [after](img/after/1440/sparks.jpg) | no names drawn · no names drawn |
| A spark | [before](img/before/390/spark.jpg) | [after](img/after/390/spark.jpg) | [before](img/before/1440/spark.jpg) | [after](img/after/1440/spark.jpg) | 2 drawn, lowest 10.12 · 2 drawn, lowest 10.05 |
| A mail thread | [before](img/before/390/mail-thread.jpg) | [after](img/after/390/mail-thread.jpg) | [before](img/before/1440/mail-thread.jpg) | [after](img/after/1440/mail-thread.jpg) | 37 drawn, lowest 5.13 · 37 drawn, lowest 5.07 |
| A pair page | [before](img/before/390/mail-pair.jpg) | [after](img/after/390/mail-pair.jpg) | [before](img/before/1440/mail-pair.jpg) | [after](img/after/1440/mail-pair.jpg) | 42 drawn, lowest 4.82 · 42 drawn, lowest 4.81 |
| Town | [before](img/before/390/town.jpg) | [after](img/after/390/town.jpg) | [before](img/before/1440/town.jpg) | [after](img/after/1440/town.jpg) | 5 drawn, lowest 6.30 · 5 drawn, lowest 6.29 |
| Hall of Fame | [before](img/before/390/town-quests.jpg) | [after](img/after/390/town-quests.jpg) | [before](img/before/1440/town-quests.jpg) | [after](img/after/1440/town-quests.jpg) | 34 drawn, lowest 5.64 · 34 drawn, lowest 5.69 |
| Fund | [before](img/before/390/fund.jpg) | [after](img/after/390/fund.jpg) | [before](img/before/1440/fund.jpg) | [after](img/after/1440/fund.jpg) | no names drawn · no names drawn |
| A pot (its lists folded) | [before](img/before/390/pot.jpg) | [after](img/after/390/pot.jpg) | [before](img/before/1440/pot.jpg) | [after](img/after/1440/pot.jpg) | no names drawn · no names drawn |
| Projects | [before](img/before/390/projects.jpg) | [after](img/after/390/projects.jpg) | [before](img/before/1440/projects.jpg) | [after](img/after/1440/projects.jpg) | 24 drawn, lowest 5.93 · 24 drawn, lowest 5.87 |
| Replay | [before](img/before/390/replay.jpg) | [after](img/after/390/replay.jpg) | [before](img/before/1440/replay.jpg) | [after](img/after/1440/replay.jpg) | 12 drawn, lowest 5.87 · 11 drawn, lowest 5.89 |
| Conversations | [before](img/before/390/conversations.jpg) | [after](img/after/390/conversations.jpg) | [before](img/before/1440/conversations.jpg) | [after](img/after/1440/conversations.jpg) | 137 drawn, lowest 5.66 · 154 drawn, lowest 5.84 |
| A rendition | [before](img/before/390/rendition.jpg) | [after](img/after/390/rendition.jpg) | [before](img/before/1440/rendition.jpg) | [after](img/after/1440/rendition.jpg) | 1 drawn, lowest 12.35 · 1 drawn, lowest 11.19 |
| Meeps | [before](img/before/390/meeps.jpg) | [after](img/after/390/meeps.jpg) | [before](img/before/1440/meeps.jpg) | [after](img/after/1440/meeps.jpg) | 7 drawn, lowest 5.35 · 7 drawn, lowest 5.31 |
| Bulletin | [before](img/before/390/bulletin.jpg) | [after](img/after/390/bulletin.jpg) | [before](img/before/1440/bulletin.jpg) | [after](img/after/1440/bulletin.jpg) | 6 drawn, lowest 4.50 · 6 drawn, lowest 4.50 |
| Window street | [before](img/before/390/window.jpg) | [after](img/after/390/window.jpg) | [before](img/before/1440/window.jpg) | [after](img/after/1440/window.jpg) | 198 drawn, lowest 4.84 · 198 drawn, lowest 4.83 |
| World (no conversation open) | [before](img/before/390/world.jpg) | [after](img/after/390/world.jpg) | [before](img/before/1440/world.jpg) | [after](img/after/1440/world.jpg) | no names drawn · no names drawn |
| Conversations reader (one conversation) | [before](img/before/390/conversations-reader.jpg) | [after](img/after/390/conversations-reader.jpg) | [before](img/before/1440/conversations-reader.jpg) | [after](img/after/1440/conversations-reader.jpg) | 1 drawn, lowest 6.33 · 1 drawn, lowest 6.34 |
| World column, a conversation open | [before](img/before/390/world-column.jpg) | [after](img/after/390/world-column.jpg) | [before](img/before/1440/world-column.jpg) | [after](img/after/1440/world-column.jpg) | 7 drawn, lowest 6.03 · 2 drawn, lowest 9.04 |
| Pot: Who has staked (opened) | [before](img/before/390/pot-open.jpg) | [after](img/after/390/pot-open.jpg) | [before](img/before/1440/pot-open.jpg) | [after](img/after/1440/pot-open.jpg) | 9 drawn, lowest 6.26 · 9 drawn, lowest 6.21 |
| Hearth tab: closest correspondents (opened) | [before](img/before/390/hearth-tab.jpg) | [after](img/after/390/hearth-tab.jpg) | [before](img/before/1440/hearth-tab.jpg) | [after](img/after/1440/hearth-tab.jpg) | 63 drawn, lowest 4.83 · 77 drawn, lowest 4.85 |
| Ledger accordion section (opened) | [before](img/before/390/ledger-accordion.jpg) | [after](img/after/390/ledger-accordion.jpg) | [before](img/before/1440/ledger-accordion.jpg) | [after](img/after/1440/ledger-accordion.jpg) | 72 drawn, lowest 4.76 · 86 drawn, lowest 4.70 |
| Resident Window (opened) | [before](img/before/390/resident-window.jpg) | [after](img/after/390/resident-window.jpg) | [before](img/before/1440/resident-window.jpg) | [after](img/after/1440/resident-window.jpg) | 10 drawn, lowest 5.07 · 10 drawn, lowest 5.10 |
| Meep panel, Illuminator (opened) | [before](img/before/390/meep-panel.jpg) | [after](img/after/390/meep-panel.jpg) | [before](img/before/1440/meep-panel.jpg) | [after](img/after/1440/meep-panel.jpg) | 7 drawn, lowest 5.02 · 7 drawn, lowest 4.90 |
| Bulletin calendar view (opened) | [before](img/before/390/bulletin-calendar.jpg) | [after](img/after/390/bulletin-notice.jpg) | [before](img/before/1440/bulletin-calendar.jpg) | [after](img/after/1440/bulletin-notice.jpg) | 29 drawn, lowest 5.04 · 29 drawn, lowest 5.04 |
| Replay settlement card (opened) | [before](img/before/390/replay-card.jpg) | [after](img/after/390/replay-card.jpg) | [before](img/before/1440/replay-card.jpg) | [after](img/after/1440/replay-card.jpg) | 12 drawn, lowest 5.87 · 11 drawn, lowest 5.89 |
| Front-page ticker, reduced motion | [before](img/before/390/ticker.jpg) | [after](img/after/390/ticker.jpg) | [before](img/before/1440/ticker.jpg) | [after](img/after/1440/ticker.jpg) | 17 drawn, lowest 5.05 · 18 drawn, lowest 5.05 |

The before frames of the first 23 surfaces were taken in the first round, at most 16,000 px tall. The rest were taken with the after frames' harness.
