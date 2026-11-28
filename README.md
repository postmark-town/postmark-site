# UI-5 · the signed-out front page, built from the approved mockup: before and after, 375 and 1440 (retake, after Facet's return on c71116a2)

The mockup is `docs/proposals/ui-5-landing/landing-mockup.html` at `f0bec6f2`; Darko: "I think the landing can be built as is". This set replaces `pictures/ui-5-landing-c71116a2-20261128` (`2240288a`), whose full frames drew some real pictures blank (cause below). Taken and published by the Site builder (starforge-plumb-f3).

## Pins
- **BEFORE:** `train/2026-w49` `a69717f09cc92a2564a6e582411c16e287303296`. `train/2026-w50` doesn't exist yet (checked 03:13Z); the final set is retaken on the w50-reconciled head.
- **AFTER:** `ui-5-visitor-landing` at `3e1c5bfa68ee62277f5601466250e83b19a21a3e`, which is `c71116a2` plus the four corrections.
- **Data, both sides:** the committed snapshot, plus the same four anonymous public reads on both sides (the calendar at `as_of` 2026-11-28T02:35:21Z, the Spark register, the ledger, and the 40 newest letters). They were written for these local builds only, then restored and never committed (`provenance/data-sha256.txt`).
- **Camera:** `site-prep shots / "/?signed" --tree site-3 --setup review/ui5/ui5-setup.mjs`, run under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one run at a time.
  - BEFORE ran 03:32:27Z to 03:36:39Z; AFTER ran 03:36:49Z to 03:38:02Z. Both exited 0.
  - Media is answered from the sha-checked cache (`picture-cache-manifest.json`), with 0 requests aborted.
  - The signed-in view is an invented sign-in (`invented-ui5-camera`, handle `wright`). Every /api/ call was aborted.
- **Widths:** 1440x900, 390x844, and 375x812 (the after hook in the 390 context). Each comes as a viewport frame and a `-full` page.

## The blank pictures: the cause was the capture, not the product (`provenance/imgdiag-ab.txt`, `ui5-imgdiag.mjs`)
- **What happened.** In the first set's full frames, the three lower Sparks, Regina and some RSVP faces were blank. The page has real `<img>` elements there, `loading="lazy"`.
- **Cause.** The first module's walk used plain `scrollTo()`. The landing sets `scroll-behavior: smooth` for a visitor, so each step only started a glide, the next step retargeted it, and the last one glided back to the top. The lower pictures never came near the window and **were never requested**. That is why "0 aborted" said nothing.
- **A/B, on the same built page with the same cache route:** the old walk left 4 pictures unrequested; an instant walk left 0. Every request that was made was fulfilled with a 200.
- **Fix, in the camera only.** The walk now jumps (`behavior: "instant"`), waits for each screen's pictures, and ends only when every shown picture has a real width. UI5-FACTS now names any `unloaded` picture.
- **The retake:** the visitor page at 375, 390 and 1440 shows **15 of 15 pictures loaded, 0 unloaded**. The signed-in page shows 9 of 9.
  - BEFORE's visitor page has 9 of 10 loaded. The tenth is the old hero's empty crossfade layer, which has no src until a sign-in swaps art in; it is pre-existing and not a picture.
  - RSVP faces drawn as initials are residents this build's committed roll gives no avatar (or doesn't hold): the product's own monogram, not a blank.

## What the pages showed (`provenance/ui5-facts.txt`)
| View | BEFORE `a69717f0` | AFTER `3e1c5bfa` |
|---|---|---|
| `/` visitor (375, 390, 1440) | the old front page, with the town header and footer | **the landing**: the mockup's own nav row in the hero (brand only at 375), one footer (the mockup's social one, with Privacy · Terms), the town header and footer hidden, the signed-in page hidden, nothing scrolling sideways; examples drawn: `room`; quiet slots: flare, review ×3, short ×3 |
| `/?signed` (375, 390, 1440) | the signed-in page, "Welcome back," | **the same**: the town header, the signed-in page, the town footer; the landing is hidden |

## Facet's four corrections (`3e1c5bfa`)
1. **The visitor nav is the mockup's.** For a visitor on the front page only, the town header stands down (index.astro: `html:not([data-lens]):has(.pm-landing) .pm-townhead`). A signed-in reader keeps it. It is hidden, not removed, so the sign-in script still runs.
2. **One visitor footer: the mockup's social footer, which now carries Privacy · Terms.** The town footer stands down for a visitor on this page. Its agents' door line stays in the document for machine readers.
3. **The letter's FROM · TO · date line clears the stamp** (padding-right 70px; 50px on a phone). A browser test measures it, and removing the rule fails the test.
4. **The pictures were reconciled** (above) and retaken.

## Two things to see, for Facet
- **Sign-in on the visitor front page.** With the town header hidden, the front page shows a visitor no sign-in button; the mockup's nav has none. A returning resident who arrives signed out signs in from any other page.
- **The mockup's nav row is centred, with "✉ POSTMARK" touching "The World".** This is the approved file's own rendering: its `.wrap` shrinks to its content inside the hero's flex column, so `justify-content: space-between` has no room (`provenance/mockup-f0bec6f2-rendered-1440.png`, measured nav 483–957px at 1440). It is built as approved. A one-rule fix (`header.hero > .wrap:first-child{width:100%}`) would put the brand left and the links right. Not applied: it's for the look.

## The real parts, fallbacks, placeholders, and look list
These are unchanged from the first set's README, at `2240288a`.
- **Real parts:** letter and ledger, the week's count, households, next crossing, calendar, Sparks, map homes; all from baked inputs.
- **Fallbacks for Wright:** `room` ALWAYS (no room lines are baked); the others only when their input is empty or unread.
- **Placeholders, as quiet slots:** the flare, three reviews, three short-film frames.
- **Deliberate changes, still standing:**
  - self-hosted OFL fonts;
  - an upright lede;
  - the 375 hero gutter;
  - `#join-postmark`.
- **For Darko's look:**
  1. the map households and each one's yes: Rei and Wright (starforge), limen (jennuh), Cipher (rasoom), Carta (will-martin);
  2. the companies' marks and the not-affiliated line;
  3. pictures with no likeness yes on record:
     - the five Spark pictures;
     - the six home pictures;
     - the RSVP avatars;
     - Regina;
  4. the featured letter, chosen by rule every build.
