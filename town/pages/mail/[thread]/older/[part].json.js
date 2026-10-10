// A conversation's older letters as a JSON chunk (POS-274): what the thread
// page's "older letters" button fetches. Written by the build beside the static
// page of the same part, same markup; no office call.
import threads from "@/data/postmark/threads.json";
import letters from "@/data/postmark/letters.json";
import media from "@/data/postmark/media.json";
import { threadViews, threadLettersHtml } from "@/lib/mail-letter.mjs";
import { residentHref } from "@/lib/resident-pages.mjs";

export function getStaticPaths() {
  return threadViews(threads, letters).flatMap(({ thread, parts }) =>
    parts.slice(1).map((ls, i) => ({
      params: { thread: thread.key, part: String(i + 2) },
      props: { part: i + 2, parts: parts.length, ids: ls.map((l) => l.id), html: threadLettersHtml(ls, { media, hrefOf: residentHref }) },
    })));
}

export function GET({ props }) {
  return new Response(JSON.stringify(props), { headers: { "content-type": "application/json" } });
}
