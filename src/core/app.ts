// Shared app shell used by both targets. Subscribes to the UniversalRouter and
// keeps one view controller mounted; the body element is never detached on route
// changes so the reader's scroll position is preserved (see skills/router-
// isolation). The library view is injected so each target supplies its own.

import { router, type Route, type ViewName } from "@/core/navigation";
import type { ViewController } from "@/core/view";
import { getReadingTheme, applyReadingTheme } from "@/core/theme";
import { renderNavBar } from "@/components/Common/NavBar";
import { createReaderView } from "@/components/Reader/ReaderView";

export function startApp(createLibrary: () => ViewController): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app mount point");

  const navbarSlot = document.createElement("div");
  navbarSlot.className = "app-shell__navbar";
  const body = document.createElement("div");
  body.className = "app-shell__body";
  root.replaceChildren(navbarSlot, body);

  let current: ViewController | null = null;
  let currentView: ViewName | null = null;

  function controllerFor(route: Route): ViewController {
    return route.view === "reader" ? createReaderView(route) : createLibrary();
  }

  function render(route: Route): void {
    if (route.view !== currentView) {
      current?.destroy();
      current = controllerFor(route);
      currentView = route.view;
      body.replaceChildren(current.el);
    } else {
      current?.update(route);
    }
    navbarSlot.replaceChildren(
      renderNavBar(route.view === "reader" ? "Reader" : "Library"),
    );
  }

  // Apply the saved reading theme app-wide at startup (chrome + pages).
  void getReadingTheme().then((theme) => applyReadingTheme(theme));

  router.subscribe((route) => render(route));
}
