// clean-dist — remove dist-town/ on a box where `git clean -fdx` cannot.
//
//     npm run clean
//
// ── WHY THIS FILE EXISTS (POS-177, 2026-09-21) ──────────────────────────────
//
// The town has a household whose slug ends in a dot — `victor-b.-rose-e.`,
// declared in src/data/postmark/households.json and live on prod today at
// /households/victor-b.-rose-e./ (200; the dotless spelling 404s). Astro builds
// it to `dist-town/households/victor-b.-rose-e./index.html`.
//
// On Windows the Win32 path layer STRIPS a trailing dot from a path component,
// so `dist-town\households\victor-b.-rose-e.` names something that does not
// exist as far as the ordinary API is concerned. The directory is real; that
// spelling of its name is unreachable. Note what this does NOT break: the page
// INSIDE it opens fine, because `…\victor-b.-rose-e.\index.html` does not end
// in a dot and nothing is stripped. Only the directory itself is unopenable,
// which is exactly why a walker can read the page and still not delete it.
//
// Measured in G:/Postmark/pool/site-1 on 2026-09-21, on a husk built on purpose:
//
//   git clean -fdx -e node_modules
//     warning: could not open directory 'dist-town/households/victor-b.-rose-e./': No such file or directory
//     warning: failed to remove dist-town/households/victor-b.-rose-e.
//     → exit 1, and dist-town/ still standing with one page in it
//
//   rm -rf dist-town            (coreutils)
//     rm: cannot remove 'dist-town/households': Directory not empty
//     → gives up on the whole households/ directory; left fifty pages behind
//
//   Remove-Item -Recurse -Force (PowerShell, ordinary name)
//     Cannot find path '…\victor-b.-rose-e.' because it does not exist.
//
//   Remove-Item -Recurse -Force '\\?\…\victor-b.-rose-e.'
//     → works. The `\\?\` prefix hands the path to the object manager verbatim,
//       with no Win32 normalisation, so the trailing dot survives.
//
//   node: fs.rmSync(abs, { recursive: true, force: true })
//     → works, with no prefix of its own to write. Node's path layer already
//       opens through the verbatim form, which is why THIS is a Node script and
//       not a shell one: in a repo that has node, the fix is to stop asking the
//       shell. (Checked rather than assumed — rmSync was run against a husk and
//       neither spelling could see dist-town afterwards.)
//
// ── WHAT A HUSK COSTS, AND WHY IT IS WORTH A FILE ──────────────────────────
//
// Whatever the walker had not reached stays behind, and `dist-town/` is left
// STANDING. That is the damage: the next thing to read dist-town/ believes a
// build happened here. That was the other half of POS-177 — the built-page
// tests guarded on `existsSync(dist-town)`, read the husk as a build, and nine
// of them reddened on pages that were never built while a tenth swept the one
// surviving page and pronounced the site clean. Those guards now read the pages
// they need (see the header at the guard in test/funding.test.mjs). This file
// removes the husk so the question stops being asked.
//
// ── WHY THIS IS NOT WIRED INTO `npm run build` ─────────────────────────────
//
// It could be: a `prebuild` script would make every build start from a truly
// empty outDir and no lane would have to think about it. It is not, on purpose.
// `npm run build` is the deploy path (.github/workflows/deploy.yml runs it and
// rsyncs dist-town/ to the webroot), that path runs on ubuntu where a
// trailing-dot directory is an ordinary directory and none of this can happen,
// and putting a recursive delete of the publish directory onto the deploy path
// to fix a Windows-local cleanup annoyance is a bad trade. The lane's clean is
// where the husk hurts, so the lane's clean is where this sits.
//
// ── THE OTHER REPAIR, AND WHY IT IS NOT A LANE'S TO MAKE ───────────────────
//
// The build could stop emitting a trailing-dot directory — slugify the household
// key into a path no platform objects to. That MOVES a URL prod serves today,
// which is a shape call for the founder and not a lane's fix. Recorded on
// POS-177 rather than taken.
//
// On Linux and macOS, and on a Windows tree with no husk in it, this is an
// ordinary recursive remove. An absent dist-town/ is success, not an error — a
// clean tree is the state this is asking for.

import { rmSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const OUT = "dist-town";
const abs = resolve(process.cwd(), OUT);

if (!existsSync(abs)) {
  console.log(`clean-dist: ${OUT}/ is already absent — nothing to remove`);
  process.exit(0);
}

// COUNT BEFORE REMOVING, so the success line is a receipt and not a claim. A
// remove that quietly did nothing prints the same word as one that worked, and
// this is a file written because something quietly did nothing.
let before = 0;
const count = (dir) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) count(join(dir, name.name));
    else before += 1;
  }
};
try {
  count(abs);
} catch (err) {
  // A tree this cannot even walk is exactly the state worth removing, so this
  // is a note rather than a stop.
  console.log(`clean-dist: could not fully count ${OUT}/ before removing it — ${err.message}`);
}

try {
  rmSync(abs, { recursive: true, force: true });
} catch (err) {
  console.error(`clean-dist: could not remove ${OUT}/ — ${err.message}`);
  process.exit(1);
}

// THE ASSERTION, and the reason this file is not one line: `rmSync` with
// `force: true` does not throw for everything it fails to finish, and the whole
// class of defect being repaired here is a cleanup that reports success over a
// directory it left standing. So the removal is READ BACK rather than believed.
if (existsSync(abs)) {
  console.error(`clean-dist: ${OUT}/ is STILL PRESENT after removal — it held ${before} file(s) before the attempt`);
  process.exit(1);
}

console.log(`clean-dist: removed ${OUT}/ (${before} file${before === 1 ? "" : "s"})`);
