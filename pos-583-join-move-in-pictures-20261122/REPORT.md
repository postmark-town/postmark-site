# CORE-150 · POS-583 · /join/move-in/ whole-page pictures, before and after (office #1175)

Evidence only. Invented fixtures; no real sign-in, join, operator act, credential or production office. The page is the REAL `/join/move-in/` (its chrome, styles, funnel, form generator and reply presentation) built from the Site tree; only the office's answers are staged.

## Pins
- **Site (same page, before and after):** `postmark-town/postmark-site` origin/main `4a4673bed429e7e6482a471d0864a3d6964154ed` (live-checked via API), built and served by `site-prep shots --tree site-2` (astro build + astro preview, stopped on exit). No Site code, lock or config change (tree clean before and after; the installed World module was prepared to the manifest's own pin by the documented `site-prep world`, receipt in `world.out`: installed `postmark-world #50d1e6eebce9cc8a398083289161fc113a7ebcf0`, was `50fbbaf75`; head unchanged; lock's cosmetic rewrite undone).
- **Office after:** #1175 `08ede63547823823c3d7d5937033bffe14690be4` (cards via Rivet's extraction, validated; replies from the pinned `src/residency.mjs`). **Office before:** `7e4e078b3af9353ea6cc1fe9b35f0db2df321792`.
- **Staging module:** `core150-setup.mjs` (sha256 d226043c…), fixtures with checksums in `fixtures/SHA256SUMS`, plan and validation in `PREP.md`. Viewports: 390x844 touch/mobile and 1440x900; for each, the viewport shot (`-390.png`, `-1440.png`) and a whole-page copy (`…-full.png`).

## Pictures (all under this folder; 8 states x 2 widths = 16, plus -full copies = 32 files)
Form states, the page's own funnel walked (invented answers typed in the required boxes, Continue/Skip pressed) to its "Look it over." REVIEW screen:
- `join-move-in-fx-declare-before-{390,1440}[-full].png`, `…-declare-after-…`: the declaring visitor (act `declare`).
- `join-move-in-fx-add-before-…`, `…-add-after-…`: the house's keeper (act `add-resident`, "Adding to Fixture House").
  AFTER shows one new row "WHAT THEY RUN ON · left blank" between SINCE and DIRECTORY LINE, apart from "HOW THEY PERSIST". At 390 the viewport shot ends above that row; it is in the `-full` copy.
Reply states (runtime typed in the page's own box, sent with the page's own button; the office's pinned reply returned):
- `…-reply-pr-…` (a pull-request join) and `…-reply-boarding-…` (a boarding).
The runtime screen itself (extra):
- `…-declare-step-…`, `…-add-step-…`: the one-question screen "What they run on", the office's description in its own words (distinguishes itself from "How they persist"), placeholder "Claude Code on Opus 4.8".

## FINDING (concrete, runtime-confirmed on the real page): the pinned reply's runtime notice is NOT visible by default
On both reply states the page's default view shows only **DID `add-resident`** and **DISPATCHED TO `request_residency`**, then a collapsed "THE OFFICE'S WHOLE ANSWER", then the site's own "Connect your agent" block. The sentence "the runtime you offered was not recorded at joining … set it on your profile with update_profile …" (and the note, PR URL and number) are not shown anywhere outside that collapsed `<details>`; I did not open it. The whole-page (`-full`) frames show nothing else. Cause, from source (and predicted before the run by the Site's pure `replyShape`): the office wraps every act receipt as `{did, dispatched_to, card, result:{…}}` (postmark-office `src/household-apex.mjs`:2663 @08ede635, sent unchanged by `src/mcp.mjs`), and the page's `replyShape` sorts only top-level keys, so the receipt (an object) stays in `whole`. Not repaired, flattened, opened or text-injected, per the brief; a Site change is a new CORE-150 decision. The wrapper shape is derived from the pinned source, not from a live office answer (see limits).

## Limits (source vs runtime)
- Office behaviour is NOT proven: cards are Rivet's extraction validated against the pinned source diffs; replies are built from the pinned source strings and wrapped as the source says; no Office code ran, no live office was asked.
- The bare answer lists only the one act each tier needs (the real index lists thirteen); blurb/teaches are the sentences captured in the Site's own test fixtures, the same before and after.
- The header (STARFORGE pill, signed-in "F", bell) is the real Site chrome reading the fixture session; "Connect your agent" and the Discord line are the page's own.
- The extra "runtime" screens exist only in AFTER (the field does not exist in BEFORE).

## Runs (own PIDs: site-prep's preview server process group 2449104 stopped per its own log; command/start data for my own shell children were not captured separately)
- `world.out` / `world.exit` (exit 0) / `world.meta` (02:25:03Z–02:25:48Z), pre-readback `world-pre.txt`: `systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0 site-prep world <site-2> 50d1e6eebce9cc8a398083289161fc113a7ebcf0` (own run-heavy slot inside).
- First shots attempt (02:25:59Z) was refused at usage (`the out dir must be under /home/seat or /tmp, not /var/tmp/...`) before any build or browser; the one batch ran with out dir `/tmp/core-150-shots`, copied here. `shots-run.log` (7729 lines, full), `shots-run.exit` (exit=0), `shots.meta` (02:26:04Z–02:29:41Z): `systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0 site-prep shots /tmp/core-150-shots <8 paths> --tree …/site-2 --setup …/site-2/core150-setup.XXXXXX/core150-setup.mjs`.
- Cleanup `cleanup-readback.txt` (02:29:57Z): the setup module and its own fresh mkdtemp removed, site-2 clean at 4a4673be, installed World pin 50d1e6ee, no astro/chrome/node process of this lane, run-heavy slots 1-3 free.
