# Libra-Local

A premium, local-first, fully offline PDF reader for legacy iOS chipsets.
Tauri v2 (Rust host) + vanilla TypeScript + PDF.js webview.

See [`ROADMAP.md`](./ROADMAP.md) for phases and [`skills/`](./skills) for the
architectural guardrails that govern all code.

## Prerequisites (run on macOS with Xcode)

- Node 18+
- Rust (stable) + `cargo`
- Tauri CLI: `cargo install tauri-cli --version "^2"` (or use the bundled `@tauri-apps/cli`)
- For iOS: Xcode + the iOS targets (`rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`)

## Getting started

```bash
npm install              # install JS deps
npm run tauri dev        # run the desktop webview during development
```

## iOS / iPadOS

Requires macOS with Xcode, the iOS Rust targets, and CocoaPods:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
brew install cocoapods

npm install
npm run tauri ios init    # one-time: generates the Xcode project under src-tauri/gen/apple
```

### One-time: make PDFs reachable in the Files app

After `ios init`, open `src-tauri/gen/apple/libra-local_iOS/Info.plist` and add these
keys so the app's Documents folder appears in the Files app (users drop PDFs there,
and "Use Documents folder" in the app reads them — no security-scoped bookmarks needed):

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

### Run

```bash
npm run tauri ios dev                 # simulator (or a connected device)
# or open the Xcode project to run/sign on a physical iPad/iPhone:
open src-tauri/gen/apple/*.xcodeproj
```

Code signing for a physical device: set your Apple Team in Xcode (Signing &
Capabilities), or export `TAURI_APPLE_DEVELOPMENT_TEAM=<TEAMID>` before `ios dev`.

### iOS notes / platform differences

- **Adding books:** open the **Files app → On My iPad → Libra-Local** and copy PDFs
  in, then tap **Use Documents folder** in the app. You can also **Choose folder**
  to pick an iCloud/Files location.
- **No live updates:** iOS doesn't support the desktop file-watcher, so the library
  won't auto-refresh — use the **Refresh** button after adding files.
- **Icons:** run `npm run tauri icon app-icon.png` before a release build so the iOS
  app icons are generated.

## Web / PWA target

A second build target runs the same reader as a plain web app / installable PWA —
no Xcode, no signing, no expiry. It shares all the UI; only the data layer differs
(a runtime-selected backend in `src/core/backend`): the Tauri build talks to the
Rust commands, while the web build stores imported PDFs in the browser's OPFS and
metadata/annotations in IndexedDB.

```bash
npm install
npm run dev:web      # dev server (http://localhost:1430)
npm run build:web    # outputs dist-web/ (a static, offline-capable site)
```

Deploy `dist-web/` to any static host **at the domain root** (the build copies
`web.html` to `index.html`, and the service worker + manifest assume root scope).
Open it on iPad in Safari and **Share → Add to Home Screen** to install it.

How it differs from the native app:

- **Adding books:** tap **Import PDFs** and pick files; they're copied into the
  app's private storage and stay available offline. (Browsers can't read the
  Files-app directory directly — that's a platform limitation, not a bug.)
- **Everything else** — reader, zoom, themes, highlights, notes, bookmarks,
  progress — works identically, stored per-device in the browser.

## Project layout

```
src-tauri/   Rust host engine (systems layer) — owns all filesystem & data work
src/         Webview UI (interface layer) — rendering & interaction only
skills/      Architectural guardrails (design tokens, router, data boundary, …)
```

## Core invariants

- **Offline always** — no network, no CDNs (enforced via a strict CSP).
- **Content over path** — documents identified by SHA-256, never path.
- **Rust owns data** — the webview never touches the filesystem.
- **Tokens own geometry** — no raw px / inline layout styles.
- **One router** — all navigation flows through `UniversalRouter`.
