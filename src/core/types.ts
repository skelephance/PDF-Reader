// Shared data types used across the reader, the data backends, and storage.
// Kept backend-agnostic so the Tauri and web targets speak the same shapes.

/** Reading position for a document. */
export interface Progress {
  /** 1-based page last viewed. */
  page: number;
  /** Total page count. */
  pages: number;
}

/** A rectangle normalized to its page box (0..1). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A highlight or note anchored to a document. */
export interface Annotation {
  id: string;
  page: number;
  kind: "highlight" | "note";
  /** Highlight tint (CSS color). */
  color: string;
  /** Selected text — the durable text-signature anchor. */
  quote: string;
  /** Optional note body. */
  note: string;
  rects: Rect[];
}

/** A saved page bookmark. */
export interface Bookmark {
  id: string;
  page: number;
  label: string;
}

/** Reading theme identifiers. */
export type ReadingTheme = "day" | "night" | "sepia";
