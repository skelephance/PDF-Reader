---
name: tauri-data-boundary
description: Enforce the Rust/Tauri data boundary in the libra-local project. Use this skill whenever code reads or writes files, crawls directories, computes hashes, persists annotations/progress/bookmarks, or otherwise touches disk or the filesystem. Trigger whenever frontend (TypeScript/webview) code is about to do data work that should instead go through a native Rust Tauri command — including "save", "load", "scan the folder", "read the file", "store annotation".
---

# Libra-Local Rust/Tauri Data Boundary

Libra-Local splits cleanly into two layers: a Rust host engine (`src-tauri/`) that owns all systems work, and a webview UI (`src/`) that owns presentation. This boundary is what keeps the UI thread responsive on legacy iOS chipsets — heavy work (directory traversal, binary hashing, atomic disk writes) runs off the main thread in Rust, not in JavaScript loops that would jank the interface.

## The core rule

Visual templates and frontend code are strictly barred from initializing direct filesystem actions. All file-tree crawling, content evaluation, hashing, and data writes must process asynchronously through native Rust Tauri command handlers.

The frontend's job is to `invoke` a command and `await` the result, then render it. It never touches the filesystem itself, never holds business logic for how scanning or persistence works, and never blocks waiting on synchronous work.

## Where work lives

| Concern | Owner |
|---|---|
| Directory traversal / tree scan | `src-tauri/src/commands/library.rs` |
| Progress tracking & annotation persistence | `src-tauri/src/commands/reader.rs` |
| SHA-256 content hashing | `src-tauri/src/commands/crypto.rs` (see [[content-hashing]]) |
| Atomic JSON reads/writes | `src-tauri/src/storage/` |
| Rendering, layout, interaction | `src/` (webview) |

Storage writes go through the transactional atomic JSON engine in `src-tauri/src/storage/` — never write data files directly, even from Rust commands, without going through it, so a crash mid-write can't corrupt the catalog.

## Examples

**Wrong** — frontend reaching for the filesystem and doing work in JS:
```ts
import { readDir, readBinaryFile } from '@tauri-apps/api/fs';
const files = await readDir(folder, { recursive: true });
const bytes = await readBinaryFile(path); // hashing in JS would block the UI
```

**Right** — frontend invokes a Rust command; Rust does the work async:
```ts
import { invoke } from '@tauri-apps/api/core';
const tree = await invoke('scan_library');           // library.rs
await invoke('save_annotation', { docHash, note });   // reader.rs -> storage/
```

```rust
// src-tauri/src/commands/library.rs
#[tauri::command]
async fn scan_library() -> Result<LibraryTree, AppError> {
    // async traversal off the UI thread; never blocks the webview
}
```

## Why offline-first reinforces this

The app must work at 100% in fully offline environments — no remote calls, no CDNs. Concentrating all data work in Rust commands keeps the trust and capability boundary in one auditable place and guarantees nothing in the UI quietly reaches out to the network or the disk on its own.
