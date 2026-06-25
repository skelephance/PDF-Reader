// Centralized SPA router state machine — the single source of truth for what
// the user is looking at. Every transition (open reader, return to library,
// slide the annotation panel) goes through here. Components dispatch intent;
// they never manipulate other views' DOM or call history APIs directly
// (see skills/router-isolation).

/** The top-level views in the app. */
export type ViewName = "library" | "reader";

/** Routed surfaces that can overlay the reader (also part of the back stack). */
export type PanelName = "toc" | "annotate";

/** A single, fully-described location in the app. */
export interface Route {
  view: ViewName;
  /** Content hash of the open document (reader only). */
  docHash?: string;
  /** An open overlay panel, if any. */
  panel?: PanelName;
  /** Opaque per-route payload (e.g. a captured selection for annotate). */
  data?: unknown;
}

export type RouteListener = (route: Route, previous: Route | undefined) => void;

const HOME: Route = { view: "library" };

/**
 * UniversalRouter — a minimal history-stack state machine.
 *
 * Kept deliberately tiny: no virtual DOM, no heavy framework. It holds a stack
 * of routes and notifies subscribers on change so the shell can render the
 * current view.
 */
class UniversalRouter {
  private stack: Route[] = [HOME];
  private listeners = new Set<RouteListener>();

  /** The route currently on top of the stack. */
  get current(): Route {
    return this.stack[this.stack.length - 1];
  }

  /** Whether there is somewhere to go back to. */
  get canGoBack(): boolean {
    return this.stack.length > 1;
  }

  /** Push a new route onto the stack. */
  navigate(route: Route): void {
    const previous = this.current;
    this.stack.push(route);
    this.emit(previous);
  }

  /** Replace the top route without growing the stack. */
  replace(route: Route): void {
    const previous = this.current;
    this.stack[this.stack.length - 1] = route;
    this.emit(previous);
  }

  /** Pop the top route. Returns false if already at the root. */
  pop(): boolean {
    if (!this.canGoBack) return false;
    const previous = this.stack.pop();
    this.emit(previous);
    return true;
  }

  /** Reset back to the library root. */
  home(): void {
    const previous = this.current;
    this.stack = [HOME];
    this.emit(previous);
  }

  /** Subscribe to route changes. Returns an unsubscribe function. */
  subscribe(listener: RouteListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately so new subscribers render right away.
    listener(this.current, undefined);
    return () => this.listeners.delete(listener);
  }

  private emit(previous: Route | undefined): void {
    for (const listener of this.listeners) listener(this.current, previous);
  }
}

/** App-wide singleton. Import this everywhere — never construct your own. */
export const router = new UniversalRouter();
