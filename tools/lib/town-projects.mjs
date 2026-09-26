// town-projects.mjs — THE PROJECTS, read from the town repo's PROJECTS/ (the
// Site Lift, POS-256).
//
// Keemin, 2026-09-26: the Works "is stale, hand-updated", and "PROJECTS in the
// town repo is probably what it is for; it should be programmatic like the
// rest and be called The Projects". So nothing here is a list: a project is a
// folder `PROJECTS/<dir>/` with a README.md, and every field is read from the
// town's own files.
//
//   name          the README's first heading
//   seeded by     PROJECTS/INDEX.md's "Seeded by" cell; else the README's own
//                 "Seeded by" line
//   what it is    INDEX.md's "What it is" cell; else the README's first
//                 paragraph of prose
//   hands         the folder's git history: who committed to it
//   latest        the newest of those commits
//
// THE HANDS ARE NAMED ONLY THROUGH THE TOWN'S OWN RECORD. A commit's author is a
// GitHub account, not a resident, and a git author name is often a human's
// real name. So a hand is named only when its account is the `github` a
// resident declared on their ADDRESS; every other hand is counted, never
// named, and no author name or email ever reaches the data file. Machines (the
// town clock's regrowths, the Pen's re-seals) are not hands at all, and not a
// project's latest activity either.
//
// Pure parsers first, so `node --test` can prove each rule without a clone; the
// one function that touches the disk and git is last.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export const TOWN_REPO_SLUG = "postmark-town/postmark";

// Markdown to the plain words a reader sees: links keep their text, emphasis
// and code marks go, runs of space fold.
export function plainText(md) {
  return String(md ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ── PROJECTS/INDEX.md ────────────────────────────────────────────────────────
// Every table in the index whose first column is "Project" is read by its
// header's names, not by position, so a column added to the town's table does
// not shift what the site reads. A row's project is the folder its link names.
export function parseProjectsIndex(md) {
  const rows = new Map();
  const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const lines = String(md ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) continue;
    const head = cells(lines[i]).map((h) => h.toLowerCase());
    if (head[0] !== "project") continue;
    const col = (name) => head.indexOf(name);
    for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
      const row = cells(lines[i]);
      const dir = row[0].match(/\]\(([^)/]+)\/?\)/)?.[1];
      if (!dir) continue;
      const seeded = col("seeded by") >= 0 ? plainText(row[col("seeded by")]) : "";
      const what = col("what it is") >= 0 ? plainText(row[col("what it is")]) : "";
      rows.set(dir, { seeded_by: seeded || null, what: what || null });
    }
  }
  return rows;
}

// ── A PROJECT'S README ───────────────────────────────────────────────────────
export function readmeName(md) {
  const h1 = String(md ?? "").match(/^#\s+(.+)$/m);
  return h1 ? plainText(h1[1]) : null;
}

// "**Seeded by:** lupi", "*Seeded by Vermillion (`vermillion`), of the Pando
// Peak — 2026-07-14.*" and "**Seeded by:** the founders, with …" all say it;
// the name is what comes before the first comma or dash.
export function readmeSeeder(md) {
  const line = String(md ?? "").match(/^[>*_\s]*\**seeded by\**:?\**\s*(.+)$/im);
  if (!line) return null;
  const who = plainText(line[1]).replace(/[*_]+$/, "").split(/[,;]| — | - /)[0].replace(/\.$/, "").trim();
  return who || null;
}

// The first paragraph under the title that is prose: not a heading, a rule, a
// picture, a table, a list, code, or a "Seeded by:"/"Status:" label line. A
// blockquote's words count (several projects open with their one-line pitch
// quoted).
export function readmeWhat(md) {
  const body = String(md ?? "").replace(/^[\s\S]*?^#\s+.+$/m, "");
  for (const para of body.split(/\r?\n\s*\r?\n/)) {
    const text = para.split(/\r?\n/).map((l) => l.replace(/^\s*>\s?/, "")).join(" ").trim();
    if (!text) continue;
    if (/^(#|---|\||```|!\[|[-*+]\s|\d+\.\s)/.test(text)) continue;
    if (/^[*_]*(seeded by|status)\b/i.test(text)) continue;
    const plain = plainText(text);
    if (plain) return plain;
  }
  return null;
}

// ── THE FOLDERS' HISTORY ─────────────────────────────────────────────────────
// One `git log` over PROJECTS/, bucketed by folder. Record separator \x1e opens
// each commit, unit separator \x1f parts its fields, then the paths it touched.
export const GIT_LOG_FORMAT = "%x1e%H%x1f%aI%x1f%an%x1f%ae%x1f%s";

export function parseProjectsLog(text) {
  const byDir = new Map();
  for (const chunk of String(text ?? "").split("\x1e").slice(1)) {
    const [head, ...paths] = chunk.split(/\r?\n/);
    const [sha, date, name, email, subject] = head.split("\x1f");
    const dirs = new Set(paths.map((p) => p.trim().match(/^PROJECTS\/([^/]+)\//)?.[1]).filter(Boolean));
    for (const dir of dirs) {
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir).push({ sha, date, name, email, subject });
    }
  }
  return byDir;
}

// The machines that write into PROJECTS/ on the town's behalf: the town clock
// (any [bot] account — the atlas refresh, the herbarium regrow) and the Pen's
// re-seal of the town seal at each crossing.
export function isMachine({ name = "", email = "" } = {}) {
  return /\[bot\]$/i.test(name) || /^\d+\+postmark-pen@users\.noreply\.github\.com$/i.test(email);
}

// The GitHub account a commit came from: the login in a GitHub noreply
// address, else the author name as written (most residents' agents commit
// under their account's own name).
export function commitLogin({ name = "", email = "" } = {}) {
  const noreply = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
  return (noreply ? noreply[1] : name).trim().toLowerCase();
}

// account (lower-case) → the handles of every resident who declared it.
export function residentsByGithub(residents) {
  const by = new Map();
  for (const r of residents ?? []) {
    const gh = String(r?.address?.github ?? "").trim().toLowerCase();
    if (!gh || gh === "n/a" || !r.handle) continue;
    if (!by.has(gh)) by.set(gh, []);
    by.get(gh).push(r.handle);
  }
  for (const list of by.values()) list.sort();
  return by;
}

// A project's hands and its latest activity, from its commits (newest first,
// as git log gives them). A named hand carries the residents its account
// belongs to and how many commits it made; the rest are only counted.
export function handsOf(commits, byGithub) {
  const named = new Map();
  const unnamed = new Set();
  let latest = null;
  for (const c of commits) {
    if (isMachine(c)) continue;
    const login = commitLogin(c);
    const residents = byGithub.get(login) ?? null;
    if (!latest) latest = { date: c.date, subject: c.subject, residents };
    if (residents) {
      const hand = named.get(login) ?? { residents, commits: 0 };
      hand.commits += 1;
      named.set(login, hand);
    } else {
      unnamed.add(login);
    }
  }
  const hands = [...named.values()].sort((a, b) => b.commits - a.commits || a.residents[0].localeCompare(b.residents[0]));
  return { hands, unnamed_hands: unnamed.size, latest };
}

export function buildProjects({ folders, indexMd, log, residents, sha = null, branch = "main", repo = TOWN_REPO_SLUG }) {
  const index = parseProjectsIndex(indexMd);
  const byDir = parseProjectsLog(log);
  const byGithub = residentsByGithub(residents);
  const projects = folders.map(({ dir, readme }) => {
    const row = index.get(dir) ?? {};
    const { hands, unnamed_hands, latest } = handsOf(byDir.get(dir) ?? [], byGithub);
    return {
      dir,
      name: readmeName(readme) ?? dir,
      seeded_by: row.seeded_by ?? readmeSeeder(readme),
      what: row.what ?? readmeWhat(readme),
      hands,
      unnamed_hands,
      latest,
      href: `https://github.com/${repo}/tree/${branch}/PROJECTS/${dir}`,
    };
  });
  // newest activity first; a project no hand has touched sinks, by name
  projects.sort((a, b) => (b.latest?.date ?? "").localeCompare(a.latest?.date ?? "") || a.name.localeCompare(b.name));
  return { repo, branch, sha, projects };
}

// ── THE CHECKOUT ─────────────────────────────────────────────────────────────
// The box's own town clone (deploy/site-refresh.sh passes it as --town) has the
// whole history. A shallow checkout — sync-atlas.yml's actions/checkout, depth
// 1 — would make every project's latest activity the one commit it holds, so
// it refuses, and fetch-town keeps the committed projects.json.
export function readProjectsFromCheckout(townRoot, residents, { git = (args) => execFileSync("git", ["-C", townRoot, ...args], { encoding: "utf8", maxBuffer: 64 << 20 }) } = {}) {
  const root = join(townRoot, "PROJECTS");
  if (!existsSync(root)) throw new Error(`no PROJECTS/ in the town checkout ${townRoot}`);
  if (git(["rev-parse", "--is-shallow-repository"]).trim() !== "false") {
    throw new Error("the town checkout is shallow, so its history cannot say who built what or when");
  }
  const folders = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "README.md")))
    .map((d) => ({ dir: d.name, readme: readFileSync(join(root, d.name, "README.md"), "utf8") }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
  const indexPath = join(root, "INDEX.md");
  return buildProjects({
    folders,
    indexMd: existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "",
    log: git(["log", "--no-merges", `--format=${GIT_LOG_FORMAT}`, "--name-only", "HEAD", "--", "PROJECTS"]),
    residents,
    sha: git(["rev-parse", "HEAD"]).trim(),
  });
}
