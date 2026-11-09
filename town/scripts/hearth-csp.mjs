// hearth-csp — writes the Hearth pages' security policy into the BUILT html (POS-959).
//
// An Astro integration, like world-engine-island.mjs: after the build it opens each
// dist/households/<slug>/hearth/index.html, hashes the inline scripts the built page really carries, and adds
// the page's meta policy (tools/lib/hearth-csp.mjs, which holds the reasons). Static hashes, because the
// build is static; computed from the emitted text, so they cannot drift from the code they allow.
//
// IT TOUCHES NO OTHER PAGE. The household page, the rail and every other route are byte-for-byte what they were.
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hearthPages, withHearthPolicy } from "../../tools/lib/hearth-csp.mjs";

export default function hearthCsp() {
  return {
    name: "hearth-csp",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const dest = fileURLToPath(dir);
        const abs = (rel) => join(dest, rel);
        const pages = hearthPages(
          (rel) => (existsSync(abs(rel)) ? readdirSync(abs(rel)).filter((n) => statSync(join(abs(rel), n)).isDirectory()) : []),
          join,
          (rel) => existsSync(abs(rel)),
        );
        for (const rel of pages) writeFileSync(abs(rel), withHearthPolicy(readFileSync(abs(rel), "utf8")));
        console.log(`[hearth-csp] security policy written into ${pages.length} Hearth pages`);
      },
    },
  };
}
