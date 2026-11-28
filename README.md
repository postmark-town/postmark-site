# UI-5 · #519 · the signed-out front page: final before and after on w50, 375 and 1440

The mockup is `docs/proposals/ui-5-landing/landing-mockup.html` at `f0bec6f2`; Darko: "I think the landing can be built as is". These are the final pictures for the draft PR #519 into `train/2026-w50`, at its CI-green head. They supersede `2240288a`, `73a21eed` and `d14ee384`. Taken and published by the Site builder (starforge-plumb-f3).

## Pins
- **BEFORE:** `train/2026-w50` `cd7c088b9d900025466dd1343ba6968e5cb866b7` (w49 a69717f0 + CORE-188 #503).
- **AFTER:** #519's head `a4efa808cd2f2ffc10c9198f57cf6ece84612c41`. Hosted CI is green there (test, build, built-pages, ship-guard, pr-preview). The branch history is kept as committed:
  - `c71116a2`: the landing;
  - `3e1c5bfa`: Facet's four corrections;
  - `17ce123d`: the w50 merge, which was clean;
  - `a266b54c`: Regina from CORE-188;
  - `a4efa808`: the red mark kept for a visitor, and the fonts bundled.
- **Data, both sides:** the committed snapshot plus four anonymous public reads, the same bytes on both sides, never committed (`provenance/data-sha256.txt`):
  - the calendar at `as_of` **2026-11-28T14:46:44Z**;
  - the Spark register (45 rows);
  - the ledger;
  - the 40 newest letters.
- **Camera:** `site-prep shots / "/?signed" --tree site-3 --setup review/ui5/ui5-setup.mjs`, run under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one run at a time.
  - BEFORE ran 14:46:58Z to 14:51:16Z; AFTER ran 15:16:35Z to 15:17:50Z. Both exited 0.
  - The 21 media pictures are answered from a sha-checked cache (`picture-cache-manifest.json`), with **0 aborted**. The walk is instant and waits until every shown picture has a real width (`imgdiag-ab.txt` is the cause fixed earlier).
  - The signed-in view is an invented sign-in (`invented-ui5-camera`, handle `wright`). Every /api/ call was aborted.
- **Widths:** 1440x900, 390x844, and 375x812 (the after hook in the 390 context). Each comes as a viewport frame and a `-full` page.

## What the pages showed (`provenance/ui5-facts.txt`)
| View | BEFORE `cd7c088b` | AFTER `a4efa808` |
|---|---|---|
| `/` visitor (375, 390, 1440) | the old front page, with the town header and footer; 9/10 pictures (the tenth is the old hero's empty crossfade layer, pre-existing) | **the landing**: the mockup's nav row, one footer with Privacy · Terms, the town header drawn as nothing at rest (it keeps only the sentinel's red mark, hidden while the town is well), no sideways scroll; **14/14 pictures loaded, 0 unloaded**; examples: `room`; quiet slots: flare, review ×3, short ×3 |
| `/?signed` (375, 390, 1440) | the signed-in page, "Welcome back,"; 9/9 | **the same signed-in page**, "Welcome back,"; 9/9; the landing is hidden |

## Tests at `a4efa808` (local, site-3, run-heavy)
- The pure suite, in 4 batches: 228 files, 2842 tests, **2795 pass, 0 fail**, 47 skipped (`pure-suite-a4efa808.txt`).
- The landing (pure and browser), settlement-notice-browser and home-your-household: **50/50** (`landing-and-settlement-tests-a4efa808.txt`).
- The other browser files were all green on `a266b54c` (73 + join-move-in 9). `a4efa808` changes only the front page's chrome CSS and where the fonts live. Hosted built-pages ran the whole suite green on `a4efa808`.
- The falsifiers (`falsifiers-2.log`):
  - the reversed visitor/resident rule fails both separation tests;
  - removing `#letters` fails both CTA checks;
  - stripping the stamp rule fails the letter test.

The inventory, the fallbacks, the placeholders, the deliberate changes and Darko's look list are in #519's description.
