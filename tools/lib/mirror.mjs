// mirror.mjs — ref-rewriting + byte-mirroring helpers for town artifacts.
//
// Self-contained town HTML (the seal, the herbarium) mirrors byte-for-byte;
// HTML that references repo-relative paths (the atlas, Ferry's Daily) gets
// its refs rewritten — images to local processed copies, documents to GitHub
// blob URLs so the record stays one click away. These helpers are the single
// implementation of both patterns.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export const TOWN_GITHUB = "https://github.com/postmark-town/postmark/blob/main";

// any quoted repo-relative image ref — matches both SVG href="..." attributes
// and JS data blobs ("image":"../../../...") in generated town HTML
export const QUOTED_IMAGE_REF_RE = /(["'])((?:\.\.\/)+)([^"']+?\.(?:png|jpe?g|webp|gif))\1/gi;

// any src/href attribute value (for document-style HTML like the office)
export const ATTR_REF_RE = /(src|href)="([^"#][^"]*?)"/gi;

export function githubUrl(repoRelPath) {
  return `${TOWN_GITHUB}/${repoRelPath}`;
}

// byte-compare copy. Returns "wrote" | "kept" | "missing".
export function byteMirror(src, dest) {
  if (!existsSync(src)) return "missing";
  const buf = readFileSync(src);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && Buffer.compare(readFileSync(dest), buf) === 0) return "kept";
  writeFileSync(dest, buf);
  return "wrote";
}

// does this HTML still carry a repo-relative image ref? (the fail-loud guard
// callers run AFTER rewriting — a leftover means a pattern the extractor
// doesn't know yet, and shipping it would mean broken images on the site)
export function findLeftoverImageRef(html) {
  const m = html.match(/(?:\.\.\/)+[^"'\s)]+\.(?:png|jpe?g|webp|gif)/i);
  return m ? m[0] : null;
}

// self-contained check for byte-mirrored HTML: warn if a regrow ever
// introduces relative refs this mirror doesn't rewrite
export function findRelativeRef(html) {
  const m = html.match(/(src|href)="(?:\.\.?\/)[^"]*"/i);
  return m ? m[0] : null;
}

// ── the framed-viewer escape (postmark#2769) ──────────────────────────────
// Ferry's Daily is served inside an <iframe> on /daily/. Its document links are
// rewritten to GitHub blob URLs above (githubUrl), and GitHub sends
// X-Frame-Options: deny — so a link clicked inside the frame navigates the
// FRAME and the reader is left staring at a blank panel. The page's own
// "full-screen" button already carries target="_blank", which is why that route
// works and the in-frame one does not.
//
// The smallest owner of the fix is this mirror: one <base target="_blank"> in
// the copied <head> makes every link in the document open in a new tab, and the
// frame keeps showing the Daily. A <base> with no href changes nothing about
// how URLs RESOLVE — only where they land.
//
// This is deliberately NOT an edit to Ferry's template: TOWN_BULLETIN/
// ferrys-daily.html is the town's file, the town's to write. The framing is the
// site's own choice, so the site's copy step owns the consequence.
//
// Idempotent, because the copy runs on every sync: a second pass over this
// function's own output returns it unchanged.
export function injectBaseTarget(html) {
  const existing = html.match(/<base\b[^>]*>/i);
  if (existing) {
    // Browsers honour only the FIRST <base>, so a second one would be dead
    // markup. Set target on the one that is already there instead.
    const tag = existing[0];
    const withTarget = /\btarget\s*=\s*("[^"]*"|'[^']*'|[^\s/>]+)/i.test(tag)
      ? tag.replace(/\btarget\s*=\s*("[^"]*"|'[^']*'|[^\s/>]+)/i, 'target="_blank"')
      : tag.replace(/\s*(\/?)>$/, ' target="_blank"$1>');
    return withTarget === tag ? html : html.replace(tag, withTarget);
  }
  // No <base> yet: open one immediately after <head> (which may carry
  // attributes). A document with no <head> is returned untouched rather than
  // guessed at — that shape is not Ferry's and not ours to invent.
  const head = html.match(/<head\b[^>]*>/i);
  if (!head) return html;
  return html.replace(head[0], `${head[0]}\n<base target="_blank">`);
}

// write text iff changed. Returns "wrote" | "kept".
export function writeIfChanged(path, text) {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return "kept";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return "wrote";
}
