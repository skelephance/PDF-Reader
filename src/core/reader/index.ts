// Reader data service. Delegates to the active data backend (Tauri or web) so
// the reader UI is identical on both targets (see core/backend).

import { backend } from "@/core/backend";
import type { Progress, Annotation, Bookmark } from "@/core/types";

export type { Progress, Rect, Annotation, Bookmark } from "@/core/types";

/** Read a document's bytes. `ref` is a path (Tauri) or content id (web). */
export function readDocument(ref: string): Promise<ArrayBuffer> {
  return backend.readDocument(ref);
}

export function getProgress(docHash: string): Promise<Progress | null> {
  return backend.getProgress(docHash);
}

export function saveProgress(docHash: string, progress: Progress): Promise<void> {
  return backend.saveProgress(docHash, progress);
}

export function listAnnotations(docHash: string): Promise<Annotation[]> {
  return backend.listAnnotations(docHash);
}

export function saveAnnotation(docHash: string, annotation: Annotation): Promise<void> {
  return backend.saveAnnotation(docHash, annotation);
}

export function deleteAnnotation(docHash: string, id: string): Promise<void> {
  return backend.deleteAnnotation(docHash, id);
}

export function listBookmarks(docHash: string): Promise<Bookmark[]> {
  return backend.listBookmarks(docHash);
}

export function saveBookmark(docHash: string, bookmark: Bookmark): Promise<void> {
  return backend.saveBookmark(docHash, bookmark);
}

export function deleteBookmark(docHash: string, id: string): Promise<void> {
  return backend.deleteBookmark(docHash, id);
}
