// hearth-csp — writes the Hearth pages' security policy into the BUILT html (POS-959).
//
// An Astro integration, like world-engine-island.mjs: after the build it opens each
// dist/households/<slug>/index.html (the household's one page, which draws its Hearth since POS-984), checks its
// inline scripts against the trusted host's, and adds the page's meta policy (tools/lib/hearth-csp.mjs, which holds
// the reasons). Static hashes, because the build is static. The AUTHORITY is the page with the entry's region taken
// out; the page, entry included, is only checked against it.
//
// IT TOUCHES NO OTHER PAGE. The resident pages, the forwarding page beside each household page and every other
// route are byte-for-byte what they were.
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyHearthPolicy } from "../../tools/lib/hearth-csp.mjs";

export default function hearthCsp() {
  return {
    name: "hearth-csp",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const dest = fileURLToPath(dir);
        // THE BUILD FAILS, not warns, when a household page carries inline code the trusted host does not (tools/lib/hearth-csp.mjs)
        const pages = applyHearthPolicy(dest, {
          readFile: (p) => readFileSync(p, "utf8"),
          writeFile: (p, t) => writeFileSync(p, t),
          listDir: (p) => readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory()),
          exists: existsSync,
          join,
        });
        console.log(`[hearth-csp] security policy written into ${pages.length} household pages`);
      },
    },
  };
}
