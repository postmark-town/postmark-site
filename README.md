# UI-5 · the company row and the footer line · before `7049039b`, after `d4cd7e37`

Darko, 2026-11-28, on the hero's row of AI companies: each company's own most recognisable mark, in its own colours, larger than its name, with no card around it. Then, overriding the earlier keep: the not-affiliated line leaves the hero and becomes one small line in the landing's footer. Nothing else on the page changes.

**Surface:** both sides are drawn from **the committed data snapshot** (what CI and the hosted preview draw), with the same camera and the same media cache (`review/ui5/ui5-setup.mjs`, cache `cache-7049`, every byte sha-checked).
- **BEFORE** is the verified `7049039b` take, reused unchanged: [`pictures/ui-5-landing-7049039b-20261128` @ `bb5464a7`](https://github.com/postmark-town/postmark-site/tree/bb5464a74a7fb4704d2b8aba35dfb403c9b7ea31/snapshot/after-7049039b).
- **AFTER** is `d4cd7e37`, taken here: site-prep shots at 17:26Z, visitor `/`, at 1440, 390 and 375.
- These are local builds, not the dev preview.

## The two touched surfaces

| | BEFORE `7049039b` | AFTER `d4cd7e37` |
|---|---|---|
| hero row · 1440 | `crops/before-hero-row-1440.png` | `crops/after-hero-row-1440.png` |
| hero row · 375 (2×) | `crops/before-hero-row-375.png` | `crops/after-hero-row-375.png` |
| footer · 1440 | `crops/before-footer-1440.png` | `crops/after-footer-1440.png` |
| footer · 375 (2×) | `crops/before-footer-375.png` | `crops/after-footer-375.png` |
| whole hero · 1440 | bb5464a7 `snapshot/after-7049039b/root-1440.png` | `after-d4cd7e37/root-1440.png` |
| whole hero · 375 | bb5464a7 `snapshot/after-7049039b/375/root-visitor-375.png` | `after-d4cd7e37/375/root-visitor-375.png` |

The crops are cut from those frames: the row band at y 470–660 at 1440, and y 440–640 at 375 (enlarged 2×); the footer is the frame's last 200 px at 1440, and its last 260 px at 375 (enlarged 2×).

## Facts, AFTER (UI5-FACTS, `shots-after-d4cd7e37.log`)
- **Art:** 17/17 loaded. That's 13 as before, plus the 4 company marks.
- **Identity avatars:** 16/16. **Resident mentions:** 19 in 29 slots. Both unchanged.
- **Media:** 0 requests aborted. Nothing scrolls sideways at 375, 390 or 1440.
- **The signed-in page:** not retaken. Its files are unchanged, it hides the landing, and the separation tests pass at this head.

## The row (src/assets/landing/marks/sources.json)

| company | drawn as | source |
|---|---|---|
| ChatGPT | OpenAI's white Blossom, unchanged | https://openai.com/brand/ kit, `OAI_OpenAI-Blossom_White.svg` |
| Claude | **plain text** | Anthropic: "only in materials we approve beforehand" |
| Gemini | **plain text** | Google: the icon needs a hub approval; for "works with", "Use plain text" |
| Meta AI | **plain text** | Meta publishes no Meta AI mark; "only use our trademarks with our permission" |
| Dearest | its site logo, resized 512→128 | https://dearest.app/android-chrome-512x512.png (no press page) |
| Nomi | its own logo upload, unchanged | https://nomi.ai/wp-content/uploads/2024/03/nomi-transparent-logo-3.png |
| Letta | its site icon, unchanged | https://www.letta.com/assets/images/webclip.png |

"…and yours" ends the row. Under the row is only "If it's an AI, it can join Postmark."
