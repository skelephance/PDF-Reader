// Web data backend — document bytes in OPFS, everything else in IndexedDB.
// Annotation/bookmark lists are stored whole per document hash and upserted.

import type { DataBackend } from "./types";
import type { Progress, Annotation, Bookmark } from "@/core/types";
import { idbGet, idbSet } from "./idb";
import { readFile } from "./opfs";

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
  return list;
}

export const webBackend: DataBackend = {
  readDocument: (ref) => readFile(ref),

  getProgress: (h) => idbGet<Progress>("progress", h).then((v) => v ?? null),
  saveProgress: (h, p) => idbSet("progress", h, p),

  listAnnotations: (h) => idbGet<Annotation[]>("annotations", h).then((v) => v ?? []),
  saveAnnotation: async (h, a) => {
    const list = (await idbGet<Annotation[]>("annotations", h)) ?? [];
    await idbSet("annotations", h, upsert(list, a));
  },
  deleteAnnotation: async (h, id) => {
    const list = (await idbGet<Annotation[]>("annotations", h)) ?? [];
    await idbSet("annotations", h, list.filter((a) => a.id !== id));
  },

  listBookmarks: (h) => idbGet<Bookmark[]>("bookmarks", h).then((v) => v ?? []),
  saveBookmark: async (h, b) => {
    const list = (await idbGet<Bookmark[]>("bookmarks", h)) ?? [];
    await idbSet("bookmarks", h, upsert(list, b));
  },
  deleteBookmark: async (h, id) => {
    const list = (await idbGet<Bookmark[]>("bookmarks", h)) ?? [];
    await idbSet("bookmarks", h, list.filter((b) => b.id !== id));
  },

  getReadingTheme: () => idbGet<string>("settings", "reading_theme").then((v) => v ?? null),
  setReadingTheme: (t) => idbSet("settings", "reading_theme", t),
};
