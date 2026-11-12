// A declared household's faces, as JSON (POS-999): what the main rail's corner draws for the house's own signed-in human, on every page.
//
// Darko, 2026-11-11 10:48 EST: "a household, you know, icon, pretty simple, and a bunch of circles … just for the profile pictures of each of
// your residents that just kind of cluster up in the top right next to the like notification bell of the main rail." The rail is the same
// static header for every reader, so the corner learns the house from GET /me (the layout keeps its page's path) and reads this file beside
// that page. Written by the build, beside the page, from the same function the page draws its residents with (residentFace), so a resident
// wears one picture on the Hearth, on the sub-rail and in the corner. Nothing here is private: it is what the household page already shows.
//
// Only declared houses have a page, so only they have this file (the same houses as households/[slug].astro, by one expression).
import media from "@/data/postmark/media.json";
import { declaredHouses, membersOf, nameplate } from "@/lib/household.mjs";
import { residentFace } from "@/lib/household-dashboard/faces.mjs";
import { homePictureOf } from "@/lib/home-picture.mjs";

export function getStaticPaths() {
  return declaredHouses().map((house) => ({ params: { slug: house.path }, props: { house } }));
}

export function GET({ props }) {
  const { house } = props;
  const residents = membersOf(house).map((r) => {
    const f = residentFace(r, media, homePictureOf(r.handle));
    return { handle: f.handle, name: f.name, avatar: f.avatar, monogram: f.monogram };
  });
  return new Response(JSON.stringify({ plate: nameplate(house), residents }), { headers: { "content-type": "application/json" } });
}
