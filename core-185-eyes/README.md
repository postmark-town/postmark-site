# CORE-185 · Iris's and the Registrar's eyes, before and after (postmark-site#500)

Darko's look, relayed by Wright on 2026-11-26: the pixel eyes "are just horizontal bars, which read as like potentially like exasperated or tired". Wright's direction was "an open eye with a highlight pixel, not a flat bar". The correction changes those eyes and nothing else.

## Pins
- **BEFORE:** #500's held head `3dca60a5eef13fa5ee0fe09d478eb3f13ef3b239` (the eyes are one-row bars of `dd`).
- **AFTER:** `c53bff217835f12a42ea506dd5c34d4aebe2b289`, one commit on `3dca60a5`. Each eye becomes a 2×2 of the doorway dark with one paper pixel (`p`) on top as its catchlight, as Darko's own token lights his.
  - Two pixels change per eye, four per token, all in the shared table's existing inks.
  - Nothing else changes: likeness, grid, size, palette, framing and every other token stay as they were.

## How these were taken (the same disclosed setup as #500's first picture card, issuecomment-7170284630)
- `site-prep shots --tree site-3`, with no setup module and nothing staged: the branch's own build over the train's committed data. Each run used run-heavy under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one at a time, and site-prep stopped its preview server on exit.
  - BEFORE: 2026-11-26 18:13:25Z to 18:14:53Z, tree checked out at `3dca60a5`, exit 0 (preview server process group 2284570, stopped).
  - AFTER: 18:14:59Z to 18:16:30Z, tree at `c53bff21`, exit 0 (process group 2291279, stopped).
- The same build-data caveat as the first card applies to both sides: the committed roll has no portraits for the meeps, so profile cards show quay faces. It isn't part of this diff.

## Files
- `before-3dca60a5/` and `after-c53bff21/`: whole frames at 1440x900 and 390x844, each with a `-full` whole-page copy.
  - `bulletin-meeps-*`: the opened `/bulletin/#meeps` quay.
  - `bulletin-meeps-illuminator-*` and `bulletin-meeps-registrar-*`: the quay opened on each.
  - At 390 the quay sits below the first screen, so the `-full` copy shows it, as in the first card.
- `crops/`: a reading aid only; the whole frames are the evidence.
  - `crop-quay-1440.png`: the same rectangle of `bulletin-meeps-1440.png` (x 440, y 640, 270x100), BEFORE left and AFTER right, each pixel repeated 4x (nearest neighbour, no smoothing).
  - `crop-quay-390.png`: the same from `bulletin-meeps-390-full.png` (x 92, y 878, 100x46), at 8x.
