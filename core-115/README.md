# CORE-115: the household human's pill and the owner's form entry, in the one sub-rail, on both hosts

Real renderer (headless Chrome 1x emulation, desktop 1280 and phone 390), over the REAL BUILT pages: the household page `/households/starforge/` and a resident page `/residents/rei/`. Local, not production, not a physical phone.

- `before-*`: train/2026-w48 as it stands (no pill, no entry). `before-public` signed out; `before-owner` as the house's own human (the "+" shows).
- `after-public-profile` / `-tip`: a build whose starforge registry row carries an INVENTED, labelled fixture `human_profile` ("Fixture Human", they/them, a short line that says it is invented). The tip frames focus the pill so the tooltip (the chosen short line) shows. Same pill on both hosts, after the resident chips.
- `after-owner-profile`: the same build as the house's own human: the pill plus a small "edit" entry (to the office's form, by the canonical slug) and the "+".
- `after-owner-empty`: a build with NO profile set, as the owner: the "set your town name" entry is reachable before anything is set. `after-public-empty`: the same signed out: no pill, nothing.
- `*-states.json`: per frame, what the rail read (pill text, tooltip visible, pill after the last chip, entry shown/text/href, "+" shown, no horizontal overflow).

INVENTED: the fixture profile (written into the build's registry data for the picture, restored afterwards; nothing committed), the signed-in owner (a fake token and a mocked `/api/me` through CDP Fetch). No real private identity, no live profile write; the form itself and sign-in are the office's and were not exercised.
