// Pure abstraction service for the library systems layer.
//
// The only way the UI reaches the filesystem is through these typed wrappers
// over Rust commands. Components import from here; they never call the
// filesystem or `invoke` directly (see skills/tauri-data-boundary).

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

/** A discovered document. Its content hash (identity) is derived on open. */
export interface DocumentNode {
  name: string;
  /** Current location, used to open the bytes and derive the content hash. */
  path: string;
  size: number;
}

/** A folder in the mirrored library tree. */
export interface FolderNode {
  name: string;
  path: string;
  folders: FolderNode[];
  documents: DocumentNode[];
}

/** Scan a directory and return its mirrored folder/document tree. */
export function scanLibrary(root: string): Promise<FolderNode> {
  return invoke<FolderNode>("scan_library", { root });
}

/** Compute the SHA-256 content identity of a single document. */
export function hashDocument(path: string): Promise<string> {
  return invoke<string>("hash_document", { path });
}

/** The saved library root, or null on first run. */
export function getLibraryRoot(): Promise<string | null> {
  return invoke<string | null>("get_library_root");
}

/** Persist the chosen library root. */
export function setLibraryRoot(root: string): Promise<void> {
  return invoke("set_library_root", { root });
}

/** Begin watching `root` so external changes surface in real time. */
export function watchLibrary(root: string): Promise<void> {
  return invoke("watch_library", { root });
}

/** Subscribe to library-changed events. Returns an unlisten function. */
export function onLibraryChanged(handler: () => void): Promise<UnlistenFn> {
  return listen("library:changed", () => handler());
}

/** Open the native folder picker. Returns the chosen path, or null if cancelled. */
export async function pickLibraryFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

/** The app's Documents directory — the Files-app-visible folder on iOS. */
export function appDocumentsDir(): Promise<string> {
  return invoke<string>("app_documents_dir");
}
