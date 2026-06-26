# Libra-Local — Development Roadmap

A phased outline for building Libra-Local: a premium, local-first, offline PDF reader (Tauri v2 + Rust + PDF.js). Phases are sequenced so each one stands on a working foundation from the last. Governing skills live in `skills/`.

---

## Phase 0 — Foundation & Scaffolding

**Goal:** A buildable, offline-capable shell that runs on device.

- Tauri v2 project scaffold
- Directory structure per spec (`src-tauri/` host, `src/` webview)
- `tokens.css` + `main.css` with the full design-token matrix
- Network isolation verified: no CDNs, analytics, or remote hooks; assets/fonts bundled locally
- Empty `UniversalRouter` state machine wired to a placeholder shell

**Governing skills:** design-tokens, router-isolation

---

## Phase 1 — Rust Systems Layer

**Goal:** All data work lives in native, async Rust commands.

- `main.rs` command router and app lifecycle
- `crypto.rs` — non-blocking SHA-256 content hashing
- `storage/` — transactional atomic JSON engine
- `commands/library.rs` — async directory traverser/tree scanner
- Command boundary established: frontend invokes, never touches disk

**Governing skills:** tauri-data-boundary, content-hashing

---

## Phase 2 — Library View

**Goal:** A live mirror of the on-device folder, cataloged by content.

- Folder mirroring with real-time reflection of external changes (no source mutation)
- Documents cataloged by SHA-256 hash, not path
- `components/Library/` — folder tree + metadata display, token-compliant tiles
- Open-document flow routed through `UniversalRouter`

**Governing skills:** content-hashing, tauri-data-boundary, design-tokens, router-isolation

---

## Phase 3 — Reader Core

**Goal:** Fast, fully local PDF rendering.

- Decoupled PDF.js integration in the webview frame
- `components/Reader/` viewport container + page rendering
- Outline/TOC extraction
- Page-state metrics pushed to Rust backend (progress keyed by content hash)

**Governing skills:** pdfjs-reader-engine, tauri-data-boundary, content-hashing

---

## Phase 4 — Performance & Zoom

**Goal:** 60fps interaction on weak chipsets.

- `core/zoom/` scale-then-render pipeline (instant GPU CSS scale → 300ms debounced vector redraw)
- Audit and remove heavy JS render loops / bloated wrappers
- Main-thread responsiveness profiling on legacy hardware

**Governing skills:** pdfjs-reader-engine, design-tokens

---

## Phase 5 — Reading Themes

**Goal:** Battery-friendly display modes with zero re-render.

- GPU CSS-filter themes via `data-theme` (night = `invert(1) hue-rotate(180deg)`, sepia, etc.)
- Instant theme switching with no rasterization
- Theme-aware chrome that still honors design tokens

**Governing skills:** reading-themes, design-tokens

---

## Phase 6 — Selection & Annotation

**Goal:** Precise selection and persistent notes.

- Transparent text-layer overlay aligned to canvas
- `core/events/` centralized native selection capture
- Floating action → router-driven sliding annotation panel
- Annotations anchored to text signature, persisted by content hash via Rust

**Governing skills:** annotation-layer, router-isolation, content-hashing, tauri-data-boundary

---

## Phase 7 — Polish & Hardening

**Goal:** Ship-ready quality.

- Bookmarks and custom asset pairings (content-hash anchored)
- Full offline + air-gapped capacity verification
- Token-compliance and router-isolation sweep across all components
- On-device performance pass on oldest target chipset
- Crash-safety check on the atomic storage engine

**Governing skills:** all

---

## Cross-cutting invariants (every phase)

- **Offline always:** no network calls, ever.
- **Content over path:** identity = SHA-256, never a path string.
- **Rust owns data:** the webview never touches the filesystem.
- **Tokens own geometry:** no raw px / inline layout styles.
- **One router:** all navigation/transitions go through `UniversalRouter`.
