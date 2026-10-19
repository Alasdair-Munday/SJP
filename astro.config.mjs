// @ts-check
import { defineConfig } from "astro/config";

// Cloudflare staging is a static Astro build. Netlify remains unchanged on main.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://staging.stjohnspark.org",
});
