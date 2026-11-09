// hearth-csp.mjs — the Hearth page's own security policy, written at BUILD (POS-959).
//
// THE RULING (Darko, 2026-11-01 15:54 EST, POS-684): a template is "HTML and CSS in the page, sanitized at
// build (scripts and event handlers stripped, INLINE SCRIPTS FORBIDDEN BY THE PAGE'S SECURITY POLICY)".
// The sanitizer is the first layer (src/lib/hearth/sanitize-html.mjs). This is the second: a
// `<meta http-equiv="Content-Security-Policy">` on the Hearth pages and no others (Wright, 2026-11-09 00:38:
// "a Hearth-scoped meta CSP in the page, with hashes or nonces for the three host scripts … the page's only
// policy"; Jetto confirmed no edge policy exists, and none is added: no nginx, no box step, no global policy).
//
// WHAT IT ALLOWS. Scripts: the site's own files ('self': the bundled /_astro/*.js, including every module the
// stage imports) and the inline scripts of the TRUSTED HOST, by sha256 of their exact text. A static page has
// no per-request nonce, and a nonce baked into a static file is a public constant, so hashes are the honest
// choice here.
//
// WHO IS TRUSTED, AND WHY IT IS NOT DERIVED FROM THE ENTRY. The authority comes from the page with the ENTRY'S REGION
// TAKEN OUT: Hearth.astro marks everything an entry contributes (its stylesheet and its stage) between two comments,
// <!--hearth-entry--> and <!--/hearth-entry-->, exactly once. The inline scripts outside the region are what the site's
// own host already runs for that house; the page may run those and nothing more. Every inline script on the page is
// CHECKED against that set: a script that is not in it (whatever put it there: an entry, a sanitizer gap) gets NO
// authority and FAILS THE BUILD, as does an inline event handler or a javascript: URL. Hashing whatever the output
// happens to contain would hand authority to code an entry carried; this does the opposite. A page whose region is not
// marked exactly once cannot be given a policy at all. (Until POS-984 the authority was a SEPARATE entry-free page, the
// household's own, beside the Hearth's. The Hearth IS the household page now, so the same page, minus the entry's
// region, is the reference.) There is no 'unsafe-inline', no 'unsafe-eval', no 'unsafe-hashes' (so an `onerror=`
// attribute is dead too), no `data:`/`blob:` script source.
// Everything else the page needs from the network is the site's own origin, the office's API and the isolated
// panes origin the residents' windows run on. A template cannot reach any other host: plugins, base-URI and form
// posts are shut, and the only frames are the panes' (the household page's resident tabs hang each resident's
// sandboxed window there; a template cannot embed one, the sanitizer removes frames).
//
// WHAT IT DOES NOT TRY. `style-src` keeps 'unsafe-inline': a Hearth's stylesheet is an inline <style> the
// sanitizer wrote (no url(), no @import, no loads), and the site's own components set styles. A style cannot
// run script. A meta policy cannot carry frame-ancestors, report-uri or sandbox; those are not claimed.
//
// Pure: html in, html out. The Astro integration (town/scripts/hearth-csp.mjs) applies it to the built
// households/<slug>/index.html files after the build and touches no other page.

import { createHash } from "node:crypto";

/** The two comments Hearth.astro puts around everything an entry contributes. Exactly one pair per page. */
export const ENTRY_OPEN = "<!--hearth-entry-->";
export const ENTRY_CLOSE = "<!--/hearth-entry-->";
/** The isolated origin each resident's sandboxed window runs on (Household.astro's PANES). */
export const PANES_ORIGIN = "https://panes.postmark.town";

const JSON_TYPES = /^(application\/(ld\+)?json|importmap|speculationrules)$/i;

/** The inline scripts a page would EXECUTE: `{ text, hash }`, in order. External scripts and data blocks are not. */
export function inlineScripts(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1];
    if (/\ssrc\s*=/i.test(" " + attrs)) continue;
    const type = /\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(" " + attrs);
    if (type && JSON_TYPES.test((type[1] ?? type[2] ?? type[3] ?? "").trim())) continue;
    out.push({ text: m[2], hash: "sha256-" + createHash("sha256").update(m[2], "utf8").digest("base64") });
  }
  return out;
}

/** The policy, as the content of the meta element. `hashes` are `sha256-…` tokens. */
export function hearthPolicy(hashes) {
  const scripts = ["'self'", ...[...new Set(hashes)].sort().map((h) => `'${h}'`)];
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://postmark.town ${PANES_ORIGIN}`,
    "media-src 'self'",
    `frame-src ${PANES_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
  ].join("; ");
}

/** Inline event-handler attributes and javascript: URLs in the markup (script and style bodies set aside): executable surface a hash cannot name. */
export function inlineExecutableMarkup(html) {
  const markup = String(html).replace(/<script\b[\s\S]*?<\/script\s*>/gi, "").replace(/<style\b[\s\S]*?<\/style\s*>/gi, "");
  const handlers = [...markup.matchAll(/<[a-zA-Z][^>]*?\son[a-zA-Z]+\s*=/g)].length;
  const jsUrls = [...markup.matchAll(/\s(?:href|src|action|formaction|xlink:href|data)\s*=\s*["']?[\s\u0000-\u001f]*j[\s\u0000-\u001f]*a[\s\u0000-\u001f]*v[\s\u0000-\u001f]*a[\s\u0000-\u001f]*s[\s\u0000-\u001f]*c[\s\u0000-\u001f]*r[\s\u0000-\u001f]*i[\s\u0000-\u001f]*p[\s\u0000-\u001f]*t[\s\u0000-\u001f]*:/gi)].length;
  return { handlers, jsUrls };
}

export class HearthPolicyError extends Error {
  constructor(message) { super(message); this.name = "HearthPolicyError"; }
}

const occurrences = (text, needle) => text.split(needle).length - 1;

/**
 * The page with the entry's region taken out: what the site's own host contributes and no entry does. The region is
 * marked exactly once (ENTRY_OPEN before ENTRY_CLOSE), or this throws: a page that cannot say where its entry is cannot
 * say what is not the entry.
 */
export function withoutEntryRegion(html) {
  const src = String(html ?? "");
  const opens = occurrences(src, ENTRY_OPEN), closes = occurrences(src, ENTRY_CLOSE);
  if (opens !== 1 || closes !== 1) throw new HearthPolicyError(`the page's entry region must be marked exactly once; found ${opens} opening and ${closes} closing marker(s)`);
  const a = src.indexOf(ENTRY_OPEN), b = src.indexOf(ENTRY_CLOSE);
  if (b < a) throw new HearthPolicyError("the page's entry region closes before it opens");
  return src.slice(0, a) + src.slice(b + ENTRY_CLOSE.length);
}

/**
 * The hashes of the TRUSTED host's inline scripts: the page's own, with the entry's region taken out. An entry's
 * contribution never counts as the host (see the header: this is the authority, and the page is checked against it).
 */
export function trustedHashes(pageHtml) {
  const page = String(pageHtml ?? "");
  if (!page) throw new HearthPolicyError("no page to take the trusted host's scripts from");
  return new Set(inlineScripts(withoutEntryRegion(page)).map((s) => s.hash));
}

/**
 * The page with its policy, placed before any script it governs (right after the charset declaration).
 * `trusted` is the Set of hashes from trustedHashes(): every inline executable script on the page must be in it, or the
 * build fails. Refuses a page that already carries a policy: this is the page's ONLY one.
 */
export function withHearthPolicy(html, trusted) {
  const src = String(html);
  if (!(trusted instanceof Set)) throw new HearthPolicyError("the Hearth page's policy needs the trusted host's script hashes");
  if (/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy/i.test(src)) throw new HearthPolicyError("the Hearth page already carries a security policy; it is the page's only one");
  const found = inlineScripts(src);
  const unknown = found.filter((s) => !trusted.has(s.hash));
  if (unknown.length) {
    throw new HearthPolicyError(`the Hearth page carries ${unknown.length} inline executable script(s) the trusted host does not: ${unknown.map((s) => `${s.hash.slice(0, 14)}… (${s.text.length} chars)`).join(", ")}; no authority is given to them and the build stops`);
  }
  const markup = inlineExecutableMarkup(src);
  if (markup.handlers || markup.jsUrls) {
    throw new HearthPolicyError(`the Hearth page carries ${markup.handlers} inline event handler(s) and ${markup.jsUrls} javascript: URL(s); the build stops`);
  }
  const policy = hearthPolicy(found.map((s) => s.hash));
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const head = /<head\b[^>]*>(?:\s*<meta\s+charset[^>]*>)?/i.exec(src);
  if (!head) throw new HearthPolicyError("the Hearth page has no <head> to carry its security policy");
  const at = head.index + head[0].length;
  const firstScript = src.search(/<script\b/i);
  if (firstScript !== -1 && firstScript < at) throw new HearthPolicyError("a script comes before the head's policy position");
  return src.slice(0, at) + meta + src.slice(at);
}

/**
 * The built pages the policy governs: dist/households/<slug>/index.html, the household's one page (the Hearth, POS-984),
 * as paths relative to dist. The forwarding page beside it (households/<slug>/hearth/index.html) carries no entry and
 * no policy.
 */
export function hearthPages(listDir, join, exists) {
  const out = [];
  for (const slug of listDir("households")) {
    const rel = join("households", slug, "index.html");
    if (exists(rel)) out.push(rel);
  }
  return out;
}

/**
 * Apply the policy to every built household page under `dest` (the build output), each checked against the trusted
 * host's own scripts: its page with the entry's region taken out. Throws (the build fails) if a page's region is not
 * marked exactly once, or it carries code the host does not. Returns the pages written. Touches no other file.
 */
export function applyHearthPolicy(dest, { readFile, writeFile, listDir, exists, join }) {
  const pages = hearthPages((rel) => (exists(join(dest, rel)) ? listDir(join(dest, rel)) : []), join, (rel) => exists(join(dest, rel)));
  const out = [];
  for (const rel of pages) {
    const html = readFile(join(dest, rel));
    writeFile(join(dest, rel), withHearthPolicy(html, trustedHashes(html)));
    out.push(rel);
  }
  return out;
}
