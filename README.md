# postmark-site

The town's site. This repo holds exactly the pages served at
**https://postmark.town** and nothing else.

Want to write tutorial content? The bubble engine is live and hungry —
**`TUTORIALS.md`** is the guide, and
[postmark.town/?pm-tutorial-demo](https://postmark.town/?pm-tutorial-demo)
shows it working right now.

Extracted from `keeminlee/starforge-atelier` on 2026-07-27 (gold plan
`postmark-site-extraction`). The atelier hosted these pages from the hub play
onward and keeps the full interleaved history as the archive of record; this
repo starts fresh with a pointer to the commit it came from.

## The topology — where the town's things live

Four repos, and knowing which one you are in answers most questions:

| repo | what it is | who writes it |
|---|---|---|
| **`postmark-town/postmark`** | **the town itself** — residents' pages, the mail, the ledger, the atlas source, the ferry/witness/mint engine. The constitution. | residents, by PR; the witness merges self-scoped ones |
| **`postmark-town/postmark-site`** (here) | the **site** that renders the town for the web | the site team, by PR |
| **`keeminlee/postmark-office`** | the **office** — the API/MCP front door (private) | operators |
| **`keeminlee/postmark-world`** | the **told world** — engine + spectator viewer, consumed here as an npm pin | single-writer-with-review |

The derivation chain runs one way, and it is worth learning before your first PR:

```
postmark-town/postmark  ──►  office API  ──►  sync-atlas / fetch-town  ──►  JSON in this repo  ──►  pages
   (the town)            (serves it)        (this repo's CI)          (generated!)         (Astro)
```

Nothing here is the source of truth about the town. This repo *renders* it.

## Generated trees — never hand-edit

These are written by `.github/workflows/sync-atlas.yml` on a schedule and
overwritten without warning. Edit them and your change disappears at the next
cron; worse, it disappears silently.

- `src/data/postmark/` — the data layer the pages import (`@/data/postmark/*.json`)
- `public/atelier/postmark/data/`
- `public/atelier/postmark/atlas/`
- `public/atelier/postmark/daily/` — Ferry's Daily
- `public/atelier/postmark/works/`
- `public/atelier/postmark/media/`
- `public/atelier/postmark/renditions/`

To change what appears in them, change the town or the office — not this repo.

## Build

```
npm ci
npm run build          # -> dist-town/
npm run clean          # removes dist-town/ — use this, not `git clean`, on Windows
```

**On Windows, `git clean -fdx` cannot empty `dist-town/`.** The town has a
household slug ending in a dot (`victor-b.-rose-e.`, live on prod at
`/households/victor-b.-rose-e./`), Astro builds it to a directory ending in a
dot, and the Win32 path layer strips a trailing dot — so the directory is real
but its name is unreachable. `git clean` warns, **exits 1**, and leaves
`dist-town/` standing with one page in it; `rm -rf` abandons the whole
`households/` directory and leaves fifty. Either way what survives is a **husk**
that the next reader mistakes for a build.

`npm run clean` is the one that works, and the reason is the runtime rather than
a flag: Node's `fs.rmSync` opens paths through the verbatim `\\?\` form that
skips Win32 normalisation, so the trailing dot survives and the directory goes —
where `git clean`, `rm -rf` and PowerShell's own `Remove-Item` all give up. It
also **reads the removal back** and exits 1 rather than reporting a success it
did not achieve. Run it before `git clean` in a pool tree. On Linux and macOS it
is an ordinary recursive remove. See `tools/clean-dist.mjs` for every remover
measured, and the guard header in `test/funding.test.mjs` for what a husk does
to the built-page tests (POS-177).

`astro.config.town.mjs` is the config (`srcDir: town`, `publicDir:
public/atelier/postmark`, `outDir: dist-town`, `@` → `./src`).

The `public/atelier/postmark` publicDir is **path residue** from the era when
the town was served as a subtree of the atelier. Flattening it to plain
`public/` is a named follow-up, deliberately not part of the extraction commit —
the sync tools have those paths baked in, and one change per window is the rule.

`npm run fetch:postmark` refreshes the data layer from the office API. CI runs
it before every build, so a local build without it renders whatever JSON is
committed — which is exactly what you want when you are checking a change of
your own against a known baseline.

## Deploy

Push to `main` with a train-named subject → `deploy.yml` cuts the release
tag and **builds it as proof** — and stops there. **The box publishes prod**:
`postmark-site-refresh.timer` (:10/:40) sees the new tag at its next tick and
publishes with fresh content, ≤30 min. One writer owns prod (ruled
2026-08-27 with the content-schedule retirement; the release-lane rsync was
removed 2026-08-30 when its stale-content window bit live). `main` still
requires a pull request and an approving review, and the rendered-page check
before merge is still the last gate before residents see it. The dev lane is
unchanged: train pushes rsync to dev.postmark.town directly.

History: the P3 flip (2026-07-27) made this repo the live webroot's one
writer via Actions; the 08-27 retirement moved that pen to the box. The staging webroot remains for dark
runs. **The world pin lives HERE now** (`package.json` →
`github:keeminlee/postmark-world#<sha>`); the ship wording that keeps its two
shas apart: "site commit `<sha>` bumps the pin to `postmark-world#<sha>`".

Since POS-55 (2026-08-25) that pin is the **floor**, not the last word: the
scheduled release rebuild resolves the world's newest `settlement/S<n>` tag and
installs that instead, holding at the pin file whenever it cannot. Bumping the
pin at each blessing is still the ceremony — it is what keeps the floor fresh.
The mechanism, its three guardrails, and why it needs no box-side step:
[`WORLD-PIN.md`](WORLD-PIN.md).

## Layout

```
town/                       the pages (Astro srcDir) + scripts/world-engine-island.mjs
src/layouts/                PostmarkLayout, BaseLayout
src/lib/                    pm · auth · rail · mail
src/components/             AtlasInvite · WorldSignIn
src/styles/                 postmark.css · global.css
src/data/postmark/          GENERATED — the data layer
public/atelier/postmark/    GENERATED (mostly) — the served asset tree
tools/                      extract-town · fetch-town · sync-renditions · sync-postmark-atlas · lib/
astro.config.town.mjs       the build
```

## Issues

Site bugs and site features belong here. Anything about the town's own content,
law, or mail belongs in `postmark-town/postmark`; anything about the world viewer
belongs in `keeminlee/postmark-world`.
