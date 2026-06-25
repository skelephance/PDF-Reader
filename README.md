# Libra-Local

A premium, **local-first, fully offline PDF reader** that runs as a native desktop
app, a native iOS/iPadOS app, and an installable web PWA — all from a single shared
codebase. Built with Tauri v2 (Rust host) + TypeScript + PDF.js.

Your library, highlights, notes, bookmarks, and reading position stay on your
device. No accounts, no uploads, no network — by design.

- **Live web app:** https://skelephance.github.io/PDF-Reader/
- **Desktop & mobile installers:** see [Releases](https://github.com/skelephance/PDF-Reader/releases)

> _Screenshots / demo GIF go here — library view, reader with a highlight, the night theme._

---

## Features

- **Reader** — fast PDF.js rendering with lazy, recycled page canvases (won't blow
  mobile Safari's canvas-memory cap on long documents).
- **Scale-then-render zoom** — instant GPU-composited zoom while pinching, then a
  single crisp re-render once you settle, so it stays smooth on weak hardware.
- **Reading themes** — Day / Night / Sepia applied as GPU CSS filters with zero
  re-render; the whole UI recolors to match.
- **Highlights & notes** — select text to highlight; tap a highlight to add a note
  or delete it. Anchored to the text, not the page position.
- **Bookmarks** — star any page; jump back from the Contents panel.
- **Table of contents** — extracted from the PDF outline, with accurate jumps.
- **Reading progress** — every document reopens exactly where you left off.
- **Immersive mode** — collapse the chrome for a clean, full-bleed page.
- **Content-addressed** — documents are identified by the SHA-256 of their bytes,
  so your annotations follow a file even if it's moved or renamed.

## Platforms

| Target | Library model | Storage |
| --- | --- | --- |
| **Desktop** (macOS / Windows / Linux) | mirrors a folder you pick, live-watched | local app data |
| **iOS / iPadOS** | the app's Files-visible Documents folder | local app data |
| **Web / PWA** | import PDFs into the app | browser (OPFS + IndexedDB) |

## Tech stack

- **Tauri v2** — Rust host engine; native windows, filesystem, and packaging.
- **TypeScript** (no UI framework) — small, fast, framework-free webview UI.
- **PDF.js** — local PDF rendering and text layer (worker bundled, no CDN).
- **Vite** — dev server and builds for both the Tauri and web targets.

## Architecture

Two layers with a hard boundary between them:

```
src-tauri/   Rust host engine (systems layer) — owns all filesystem & data work
src/         Webview UI (interface layer) — rendering & interaction only
skills/      Architectural guardrails (design tokens, router, data boundary, …)
```

The desktop/iOS and web targets share **all** of the UI and reader code. They
diverge only at a runtime-selected data backend (`src/core/backend`): inside Tauri
it calls native Rust commands; in a browser it uses OPFS for PDF bytes and
IndexedDB for annotations/progress. `main.ts` is the Tauri entry, `main.web.ts` the
web entry.

### Core invariants

- **Offline always** — no network, no CDNs (enforced via a strict CSP).
- **Content over path** — documents identified by SHA-256, never path.
- **Rust owns data** — the webview never touches the filesystem directly.
- **Tokens own geometry** — no raw px / inline layout styles.
- **One router** — all navigation flows through `UniversalRouter`.

See [`ROADMAP.md`](./ROADMAP.md) for the build phases and [`skills/`](./skills) for
the guardrails that govern the code.

---

## Development

Prerequisites: Node 18+, Rust (stable) + `cargo`, and the Tauri CLI
(`cargo install tauri-cli --version "^2"`, or use the bundled `@tauri-apps/cli`).

```bash
npm install              # install JS deps
npm run tauri dev        # run the desktop app in development
```

## Build a desktop installer

```bash
npm run tauri icon app-icon.png   # generate icons (first time)
npm run tauri build               # → src-tauri/target/release/bundle/
```

`tauri build` only builds for the OS you run it on. Cross-platform installers
(macOS, Windows, Linux) are produced automatically by the release workflow — push a
version tag and it builds all three and attaches them to a draft GitHub Release:

```bash
git tag v0.1.0 && git push --tags
```

> Unsigned builds trigger an "unidentified developer / unknown publisher" warning;
> signing requires an Apple Developer account and/or a Windows code-signing cert.

## iOS / iPadOS

Requires macOS with Xcode, the iOS Rust targets, and CocoaPods:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
brew install cocoapods

npm install
npm run tauri ios init    # one-time: generates the Xcode project under src-tauri/gen/apple
```

After `ios init`, add these keys to `src-tauri/gen/apple/libra-local_iOS/Info.plist`
so the app's Documents folder appears in the Files app (drop PDFs there, then tap
**Use Documents folder** in the app — no security-scoped bookmarks needed):

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

Run it:

```bash
npm run tauri ios dev                 # simulator or a connected device
open src-tauri/gen/apple/*.xcodeproj  # or sign/run on a physical iPad in Xcode
```

For a physical device, set your Apple Team in Xcode (Signing & Capabilities) or
export `TAURI_APPLE_DEVELOPMENT_TEAM=<TEAMID>` before `ios dev`.

iOS notes: there's no desktop file-watcher, so use the **Refresh** button after
adding files; add books via **Files app → On My iPad → Libra-Local**.

## Web / PWA

The same reader as a static, installable, offline web app — no Xcode, no signing,
no expiry.

```bash
npm run dev:web      # dev server (http://localhost:1430)
npm run build:web    # outputs dist-web/ (static, offline-capable)
```

Deploy `dist-web/` to any static host (GitHub Pages, Cloudflare Pages, Netlify, …).
On iPad, open the URL in Safari and **Share → Add to Home Screen** to install it.
Add books with the **Import PDFs** button; they're stored privately in the browser
and available offline.

---

## License

MIT — see [`LICENSE`](./LICENSE).
