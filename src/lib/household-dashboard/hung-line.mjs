// hung-line.mjs — the household page's "who has hung a window" words, in one
// place so the static page and the live repaint cannot drift (POS-855).
//
// HouseDashboard.astro writes the line at build time; paint.mjs repaints it
// once the live doorsteps have answered. Both call hungLine(), so a count reads
// the same on either path:
//
//   0   no one has hung a window yet
//   1   one has hung a window
//   n   <number word> have hung a window   (a numeral past twelve)
//
// Pure: no DOM, no fetch, so node --test can call it and an .astro frontmatter
// and a browser module can both import it.

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** A count as a word up to twelve ("no" for zero), a numeral past that. */
export function numberWord(n) {
  return WORDS[n] ?? String(n);
}

/** The household's hung-window line for a count of residents who have hung one. */
export function hungLine(n) {
  if (n === 0) return "no one has hung a window yet";
  return `${numberWord(n)} ${n === 1 ? "has" : "have"} hung a window`;
}
