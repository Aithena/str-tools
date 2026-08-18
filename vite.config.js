import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/str-tools/" : "/",
  server: {
    port: 18807,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["@firecrawl/anydoc-wasm"],
  },
});
