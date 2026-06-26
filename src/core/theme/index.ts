// Reading theme service.
//
// Reading themes recolor the chrome (token overrides) and the pages (GPU CSS
// filter) via a single attribute on the document root (see skills/reading-
// themes). The choice is persisted through the active data backend.

import { backend } from "@/core/backend";
import type { ReadingTheme } from "@/core/types";

export type { ReadingTheme } from "@/core/types";

/** Cycle order + labels for the reader's theme toggle. */
export const READING_THEMES: ReadonlyArray<{ id: ReadingTheme; label: string }> = [
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
  { id: "sepia", label: "Sepia" },
];

/** Load the saved reading theme (defaults to "day"). */
export async function getReadingTheme(): Promise<ReadingTheme> {
  const saved = await backend.getReadingTheme().catch(() => null);
  return normalize(saved);
}

/** Persist the chosen reading theme. */
export function setReadingTheme(theme: ReadingTheme): Promise<void> {
  return backend.setReadingTheme(theme);
}

/** Apply a theme app-wide — one attribute write on the document root. */
export function applyReadingTheme(theme: ReadingTheme): void {
  document.documentElement.dataset.theme = theme;
}

/** The theme after the given one, wrapping around (for the toggle button). */
export function nextTheme(theme: ReadingTheme): ReadingTheme {
  const i = READING_THEMES.findIndex((t) => t.id === theme);
  return READING_THEMES[(i + 1) % READING_THEMES.length].id;
}

export function labelFor(theme: ReadingTheme): string {
  return READING_THEMES.find((t) => t.id === theme)?.label ?? "Day";
}

function normalize(value: string | null): ReadingTheme {
  return value === "night" || value === "sepia" ? value : "day";
}
