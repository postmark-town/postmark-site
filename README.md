# UI-5 · #519 · the signed-out front page: final before and after on w50, 375 and 1440

The mockup is `docs/proposals/ui-5-landing/landing-mockup.html` at `f0bec6f2`; Darko: "I think the landing can be built as is". These are the final pictures for the draft PR #519 into `train/2026-w50`. They supersede `2240288a` and `73a21eed`, which were taken on w49. Taken and published by the Site builder (starforge-plumb-f3).

## Pins
- **BEFORE:** `train/2026-w50` `cd7c088b9d900025466dd1343ba6968e5cb866b7` (w49 a69717f0 + CORE-188 #503).
- **AFTER:** #519's head `a266b54c8d902ad73210edeab20def8dc11cfe56`. The branch history is kept as committed:
  - `c71116a2`: the landing;
  - `3e1c5bfa`: Facet's four corrections;
  - `17ce123d`: the w50 merge, which was clean;
  - `a266b54c`: Regina taken from CORE-188's `join-draft.mjs`.
- **Data, both sides:** the committed snapshot plus four anonymous public reads, the same bytes on both sides, never committed (`provenance/data-sha256.txt`):
  - the calendar at `as_of` **2026-11-28T14:46:44Z**;
  - the Spark register (45 rows);
  - the ledger;
  - the 40 newest letters.
- **Camera:** `site-prep shots / "/?signed" --tree site-3 --setup review/ui5/ui5-setup.mjs`, run under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one run at a time.
  - BEFORE ran 14:46:58Z to 14:51:16Z; AFTER ran 14:51:23Z to 14:52:42Z. Both exited 0.
  - The 21 media pictures are answered from a sha-checked cache (`picture-cache-manifest.json`), with **0 aborted**.
  - The walk is instant and waits until every shown picture has a real width; this is the cause fixed in the previous set (`imgdiag-ab.txt`).
  - The signed-in view is an invented sign-in (`invented-ui5-camera`, handle `wright`). Every /api/ call was aborted.
- **Widths:** 1440x900, 390x844, and 375x812 (the after hook in the 390 context). Each comes as a viewport frame and a `-full` page.

## What the pages showed (`provenance/ui5-facts.txt`)
| View | BEFORE `cd7c088b` | AFTER `a266b54c` |
|---|---|---|
| `/` visitor (375, 390, 1440) | the old front page, with the town header and footer; 9/10 pictures (the tenth is the old hero's empty crossfade layer, pre-existing) | **the landing**: the mockup's nav row, one footer with Privacy · Terms, the town header and footer hidden, no sideways scroll; **14/14 pictures loaded, 0 unloaded**; examples: `room`; quiet slots: flare, review ×3, short ×3 |
| `/?signed` (375, 390, 1440) | the signed-in page, "Welcome back,"; 9/9 | **the same signed-in page**, "Welcome back,"; 9/9; the landing is hidden |

The inventory, the fallbacks, the placeholders, the deliberate changes and Darko's look list are in #519's description.
