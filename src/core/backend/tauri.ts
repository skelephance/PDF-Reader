// Tauri data backend — delegates to the native Rust command handlers.

import { invoke } from "@tauri-apps/api/core";
import type { DataBackend } from "./types";
import type { Progress, Annotation, Bookmark } from "@/core/types";

export const tauriBackend: DataBackend = {
  readDocument: (ref) => invoke<ArrayBuffer>("read_document", { path: ref }),

  getProgress: (docHash) => invoke<Progress | null>("get_progress", { docHash }),
  saveProgress: (docHash, progress) => invoke("save_progress", { docHash, progress }),

  listAnnotations: (docHash) => invoke<Annotation[]>("list_annotations", { docHash }),
  saveAnnotation: (docHash, annotation) =>
    invoke("save_annotation", { docHash, annotation }),
  deleteAnnotation: (docHash, id) => invoke("delete_annotation", { docHash, id }),

  listBookmarks: (docHash) => invoke<Bookmark[]>("list_bookmarks", { docHash }),
  saveBookmark: (docHash, bookmark) => invoke("save_bookmark", { docHash, bookmark }),
  deleteBookmark: (docHash, id) => invoke("delete_bookmark", { docHash, id }),

  getReadingTheme: () => invoke<string | null>("get_reading_theme"),
  setReadingTheme: (theme) => invoke("set_reading_theme", { theme }),
};
