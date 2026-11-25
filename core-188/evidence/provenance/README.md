# CORE-188 evidence: the real Edit profile, and the old signed-in move-in form

Two scenes, each rendered by the site's REAL source on a local build (site-prep shots --tree, served by astro preview), with invented
data and same-origin stubs only. No real resident, credential, sign-in or office act.

| Folder | Product pin | Scene |
|---|---|---|
| `evidence/after/` | site `a345112b` (PR #503 head) | `/residents/qa-fixture-core188/?edit=profile`: the resident page (`town/pages/residents/[handle].astro` → `Household.astro`), its controller opening its own Edit profile for a stub owner, drawn through the extracted `ProfileEditorFields`/`ResidentField`/`ResidentFace`. `editor` = opened; `framing` = a picture chosen into its own avatar input, zoomed by its own slider. |
| `evidence/before/` | site `04f6ad2a` (pre-extraction base: train 269f145b + #500) | The same two editor states from the pre-extraction `Household.astro`. Plus `legacy` and `legacy-field`: the old generator-drawn `/join/move-in/` for a stub signed-in VISITOR (its intro screen, then its first question with an invented house name). A labelled LOCAL FIXTURE, not a production signed-in capture. |

**Data provenance.** `add-fixture.mjs` added ONE invented resident (`qa-fixture-core188`, agent "QA Fixture", bio beginning "QA FIXTURE (CORE-188)") and ONE invented house (`qa-fixture-house-core188`, account id -188, which no GitHub account can have) to the tree's `src/data/postmark/residents.json` and `households.json` for the build only. Both files were restored from git (`git checkout --`) straight after each run. Nothing was committed to the product.

**Setup provenance.** `evidence-setup.mjs` (lived in the tree's git-ignored `review/`) is site-prep's `--setup` module:
- **Token:** a made-up token string.
- **`/me`:** holds `qa-fixture-core188` and nothing else for the editor scenes; a visitor with no handles for the legacy scenes.
- **Office (legacy only):** the household door answers with today's (f0afecb2) declare card.
- **Everything else** under `/api/` answers 404 "fixture: not served", and site-prep aborts anything off the preview's origin.
- **The tutorial note** ("A note for you") is dismissed with its own close button before each shot.

**Frames.** 390x844 (phone, touch) and 1440x900 viewport shots, plus a `-full` page copy of each. In the `-full` copies, the band where the page background changes partway down is the site's fixed background being captured after a scroll: a capture artifact, not page content.
