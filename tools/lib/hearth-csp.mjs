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
// WHO IS TRUSTED, AND WHY IT IS NOT DERIVED FROM THE PAGE ITSELF. The authority comes from a page that carries NO
// entry content: the same house's own household page (households/<slug>/index.html), built from the same layout. Its
// inline scripts are what the site already runs for that house; the Hearth page may run those and nothing more. The
// Hearth page's own inline scripts are only CHECKED against that set: a script that is not in it (whatever put it
// there: an entry, the stage, a sanitizer gap) gets NO authority and FAILS THE BUILD, as does an inline event handler or
// a javascript: URL. Hashing whatever the output happens to contain would hand authority to any code that reached the
// build; this does the opposite. A page with no trusted reference cannot be given a policy at all. There is no 'unsafe-inline', no
// 'unsafe-eval', no 'unsafe-hashes' (so an `onerror=` attribute is dead too), no `data:`/`blob:` script source.
// Everything else the page needs from the network is the site's own origin and the office's API. A template
// cannot reach any other host: frames, plugins, base-URI and form posts are shut.
//
// WHAT IT DOES NOT TRY. `style-src` keeps 'unsafe-inline': a Hearth's stylesheet is an inline <style> the
// sanitizer wrote (no url(), no @import, no loads), and the site's own components set styles. A style cannot
// run script. A meta policy cannot carry frame-ancestors, report-uri or sandbox; those are not claimed.
//
// Pure: html in, html out. The Astro integration (town/scripts/hearth-csp.mjs) applies it to the built
// households/<slug>/hearth/index.html files after the build and touches no other page.

import { createHash } from "node:crypto";

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
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://postmark.town",
    "media-src 'self'",
    "frame-src 'none'",
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

/**
 * The hashes of a TRUSTED reference page's inline scripts: a page built from the same layout that carries no entry
 * content. A Hearth page is never a reference (it cannot vouch for itself or another Hearth).
 */
export function trustedHashes(referenceHtml) {
  const ref = String(referenceHtml ?? "");
  if (!ref) throw new HearthPolicyError("no trusted reference page for the Hearth page's policy");
  if (/data-hearth(?:-stage|-entries|=)/.test(ref)) throw new HearthPolicyError("a Hearth page cannot be the trusted reference");
  return new Set(inlineScripts(ref).map((s) => s.hash));
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

/** The built pages the policy governs: dist/households/<slug>/hearth/index.html, as paths relative to dist. */
export function hearthPages(listDir, join, exists) {
  const out = [];
  for (const slug of listDir("households")) {
    const rel = join("households", slug, "hearth", "index.html");
    if (exists(rel)) out.push(rel);
  }
  return out;
}

/**
 * Apply the policy to every built Hearth page under `dest` (the build output), each against ITS OWN house's entry-free
 * household page as the trusted reference. Throws (the build fails) if a reference is missing or a page carries code the
 * reference does not. Returns the pages written. Touches no other file.
 */
export function applyHearthPolicy(dest, { readFile, writeFile, listDir, exists, join }) {
  const pages = hearthPages((rel) => (exists(join(dest, rel)) ? listDir(join(dest, rel)) : []), join, (rel) => exists(join(dest, rel)));
  const out = [];
  for (const rel of pages) {
    const slug = rel.split(/[\\/]/)[1];
    const refRel = join("households", slug, "index.html");
    if (!exists(join(dest, refRel))) throw new HearthPolicyError(`${rel}: no trusted reference page (${refRel}) in the build`);
    const trusted = trustedHashes(readFile(join(dest, refRel)));
    writeFile(join(dest, rel), withHearthPolicy(readFile(join(dest, rel)), trusted));
    out.push(rel);
  }
  return out;
}
