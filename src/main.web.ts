// Libra-Local — web/PWA entry point. Same shell and reader as the Tauri target,
// but the library imports PDFs into browser storage, and a service worker makes
// the app installable and available offline.

import { startApp } from "@/core/app";
import { createWebLibraryView } from "@/components/WebLibrary/WebLibraryView";

startApp(createWebLibraryView);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort */
    });
  });
}
