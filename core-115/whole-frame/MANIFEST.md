# CORE-115 · whole-frame pictures (36 PNG + 9 state JSON) · postmark-site#459 candidate 10084fa3

Real renderer (headless Chromium over CDP, the existing author harness), local built pages, NOT production, not a physical phone. Whole viewport edges, no clip: desktop **1440x900**, phone **390x844** (mobile emulation, 1x). Pages: the starforge household page `/households/starforge/` and a resident page `/residents/rei/`. No full-page companion (the existing harness does not take one).

INVENTED: the fixture profile ("Fixture Human", they/them, "An INVENTED fixture line for the CORE-115 pictures: not a real person's profile."; long-pronoun case: "she/her/they/them/he/him/xe/xem/ze/zir/ey/em/fae/faer/it" = 56 chars, line says it is the long-pronoun picture) written temporarily into the build's registry row `src/data/postmark/households.json` -> `starforge.human_profile` (tracked file restored with `git checkout -- <file>` after each build; tree clean at 10084fa3 at the end; nothing committed); and the owner session = a fake `pm.oauth.token` in localStorage plus a CDP-mocked `/api/me` (the form link/entry points at the office's own form, `https://postmark.town/api/oauth/human?household=starforge`, and was NOT followed; no sign-in, no key, no live write, no private identity). The mock frames are not live frames.

## Sources (labelled separately)
| set | source | build |
|---|---|---|
| `before-*` | Site `train/2026-w48` **f4e4802c29687f99f13b6496581dc94595d0d247** (no pill, no entry) | `npm run build` (run-heavy + 2G scope), pool tree site-2 |
| `after-*-empty` | Site **10084fa39072cb3e2f3ffc328b63c952ec9e8c33** (draft #459 head), registry unchanged (no profile) | same |
| `after-*-profile`, `after-*-profile-tip` | 10084fa3 + the nominal fixture profile above | same |
| `longpro-*` | 10084fa3 + the long-pronoun fixture profile | same |
Installed module for all builds: the manifest pin `postmark-world@47ad6380d828fb8b342d1c421b9058f455467987` (already in node_modules; no install, no pin/lock/code change). NOTE: with that module each Site build exits 1 in its own `world-engine-island` `astro:build:done` hook ("the viewer imports 1 module(s) this build did not stage: /world-engine/spectator/circle-reader.mjs"), after all 7519 pages are emitted; the later `hearth-csp` hook therefore did not run (no CSP meta in these household pages). The pictures are of the emitted pages, not of a fully successful Site build. Logs: scratchpad `c115b/build-{before,empty,profile,longpro}.log`.

## States (file prefix `<label>-<host>-<viewport>.png`, host = household|resident, viewport = desktop-1440|phone-390; `<label>-states.json` = what the rail read per frame)
- `before-public`, `before-owner` (owner: the "+" shows): 8 PNG
- `after-public-empty` (no pill, no entry), `after-owner-empty` ("set your town name" entry + "+"): 8
- `after-public-profile` (pill, no owner entry), `after-public-profile-tip` (pill focused, tooltip visible), `after-owner-profile` (pill + "edit" + "+"): 12
- `longpro-public`, `longpro-owner` (56-char pronouns wrap inside the pill, name visible): 8
All 36 frames are 1440x900 or 390x844. States JSON confirms per frame: pill text, tooltip visible only in the `tip` set, pill after the last resident chip, entry shown only for owner, "+" only for owner, no horizontal overflow (docWidth <= innerWidth) in all 36.

## Harness (absolute paths)
- Invoked: `/tmp/claude-1000/-home-seat-trees-interfaces/325fac77-05bc-4930-bbb2-07786d4dd6d3/scratchpad/pics115-whole.mjs` = a copy of the accepted-state recipe `/tmp/claude-1000/-home-seat-trees-interfaces/325fac77-05bc-4930-bbb2-07786d4dd6d3/scratchpad/pics115.mjs` with ONLY: the screenshot `clip` removed (captureBeyondViewport false), desktop 1280x900 -> 1440x900, and the owned Chrome child reaped on every exit. Fixture, token, `/api/me` mock, focus step, probes unchanged.
- Builds: `npm run build` in `/home/seat/trees-interfaces/pool/site-2` (claimed, lane core-115-pics), each inside `run-heavy env XDG_RUNTIME_DIR=/run/user/1000 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0`; each capture run the same wrapper, one at a time (9 runs, 01:16:43Z-01:20:13Z; builds 01:12:28Z-01:16:18Z). Not `site-prep shots` (cannot stage these states; Jetto-approved route).

## Differences from the nominal reference (core-115-pictures @ 7b87a71e / 0bdcffa3)
Whole frames instead of rail crops; desktop 1440 instead of 1280; the builds are re-made at 10084fa3 / f4e4802c (not 31dc/e2b323f5); same states and fixtures. The tip frames focus the pill, as before.
