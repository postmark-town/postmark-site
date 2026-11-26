# UI-40 · resident #510 carrier (postmark-site#512): household stance count, before and after

Pictures of the **real household page** `/households/reeves/` (default Hearth: the `Needs you` slot and the `Mail` slot, both private to a signed-in house), built from the tree and served by astro preview. Desktop 1440x900 and phone 390x844 viewports, each also with a `-full` whole-page copy.

- **First set** (unchanged, carried): two scenes, two views, two widths, before and after the carrier: 32 files.
- **FIX set** (new): the `Needs you` view after the maintainer's ink fix, for the `partial` scene and a new `unavailable` scene, at both widths: 8 files.

## Pins
- **Before:** postmark-site `main` `45c930794199156408c49c53d87850a1d071a2a4`.
- **After (carrier):** #512 head `0e0b198327c3e7a70d7a6a6390190cfcf6474118`, the merge of Lyra's #510 head `fb225056b9a59be10004b9a5a9b58b5571ad28a5`, unchanged. The two builds differ in source only by #510's seven files: same tree, same data, same fixture, same camera.
- **After (FIX):** #512 head `38b74200689cdc64d3441f3ceeaf1a2862423660`, one maintainer commit on the carrier. It gives the note inside the paper card the card's own ink, in both consumers (`hearth-host.css` and `HouseDashboard.astro`), plus a contrast regression in `test/household-needs-you.test.mjs`. It changes no copy, count, palette or layout.
- **How they were built:** locally with `site-prep shots --tree site-2` (astro build and preview, stopped by site-prep on exit). Each run was under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one at a time, and exited 0.
- **Logs:** `run-facts/*-facts.txt` hold the page's own readings.
  - The FIX run was 2026-11-26 16:04:52Z to 16:06:12Z.
  - An earlier FIX run (16:02:51Z) took the same frames, but its revert control didn't find the rule, because the build merges it with the meta line's rule. Its pictures aren't published.

## Fixture provenance (read plainly)
- **The house read:** the office's house aggregate read `GET <office>/household?read=house&household=reeves&full=true` is answered by a clearly labelled, read-only, INVENTED fixture, on the browser's route layer.
  - The fixture is `ui40-setup.mjs` for the first set, and `ui40-setup-fix-38b742006.mjs` for the FIX set. The FIX module is the same module plus three things: the `unavailable` scene, a wait for the answered state, and the ink reading below. Its `partial` fixture is byte-for-byte the first one's.
  - The mark ids (`fixture/mark-1`..`5`) and counts are invented; **nothing here is the Reeves house's real state**. `reeves` is used only because the committed registry gives it five residents, the shape of the reported bug (five doorsteps repeating one household's marks).
- **The sign-in** is a made-up browser-storage entry (`pm.oauth.token`, `pm.oauth.handles`) that no server sees. site-prep aborted every request that left the preview's origin and wasn't answered by the fixture. No real credential, no resident act, no owner session, no production write.
- **Other reads** (bundle, walkers, calendar...) were aborted, so the page shows its own "could not be read" notes in other sections; they aren't part of the change. The saved-design read was also aborted, so the default Hearth is drawn.

## Scenes and what the page itself reported (`UI40-FACTS`, in `run-facts/*-facts.txt`)

**`five`:** all five doorsteps carry the SAME five complete household-wide marks.
- **Before (main):**
  - Needs you: `awaiting the house's word · 25` (Caelum 5, Callan 5, Isaiah 5, Lumen 5, Sage 5).
  - Mail: `25 marks awaiting the house's word`.
- **After (carrier):**
  - Needs you: `· 5`, `household-wide 5`.
  - Mail: `5 marks awaiting the house's word`.
- **After (FIX):** not re-shot. No note is drawn in this scene, so the FIX doesn't touch it.

**`partial`:** two doorsteps report the household's five but carry a SHORT page (one mark each, `complete: false`); the other three carry no stance count.
- **Before (main):**
  - Needs you: `· 10`, no caveat.
  - Mail: `10 marks awaiting the house's word`, no caveat.
- **After (carrier):**
  - Needs you: `· at least 5`, plus `stance count: The exact stance count is uncertain.` The note is drawn at about 1.4:1 on the card's paper.
  - Mail: `At least 5 marks awaiting the house's word`, plus `The exact stance count is uncertain.`
- **After (FIX):** the same words and counts. **The Needs you note now reads at 6.34:1.**

**`unavailable` (new in the FIX set):** the same five residents, every doorstep ANSWERED, none carrying a stance count.
- **Before (main):** not shot.
- **After (carrier):** not shot. The carrier's code drew this note in the same 1.38:1 ink; see the control below.
- **After (FIX):**
  - Needs you: `stance count: The stance count is unavailable or uncertain.`, at **6.34:1**, with no count and no calm line.
  - Mail: `The stance count is unavailable or uncertain.`

The `unavailable` scene is not the "still reading" state. No read is outstanding: the module waits until Needs you no longer says "Still reading the house's record…", and the facts show the answered words.

## The FIX's ink, read from the real default Hearth (`UI40-INK`, in `run-facts/after-38b742006-facts.txt`)
The reading is bounded to the computed style of the `.hd-empty` note inside `[data-hearth-slot="needs-you"]`, at both widths and in both scenes:
- its colour and opacity;
- the card paper behind it (the nearest opaque ancestor background);
- the WCAG contrast of the blended ink.

| Reading | color · opacity | paper | shown | contrast |
|---|---|---|---|---|
| FIX (as shipped) | `rgb(42, 33, 24)` · 0.75 (the card's ink, as its meta line) | `rgb(244, 236, 217)` (`--hx-paper`) | `rgb(92.5, 83.8, 72.3)` | **6.34:1** |
| revert control: the FIX selector taken out of the live stylesheet | `rgb(205, 194, 171)` · 0.8 (`--hx-ink`, the dark glass's light ink) | same | `rgb(212.8, 202.4, 180.2)` | **1.38:1** |
| restored at its index, before the shots | as FIX | same | as FIX | 6.34:1 |

The build merges the FIX selector into the meta line's rule: `.hearth-stage .hd-needs .hd-meta, .hearth-stage .hd-needs .hd-empty { color: inherit; opacity: 0.75; }`. The control takes out only `.hearth-stage .hd-needs .hd-empty` and leaves the meta line as it is. The italic note is 15.33px, normal text, so it needs 4.5:1. The pictures are taken after the rule is restored.

## Files (`pictures/`)
- **First set:** `{before-45c930794|after-0e0b19832}-{five|partial}-{needs-you|mail}-{1440|390}[-full].png`.
  - The `needs-you` pictures start at the Needs you slot, the `mail` pictures at the Mail slot; the `-full` copies show the whole page.
  - `after-0e0b19832-partial-needs-you-*` show the carrier's unreadable note. The FIX set's partial frames are their after; they are kept, not replaced.
- **FIX set:** `after-38b742006-{partial|unavailable}-needs-you-{1440|390}[-full].png`. They start at the Needs you slot.

The before, five and Mail frames are carried unchanged from the first set. The FIX touches only the note inside the Needs you card, so the Mail slot's notes (on the dark glass) keep their ink.

## Correction to the first set's README
The first README listed "a scene where every doorstep is unavailable" as "not captured (not asked, not changed)". **"Not changed" was wrong.** Main `45c930794` has neither the zero line `The stance count is unavailable or uncertain.` nor `The exact stance count is uncertain.`: #510 adds this zero-disclosure branch to both painters, `src/lib/hearth/paint.mjs` and `src/lib/household-dashboard/paint.mjs`. It was new in the carrier, just not pictured. The FIX set now pictures it (`unavailable`).
