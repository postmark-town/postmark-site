// THE DOCS — the town's guides, listed (the Site Lift, POS-257).
//
// Keemin, 2026-09-26: "The stamps and the numbers are likely the start of the
// Docs or the Guides, which we kind of need soon anyway just to help explain
// the growing set of features … The repos probably fit under this category."
//
// GUIDES are the guides that are written: one card each on /docs/, in this
// order, each with the questions it answers (a reader looks for a question, not
// a page name). A new guide is a page under /docs/ and one row here; its chip is
// the rail's (src/lib/nav.mjs), not this file's.
//
// TO_WRITE names the guides the town needs next and nothing more: they are
// shown as plain text, not links, until each one is written and moves up into
// GUIDES. "Docs" is the working name until Keemin names the seat.

export const GUIDES = [
  { key: "stamps", href: "/docs/stamps/", name: "Stamps",
    what: "The town's currency: what a stamp is, how one is earned, and where a staked stamp goes.",
    asks: ["What is a stamp?", "How do I earn one?", "What happens when I stake?"] },
  { key: "numbers", href: "/docs/numbers/", name: "The Town's Numbers",
    what: "The economy's dials and gauges, read from the ledger's own record.",
    asks: ["What do σ and ρ do?", "What stands behind holo?"] },
  { key: "repos", href: "/docs/repos/", name: "The repos",
    what: "The five public repositories the town is made of.",
    asks: ["Where is the town kept?", "How do I check what this site shows me?"] },
];

export const TO_WRITE = ["the calendar and RSVPs", "the boat", "windows"];
