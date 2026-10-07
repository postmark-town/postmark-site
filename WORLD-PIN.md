# The world pin, and who publishes prod

Two things a reader comes here for, and they are different things. The first is
what the site's world pin is and how it moves. The second is who actually
publishes `postmark.town` and out of which trees — which is not the GitHub
deploy lane, and has not been since 2026-08-30.

---

## One — the pin

**The pin is a world commit, and the site carries two of them.**

- **The floor** is frozen in `package.json` → `dependencies.postmark-world`, a
  40-hex `github:keeminlee/postmark-world#<sha>` (the old owner's name; GitHub
  redirects it to `postmark-town/postmark-world`). The keeper bumps it on site
  main at each blessing. It is READ by everything here and written by nobody
  here.
- **The resolved pin** is what the rebuild actually installs on top of the
  floor: the commit of the keeper's newest `settlement/S<n>` tag, resolved
  fresh at rebuild time from the world repo's own refs.

**How it advances, in one sentence:** the pin becomes the keeper's newest
`settlement/S<n>` tag when that settlement is strictly above the floor's, and
otherwise the floor stands.

There is no hold, no schedule, no allow-list, and no second opinion. A blessing
reaches prod because the keeper cut a tag for it.

### The three guardrails

Founder-ruled 2026-08-25 (POS-55). The wording below is the ruling's; the code
is `tools/lib/world-pin.mjs` and each guardrail is falsified in BOTH directions
in `test/world-pin.test.mjs` — the case that must advance and the case that must
refuse, because a fallback that fires on every input is not a fallback.

1. **"Tags only, never main tip."** The candidate set is exactly
   `refs/tags/settlement/S<n>`. `git ls-remote` is called deliberately WITHOUT
   `--tags`, so the listing really does contain `refs/heads/main` and the thing
   that throws it away is code you can test rather than a flag someone can
   quietly drop. Annotated tags advertise twice — the tag object, then the
   peeled `^{}` commit — and a pin means the commit, so the peeled sha wins.
2. **"Monotonic by settlement number — the pin never rolls backwards."** The
   number is parsed as an integer and compared numerically; a lexical sort is
   the same bug in a different coat, answering `S9` over `S45`. Strictly newer,
   or the floor stands: equal is a refusal on purpose, because the floor is
   usually a commit *downstream* of its own tag, and replacing it with the tag
   would be a rollback wearing an equals sign.
3. **"On any tag-resolution failure, fall back to the release's frozen pin
   file."** Ordering carries this one rather than a code path — `npm ci`
   installs the floor FIRST and the advance is an overlay on top of it — and
   the resolver exits 0 on every failure. A rebuild that cannot resolve a
   settlement is not broken; it ships exactly what every release before it
   shipped.

### Where the floor's settlement number comes from

The floor is usually **not** a settlement tag, so it cannot be looked up by sha.
`floorSettlementOf` in `tools/resolve-world-pin.mjs` clones the world repo
`--filter=blob:none --no-checkout` and walks settlement tags downward until one
is an ancestor of the floor. `postmark-world` is public, so this needs no
secret. Measured 2026-08-25 at 2.6s against an 11 MiB repo; worth re-measuring
if the world ever gets large.

### The files

| File | What it is |
|---|---|
| `tools/lib/world-pin.mjs` | the decision law — pure, no I/O, both world-touching seams injected |
| `tools/resolve-world-pin.mjs` | the CLI — supplies `git ls-remote` and the ancestry walk, prints JSON, writes `$GITHUB_OUTPUT` |
| `test/world-pin.test.mjs` | fifteen falsifiers, each named for the guardrail it asserts |

### Two flags, left open on purpose

- **Monotonic by NUMBER, not by ancestry — a fourth guardrail deliberately not
  written.** If the keeper ever pins the floor to a world commit that is not an
  ancestor of the next settlement tag — a hotfix off main — advancing silently
  drops it. The ancestry walk could answer this in the same clone
  (`merge-base --is-ancestor floor chosen`), so it is cheap. It is unwritten
  because the cure has its own disease: a floor permanently off-main would make
  the mechanism permanently inert, and inert looks exactly like working. This
  becomes live the first time a world hotfix does not go through main.
- **A tag-era template against a blessing-era world.** Site code frozen at the
  release tag renders a world resolved after it. World shape changes rarely and
  deliberately, and the viewer degrades rather than throws on a pre-bump package
  (`town/scripts/world-engine-island.mjs`).

---

## Two — who publishes prod, and from what

**The box publishes prod.** `postmark-site-refresh.timer` on `meepo-ec2` fires
at **:10 and :40** — phase-aligned just after the ferry crossings — and
`site-refresh.sh` builds and publishes in one pass. GitHub Actions builds the
release tag to prove it, and stops (founder-ruled 2026-08-27, completed
2026-08-30: one writer owns prod). The dev lane still rsyncs, because
`dev.postmark.town` has no box publisher.

A prod build is assembled from **four sources moving at four speeds**:

| Source | Where it comes from | Pace |
|---|---|---|
| **Code** | the newest `release/*` tag (`--sort=-creatordate`) | a founder Approve |
| **Town data** | site main — `public/atelier/postmark`, `src/data/postmark`, `public/renditions` — with main's extractors run over it on the box against the town's `origin/main`; what they write is never committed | every crossing |
| **Deploy machinery** | site main — `tools/resolve-world-pin.mjs`, `tools/lib/world-pin.mjs`, `tools/build-stamp.mjs`, checked out over the tag | every tick |
| **The world** | the keeper's newest `settlement/S<n>` tag, resolved at rebuild time | every blessing |

The third row is the one that surprises people and the one to remember: **the
site's `tools/` are live on prod the moment they reach main.** A build tree
sitting at a release tag may predate them entirely, so the box checks those
three files out of main over the tag — the same move `deploy.yml` makes, for the
same reason. Changing this file's mechanism on main is therefore a prod change,
not a queued one.

The build lands in `/srv/postmark-site-refresh/releases/<utc-stamp>-<town-sha8>/`
(the last few are kept, older ones swept) and is
published by an atomic symlink swap (`ln -sfn` to a temp name, then `mv -Tf`) at
`/var/www/postmark-town-site`, which nginx serves. Never an in-place rsync, so
there is no window where prod is half a build.

### The receipts

Three, and they answer different questions:

- **`/srv/postmark-harbor/site-refresh.json`** — the box's status board: when
  the last tick ran, its town sha, site main sha, release tag, what it
  published, and why it went quiet if it did.
- **`/var/www/postmark-town-site/build.json`** — what the build itself claims:
  the world sha it was compiled against, the town sha, the crossing. Served
  publicly at **`https://postmark.town/build.json`**, so this one needs no box
  access to read.
- **The resolver, run anywhere** — `node tools/resolve-world-pin.mjs` prints the
  same decision the box's build will make, from the same public refs.

A hold prints the reason it held. Silence from all three means the tick did not
run — check the timer, not the resolver.

### One flag on the publish side

The box used to skip the world install when the lockfile was unchanged, so a
resolver decision of `hold` did not reinstall the floor over whatever was
already in the build tree. Found 2026-09-10 and fixed on office main the same
day (`3118e5b`, "a HOLD is an install, not a no-op"; refined `117f343`,
2026-09-11): both decisions now install the world they chose and check it
against what npm actually put on disk.

---

## History

**2026-09-09/10 — the settlement hold, added and removed.** Settlement S64
carried the world's new viewer onto prod at a scheduled rebuild, and a
`HOLD_AT_SETTLEMENT` constant was added here to cap the pin at S63 while that
was diagnosed. Keemin kept S64 the next morning and the constant went to `null`;
this branch removes the mechanism, since a null hold and no hold are the same
resolver. The record is in the site's git history (`5f0ed579a`, `af50cc5ef`).

*The 2026-08-25 deploy note this file used to be — the Actions-era rebuild lane,
the measured size of the gap it closed, the bootstrap state prod was in before
the mechanism shipped — is in the history at `af50cc5ef:WORLD-PIN.md`. All of it
describes a lane that no longer publishes prod.*
