---
name: pdfjs-reader-engine
description: Build and maintain the Libra-Local PDF reader engine. Use this skill whenever working on PDF rendering, the reader viewport, page navigation, table-of-contents/outline extraction, page-state tracking, or zooming. Trigger whenever the user mentions PDF.js, rendering pages, zoom/scale, the reader view, the outline/TOC, or "where the user is" in a document, even if performance isn't explicitly mentioned.
---

# Libra-Local PDF.js Reader Engine

The reader uses a decoupled PDF.js integration inside the Tauri webview frame for high-speed, fully local processing (no network, no remote workers fetched from a CDN). The engine's design priorities are responsiveness on weak chipsets and keeping rendering logic isolated from app state, which lives in Rust. Components for this live in `src/components/Reader/` and the zoom controller in `src/core/zoom/`.

## Outline extraction and page state

Extract the table of contents via PDF.js outline hooks (`getOutline()`), and surface it through the router-driven UI rather than wiring custom navigation (see [[router-isolation]]). As the user reads, push page-state metrics (current page, scroll position, zoom) dynamically to the backend actors so progress persists — keyed by content hash, never path (see [[content-hashing]], [[tauri-data-boundary]]).

## The scale-then-render zoom engine

This is the heart of the reader's perceived performance. Re-rasterizing PDF pages is expensive; doing it on every zoom tick would clip text and stutter on low-spec mobile chipsets. So zoom runs as a two-stage pipeline:

1. **Immediate stage** — apply a hardware-accelerated CSS transform (`transform: scale(...)`) for instant 60fps visual feedback. This costs almost nothing because the GPU composites the existing canvas; no re-rasterization happens.
2. **Debounced stage** — after the user settles (a ~300ms debounce), perform a single crisp vector redraw at the new scale, then reset the CSS transform to 1. This swaps the cheap stretched bitmap for a sharp re-render exactly once.

The controller lives in `src/core/zoom/` ("Scale-Then-Render Debounce Controller"). The principle: never trigger a vector redraw on every zoom event — give instant GPU feedback, then redraw once when motion stops.

```ts
// conceptual shape — instant scale, single debounced redraw
function onZoom(scale: number) {
  viewport.style.transform = `scale(${scale})`;   // 60fps, GPU
  debouncedRedraw(scale);                          // ~300ms -> one crisp render
}
const debouncedRedraw = debounce((scale: number) => {
  renderPageAtScale(scale);            // vector redraw via PDF.js
  viewport.style.transform = 'scale(1)';
}, 300);
```

## Reject heavy JS loops

The engine must actively avoid heavy client-side JavaScript execution loops and bloated rendering wrappers. Prefer GPU-composited CSS for transient visual changes, debounce expensive work, and keep per-frame JS minimal. If a feature seems to need a tight render loop in JS, that's a signal to rethink it toward a CSS/GPU or debounced approach.

## Related surfaces

The transparent text layer over the canvas powers selection and annotation — see [[annotation-layer]]. Reading themes are applied as GPU CSS filters over the canvas — see [[reading-themes]]. Keep those concerns in their own layers rather than entangling them with the render pipeline.
