// Native Selection Capture Hub.
//
// Centralizes interception of text-selection events on the transparent text
// layer overlaid on each PDF canvas, so selection behavior stays consistent
// across pages and listeners don't leak on long documents
// (see skills/annotation-layer).

import type { Rect } from "@/core/reader";

/** A finalized selection within a single page's text layer. */
export interface CapturedSelection {
  /** 1-based page number. */
  page: number;
  /** Selected text — used as the annotation's text signature. */
  text: string;
  /** Selection rectangles, normalized to the page box (0..1). */
  rects: Rect[];
  /** Viewport-space point (top-center of the selection) for the floating menu. */
  anchor: { x: number; y: number };
}

export interface SelectionHubHandlers {
  onSelect: (selection: CapturedSelection) => void;
  onClear: () => void;
}

/**
 * Watches a scroll container for text selections inside `.pdf-page-text-layer`
 * elements and reports normalized results. Cross-page selections are ignored.
 */
export class SelectionHub {
  private readonly onPointerUp = () => window.setTimeout(() => this.evaluate(), 0);
  private readonly onSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) this.handlers.onClear();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: SelectionHubHandlers,
  ) {
    this.root.addEventListener("pointerup", this.onPointerUp);
    document.addEventListener("selectionchange", this.onSelectionChange);
  }

  destroy(): void {
    this.root.removeEventListener("pointerup", this.onPointerUp);
    document.removeEventListener("selectionchange", this.onSelectionChange);
  }

  /** The current selection right now, if any (for toolbar-driven actions). */
  current(): CapturedSelection | null {
    return this.capture();
  }

  private evaluate(): void {
    const captured = this.capture();
    if (captured) this.handlers.onSelect(captured);
    else this.handlers.onClear();
  }

  private capture(): CapturedSelection | null {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const textLayer = el?.closest(".pdf-page-text-layer");
    if (!textLayer || !this.root.contains(textLayer)) return null;

    const pageEl = textLayer.closest<HTMLElement>(".pdf-page");
    if (!pageEl) return null;
    const page = Number(pageEl.dataset.page);
    if (!page) return null;

    const box = pageEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;

    const clientRects = Array.from(range.getClientRects());
    const rects: Rect[] = clientRects
      .map((r) => ({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
      }))
      .filter((r) => r.w > 0 && r.h > 0);
    if (rects.length === 0) return null;

    const first = clientRects[0];
    return {
      page,
      text: sel.toString(),
      rects,
      anchor: { x: first.left + first.width / 2, y: first.top },
    };
  }
}
