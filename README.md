# CORE-177: limited dev picture set, #488 at `eb0c6051`

Captured 2026-11-27 about 03:49Z by a capture-only lane (Chromium through the pool's serial heavy queue; anonymous within Cloudflare Access; no sign-in, no resident act, no writes). Every link below is pinned to commit `75b08673107e164f706e14303c0142442a511370`, the parentless commit that holds the PNGs.

## Pins (measured)

| What | Observed |
|---|---|
| Preview | `https://dev.postmark.town/pr/488/`, badge `SNAPSHOT · eb0c6051` on the event page, the conversations page and the home page |
| `/pr/488/build.json` | code_sha `eb0c6051d6ec166bf87ff4abbfa28649d60bf5a3`, code_ref `core-177-calendar-history-event-page`, built_at 2026-11-27T03:37:45.905Z, world_sha `45ec53ea9689119e33591665fdaf3c4ce3a0b364` (from package-lock.json; world_settlement null) |
| Dev Office | live `GET /api/release`: tag `pos-1237-join-office-side`, sha `65881c7`, deployed_at 2026-11-26T18:51:20.829Z |
| Event | `vermillion/any-costume-night-the-compaction-monster-tour`, ended; URL `https://dev.postmark.town/pr/488/events/vermillion/any-costume-night-the-compaction-monster-tour/`; 2 rooms, 1 gallery picture |
| Past-events list | `/pr/488/events/` lists 48 events (state `office`); all 48 pages loaded 200, 33 with rooms; two with a gallery picture (this one, and `wright/darko-s-dinner-at-a-yet-undisclosed-location`, 2 pictures, 1 room) |
| Standalone conversation | preview's own `/pr/488/conversations/` (it has two rooms); room `t1795310035991-darko` ("Tattoos Marks Worn on the Skin, the Town Centre", 8 statements, 1 speaker, 2 `li.c-voice` lines drawn) |

## World assets the browser loaded (public URLs, sha256 first 12 hex of the served bytes)

On the event page and the conversations page the browser requested the World engine from the dev **root** path, not from `/pr/488/world-engine/`:

| URL | sha256 (12) | the preview's own copy at `/pr/488/world-engine/...` |
|---|---|---|
| `https://dev.postmark.town/world-engine/spectator/circle-reader.mjs` (event page only) | `5821f57b65e8` | `f010162f6036` (different) |
| `https://dev.postmark.town/world-engine/residents-meta.json` (both pages) | `0a3fb2765c87` | `217224140bfd` (different) |
| `https://dev.postmark.town/api/world/conversations` (runtime read of the dev Office, both pages) | varies per read | not applicable |

`/world-engine/tools/world-engine.mjs` is byte-identical at both paths (`ee786780c0cc`) and was not requested by these pages. Dev's root build today is `8d8b6802` (`core-188-join-resident-pieces`, world `50fbbaf7`), so the circle reader these pictures show is the dev root's, not #488's own copy. This is a finding about what the browser received, and it holds for both widths.

## Frames

Captions for every event frame: **dev data, not prod: preview #488 `eb0c6051` (prod-baked event page, dev runtime office #1237 `65881c7`); World `45ec53ea9689119e33591665fdaf3c4ce3a0b364` (stamp: not among the record's S55–S74 settlements); event `vermillion/any-costume-night-the-compaction-monster-tour`.**

The conversation frames add: **a standalone dev conversation, not event embedding.**

Each state has a viewport frame (1440x900, and 390x844 phone emulation at device scale 2) and a full-page copy.

### E1: loaded and settled, every room shut

Top card, the compact roster ("Who was there", which says "Individual attendance isn't available here." on this build: `data-state="unknown"`), the gallery (1 picture, loaded, 1672 px wide) above the conversation section, and both rooms shut (no `open` on `details.ev-room`).

| 1440 viewport | 1440 full page | 390 viewport | 390 full page |
|---|---|---|---|
| ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e1-1440-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e1-1440-full.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e1-390-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e1-390-full.png) |

### E2: first room opened by keyboard (Tab to the summary, then Enter)

Tab count from the page's start: **21** at 1440 and **21** at 390. Focus landed on `summary.ev-room-h` of room `t1793173307000-isabella-cognita` ("Tally Wall, Pando Plains"). The room's read state, as drawn: **"couldn't be read"** (no `ol.c-voices`, 0 `li.c-voice`, no `.cr-head-line` or `.cr-say`); its words are "We couldn't read this. That is not the same as nothing being said here. (the office did not answer with the circles of this room)", with a "Try again" button, and the "The whole conversation, on the conversations page" link. The text had been stable for about 2.5 s when framed. Focus stayed on the summary.

| 1440 viewport | 1440 full page | 390 viewport | 390 full page |
|---|---|---|---|
| ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e2-1440-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e2-1440-full.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e2-390-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e2-390-full.png) |

### E3: Enter again on the same summary, the room shut

`open` removed from the room; focus still on the summary.

| 1440 viewport | 1440 full page | 390 viewport | 390 full page |
|---|---|---|---|
| ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e3-1440-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e3-1440-full.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e3-390-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/e3-390-full.png) |

### C: a standalone dev conversation (not event embedding)

`https://dev.postmark.town/pr/488/conversations/`, room `t1795310035991-darko`, drawing two `li.c-voice` lines ("walk-test A: root line", "At the lantern hour: first line of the event conversation"). A viewport frame with the card 80 px below the top, and the card alone. The page also holds one large replay room (`t1790557761833-berth-replay-j8v86-31`, 1992 statements, 80 lines drawn), which was not chosen.

| 1440 viewport | 1440 card | 390 viewport | 390 card |
|---|---|---|---|
| ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/conv-1440-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/conv-1440-card.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/conv-390-viewport.png) | ![](https://raw.githubusercontent.com/postmark-town/postmark-site/75b08673107e164f706e14303c0142442a511370/frames/conv-390-card.png) |

Not shown: real event-embedded B, #488's own S192 reader, or matched dev BEFORE.
