# TUTORIALS.md — the tutorial engine, and how to author for it

Postmark's tutorials are **corner-note bubbles**: small cards that appear once,
at the right moment, and never again. The engine is built and live; what it
lacks is content — which is exactly the contribution this file teaches.
(Context: [issue #3](https://github.com/postmark-town/postmark-site/issues/3) —
onboarding is the biggest single lever on the project right now.)

## See it working, zero setup

Open **<https://postmark.town/?pm-tutorial-demo>** — the demo bubble appears in
the corner. That's the whole mechanism: an event fired, the registry matched,
one card got the floor. Demo mode is memory-only: no sign-in, no office calls,
nothing written to your browser.

## The three parts

- **`src/lib/tutorial.mjs`** — the pure state machine (validate, match one
  entry per event, no-replay record). Tested; you shouldn't need to touch it.
- **`src/lib/tutorial-registry.mjs`** — **the content. This is the file you
  PR.** `REGISTRY` is live for signed-in residents; `DEMO_REGISTRY` is what
  `?pm-tutorial-demo` runs.
- **`src/layouts/PostmarkLayout.astro`** — the wiring: the event bus
  (`window.pmTutorialEmit(name, ctx)`), the card render, dismiss (× or Esc),
  and per-household persistence.

## An entry

```js
{ id: "welcome-mail",                  // unique, kebab-case, permanent —
                                       // it IS the no-replay key
  trigger: "page:enter",               // the event that may show it
  when: (ctx) => ctx.page === "mail",  // optional; any falsy/throw = skip
  priority: 10,                        // optional; highest wins a tie
  content: {
    title: "Your mailbox",
    body: "One or two sentences. A corner note, not a modal.",
    cta: { label: "Read the mail guide", href: "/mail/" },   // optional
  } }
```

**Events that exist today:** `page:enter` (ctx: `{path, page}` — `page` is the
first path segment, `"home"` on `/`) · `auth:signed-in` ·
`resident:first-recognized`. Any page island can emit new ones with
`window.pmTutorialEmit(name, ctx)` — the bus exists from first parse, so
early emits queue rather than vanish.

**The rules the engine enforces:** one bubble on screen at a time; each entry
shows **at most once per household per browser** (persisted the moment it
renders, so navigating away mid-note still counts); dismiss marks it done;
production bubbles appear only for signed-in residents (demo mode shows for
anyone).

**Asking for the floor:** `window.pmTutorialStandDown()` closes the note on
screen and keeps the queue shut for the rest of the page view. A page calls it
when it deliberately reveals something the reader asked for — the corner is
fixed to the bottom-right, and on a phone the card is most of the width, so
anything revealed and scrolled to arrives underneath it. Reach for it only at
that kind of moment, never to mute a note you'd rather not write a `when:` for.
It spends no note that wasn't already spent: an entry is recorded when it
renders, not when it's read. Today the join page's key desk is the only caller.

## The authoring loop

1. Clone, `npm install`, `npm run dev` (Astro; local at the printed port).
2. Write your entry in `DEMO_REGISTRY`, open any page with
   `?pm-tutorial-demo`, iterate until it feels right. Demo never persists, so
   every reload is a fresh audience.
3. `node --test test/tutorial.test.mjs` (engine invariants; 9 tests).
4. Move the entry to `REGISTRY`, leave the demo entry as you found it, PR.

Voice notes for content: the town speaks warmly and briefly — read a few pages
first; a bubble that interrupts is worse than no bubble; when in doubt, point
at an existing guide page rather than explaining inline.
