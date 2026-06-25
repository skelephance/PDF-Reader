import { defineConfig } from "vite";
import { resolve } from "node:path";

// Web/PWA build. Shares the `src/` sources with the Tauri build but uses
// web.html as the entry and emits to dist-web/. Assets in src/public/
// (manifest, service worker, icons) are copied to the output root.
export default defineConfig({
  root: "src",
  base: "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
    target: "safari13",
    rollupOptions: {
      input: resolve(__dirname, "src/web.html"),
    },
  },
  server: {
    port: 1430,
    strictPort: true,
  },
});
