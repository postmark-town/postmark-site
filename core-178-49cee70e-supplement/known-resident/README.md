# CORE-178 · the compact credit as a KNOWN resident (supplement 2, Facet 23:25Z)

This adds four `/sparks/` frames to the supplement at `07c00958`, whose gallery pair stays as it was: the truthful case of a credit for a handle with **no page in the build's roll**, which prints plain. Here the same Spark's credit is a **known** resident, so #491's mention can show its real face, name and colour.

## The one added input (both sides)
- **One keyless public read** of Tidemark's resident card, `GET https://postmark.town/api/residents/tidemark` (2026-11-27T23:26:18Z), the same door `fetch-town` reads for every roll row.
- It was projected exactly as `fetch-town` does: `town.mjs normalizeProfile` plus `fetch-town-data.mjs mapResident`, with no letters or ledger, so its counts are 0 (`provenance/core178-tidemark-row.mjs`, `provenance/tidemark-read.txt`).
- **Its public identity:** handle `tidemark`, no profile `name` (the mention draws the handle as "Tidemark"), `avatar_url` `https://media.postmark.town/media/harpylandfall/133da4a1c5bd2072f7de5d8f7a4d2ce868950cc4389d11ace621d2eddc1129e8.jpg`, `color` `#d0412f` ("eye-ring red").
- **Where it went:** the row was inserted in handle order into the LOCAL `src/data/postmark/residents.json` (134 → 135 rows) for the local build only, the same file on both sides, and restored with `git checkout --` after; never committed.
- **Unchanged:** the Spark (author, body, no picture), the register, renames and media. The register is the public one, re-read once for both sides (`read=ok`, 44 rows, 23:26:18Z).
- **Media:** the 43 Spark pictures, plus Tidemark's avatar, read by anonymous GET (200 `image/jpeg`, 442,789 bytes, sha256 `133da4a1…` = the content hash in its own URL), all answered from unchanged cached bytes (`provenance/manifest.json`). 0 aborted on either side.

## Pins, camera, package
- **Pins:** BEFORE train `a69717f09cc92a2564a6e582411c16e287303296`; AFTER #491 `49cee70e4ae5a1c96e944e4c83bd81ce96be126e`.
- **Package:** World `5107f7e3` (S197) as installed locally on both sides (lock and hosted CI `50fbbaf7`).
- **Camera:** the same module as supplement 1 (`provenance/core178-setup.mjs`, now also recording the credit mention's face, colour and name), one capped serial site-prep run per side.
  - BEFORE 23:26:39Z to 23:27:38Z, AFTER 23:27:48Z to 23:28:57Z, both exit 0.
  - Frames: 375x812 (the after hook, `innerWidth` 375) and the 1440 shared row; whole viewport frames only.

## What the page drew (`provenance/core178b-facts.txt`)
| | BEFORE `a69717f0` | AFTER `49cee70e` |
|---|---|---|
| Tidemark's compact card | 283 px; credit "by tidemark of hh:the-workshop", the train's plain resident link | 283 px, still compact; credit **"by Tidemark of hh:the-workshop" as #491's one mention** (`.rm`, href `/residents/tidemark/`) |
| The mention's face | none | `<img>` = the avatar above, loaded (`complete`, natural width 1408) |
| Its colour | none | `--rm-c: #d0412f`, drawn on the card's paper as `--rm-ink-p` `#b73929` (computed `rgb(183, 57, 41)`) |
| The 1440 row | shares 283 px with two pictured neighbours | the same |

## Files
`known-resident/before-a69717f0/` and `known-resident/after-49cee70e/`: `sparks-375.png`, `sparks-1440.png`.
