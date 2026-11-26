# CORE-178 pictures: the profile-label family (`acd28bc8`)

The changed surfaces only, at **390** and **1440** px. These go with postmark-site #491, still a draft.

- **After:** #491's head **`acd28bc8`**. These frames are in commit `c603d3da` on this branch.
- **Before:**
  - for the four new resident routes: `fb2dd59a`, #491's previous head, taken here;
  - for Jetto's page, its opened Window and the rendition page: `b7f9bdfe`'s frames, already published at `b5034630` on `pictures/core-178-b7f9bdfe`. Those surfaces did not change between `b7f9bdfe` and `fb2dd59a`.
- **Data, the same on both sides:** the production site's public data mirrors, plus 10 files at their committed versions. `/api` was live through the dev server's proxy, and the World is S192.
- **How:** the dev server, driven by headless Chromium over the DevTools protocol, through the pool's heavy-run queue. Long pages continue in `s2`, `s3`, …. These are JPEG viewing copies; the measurements were taken on the PNG originals.

## What changed

- **The resident's own page** painted its visible person labels straight from the name. Every one is the site's one mention now, empty and non-happy branches included:
  - the heading and the header's "Write to" button (no second face: the avatar is beside them);
  - the Address and Window card titles;
  - the window's hung, not-said and not-hung copy;
  - the marks heading and its copy;
  - the projects lead;
  - the letters lead, the empty mailbox and its "Write to" button.
  ARIA, alt, titles and the window's frame stay plain text.
- **The own page keeps the name whole,** however long (Caleb Agnitio's 158 characters, in full). Every other page still shows the shortened name, with the whole as its title.
- **The rendition page's back link** names the person through the mention. The link, its destination and its words are unchanged.
- **A "Write to" button is a gold plate,** so the name in it takes the ink for the button's gold. The first after pass measured Jetto's at 1.37:1 there, which was fixed before these frames.
- **A profile Save re-inks this resident's labels in place,** for their surface and plate.

## What the after frames measure

| Surface | 390 | 1440 | before (390 · 1440) |
|---|---|---|---|
| Jetto's page | 17 drawn, lowest 5.14 | 17 drawn, lowest 5.23 | (b7f9 set) |
| Jetto's page, Window opened (pane hung) | 16 drawn, lowest 5.07 | 16 drawn, lowest 5.10 | (b7f9 set) |
| Rendition page (back link) | 2 drawn, lowest 8.19 | 2 drawn, lowest 8.44 | (b7f9 set) |
| Andre Agnitio's page (61-character name, no colour chosen) | 14 drawn, lowest 8.52 | 14 drawn, lowest 8.48 | 7 drawn · 7 drawn |
| Caleb Agnitio's page (158-character name, no colour chosen) | 14 drawn, lowest 8.52 | 14 drawn, lowest 8.52 | 7 drawn · 7 drawn |
| Andre's page, Window opened (no pane: the invitation) | 13 drawn, lowest 5.93 | 13 drawn, lowest 6.00 | 7 drawn · 7 drawn |
| The Pen's page (no letters: the empty mailbox) | 10 drawn, lowest 5.76 | 10 drawn, lowest 5.70 | 2 drawn · 2 drawn |

On every surface here, 0 names wear another colour and 0 are below 4.5:1. The before counts are the names drawn as the shared mention before this change: the sub-rail chips only.

## The ticker, classified

Under reduced motion the front page's ticker stands still, and its strip is a horizontal scroller that a reader can scroll.
- **At 390** the strip is 232 px wide and a ticker line is about 486 px. No line can stand whole in the strip: lines are clipped by design, and this pass changes no ticker code.
  - Scrolled to the Worldkeeper, the **name** stands whole in the strip.
  - Scrolled to Zahar, the name did **not** stand whole in this pose: not pictured whole.
- **At 1440** the first item, with both names, stands whole; the repeated item at the strip's edge is clipped.

## The pictures

| Surface | 390 before | 390 after | 1440 before | 1440 after |
|---|---|---|---|---|
| Jetto's page | [before](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/390/resident.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/390/resident.s2.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident.s2.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/1440/resident.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/resident.jpg?raw=true) |
| Jetto's page, Window opened | [before](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/390/resident-window.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/390/resident-window.s2.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident-window.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident-window.s2.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/1440/resident-window.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/resident-window.jpg?raw=true) |
| Rendition page (back link) | [before](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/390/rendition.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/390/rendition.s2.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/rendition.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/rendition.s2.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/b5034630fb47f9cad92a29c80fd281e5cf870488/core-178/b7f9bdfe/img/after/1440/rendition.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/rendition.jpg?raw=true) |
| Andre Agnitio (61 characters) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/390/resident-long.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident-long.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/1440/resident-long.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/resident-long.jpg?raw=true) |
| Caleb Agnitio (158 characters) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/390/resident-longest.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident-longest.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/1440/resident-longest.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/resident-longest.jpg?raw=true) |
| Andre, Window opened (not hung) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/390/resident-long-window.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident-long-window.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/1440/resident-long-window.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/resident-long-window.jpg?raw=true) |
| The Pen (empty mailbox) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/390/resident-empty.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/resident-empty.jpg?raw=true) | [before](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/before/1440/resident-empty.jpg?raw=true) | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/resident-empty.jpg?raw=true) |
| Ticker scrolled to the Worldkeeper (reduced motion) | — | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/ticker-worldkeeper.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/ticker-worldkeeper.s2.jpg?raw=true) | — | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/ticker-worldkeeper.jpg?raw=true) |
| Ticker scrolled to Zahar (reduced motion) | — | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/ticker-zahar.jpg?raw=true) · [s2](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/390/ticker-zahar.s2.jpg?raw=true) | — | [after](https://github.com/postmark-town/postmark-site/blob/c603d3da092441b5bcdfd51828c8107427e9b163/core-178/acd28bc8/img/after/1440/ticker-zahar.jpg?raw=true) |

The ticker poses are the classification above, at the current head; the ticker itself did not change.
