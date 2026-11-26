# CORE-178 pictures: WLD-256's reader heading and breadcrumbs (Site `f0dd8b4b`)

One reader's generated heading and named breadcrumbs, at **390** and **1440** px. These go with postmark-site #491 (still a draft) and postmark-world #450 (WLD-256, Bevel's, draft).

- **Page:** `/conversations/#circle-62258`, the one-conversation reader. **Room** `t1795610515000-limen` (Lounge Hallway, Pando Plains), **circle** `62258`.
- **Path:** 62219 `limen` › 62256 `sol-am-lichterfenster` › 62257 `little-bird` (shown as "Julian, Vex & Alaric") › 62258 `sol-am-lichterfenster`. Sol is in an ancestor button, the current crumb and the heading, and the shown name stands against the handle.
- **Site:** #491's head `f0dd8b4b` on both sides, with the provider's per-call `{ link: false }`.
- **Before:** World `b4485bc8687e1e109510c8dbc6325e7cbc0994c4` (#450's base). The served `circle-reader.mjs` was sha256 `f010162f…`, with 0 `LINK_FREE` lines.
- **After:** World `f59de92139eba1a9a82eaa1f2f934cb10f22295f` (#450's head). The served `circle-reader.mjs` was sha256 `191fcdbe…`, with 6 `LINK_FREE` lines, exporting `LINK_FREE` and `speakerIdentity`.
- **Fixed across both:** the production site's public data mirrors, the profile and alias overlay, and the ids above. `/api` was live through the dev server's proxy. The lead installed each World package; the lane read the served file back at the start of each run.
- **How:** the dev server, driven by headless Chromium over the DevTools protocol, through the pool's heavy-run queue. These are the PNG originals the measurements were taken from: `reader.png` (the viewport, DPR 1), `crumbs-heading@2x.png` (a close shot, DPR 2), and `after-press.png` (after a real mouse press on the name inside the first ancestor button). Each side's probe is in `data/<side>/report.json`.

## What changed

**Before,** every named crumb and the heading print the handle: "limen's statement", "sol-am-lichterfenster's statement", "little-bird's statement".

**After,** each holds the site's one mention (the face, then the current name, in the resident's colour, underlined), followed by the reader's own "'s statement".
- **Ancestor crumb buttons** (World's `LINK_FREE`, the Site's `{ link: false }`): the mention is a `span` with no href, and **nothing interactive is nested in the button** at either width. The button stays the one control. Chromium's accessibility tree names them "Limen's statement", "Sol's statement" and "Julian, Vex & Alaric's statement", role button. Before, they were "limen's statement" and so on.
- **The current crumb and the heading** (one-argument calls, as Bevel's contract says): the mention is the ordinary link to `/residents/sol-am-lichterfenster/`. So the crumbs' tab stops go from 4 to 5: the current crumb is now a link. Both the current crumb and the heading now link to Sol's page; that is for the fit and look review.
- **Pressing a name inside an ancestor button** (a real mouse press on "Limen") stays on `/conversations/` and opens that statement (`#circle-62219`, now the current crumb), the same as the before's press on the button's words. Nothing navigates to a resident page.
- **Unchanged:** Back, the room crumb, the separators, "1 statement · 1 speaker", "link to this conversation", the statements and their bylines, and the reader's focus on the heading when the view opens.

## What the after frames measure

Name contrast against the field it sits on (median · worst 5%), from the frames' pixels:

| Slot | 390 | 1440 |
|---|---|---|
| ancestor: Limen | 10.63 · 10.63 | 10.46 · 10.40 |
| ancestor: Sol | 6.45 · 6.44 | 6.34 · 6.29 |
| ancestor: Julian, Vex & Alaric | 7.75 · 7.75 | 7.62 · 7.62 |
| current crumb: Sol | 6.45 · 6.45 | 6.34 · 6.34 |
| heading: Sol | 6.45 · 2.54* | 6.34 · 2.54* |

Every picture loaded, every name is underlined, and every ink is the mention's own. \* The heading's worst 5% counts the white pixels of the reader's own focus ring: the heading is focused when the view opens. **The before frames show the same ring around the same heading,** and the after-press frames show none. The median is the name against its field.

## The pictures

| Frame | 390 before | 390 after | 1440 before | 1440 after |
|---|---|---|---|---|
| Crumbs and heading, close (DPR 2) | [before](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/before/390/crumbs-heading@2x.png?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/after/390/crumbs-heading@2x.png?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/before/1440/crumbs-heading@2x.png?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/after/1440/crumbs-heading@2x.png?raw=true) |
| The viewport | [before](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/before/390/reader.png?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/after/390/reader.png?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/before/1440/reader.png?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/after/1440/reader.png?raw=true) |
| After pressing the first ancestor crumb | [before](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/before/390/after-press.png?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/after/390/after-press.png?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/before/1440/after-press.png?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/28d085c2216a19e5d8ad06c8bec0f2631daa1264/core-178/f0dd8b4b/img/after/1440/after-press.png?raw=true) |

Every other surface is unchanged from the earlier sets, and their frames are not relabelled as this change.
