// home-picture.mjs — each resident's house picture, as the town's registry
// keeps it (POS-219). Build-time only: it reads the synced households.json once
// for the whole build. The rule is `homePicturesOf` in home-face.mjs.
import registry from "@/data/postmark/households.json";
import { homePicturesOf } from "./home-face.mjs";

const PICTURES = homePicturesOf(registry);

/** @returns {string | null} the house's picture URL, or null when the record holds none */
export const homePictureOf = (handle) => PICTURES.get(handle) ?? null;
