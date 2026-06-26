---
name: annotation-layer
description: Build text selection and annotation in the libra-local PDF reader. Use this skill whenever working on selecting text in a PDF, the transparent/invisible text layer, highlighting, the annotation input panel, or saving notes against a document. Trigger whenever the user mentions selecting text, highlighting, adding notes/comments, the annotate button, or the sliding annotation panel.
---

# Libra-Local Annotation & Selection Layer

Selection and annotation work on a transparent HTML text layer overlaid exactly on top of the rendered PDF canvas. The user appears to select the page itself, but they're really selecting positioned, invisible text — this is the standard PDF.js text-layer technique, and it's what makes selection precise without re-rendering. This layer lives in the Reader components (`src/components/Reader/`), with native event capture coordinated through `src/core/events/`.

## How selection works

The invisible text layer (`.pdf-page-text-layer` over `.pdf-page-canvas-render`) carries the document's text positioned to match the canvas. Intercept native selection events on this overlay through the centralized selection capture hub in `src/core/events/` rather than attaching ad-hoc listeners per page. Centralizing capture keeps behavior consistent across pages and avoids leaking listeners on a long document.

## The annotation flow

When the user makes a selection, a floating action surfaces. Tapping **Annotate** opens a dedicated input panel that slides in from the left margin. Crucially, that panel is a routed surface, not a local toggle: trigger it through the `UniversalRouter` (see [[router-isolation]]) so it participates in the back stack — tapping back closes the panel before leaving the reader.

```ts
import { router } from '@/core/navigation';

// on Annotate tap, with the captured selection
router.navigate({ view: 'reader', docHash, panel: 'annotate', selection });
```

## Anchoring annotation data

Cache the annotation against the core text signature of the selection, and persist it keyed to the document's content hash — never its path (see [[content-hashing]]). Anchoring to the text signature lets a note re-locate itself even if pagination shifts, and the content-hash key keeps it attached when the file is moved or renamed. As always, the actual write goes through a Rust Tauri command, not the frontend (see [[tauri-data-boundary]]):

```ts
await invoke('save_annotation', {
  docHash,
  textSignature,   // identifies the selected span
  note,
});
```

## Keep layers separate

The text layer is for selection/annotation only; it must stay transparent and must not interfere with the render pipeline ([[pdfjs-reader-engine]]) or with reading-theme filters ([[reading-themes]]). Don't paint highlights by mutating the canvas — render them as elements in/over the text layer so themes and zoom continue to work untouched. Panel geometry follows the design tokens (see [[design-tokens]]).
