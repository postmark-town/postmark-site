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
// stage imports) and EACH inline script the built page carries, by sha256 of its exact text. A static page has
// no per-request nonce, and a nonce baked into a static file is a public constant, so hashes are the honest
// choice here: they name the host's code and nothing a template could add. There is no 'unsafe-inline', no
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

/**
 * The page with its policy, placed before any script it governs (right after the charset declaration).
 * Refuses a page that already carries a policy: this is the page's ONLY one.
 */
export function withHearthPolicy(html) {
  const src = String(html);
  if (/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy/i.test(src)) throw new Error("the Hearth page already carries a security policy; it is the page's only one");
  const policy = hearthPolicy(inlineScripts(src).map((s) => s.hash));
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const head = /<head\b[^>]*>(?:\s*<meta\s+charset[^>]*>)?/i.exec(src);
  if (!head) throw new Error("the Hearth page has no <head> to carry its security policy");
  const at = head.index + head[0].length;
  const firstScript = src.search(/<script\b/i);
  if (firstScript !== -1 && firstScript < at) throw new Error("a script comes before the head's policy position");
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
