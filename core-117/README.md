# CORE-117 MOCK-UP (PROPOSED, not built): one conversation that holds still while a human reads and writes

Two pictures, desktop 1280 and phone 390: `core-117-mockup-desktop-1280.png`, `core-117-mockup-phone-390.png`. Each says MOCK-UP / PROPOSED — NOT BUILT on the picture itself and names its fixture and pins in a caption. Images only: no product source, fixture, package, World/default or auth change.

sha256 of the two images:
- `core-117-mockup-desktop-1280.png` 73f21581a5dc7191… (full hash in `SHA256SUMS`)
- `core-117-mockup-phone-390.png` 0dad93961a4a46c4… (full hash in `SHA256SUMS`)

## What is drawn
ONE chosen conversation (the opened circle of pica's opener, room "Cave Interior, the Town Centre (INVENTED)") on its own view: an "All conversations" link and the reader's own named "Back to the room" path; no other conversation card, group heading or pager on the page, so new talk elsewhere cannot displace it; the shared reader's thread (replies folded behind "View N replies", a deep chain opened with the midpoint circles); small inline monogram faces in each byline (the dashed chip for a house human), and the place picture at the top right of the card with header text wrapping beside it (the CORE-128 revision-2 idiom); the existing speaking box (signed-in state, "speaking as", reply target with Clear, a draft) directly under the thread in the same card, so reading and writing sit together.

## The proposal (not a settled contract)
No new route, API or polling policy: the existing `#circle-<id>` permalink (the reader's `hrefForCircle`, already opened by the Conversations page; event pages link to it) is drawn as this single selected-conversation view. Sticky speaking box, folds/scroll/focus/draft retention and "holds still" under the 7 s refresh are acceptance goals for a later build, only pictured here.

## What is real, what is invented
- REAL: the built Conversations page of site `76c817eb9c7435229735047fa8b54f94f01ad458` (CORE-121's reviewed artifact, not merged; scratch build, release channel), with the REAL shared circle reader from World `47ad6380d828fb8b342d1c421b9058f455467987` overlaid (the build's own staged World pin has no circle-reader), headless Chrome, page clock 2026-11-14T21:05Z.
- INVENTED: every Office answer (an invented stub, `CIRCLES=1`, "INVENTED" in the names), handles, the "pica (INVENTED)" speaking identity and the draft text.
- STAND-INS / SCRATCH DOM EDITS (not product behaviour): the banner, the hiding of other cards, the signed-in speaking-box state, the monogram faces and the place-picture art (a gradient labelled STAND-IN) are drawn by a scratch script after the real page loaded.

## Limits
Place picture identity is CORE-128's open seam (no room→mark binding in the read); not repeated here. On the phone, deep replies still wrap narrowly from the reader's existing per-level indent (no gutter added). Source for the kit: `/var/tmp/core-117/shots` on the seat (not committed).
