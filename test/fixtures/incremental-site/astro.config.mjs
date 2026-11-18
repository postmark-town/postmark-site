// A three-route site for test/incremental-build.test.mjs: it builds with the real
// `astro build` and the real src/lib/incremental.mjs, so the test measures what
// the town's build does and not a stand-in. Its data is read from FIXTURE_DATA.
import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "src",
  outDir: process.env.FIXTURE_OUT || "dist", // the test gives every build its own empty folder (Astro does not empty an outDir)
});
