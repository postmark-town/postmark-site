// world-pin-publish.mjs — the one line the office cannot derive for itself.
//
// ── WHY THIS EXISTS (Lane A finding A8, 2026-09-07) ─────────────────────────
//
// The world focus's receipt carries `site_pin`, and it is `null` and cannot be
// anything else today: the office holds no clone of `postmark-site` and no
// record of which `postmark-world` it is pinned to. Lane A's own words:
//
//   "the question it answers is real — 'the world says my mark is published;
//    why does the site not show it?' is a resident question, and it is
//    unanswerable without that sha. But it is the site's to publish."
//
// So the site publishes it, at a path it already builds and already serves
// (`postmark.town/data/pin.json`, beside the manifest), and the office reads it
// the way it reads `panes.postmark.town/windows.json` — a fetch, no coupling,
// honest about its own staleness.
//
// ── TWO CLOCKS, DISCLOSED, NEVER RECONCILED ─────────────────────────────────
//
// `package.json`'s dependency spec is what the repo ASKS for; the installed
// package is what the build actually COMPILED against, and on a rebuild lane
// `resolve-world-pin.mjs` moves the first before the install. They agree in the
// ordinary case and this file does not average them when they do not: it names
// both and says they differ, which is the same discipline the build stamp uses
// for its two shas and the pot board uses for its two dollar figures. A single
// number here could not even express the failure it exists to catch.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The `#<sha>` a `github:owner/repo#sha` spec pins, or null for anything else. */
export function shaFromSpec(spec) {
  const m = /^github:[^#]+#([0-9a-f]{7,40})$/i.exec(String(spec ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * The sha a lockfile's `resolved` URL ends in.
 *
 * Deliberately looser than `shaFromSpec` about the PREFIX and exactly as strict
 * about the sha: npm writes `git+ssh://…`, `git+https://…` or plain `https://…`
 * depending on how the dependency was added, and pinning this to one of those
 * spellings would make the field go quiet the next time somebody re-adds it a
 * different way — the same never-speaks failure this function exists to fix.
 * A `resolved` naming a registry tarball has no sha and answers null, which is
 * a real state: the lockfile was written for a non-git source.
 */
export function shaFromResolved(resolved) {
  const m = /#([0-9a-f]{7,40})$/i.exec(String(resolved ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * What this site is pinned to, and what it was actually built against.
 *
 * Every read is guarded independently: a site that cannot read its own
 * node_modules still publishes the spec, and a site that can read neither
 * publishes nulls with a note. An absent pin is a real state — it says the
 * office cannot answer the resident's question from here — and it must never
 * be dressed up as a sha.
 */
export function worldPin({ root = ".", readJson = (p) => JSON.parse(readFileSync(p, "utf8")),
  builtAt = new Date().toISOString(), env = process.env } = {}) {
  const notes = [];
  // `code_ref` from the SAME source build.json takes it (build-stamp.mjs §
  // gather: `env.BUILD_CODE_REF`), so the two stamps cannot disagree about which
  // ref built this site. Null off the deploy lane, which is honest: a local
  // build has no release ref and inventing one would make a dev artifact look
  // like a shipped one.
  const codeRef = env.BUILD_CODE_REF ?? null;
  if (!codeRef) notes.push("code_ref is null — BUILD_CODE_REF is set by the deploy lane, so this file was written outside it");
  // ── WHICH LANE WROTE THIS, WHICH IS WHETHER THE PIN IS A BLESSING ─────────
  //
  // A reader asking "is this the world the town blessed?" cannot answer it from
  // a sha alone: they would have to resolve the world's settlement tags to find
  // out, and the office holds no clone to do it with. But the SITE knows,
  // because deploy.yml's own two lanes are exactly that distinction — the
  // release lane resolves the newest `settlement/S<n>` tag and installs it (its
  // three guardrails live in tools/lib/world-pin.mjs); the snapshot lane runs
  // no resolver at all and installs whatever the branch's lockfile pins. So a
  // snapshot pin is a branch build BY CONSTRUCTION, and this says so rather
  // than leaving a reader to infer it from a forty-character string.
  //
  // Null off the deploy lane, same as `code_ref` and for the same reason: a
  // local build has no lane, and guessing one would dress a dev artifact as a
  // shipped one.
  const lane = env.PUBLIC_CHANNEL === "release" || env.PUBLIC_CHANNEL === "snapshot" ? env.PUBLIC_CHANNEL : null;
  if (!lane) notes.push("channel is null — PUBLIC_CHANNEL is set by the deploy lane, so this file cannot say whether the pin is a blessing or a branch build");
  else if (lane === "snapshot") notes.push("SNAPSHOT BUILD: the dev lane resolves no settlement tag, so this pin is whatever the branch's lockfile asked for — not a blessed world");
  let spec = null, pinned = null;
  try {
    const pkg = readJson(join(root, "package.json"));
    spec = pkg?.dependencies?.["postmark-world"] ?? pkg?.devDependencies?.["postmark-world"] ?? null;
    pinned = shaFromSpec(spec);
    if (spec && !pinned) notes.push(`the postmark-world dependency is "${spec}", which names no sha — this site is pinned to a moving target`);
  } catch (e) { notes.push(`package.json could not be read (${String(e?.message ?? e).slice(0, 120)})`); }

  // ── THE LOCKFILE IS WHERE THE RESOLVED SHA ACTUALLY LIVES ─────────────────
  //
  // ⚠ AND THE FIRST DRAFT COULD NEVER HAVE FOUND IT. It looked only in
  // `node_modules/postmark-world/package.json` for `_resolved` / `gitHead`,
  // which npm DROPS on a git install — so `world_installed` was null on every
  // ordinary install and the two-field design could not detect the one
  // disagreement it exists for. A field that can never speak is worse than an
  // absent one: it reports "I could not tell" forever while looking like a
  // check. Caught by the fresh reviewer, 2026-09-07 (repair 1).
  //
  // `package-lock.json` records it and always has:
  //   packages["node_modules/postmark-world"].resolved
  //     = "git+ssh://git@github.com/postmark-town/postmark-world.git#<sha>"
  //
  // THE LOCKFILE IS ALSO THE RIGHT SOURCE, not merely the working one: it is
  // what `npm ci` installs from on the deploy lane, so it is the sha the build
  // actually compiled against — which is exactly what this field claims to be.
  // The installed package is kept as a FALLBACK for the case where a build ran
  // from a tree with no lockfile at all.
  //
  // Three states, held apart by their own falsifiers: recorded, present but
  // silent, or unreadable. The middle one must not be reported as the last —
  // that was the first draft's other defect, and it is the same false negative
  // this whole lane is about, committed by the fix for it.
  let installed = null;
  let from = null;
  try {
    const lock = readJson(join(root, "package-lock.json"));
    const entry = lock?.packages?.["node_modules/postmark-world"];
    installed = shaFromResolved(entry?.resolved);
    if (installed) from = "package-lock.json";
    else if (entry) notes.push("package-lock.json holds postmark-world but its `resolved` names no sha — the lockfile was written for a non-git source");
  } catch { notes.push("package-lock.json could not be read"); }
  if (!installed) {
    try {
      const dep = readJson(join(root, "node_modules", "postmark-world", "package.json"));
      installed = shaFromSpec(dep?._resolved ?? "") ?? (typeof dep?.gitHead === "string" ? dep.gitHead.toLowerCase() : null);
      if (installed) from = "node_modules";
      else notes.push("the installed postmark-world records no commit of its own (npm drops _resolved/gitHead on a git install), and the lockfile did not answer either");
    } catch { notes.push("the installed postmark-world could not be read at all"); }
  }

  if (pinned && installed && pinned !== installed)
    notes.push(`the spec asks for ${pinned.slice(0, 12)} and the installed copy is ${installed.slice(0, 12)} — the build compiled against the installed one`);

  return {
    what: "the postmark-world this site is pinned to. The office cannot derive this — it holds no clone of the site — so the site says it, and a reader comparing this against the world's own head can tell a stale site from a stale world.",
    world_pin: pinned,
    world_installed: installed,
    // WHERE that sha came from, because the two sources are not equally strong:
    // the lockfile is what `npm ci` installs from on the deploy lane, and the
    // installed package is a fallback for a tree with no lockfile.
    world_installed_from: from,
    world_spec: spec,
    // the lane that built this, which IS whether the pin was blessed: the
    // release lane resolves a settlement tag, the snapshot lane resolves nothing
    channel: lane,
    code_ref: codeRef,
    built_at: builtAt,
    ...(notes.length ? { notes } : {}),
  };
}
