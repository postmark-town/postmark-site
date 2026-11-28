// ui5-falsify.mjs — Facet's two falsifiers for UI-5, on the built page (dist-town is build output, git-ignored; every file is restored after):
//   reversal   swap the selection rule (the visitor gets the signed-in page, the signed-in reader the landing): the separation tests must fail
//   letters    take the landing's id="letters" out of the built front page: the CTA checks (pure test's built-page case, browser test 3) must fail
//   node ui5-falsify.mjs <site tree> <reversal|letters>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const [tree, which] = process.argv.slice(2);
const dist = join(tree, "dist-town");
const edits = [];
if (which === "reversal") {
  const css = readdirSync(join(dist, "_astro")).filter((f) => f.endsWith(".css")).map((f) => join(dist, "_astro", f))
    .find((f) => readFileSync(f, "utf8").includes("html:not([data-lens]) .pm-index{display:none}"));
  const before = readFileSync(css, "utf8");
  const after = before.replace("html:not([data-lens]) .pm-index{display:none}", "html[data-lens] .pm-index{display:none}")
    .replace("html[data-lens] .pm-landing{display:none}", "html:not([data-lens]) .pm-landing{display:none}");
  if (after === before) throw new Error("rule not found");
  edits.push([css, before]); writeFileSync(css, after);
} else if (which === "letters") {
  const page = join(dist, "index.html");
  const before = readFileSync(page, "utf8");
  const after = before.replace(/(<section class="chapter")([^>]*) id="letters"/, "$1$2");
  if (after === before) throw new Error("id not found");
  edits.push([page, before]); writeFileSync(page, after);
} else throw new Error("which?");
try {
  const files = which === "reversal" ? ["test/visitor-landing-browser.test.mjs"] : ["test/visitor-landing.test.mjs", "test/visitor-landing-browser.test.mjs"];
  const r = spawnSync(process.execPath, ["--test", ...files], { cwd: tree, encoding: "utf8" });
  const lines = (r.stdout + r.stderr).split("\n").filter((l) => /^(not )?ok \d|^# (pass|fail)/.test(l));
  console.log(`FALSIFIER ${which}: exit ${r.status}\n${lines.join("\n")}`);
} finally {
  for (const [f, text] of edits) writeFileSync(f, text);
  console.log(`restored ${edits.map(([f]) => f.replace(tree + "/", "")).join(", ")}`);
}
