# CORE-82 BEFORE pictures: manifest

Worker: pictures fork of interfaces-plumb-i1. Captured 2026-11-14 about 21:05-21:20Z (wall clock 16:09-16:19 EST on the box). Page clock pinned to **2026-11-14T21:05:00Z** by the harness so "ago" and phases read the same on every capture. Pictures are in `/var/tmp/core-82/before/pictures/`.

## Source refs (scratch copies, never the claimed trees)
- **site 7cf0c6586**: `git archive` of the mirror's `train/2026-w47` head (this base already carries CORE-93's kind 404 page, #421). Copy: `/var/tmp/core-82/before/site-base/` (node_modules symlinked from site-1). Built with `PUBLIC_CHANNEL=release npm run build` (release, not snapshot, so the layout's "SNAPSHOT · local" badge is absent), 7,514 pages. Build log: `/var/tmp/core-82/before/site-build.log`.
- **world 6a3b5350e**: `git archive` of the mirror's `main` head. Copy: `/var/tmp/core-82/before/world-base/`. The site build stages the PINNED World package (`package.json` pin `50d1e6ee…`, an older viewer without `select`/`holdings.mjs`), so for the World column the harness serves `/world-engine/spectator/**` and `/world-engine/tools/**` from the world-base copy (`OVERLAY_WORLD`), i.e. the viewer at world 6a3b5350e is what is pictured.

## Fixtures: everything is INVENTED
- Calendar (copy's `src/data/postmark/calendar.json`, source `/var/tmp/core-82/fixtures/calendar-invented.json`): live event `ada-test/the-snug-harbour-grand-opening` (under way at the capture instant, 2 RSVPs, one announcement), coming event `bo-test/reading-by-the-lamp`. The ended event `ada-test/the-lantern-reading` (ended 2026-11-04T23:00Z, 10 days earlier) is deliberately NOT in any list, as the office drops an event 7 days after it ends, so the base builds no page for it.
- Office (`/var/tmp/core-82/shots/office-stub.mjs`, CDP Fetch, never live): `GET /api/world/conversations` answers one live room "Cave Interior, the Town Centre (INVENTED)" (14 says, 7 speakers: the CORE-70 call-3 worked example, handles made up: pica, seth, claran, amia, noe, liv, vesper) and one closed room "The Snug Harbour (INVENTED)" (3 says), as FLAT lines of seven fields (what the deployed tag serves, no ids). `/api/me` 401. Everything else a JSON 404 bounce.
- Static server mimics the box: an absent path is 404 carrying `/404.html` (the base build has one, from CORE-93).

## Pictures (desktop 1280x800 and phone 390x844; full-page for the site pages, viewport for the World)
| file | what | source ref | notes |
|---|---|---|---|
| `before-conversations-desktop.png`, `-phone.png` | `/conversations/` with the INVENTED room | site 7cf0c6586 | A flat transcript per room card. The live card shows the newest 10 of its 14 statements (the page's own "newest ten" window); "Show earlier" pages closed rooms. Stale quiet-minutes text is not on this base's header (the page says "stay hearable ... until the next settlement"). |
| `before-event-live-desktop.png`, `-phone.png` | `/calendar/ada-test/the-snug-harbour-grand-opening/` | site 7cf0c6586 | The base event page: card, "Who is coming" (RSVPs), "From the host", RSVP forms. No conversation, no gallery, no after-page. Times render in the capture browser's zone (EST). |
| `before-event-ended-10d-path-desktop.png`, `-phone.png` | `/calendar/ada-test/the-lantern-reading/` (document status **404**) | site 7cf0c6586 | What a visitor gets for an event that ended 10 days ago: the page is gone and the kind 404 ("That page isn't here", CORE-93) renders. |
| `before-world-column-desktop.png`, `-phone.png` | the World's shared column showing the conversation | world 6a3b5350e viewer on the site 7cf0c6586 page | A flat list of statements, kicker "a conversation · live", "all conversations →" footer. On the phone the "Postmark" and "Time travel" floating buttons overlap the column (base behaviour). |

## Honest limits
- **World column was opened through the viewer's own test hook, not by a real click.** The harness first tries a real mouse click on the badge (CDP `Input.dispatchMouseEvent`); at the page's default zoom the badge disc is ~6 px and `elementFromPoint` lands on a layer rect, so the click did not open the column. It then calls `window.__pmViewer.select("convo:<id>")`, which is what a click on the badge does (`selectMark -> markInteraction.select`); the column that opens is the real `convoColumnView` through the real `renderHomeColumn`. The script prints which route opened it per capture.
- Headless Chrome fonts and the capture browser's zone (EST) are not production's; compare before and after only from the same harness.
- The "SNAPSHOT" badge was avoided by building with the release channel; the build still ran from the committed data plus the invented calendar, no fetch.

## Re-run for the AFTER set (same inputs)
```
cd /var/tmp/core-82/shots
# site pages (build the head first: PUBLIC_CHANNEL=release npm run build in the ready-head tree, with the SAME invented calendar json copied into src/data/postmark/calendar.json of a SCRATCH copy, never the claimed tree)
DIST=<after dist-town> PREFIX=after OUT=/var/tmp/core-82/after/pictures SCENES=<scenes-after.json> CIRCLES=1 [OVERLAY_WORLD=<core-82 World tree>] node shoot.mjs
# World column
DIST=<after dist-town> PREFIX=after OUT=/var/tmp/core-82/after/pictures CIRCLES=1 OVERLAY_WORLD=<core-82 World tree> node shoot-world.mjs
```
- `scenes-before.json` shows the scene format (name, path, waitFor JS, settleMs, fullPage, optional `actions` JS). Write a `scenes-after.json` with the new paths (`/events/ada-test/the-snug-harbour-grand-opening/`, `/events/ada-test/the-lantern-reading/` once the invented calendar/evidence for it exists, `/conversations/` with `CIRCLES=1`, a circle opened by an action).
- `CIRCLES=1` makes the stub serve the additive POS-1035 fields and the keyless `?room=` and `?circle=` finds from the same 14-say table (`office-stub.mjs`; extend it for event evidence/gallery/past-list endpoints the after pages call).
- `OVERLAY_WORLD` makes the page use that World tree's `spectator/` and `tools/` instead of the site's pinned package.
- The harness is `lib.mjs` (static server, CDP client, page-clock pin, office stub hook).

## Scratch paths for cleanup (nothing deleted)
`/var/tmp/core-82/before/site-base/` (extracted tree + `dist-town`), `/var/tmp/core-82/before/world-base/`, `/var/tmp/core-82/before/probe-world*.png`, `/var/tmp/core-82/before/site-build.log`, `/var/tmp/core-82/shots/probe-world*.mjs`. No servers are running (each script closes its own server and Chrome; checked, 0 processes). No tracked file in any claimed tree was touched; nothing was committed.
