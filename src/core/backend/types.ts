// The data backend the reader talks to. Two implementations exist — Tauri
// (native Rust commands) and Web (OPFS + IndexedDB) — selected at runtime in
// ./index.ts. Components never import an implementation directly.

import type { Progress, Annotation, Bookmark } from "@/core/types";

export interface DataBackend {
  /** Read a document's bytes. `ref` is a path (Tauri) or content id (web). */
  readDocument(ref: string): Promise<ArrayBuffer>;

  getProgress(docHash: string): Promise<Progress | null>;
  saveProgress(docHash: string, progress: Progress): Promise<void>;

  listAnnotations(docHash: string): Promise<Annotation[]>;
  saveAnnotation(docHash: string, annotation: Annotation): Promise<void>;
  deleteAnnotation(docHash: string, id: string): Promise<void>;

  listBookmarks(docHash: string): Promise<Bookmark[]>;
  saveBookmark(docHash: string, bookmark: Bookmark): Promise<void>;
  deleteBookmark(docHash: string, id: string): Promise<void>;

  getReadingTheme(): Promise<string | null>;
  setReadingTheme(theme: string): Promise<void>;
}
