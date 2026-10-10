// resident-pages.mjs — the build's own resident links, bound once (POS-530, POS-531).
//
// residentLinks over the roll this build makes pages from and the rename
// record it baked. Every mail and replay page links a resident through
// `residentHref`; null means no page stands for that handle, so print text.
import residents from "@/data/postmark/residents.json";
import renames from "@/data/postmark/renames.json";
import { residentLinks } from "./resident-link.mjs";

const links = residentLinks(residents, renames);

export const residentHref = links.hrefOf;
export const residentPage = links.pageOf;
