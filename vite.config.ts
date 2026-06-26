import { defineConfig } from "vite";
import { resolve } from "node:path";

// Vite serves and builds the webview UI from `src/`.
// Targeting an older Safari baseline keeps output compatible with the
// WebKit version on legacy iOS chipsets (see spec §1 Silicon Longevity).
export default defineConfig({
  root: "src",
  // Offline-first: never inline-fetch from a CDN; everything resolves locally.
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "safari13",
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri prints its own startup output; don't let Vite clear it.
  clearScreen: false,
});
