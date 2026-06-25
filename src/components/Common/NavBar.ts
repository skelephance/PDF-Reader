// Global navigation bar. Its back action dispatches to the UniversalRouter —
// it never calls history APIs or hides views itself (see skills/router-isolation).

import { router } from "@/core/navigation";

/** Render the global nav bar for the current route. */
export function renderNavBar(title: string): HTMLElement {
  const bar = document.createElement("header");
  bar.className = "navbar";

  if (router.canGoBack) {
    const back = document.createElement("button");
    back.className = "navbar__back";
    back.textContent = "‹ Back";
    back.addEventListener("click", () => router.pop());
    bar.appendChild(back);
  }

  const heading = document.createElement("h1");
  heading.className = "navbar__title";
  heading.textContent = title;
  bar.appendChild(heading);

  return bar;
}
