# UI-43 · the compact unpictured Spark in /sparks/, before and after (postmark-site#517)

Ruled UI-43/a (Darko, 2026-11-26): "Yes" to a compact /sparks/ card with title, short excerpt and author credit; dates and Flares on its own page; every word stays on the Spark. Tidemark reported the original bug (postmark-site#509), and #513 carried their first fix.

## Pins
- **BEFORE:** `5f184fa8190c42699613f9700a9beb7f40579373`, `train/2026-w49` `b64c300e` with main's approved #513 (`9de84a4e`) merged in. So BEFORE is the gallery WITH #513's six-line clamp, not the old 1150px row.
- **AFTER:** `a008ecf16bf20df24efc1c5ea5731a22c3edbffb`, #517's head.

## Data, read plainly
- **The gallery's data:** the office's PUBLIC Spark register, read anonymously with the tree's own `fetchSparks` (UI-41's `refresh-sparks.mjs`, here in `provenance/`). The read returned `read=ok`, 41 rows. It was written to `src/data/postmark/sparks.json` for the local build only, the same file for BEFORE and AFTER, and restored with `git checkout --` after both runs. It was never committed.
- **The case:** Tidemark's unpictured `tidemark/spark-the-third-try-water-going-up` (a 1,112-character recounting) in a row with pictured neighbours, plus its own page as the detail control.
- **No sign-in, fixture or resident act.**

## Pictures from the public media door (Facet, 19:00Z)
- Every off-origin request a setup module doesn't answer is aborted by site-prep.
- So before the batch, each picture URL the register's 40 pictured Sparks name (all `https://media.postmark.town/media/...jpg`) was read with an anonymous GET (`provenance/cache-images.mjs`). The bytes are stored unchanged.
  - `provenance/manifest.json` records each URL, its status (all 200), content type (all `image/jpeg`), byte size and sha256, read at 2026-11-26T19:04:35Z.
- The setup module (`provenance/ui43-setup.mjs`) fulfils exactly those GETs from that cache, with the served content type.
  - Any other media request is aborted, and nothing is continued off-origin.
  - Page URLs are not rewritten and no image is substituted.
- The same cache and module were used for BEFORE and AFTER. In both runs all 40 card pictures loaded (`UI43-FACTS`), and no media request was aborted.

## How these were taken
- `site-prep shots --tree site-2 --setup review/ui43/ui43-setup.mjs`, run through run-heavy under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one run at a time. site-prep stopped its preview server on exit.
  - BEFORE: 19:04:47Z to 19:06:54Z, exit 0 (process group 2471178).
  - AFTER: 19:07:00Z to 19:09:09Z, exit 0 (process group 2478163).
  - An earlier BEFORE run (19:01:58Z) is NOT published. My picture list had been cut to 30 of the 40 URLs, so 10 pictures drew aborted.
- **Widths:**
  - 1440x900 and 390x844 are site-prep's own frames.
  - **375x812 is the ruled phone width.** The module's `after` hook takes it in site-prep's 390 mobile context: it sets the viewport to 375x812 (the page reported `innerWidth` 375), takes the whole frame and the full page, then puts the viewport back to 390x844 for site-prep's own shots.
- In the gallery frames the module scrolls Tidemark's card to the middle of the viewport (both runs). Each `-full` copy is the whole page.

## What the page itself measured (`provenance/ui43-facts.txt`)
| | BEFORE (5f184fa8) | AFTER (a008ecf1) |
|---|---|---|
| Tidemark's card in `/sparks/` | 514px; recounting, credit, dates, Flares place, event line | **283px, compact**: title, 3-line excerpt, credit, event line |
| Its 1440 row (3 cards, sharing one height) | 514px; each pictured neighbour's picture 186px, empty well **277px** | 283px; picture 186px, well **45px** |
| Its own page (`/sparks/tidemark/…`) | 512 / 1214 / 1242px at 1440 / 390 / 375; recounting (1,112 chars), credit, dates | the same: 512 / 1214 / 1242px, every word |

## Files
- `before-5f184fa8/` and `after-a008ecf1/`, each with:
  - `sparks-{1440,375,390}[-full].png`, the gallery;
  - `sparks-tidemark-spark-the-third-try-water-going-up-{1440,375,390}[-full].png`, the detail control.
- The 390 frames are site-prep's own, kept for completeness; 375 is the ruling's phone.
