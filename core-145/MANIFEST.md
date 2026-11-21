# CORE-145 · Write to someone new · whole-frame pictures (24 PNG + setup module + 2 run logs)

Tool: the live `site-prep shots --tree <site-2> [--setup <module>]` kit (STAR-221): builds the tree, serves it with `astro preview`, shoots a fresh Chromium context per path and size: **390x844** (mobile+touch) and **1440x900** viewport edges (every edge, no clip) plus a `-full` full-page copy of each. NOT the CORE-115/128 controller. Every command ran through `XDG_RUNTIME_DIR=/run/user/1000 systemd-run --user --scope -q -p MemoryMax=2G -p MemorySwapMax=0` and site-prep's own run-heavy; one serial phase. Local build, not production.

INVENTED (setup module `wsn-setup.mjs`, in this directory; names every household/resident "Fixture …", lines say INVENTED): the pool's households and last-active times (the page's serialised `wsn-data` block is replaced in the document response only), a placeholder sign-in in localStorage for the two signed-in states (site-prep aborts every request that leaves the origin, so the island's office call never goes out), and a fixed `Math.random` sequence so the deal is repeatable. No credential, no real read or write.

## Sources
- after: draft PR #473 head **2b191617976da9042c6ce663421d6be062fd2bc4** on train f4e4802c29687f99f13b6496581dc94595d0d247; World installed with `site-prep world … 47ad6380d828fb8b342d1c421b9058f455467987` (the declared train pin; exit 0, no S183). Build: exit 0, `[hearth-csp] security policy written into 89 household pages`, 7518 pages, "Complete!" (`after-run.log`).
- before: train **f4e4802c29687f99f13b6496581dc94595d0d247** (no feature), same World 47ad, same tool; build exit 0, CSP written, 7518 pages (`before-run.log`). The unmodified page, anonymous, no setup module.

## Frames (`households-wsn-<state>-<390|1440>[-full].png`)
- `result`: anonymous reader, an invented pool, one click: Fixture Wren of Fixture Fresh House, her own card line, "✍ Write to Fixture Wren", "their page", the optional topic ("A topic, if you want one (never required)"), and beside it "They may not write back. A letter is a gift; silence is a legal answer." "Little Bird's idea." is under the button.
- `own-skipped`: a signed-in fixture reader whose own house is FIRST in the pool and would be dealt first by the fixed draw: the dealt resident is not theirs.
- `only-yours`: signed-in fixture; the only recent house is theirs: "The only house that has been around in the last 14 days is yours. The directory below is all here."
- `none-recent`: an invented pool where nobody acted in 14 days: "Nobody we can see has been around in the last 14 days…".
- `unknown`: the build's own data (the committed snapshot carries no `last_active`), no staging but the click: "We can't see who has been around lately just now, so there is nobody to suggest…" (never worded as a checked empty pool).
- `before/households-{390,1440}[-full].png`: the train page, no button.
The ordinary directory sits unchanged under the block in every frame.

## Limits
Mock/invented data and a staged identity, not live town data; Chromium emulation, not a physical phone. The committed snapshot has no `last_active`, so a real build of this checkout shows the `unknown` state until the office's field is in the data. Late identity (resolving after load) and keyboard use are covered by the tests and source pins, not pictured.
