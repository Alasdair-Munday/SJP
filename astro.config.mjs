// @ts-check
import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import { netlifyCssImages } from "./scripts/optimize-css-images.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://stjohnspark.org",
  adapter: netlify(),
  vite: { plugins: [netlifyCssImages()] },
});
