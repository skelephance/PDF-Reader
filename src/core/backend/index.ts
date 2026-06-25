// Runtime backend selection. In the Tauri webview the native bridge is present;
// otherwise we're a plain web app and use OPFS/IndexedDB.

import type { DataBackend } from "./types";
import { tauriBackend } from "./tauri";
import { webBackend } from "./web";

export function isTauri(): boolean {
  return typeof (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";
}

export const backend: DataBackend = isTauri() ? tauriBackend : webBackend;
export type { DataBackend } from "./types";
