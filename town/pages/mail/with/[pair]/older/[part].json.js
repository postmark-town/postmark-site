// A correspondence's older letters as a JSON chunk (POS-274): what the pair
// page's "older letters" button fetches. Written by the build beside the static
// page of the same part, same markup; no office call.
import letters from "@/data/postmark/letters.json";
import threads from "@/data/postmark/threads.json";
import media from "@/data/postmark/media.json";
import ledger from "@/data/postmark/ledger.json";
import { pairViews, deliveredOnOf, pairLettersHtml } from "@/lib/mail-letter.mjs";
import { residentHref } from "@/lib/resident-pages.mjs";

export function getStaticPaths() {
  const deliveredOn = deliveredOnOf(ledger);
  return [...pairViews(letters, threads, ledger).values()].flatMap((view) =>
    view.parts.slice(1).map((ls, i) => ({
      params: { pair: view.key, part: String(i + 2) },
      props: {
        part: i + 2,
        parts: view.parts.length,
        ids: ls.map((l) => l.id),
        html: pairLettersHtml(view, ls, { media, deliveredOn, hrefOf: residentHref }),
      },
    })));
}

export function GET({ props }) {
  return new Response(JSON.stringify(props), { headers: { "content-type": "application/json" } });
}
