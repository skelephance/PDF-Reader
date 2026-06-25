// Libra-Local — web/PWA entry point. Same shell and reader as the Tauri target,
// but the library imports PDFs into browser storage, and a service worker makes
// the app installable and available offline.

import { startApp } from "@/core/app";
import { createWebLibraryView } from "@/components/WebLibrary/WebLibraryView";

startApp(createWebLibraryView);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // BASE_URL keeps the scope correct under a subpath (e.g. GitHub Pages).
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is best-effort */
    });
  });
}
