# CORE-117 · Conversations: one conversation that holds still while a human reads and writes · whole-frame before/after

Erin (via Darko, CORE-111 ask 2): "a separate view of just one conversation window" ... "I can't see the conversation I was following before responding". PR (draft): postmark-site#466, branch `core-117-selected-view`, base `train/2026-w48`.

## What these are, and are NOT
- **Built local Site pages** (`site-prep shots --tree`, which builds the tree and serves it with `astro preview`), Chromium (Playwright 1.62.0 via the helper): **desktop 1440x900** and **phone 390x844** (mobile emulation), whole viewport every edge, each with a `-full` whole-page copy. Page `/conversations/` and `/conversations/#circle-50101`. **NOT production, NOT a physical phone.**
- **INVENTED**: every word and record is the repo's existing fixture `test/fixtures/circles.sample.json` ("invented speech", the CORE-70 worked example), answered as `test/conversations-circles.test.mjs`'s `makeOffice` answers it, here as route mocks from the `--setup` module (`core-117-shots-setup.mjs`, this folder): two live rooms ("Cave Interior", 14 statements; "The Quay", 3), a public residents list with two INVENTED SVG portraits (pica, claran; the rest letters). Nothing reads a real office or a real resident.
- **The visitor is anonymous.** `site-prep shots` refuses a setup module that names a credential, so no sign-in is staged: the in-flow speaking area is the page's own **signed-out gate** ("Speaking needs an address in this town ... Sign in"), which is the same single `[data-say]` node that holds the form when signed in. **No real speaking act, no real credential.** The signed-in form's behaviour (draft, focus, submit target) is shown by the Chrome page tests (`test/conversations-circles.test.mjs`, 16/16), not by these frames.
- No screenshot DOM edits; the setup module only mocks routes and waits for the page's own reader to mount.

## Sources (exact pins; each build log ends "Complete!" after the hearth-csp line)
| set | page source | installed World | build |
|---|---|---|---|
| **before** = the accepted CORE-128 host, labelled baseline | Site `85837d089745c7498542e4ceb6b82e5682200f4a` (draft #465's head, S183 integration; detached in the lane's own pool tree for this run) | normal S183 `postmark-world#50fbbaf75bf2851d25214d6415be3d4f27488594` (`site-prep world`, receipt exit 0) | `site-prep shots --tree`: 7518 pages, `[hearth-csp] security policy written into 89 household pages`, "Complete!" |
| **after** = CORE-117 final | Site `ced2c4b0dced19783cdaf74688fafc849857f1f7` (draft #466 head = `96dcc7b17` + the merged accepted host `85837d089` + test fixes + one CSS line) | the same installed `50fbbaf75bf2851d25214d6415be3d4f27488594` | 7518 pages, hearth-csp 89 household pages, "Complete!" |
Both builds print the warning "the world commit ... (50fbbaf75) is not one of the settlements the town's record names (S55..S74)": the build completed. **No claim that either baseline is merged or live.**

## Frames (`<set>-<path>-<viewport>[-full].png`)
- `*-conversations-*`: the ordinary page, hash-less: identical code path before and after (the lists; two live rooms, the metadata group, face + name speakers). Included so the lists are shown intact.
- `before-conversations-circle-50101-*`: **the accepted host on a #circle-50101 link.** The circle opens INSIDE the room's card in the long list: the page scrolls past the lead and the **speaking area is far above it** (out of the viewport), **another conversation (The Quay) sits right below** and the page keeps growing under the reader. This is the failure Erin described.
- `after-conversations-circle-50101-*`: **CORE-117.** The page says "One conversation": the lists step aside, "← All conversations", the place + live chip, the one conversation read by the shared reader (faces first in each byline, "View 5 replies", "Show more"), and the page's own **speaking area in the flow right under it**, in one viewport on the desktop (and directly under it in the phone's whole-page copy). The accepted host's face provider is the SAME one here (one renderer).

## Observed and disclosed (not fixed here)
- The reader moves focus to the circle's heading when it opens, so a focus ring is drawn around "pica's statement" in both before and after frames (the World reader's own behaviour).
- The breadcrumb ("Back to the room > Cave Interior > pica's statement") and the heading repeat the title: the World reader's circle header, which the page does not own.
- One layout defect WAS found in the first after-frames and fixed before these were taken: on desktop "All conversations" butted against "Cave Interior" (inline-block, no gap); it is now a block of its own (the one CSS line in `ced2c4b0d`).

## Run (one serial phase, every heavy step through run-heavy with the 2G scope)
`site-prep world ... 50fbbaf` (exit 0, 3 min) -> `node --test test/conversations-circles.test.mjs` singly (16/16) -> `site-prep shots` after build (head ced2c4b0d) -> `site-prep shots` before build (head 85837d089). `site-prep` stopped its own preview server on each exit (process groups reported). One first retry: a `site-prep shots` refused once ("another writer", exit 3) with no process of mine in the tree afterwards; I ran it again, once, and it completed.
