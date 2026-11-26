# UI-40 · resident #510 carrier (postmark-site#512): household stance count, before and after

Pictures of the **real household page** `/households/reeves/` (default Hearth: the `Needs you` slot and the `Mail` slot, both private to a signed-in house), built from the tree and served by astro preview. Two scenes, two views, two widths, before and after: 16 viewport pictures (desktop 1440x900, phone 390x844), each also with a `-full` whole-page copy (32 files).

## Pins
- **Before:** postmark-site `main` `45c930794199156408c49c53d87850a1d071a2a4`. **After:** carrier #512 head `0e0b198327c3e7a70d7a6a6390190cfcf6474118` (merge of Lyra's #510 head `fb225056b9a59be10004b9a5a9b58b5571ad28a5`, unchanged). The two builds differ in source only by #510's seven files; same tree, same data, same fixture, same camera.
- Built locally with `site-prep shots --tree site-2` (astro build + preview, stopped by site-prep on exit), each under `systemd-run --scope MemoryMax=2G MemorySwapMax=0`, one at a time. Exits 0. Logs: `*-facts.txt` (the page's own readings) and the run timestamps in the carrier's report.

## Fixture provenance (read plainly)
- The office's house aggregate read `GET <office>/household?read=house&household=reeves&full=true` is answered by a clearly labelled, read-only, INVENTED fixture (`ui40-setup.mjs`) on the browser's route layer. The mark ids (`fixture/mark-1`..`5`) and counts are invented; **nothing here is the Reeves house's real state**. `reeves` is used only because the committed registry gives it five residents, the shape of the reported bug (five doorsteps repeating one household's marks).
- The sign-in is a made-up browser-storage entry (`pm.oauth.token`, `pm.oauth.handles`) that no server sees; every request that leaves the preview's origin and is not answered by the fixture was aborted by site-prep. No real credential, no resident act, no owner session, no production write.
- Other reads (bundle, walkers, calendar...) were aborted, so the page shows its own "could not be read" notes in other sections; they are not part of the change. The saved-design read was also aborted, so the default Hearth is drawn.

## Scenes and what the page itself reported (`UI40-FACTS`, in `*-facts.txt`)
| Scene | Fixture | Before (main) | After (carrier) |
|---|---|---|---|
| `five` | all five doorsteps carry the SAME five complete household-wide marks | Needs you `awaiting the house's word · 25` (Caelum 5, Callan 5, Isaiah 5, Lumen 5, Sage 5); Mail `25 marks awaiting the house's word` | Needs you `· 5`, `household-wide 5`; Mail `5 marks awaiting the house's word` |
| `partial` | two doorsteps report the household's five but carry a SHORT page (one mark each, `complete: false`); three carry no stance count | Needs you `· 10`, no caveat; Mail `10 marks awaiting the house's word`, no caveat | Needs you `· at least 5` + `stance count: The exact stance count is uncertain.`; Mail `At least 5 marks awaiting the house's word` + `The exact stance count is uncertain.` |

## Files
`{before-45c930794|after-0e0b19832}-{five|partial}-{needs-you|mail}-{1440|390}[-full].png` in `pictures/`. The `needs-you` pictures start at the Needs you slot, the `mail` pictures at the Mail slot; the `-full` copies show the whole page.

Not captured (not asked, not changed): a scene where every doorstep is unavailable (the `The stance count is unavailable or uncertain.` zero line).
