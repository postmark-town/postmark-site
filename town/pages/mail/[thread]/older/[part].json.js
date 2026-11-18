// A conversation's older letters as a JSON chunk (POS-274): what the thread
// page's "older letters" button fetches. Written by the build beside the static
// page of the same part, same markup; no office call.
//
// INCREMENTAL (POS-1085): reads ONLY its props (src/lib/mail-routes.mjs makes
// them); import no data/postmark JSON here (test/incremental-pages.test.mjs).
import { threadOlderJsonPaths } from "@/lib/mail-routes.mjs";

export function getStaticPaths() {
  return threadOlderJsonPaths();
}

export function GET({ props }) {
  return new Response(JSON.stringify(props), { headers: { "content-type": "application/json" } });
}
