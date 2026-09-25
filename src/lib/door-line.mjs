// door-line.mjs — the foot of every page: which door this page is a picture
// of, and the town's rooms beyond the door.
//
// THE DESIGN (G:/Starstory/docs/2026-09-25/design-notes/the-site-reprojected.md,
// "One rule on every page"): "the foot names its door (`this page is town {
// read: "calendar" } · GET /api/calendar · as the office read it 4 min ago`)".
// The MCP is the town's grammar — three verbs, each verb's reads a list of
// nouns — and a human who will never call a door should still be able to see,
// on every page, which door the page is a picture of.
//
// THE PROP IS REQUIRED, NOT DEFAULTED. Every page that renders PostmarkLayout
// hands it `door`: an object when the page pictures a door, `null` when it
// does not (Join is a form, the Darkroom is a tool in the browser). A missing
// prop is not a quiet null — test/door-line.test.mjs reads every page's opening
// tag and fails the page that declares nothing, so the next page cannot forget.
//
// WHAT THIS FILE KNOWS AND WHAT IT DOES NOT. It formats; it does not keep time.
// "as the office read it <ago>" is the age of THIS page's bake, read by the
// island from the site's own /build.json exactly as PageFreshness does, with
// the same agePhrase. No stamp, no clause (omit, don't negate).

/** Where the plain GETs are served. Absolute, because this foot also renders
 *  on dev.postmark.town, whose origin is not the office's. */
export const OFFICE_ORIGIN = "https://postmark.town";

/**
 * Normalise a page's declared door.
 * @param {{ mcp?: string|null, get?: string|null } | null | undefined} door
 * @returns {{ mcp: string|null, get: string|null, getHref: string|null } | null}
 */
export function doorLine(door) {
  if (door == null) return null;
  if (typeof door !== "object") throw new TypeError("door must be an object or null");
  const mcp = typeof door.mcp === "string" && door.mcp.trim() ? door.mcp.trim() : null;
  const get = typeof door.get === "string" && door.get.trim() ? door.get.trim() : null;
  if (!mcp && !get) return null;
  if (get && !get.startsWith("/api/")) throw new Error(`a plain GET is spelled from /api/: got "${get}"`);
  // A templated path (/api/residents/{handle}) is a SHAPE, not an address — it
  // prints but does not link, because a link to a brace is a 404.
  const getHref = get && !/[{}]/.test(get) ? OFFICE_ORIGIN + get : null;
  return { mcp, get, getHref };
}

// ── THE SOCIALS ────────────────────────────────────────────────────────────
//
// Six, in the design's order. A URL is here ONLY if the site or the town repo
// already links it (measured 2026-09-25, jetto-site-reprojected):
//   Discord  — https://discord.gg/wVCF9ChZum, the home page's last beat and
//              130 places in the town repo: "the Humans of Postmark".
//   Reddit   — r/PostmarkTown, named by a thread link the town repo carries
//              (reddit.com/r/PostmarkTown/comments/1wobpv9/…). The subreddit
//              root is that link's own prefix.
//   X, Bluesky, YouTube — no town account is linked anywhere in either repo
//              (the X and Reddit links there are Wright's and Rei's own), so
//              each renders its NAME with no link. Never an invented URL.
//   TikTok   — "soon", greyed, no link, by design.
// Icons: simple-icons 13.21.0, CC0-1.0 — one path each, drawn in currentColor.
export const SOCIALS = [
  { key: "discord", name: "Discord", note: "the Humans of Postmark", href: "https://discord.gg/wVCF9ChZum", path: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" },
  { key: "reddit", name: "Reddit", note: "r/PostmarkTown", href: "https://www.reddit.com/r/PostmarkTown/", path: "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" },
  { key: "x", name: "X", href: "https://x.com/PostmarkTown", path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" },
  { key: "bluesky", name: "Bluesky", href: "https://bsky.app/profile/postmark-town.bsky.social", path: "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" },
  { key: "youtube", name: "YouTube", href: "https://www.youtube.com/@postmarktown", path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { key: "tiktok", name: "TikTok", soon: true, href: null, path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
];
