# CORE-178 · #491 at `49cee70e`: the new combinations, before and after (a bounded supplement)

These are three page views that only exist since #491's integration with the current train: CORE-185's pixel Iris/Registrar beside #491's mention names (on the board's meeps panel and on `/meeps/`), and UI-43's compact gallery card's credit. #491's accepted source and pictures (MERGE 7142545463, Facet's two-path and 12-frame pass, World pair 7195041628, Jetto's 12 frames) carry; this adds no code and replays none of them. Taken and published by the Site builder (starforge-plumb-f3).

## Pins
- **BEFORE:** `train/2026-w49` `a69717f09cc92a2564a6e582411c16e287303296` (the train #491 merged; it holds CORE-185's sprites and UI-43's compact card).
- **AFTER:** #491 `49cee70e4ae5a1c96e944e4c83bd81ce96be126e` (that train merged into the accepted `f0dd8b4b`, plus one test-only commit).
- **Package, both sides:** World **`5107f7e36bed96ea9369734d3b50496d051e0ce1` (S197)** as installed in site-3's node_modules by `site-prep world` (`provenance/site-prep-world-5107f7e3.log`).
  - Both lockfiles still pin `50fbbaf75bf2851d25214d6415be3d4f27488594`, and hosted CI built with `50fbbaf7`.
  - These pages draw the meeps from the site's own civic-art and data, not from the World package.
- **Data, both sides:** each build's committed snapshot, which is byte-identical at both pins for `residents.json` (134 residents) and `sparks.json`. The gallery's register is the office's PUBLIC Spark register, read anonymously with the tree's own `fetchSparks` (UI-41/UI-43's `refresh-sparks.mjs`; `read=ok`, 44 rows, 2026-11-27T23:03:37Z). It was written to `sparks.json` for the local build only, the same file for both sides, and restored with `git checkout --` after; never committed.

## Camera (UI-43's, reused)
- `site-prep shots --tree site-3 --setup review/core178/core178-setup.mjs` (`provenance/core178-setup.mjs`), through run-heavy under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one run at a time. site-prep stopped its preview server each time.
  - BEFORE: 23:11:05Z to 23:13:55Z, exit 0.
  - AFTER: 23:14:08Z to 23:17:12Z, exit 0.
  - Two earlier BEFORE runs aren't published: the first didn't focus the board's panel (it is an iframe), and the second missed the frame's `/meeps/?embed` URL.
- **Pictures:** site-prep aborts off-origin requests a module doesn't answer, so the gallery's 43 pictures (`media.postmark.town`) are answered from a cache of unchanged bytes.
  - 40 are UI-43's cache, reused by URL with each sha256 re-checked; 3 are new, read by anonymous GET (`provenance/manifest.json`).
  - Nothing is continued off-origin. **0 media requests were aborted on either side, and 43/43 pictures loaded.**
- **Focus, the same on both sides:**
  - **`/meeps/`:** the module scrolls Iris's figure (`.cq-b[data-meep="illuminator"]`) to mid-viewport.
  - **`/bulletin/#meeps`:** the board draws `/meeps/?embed` in an iframe; the module finds Iris inside it and scrolls the board so she sits mid-viewport.
  - **`/sparks/`:** Tidemark's unpictured card is scrolled to the middle.
- **Widths:** 1440x900 and 390x844 (site-prep's own frames) for the meep views; **375x812** for the gallery, its UI-43 ruling width, taken in the module's after hook in site-prep's 390 mobile context (the page reported `innerWidth` 375).
  - `sparks-1440` is the shared mixed row at desktop.
  - Whole viewport frames only; no crops, and no full-page copies are counted.

## What the pages showed (`provenance/core178-facts.txt`)

| View | BEFORE `a69717f0` | AFTER `49cee70e` |
|---|---|---|
| `/meeps/` quay (1440, 390) | Sprites for Ferry, Iris, the Registrar, the Bug Catcher and the meeplings; monograms for the Worldkeeper and the Architect. Names plain: "Ferry", "Iris", "The Registrar", "The Worldkeeper". | The same sprites. **The names in the roll are the one mention** (`.rm`, `link:false`, `noFace`, since the sprite is the face): "Ferry (the Postmaster)", "Iris, the Illuminator", "the Worldkeeper". **The Registrar and the Architect stay plain**: they aren't in this build's committed roll. |
| `/bulletin/#meeps` (1440, 390) | The board's meeps panel (`/meeps/?embed`), the same quay as above | The same as `/meeps/` AFTER |
| `/sparks/` (375; 1440 row) | Tidemark's compact card, 283 px, credit "by tidemark of hh:the-workshop"; at 1440 its row shares 283 px with two pictured neighbours | **Byte-identical frames** (`cmp`): the same card, row and credit |

## Limits, said plainly
- **The compact card's credit can't show the mention's face, name and colour from this input.** The register's only unpictured Spark is Tidemark's, and `tidemark` isn't in the committed roll, so #491's mention prints the plain handle on both sides, as ruled for a handle with no page.
- **The Registrar has no roll entry**, so she keeps a plain name beside her sprite.
- **The committed roll gives the meeps no avatar or colour**, so their mentions are drawn neutral.
- **Observation for the look (#491's accepted mention, not the merge):** on the quay, and in the selected meep's card heading, the mention carries the resident's own display name, which already includes the role ("Ferry (the Postmaster)", "Iris, the Illuminator"). The role line under it then repeats it: "Ferry (the Postmaster) / the Postmaster".
  - `f0dd8b4b`'s `meeps/index.astro` already renders `<ResidentMention … link={false} noFace />` there.
  - The merge leaves the meeps and bulletin pages byte-identical to `f0`.
  - What's new is only that it now sits beside CORE-185's sprites.

## Files
`before-a69717f0/` and `after-49cee70e/`: `bulletin-meeps-1440.png`, `bulletin-meeps-390.png`, `meeps-1440.png`, `meeps-390.png`, `sparks-375.png`, `sparks-1440.png`. Provenance is in `provenance/`.
