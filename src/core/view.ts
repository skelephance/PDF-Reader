// A mounted top-level view.
//
// The shell keeps one controller alive per view. When only the panel or route
// data changes (e.g. opening the table of contents over the reader), the shell
// calls `update()` instead of tearing the view down — so expensive state like a
// loaded PDF survives. `destroy()` runs when the view actually changes.

import type { Route } from "@/core/navigation";

export interface ViewController {
  /** The view's root element, mounted by the shell. */
  el: HTMLElement;
  /** Called when the route changes but the view stays the same. */
  update(route: Route): void;
  /** Called when the view is being replaced; release listeners/resources. */
  destroy(): void;
}
