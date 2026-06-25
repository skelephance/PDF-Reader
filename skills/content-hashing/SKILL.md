---
name: content-hashing
description: Enforce the content-hashing protocol in the libra-local project. Use this skill whenever code identifies, catalogs, or references a document, or attaches annotations, progress, bookmarks, or paired assets to a file. Trigger whenever you see a file being keyed by path/filename, or whenever metadata needs a stable identity for a document — including "find the book", "save where the user left off", "link this note to the PDF".
---

# Libra-Local Content Hashing Protocol

Libra-Local mirrors an un-sandboxed folder in the iOS Files app. Users freely move, rename, and restructure those files outside the app. If the catalog keyed documents by path, every reorganization would orphan the user's annotations, reading progress, and bookmarks. The content-hashing protocol exists so a document's identity travels with its bytes, not its location.

## The core rule

Files must never be cataloged by volatile path strings. Every document receives an unalterable SHA-256 hash computed from its raw binary content upon initial discovery. All annotations, progress indicators, bookmarks, and custom asset pairings lock exclusively to this content hash.

Paths are treated as ephemeral display/access hints only. The content hash is the primary key everywhere data is stored or looked up.

## How it works

When the library scanner discovers a file, it computes the SHA-256 of the file's raw bytes asynchronously (off the UI thread, in Rust — see [[tauri-data-boundary]]). That hash becomes the document's permanent identifier. Move or rename the file and the hash is unchanged, so all attached data still resolves. Two identical files anywhere in the tree share one identity and one set of annotations, which is the intended behavior.

Hashing is non-blocking: discovery shouldn't stall the scan or the UI while large files are read. Compute hashes asynchronously and let the catalog populate progressively.

## Examples

**Wrong** — keyed by path; breaks the moment the user moves the file:
```ts
annotations[filePath] = note;
const progress = store.get(`progress:${filePath}`);
```

**Right** — keyed by content hash, resolved via Rust:
```ts
const docHash = await invoke<string>('hash_document', { path });
await invoke('save_annotation', { docHash, note });
const progress = await invoke('get_progress', { docHash });
```

```rust
// src-tauri/src/commands/crypto.rs — non-blocking SHA-256 over raw bytes
#[tauri::command]
async fn hash_document(path: String) -> Result<String, AppError> {
    // stream the file, hash its content, never the path string
}
```

## What this means in practice

When writing any feature that remembers something about a document, ask "what identifies this document?" The answer is always its content hash. The path is only ever used to actually open/read the bytes at the moment of access, and even that read goes through Rust. Never persist a path as the durable link between a document and its data.
