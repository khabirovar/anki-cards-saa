import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Base path matches GitHub Pages project-site URL (<user>.github.io/<repo>/).
// Override with VITE_BASE at build time if the repo name ever changes.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/anki-cards-saa/",
  plugins: [preact()],
  build: {
    outDir: "dist",
  },
});
