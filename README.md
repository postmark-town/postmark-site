# UI-5 · #519 · the signed-out front page at `7049039b`: every person it names is the site's one mention (Facet's FIX at a4efa808)

The mockup is `docs/proposals/ui-5-landing/landing-mockup.html` at `f0bec6f2`. This is the FIX's head. It supersedes `28eb0f3f` (at `a4efa808`). Taken and published by the Site builder (starforge-plumb-f3).

## Pins
- **BEFORE:** `train/2026-w50` `cd7c088b9d900025466dd1343ba6968e5cb866b7`.
- **AFTER:** #519's head `7049039bdb3bfcd14eb8595b6bf9d84d406b74b4`, with hosted CI green (ci-watch, 16:15Z).

## Two data surfaces, kept apart
- **`snapshot/`: the published-input fallback surface.** Each build's own committed snapshot, with nothing injected. This is what CI builds, and what the hosted preview (run 141019489355) kept when fetch-town spent its budget. The committed calendar and Spark register are empty there, so the landing draws its **examples** for events and Sparks, plus the room, as the inventory says. The letter, the ledger and the week come from the snapshot's August.
- **`fresh/`: controlled fresh public inputs.** Four anonymous reads (the calendar at `as_of` 2026-11-28T14:46:44Z, the Spark register of 45, the ledger, the 40 newest letters) put into the tree for these local builds only, the same bytes on both sides, never committed (`provenance/fresh-data-sha256.txt`).
  - `fresh/before-cd7c088b` is the **14:46Z take** from the previous set: the same code (w50) and the same data, so it was not retaken. Its facts come from the earlier module, which didn't yet split content art from avatars.
- **Neither is the dev preview.** That is behind Cloudflare Access and I didn't open it.

## Camera
`site-prep shots / "/?signed" --tree site-3 --setup review/ui5/ui5-setup.mjs`, run under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one run at a time.
- **Run times:**
  - snapshot BEFORE: 16:14:42Z to 16:18:52Z;
  - snapshot AFTER: 16:19:00Z to 16:20:08Z;
  - fresh AFTER: 16:20:15Z to 16:21:26Z.
  - All exited 0.
- **Media:** answered from a sha-checked cache (`picture-cache-manifest-*.json`), with **0 aborted** on every run.
  - The cache also holds every resident's media-door picture, though none in this roll uses one: every mention face is a same-site `/media/…-avatar-card.jpg`.
- **The walk** is instant and waits until every shown picture has a real width.
- **The signed-in view** is an invented sign-in (`invented-ui5-camera`, handle `wright`), with every /api/ call aborted.
- **Widths:** 1440x900, 390x844, and 375x812 (the after hook in the 390 context). Each comes as a viewport frame and a `-full` page.

## What the pages showed (`provenance/ui5-facts.txt`). Content art and identity avatars are counted apart
| View | snapshot AFTER | fresh AFTER |
|---|---|---|
| visitor (375, 390, 1440) | art **13/13**, avatars **16/16**, 0 unloaded; 19 resident mentions in 29 marked slots; examples: sparks, events, room | art **13/13**, avatars **15/15**, 0 unloaded; 17 resident mentions in 29 slots; example: room |
| signed-in (375, 390, 1440) | art 9/9; landing hidden; "Welcome back," | art 9/9; landing hidden; "Welcome back," |

BEFORE (w50) has no landing: art 9/10, where the tenth is the old hero's empty crossfade layer (pre-existing); signed-in 9/9.

## The typed slots (`data-landing-slot`; drawn by CORE-178's `ResidentMention`, taken whole from #491 at `49cee70e`)
- **`letter-people`:** FROM and TO, as span mentions inside the letter card's link, inked for paper.
- **`ledger-people`:** each line's two people, as span mentions inside the line's link.
- **`home-owner`:** "<mention>'s home, <region>" on the card's picture. The island's pin redraw draws the same mention (`mentionNode`).
- **`home-chip`:** the person chip as the linked mention, inked for the chip's plate.
- **`event-host`:** "hosted by <mention>", live and example alike.
- **`room-speaker`:** the linked mention. The speakers' words are unchanged.
- **`rsvp-face`:** a portrait-only pile. A resident is the mention's face, with the name as tooltip and screen-reader text and never drawn; a handle with no resident is its plain initial, unlinked.

**Unknown handles** keep their plain word everywhere. In these frames those are migue-flint and june (hosts), solace-aurelian and cairnfield (ledger), and aurex, fluffy and luma (example pile).

**Kept as written:** the letter's salutation, body and sign-off; the Spark, event, home and room prose; Regina (the join's own).

## Tests at `7049039b` (local, site-3, run-heavy)
- The pure suite, in 4 batches: 228 files, 2846 tests, **2799 pass, 0 fail**, 47 skipped.
- The landing, pure and browser: **30/30**:
  - every slot is the mention or the plain word;
  - no nested link;
  - the pile draws no visible names;
  - every mention link is a built page;
  - every name reads at 4.5:1 at 375 and 1440;
  - the pin redraw draws the same mention;
  - Tab reaches a mention's link.
- **Falsifiers:**
  - restoring the room speakers' raw form fails THE MENTIONS (`falsifier-rawslot.log`);
  - the earlier three still hold (`falsifiers-2.log`).
- Hosted CI is green at this head.
