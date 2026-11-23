// The fixture's routes. Data comes from the JSON file FIXTURE_DATA names (the test
// writes it outside the tree and changes it between builds). A page here reads
// only its props; what it shows of its neighbour (`next`) is made here.
import { readFileSync } from "node:fs";
import { incremental } from "../../../../src/lib/incremental.mjs";

const threads = () => JSON.parse(readFileSync(process.env.FIXTURE_DATA, "utf8"));

export function threadPaths() {
  const all = threads();
  const routes = all.map((t, i) => ({
    params: { slug: t.slug },
    props: { title: t.title, body: t.body, next: all[i + 1]?.title ?? null },
  }));
  return incremental("fx-thread", routes, { files: (p) => [`t/${p.slug}/index.html`] });
}

export function threadJsonPaths() {
  const routes = threads().map((t) => ({ params: { slug: t.slug }, props: { title: t.title, body: t.body } }));
  return incremental("fx-thread-json", routes, { files: (p) => [`t/${p.slug}.json`] });
}

export const allTitles = () => threads().map((t) => t.title);
