// Book Reader View — engine & state management.
//
// Decoupled PDF.js integration: bytes come from Rust (see skills/tauri-data-
// boundary); pages render lazily with a transparent text layer for selection;
// the outline drives a routed TOC panel; zoom uses scale-then-render; reading
// themes are GPU CSS filters; and highlights/notes are anchored to the text
// signature and persisted by content hash (see skills/content-hashing,
// skills/annotation-layer).

import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { router, type Route } from "@/core/navigation";
import type { ViewController } from "@/core/view";
import { ScaleThenRender } from "@/core/zoom";
import { SelectionHub, type CapturedSelection } from "@/core/events";
import {
  readDocument,
  getProgress,
  saveProgress,
  listAnnotations,
  saveAnnotation,
  deleteAnnotation,
  listBookmarks,
  saveBookmark,
  deleteBookmark,
  type Annotation,
  type Bookmark,
} from "@/core/reader";
import {
  getReadingTheme,
  setReadingTheme,
  applyReadingTheme,
  nextTheme,
  labelFor,
  type ReadingTheme,
} from "@/core/theme";
import { renderOutline, type OutlineItem } from "./Outline";
import { renderAnnotationLayer } from "./AnnotationLayer";
import { renderAnnotationPanel } from "./AnnotationPanel";

// Bundled worker (no CDN) — keeps the app fully offline.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const HIGHLIGHT_COLOR = "rgba(255, 214, 10, 0.40)";
const NOTE_COLOR = "rgba(59, 110, 245, 0.28)";

type AnnoContext =
  | { mode: "create"; selection: CapturedSelection }
  | { mode: "edit"; annotation: Annotation };

export function createReaderView(route: Route): ViewController {
  const reader = new Reader(route);
  return {
    el: reader.el,
    update: (r) => reader.onRoute(r),
    destroy: () => reader.destroy(),
  };
}

function pathOf(route: Route): string | null {
  const data = route.data as { path?: string } | undefined;
  return data?.path ?? null;
}

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** SHA-256 of the document bytes — the content identity (see content-hashing).
 * Computed natively off the main thread from bytes already in memory. */
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

class Reader {
  readonly el: HTMLElement;
  private readonly pages: HTMLElement; // scroll container + viewport frame
  private readonly zoomWrap: HTMLElement; // holds page boxes; carries --zoom
  private readonly indicator: HTMLElement;
  private readonly zoomLevel: HTMLElement;
  private readonly themeButton: HTMLButtonElement;
  private readonly bookmarkButton: HTMLButtonElement;
  private readonly collapseButton: HTMLButtonElement;
  private readonly immersiveExit: HTMLButtonElement;
  private readonly overlay: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly overlayBody: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly highlightButton: HTMLButtonElement;

  private route: Route;
  private docHash: string;
  private path: string | null;

  private pdf: PDFDocumentProxy | null = null;
  private numPages = 0;
  private base = { width: 0, height: 0 };
  private outline: OutlineItem[] | null = null;
  private annotations: Annotation[] = [];
  private bookmarks: Bookmark[] = [];
  private readonly rendered = new Set<number>();
  // Wide-margin observer schedules rendering/recycling; tight observer tracks
  // which page actually fills the viewport (for the page number + progress).
  private renderObserver: IntersectionObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private readonly visible = new Map<number, number>();
  private currentPage = 1;
  private saveTimer: number | undefined;
  private disposed = false;

  private readonly zoom: ScaleThenRender;
  private gestureStart = 1;
  private theme: ReadingTheme = "day";

  private readonly selectionHub: SelectionHub;
  private pending: CapturedSelection | null = null;
  private annoContext: AnnoContext | null = null;

  constructor(route: Route) {
    this.route = route;
    this.docHash = route.docHash ?? "";
    this.path = pathOf(route);

    this.el = document.createElement("section");
    this.el.className = "reader";

    // Toolbar: contents · page indicator · theme · zoom controls.
    const toolbar = document.createElement("div");
    toolbar.className = "reader__toolbar";

    const contents = document.createElement("button");
    contents.className = "reader__action";
    contents.textContent = "Contents";
    contents.addEventListener("click", () => this.openPanel("toc"));

    this.bookmarkButton = document.createElement("button");
    this.bookmarkButton.className = "reader__action reader__bookmark";
    this.bookmarkButton.textContent = "☆";
    this.bookmarkButton.title = "Bookmark this page";
    this.bookmarkButton.addEventListener("click", () => void this.toggleBookmark());

    this.indicator = document.createElement("span");
    this.indicator.className = "reader__indicator";

    this.themeButton = document.createElement("button");
    this.themeButton.className = "reader__action";
    this.themeButton.textContent = "Day";
    this.themeButton.addEventListener("click", () => void this.cycleTheme());

    const zoomControls = document.createElement("div");
    zoomControls.className = "reader__zoom-controls";
    const zoomOut = this.zoomButton("−", () => this.zoom.zoomBy(1 / 1.25));
    this.zoomLevel = document.createElement("span");
    this.zoomLevel.className = "reader__zoom-level";
    this.zoomLevel.textContent = "100%";
    const zoomIn = this.zoomButton("+", () => this.zoom.zoomBy(1.25));
    zoomControls.append(zoomOut, this.zoomLevel, zoomIn);

    this.collapseButton = document.createElement("button");
    this.collapseButton.className = "reader__action";
    this.collapseButton.textContent = "⤢";
    this.collapseButton.title = "Hide controls";
    this.collapseButton.addEventListener("click", () => this.setImmersive(true));

    // Selection actions live in the toolbar (not a floating menu) so iOS
    // Safari's native selection callout can't cover them.
    this.highlightButton = document.createElement("button");
    this.highlightButton.className = "reader__action";
    this.highlightButton.textContent = "Highlight";
    this.highlightButton.addEventListener("click", () => void this.doHighlight());

    // Page indicator on the left; all actions grouped on the right.
    const actions = document.createElement("div");
    actions.className = "reader__actions";
    actions.append(
      this.highlightButton,
      this.themeButton,
      this.bookmarkButton,
      zoomControls,
      contents,
      this.collapseButton,
    );
    toolbar.append(this.indicator, actions);

    // Scroll container (the viewport frame that carries the reading theme).
    this.pages = document.createElement("div");
    this.pages.className = "reader__pages pdf-viewport-frame";
    this.zoomWrap = document.createElement("div");
    this.zoomWrap.className = "reader__zoom";
    this.pages.appendChild(this.zoomWrap);

    // Shared routed overlay (TOC and annotation panel).
    this.backdrop = document.createElement("div");
    this.backdrop.className = "reader__backdrop";
    this.backdrop.addEventListener("click", () => router.pop());
    this.overlay = document.createElement("aside");
    this.overlay.className = "reader__overlay";
    this.overlayTitle = document.createElement("h2");
    this.overlayTitle.className = "reader__overlay-title";
    this.overlayBody = document.createElement("div");
    this.overlayBody.className = "reader__overlay-body";
    this.overlay.append(this.overlayTitle, this.overlayBody);

    // Floating control shown only in immersive (collapsed) mode.
    this.immersiveExit = document.createElement("button");
    this.immersiveExit.className = "reader__immersive-exit";
    this.immersiveExit.textContent = "⤡";
    this.immersiveExit.title = "Show controls";
    this.immersiveExit.addEventListener("click", () => this.setImmersive(false));

    this.el.append(
      toolbar,
      this.pages,
      this.backdrop,
      this.overlay,
      this.immersiveExit,
    );

    this.zoom = new ScaleThenRender({
      min: 0.5,
      max: 4,
      redrawDelay: 300,
      applyTransform: (ratio) => {
        this.zoomWrap.style.transform = `scale(${ratio})`;
      },
      commit: (scale) => this.commitZoom(scale),
      onChange: (scale) => {
        this.zoomLevel.textContent = `${Math.round(scale * 100)}%`;
      },
    });

    // Remember the last selection so toolbar actions work even after iOS
    // dismisses the visible selection when a toolbar button is tapped.
    this.selectionHub = new SelectionHub(this.pages, {
      onSelect: (sel) => {
        this.pending = sel;
      },
      onClear: () => {
        /* keep last selection for the toolbar actions */
      },
    });

    this.installZoomInput();
    void this.initTheme();
    void this.load();
  }

  // --- lifecycle ---

  onRoute(route: Route): void {
    this.route = route;
    const newPath = pathOf(route);
    if (newPath !== this.path) {
      this.teardownDoc();
      this.path = newPath;
      void this.load();
    }
    this.applyPanel();
  }

  destroy(): void {
    this.disposed = true;
    this.flushSave();
    this.selectionHub.destroy();
    this.setImmersive(false); // don't leave the library chrome hidden
    this.teardownDoc();
  }

  /** Collapse the chrome (nav bar + toolbar) for a clean, full-bleed view. */
  private setImmersive(on: boolean): void {
    document.getElementById("app")?.classList.toggle("immersive", on);
  }

  private teardownDoc(): void {
    this.renderObserver?.disconnect();
    this.renderObserver = null;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    this.visible.clear();
    this.rendered.clear();
    this.annotations = [];
    this.outline = null;
    this.zoomWrap.replaceChildren();
    this.zoomWrap.style.transform = "";
    this.zoomWrap.style.removeProperty("--zoom");
    this.overlayBody.replaceChildren();
    void this.pdf?.destroy();
    this.pdf = null;
  }

  // --- reading theme (GPU CSS filter, zero re-render) ---

  private async initTheme(): Promise<void> {
    this.theme = await getReadingTheme();
    if (this.disposed) return;
    this.applyTheme();
  }

  private async cycleTheme(): Promise<void> {
    this.theme = nextTheme(this.theme);
    this.applyTheme();
    await setReadingTheme(this.theme).catch(() => {});
  }

  private applyTheme(): void {
    applyReadingTheme(this.theme);
    this.themeButton.textContent = labelFor(this.theme);
  }

  // --- loading & rendering ---

  private async load(): Promise<void> {
    if (!this.path) {
      this.showMessage("No document selected.");
      return;
    }
    try {
      const buf = await readDocument(this.path);
      if (this.disposed) return;
      this.docHash = await sha256Hex(buf); // identity from content, before transfer
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      if (this.disposed) {
        void pdf.destroy();
        return;
      }
      this.pdf = pdf;
      this.numPages = pdf.numPages;

      const first = await pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      this.base = { width: vp.width, height: vp.height };

      this.outline = (await pdf.getOutline().catch(() => null)) as OutlineItem[] | null;
      this.annotations = await listAnnotations(this.docHash).catch(() => []);
      this.bookmarks = await listBookmarks(this.docHash).catch(() => []);

      this.buildPlaceholders();
      this.setupObserver();
      this.indicator.textContent = `1 / ${this.numPages}`;
      this.updateStar();

      const prog = await getProgress(this.docHash).catch(() => null);
      const start = prog && prog.page >= 1 && prog.page <= this.numPages ? prog.page : 1;
      if (start > 1) this.scrollToPage(start, "auto");

      this.applyPanel();
    } catch (err) {
      if (!this.disposed) this.showMessage(`Couldn't open document: ${String(err)}`);
    }
  }

  private buildPlaceholders(): void {
    const frag = document.createDocumentFragment();
    for (let n = 1; n <= this.numPages; n++) {
      const page = document.createElement("div");
      page.className = "pdf-page";
      page.dataset.page = String(n);
      page.style.aspectRatio = `${this.base.width} / ${this.base.height}`;
      frag.appendChild(page);
    }
    this.zoomWrap.replaceChildren(frag);
  }

  private setupObserver(): void {
    // Wide margin: render/recycle pages within ~2 screens of the viewport.
    this.renderObserver = new IntersectionObserver(
      (entries) => this.onRenderIntersect(entries),
      { root: this.pages, rootMargin: "200% 0px", threshold: [0, 1] },
    );
    // Tight (actual viewport): track which page is genuinely on screen, by how
    // much of it is visible — this drives the page number and saved progress.
    this.visibilityObserver = new IntersectionObserver(
      (entries) => this.onVisibilityChange(entries),
      { root: this.pages, rootMargin: "0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    for (const el of this.zoomWrap.children) {
      this.renderObserver.observe(el);
      this.visibilityObserver.observe(el);
    }
  }

  private onRenderIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const n = Number((entry.target as HTMLElement).dataset.page);
      if (entry.isIntersecting) {
        void this.renderPage(n);
      } else {
        // Past the margin (~2 screens away): free the canvas so we never blow
        // iOS Safari's canvas-memory cap on long documents.
        this.unrenderPage(n);
      }
    }
  }

  private onVisibilityChange(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const n = Number((entry.target as HTMLElement).dataset.page);
      // Visible height in actual viewport pixels — robust regardless of size.
      this.visible.set(n, entry.isIntersecting ? entry.intersectionRect.height : 0);
    }
    this.updateCurrentPage();
  }

  /** Tear down a far-offscreen page's canvas/layers, keeping its height so the
   * scroll position doesn't shift. It re-renders when scrolled back into view. */
  private unrenderPage(n: number): void {
    if (!this.rendered.has(n)) return;
    const box = this.pageEl(n);
    if (box) {
      const h = box.getBoundingClientRect().height;
      if (h > 0) box.style.height = `${h}px`;
      box.replaceChildren();
    }
    this.rendered.delete(n);
  }

  private async renderPage(n: number): Promise<void> {
    if (this.rendered.has(n) || !this.pdf) return;
    this.rendered.add(n);
    const box = this.pageEl(n);
    if (!box) {
      this.rendered.delete(n);
      return;
    }
    try {
      const page = await this.pdf.getPage(n);
      if (this.disposed) return;
      const unscaled = page.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = box.clientWidth || this.base.width;
      const scaleCss = cssWidth / unscaled.width;
      const viewport = page.getViewport({ scale: scaleCss });

      // Canvas: rasterize at device-pixel density, display at CSS size.
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas-render";
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
      if (this.disposed) return;

      // Transparent text layer for selection, sized to the CSS viewport.
      const textLayer = document.createElement("div");
      textLayer.className = "pdf-page-text-layer";
      textLayer.style.setProperty("--scale-factor", String(scaleCss));
      textLayer.style.setProperty("--total-scale-factor", String(scaleCss));
      const layerBuilder = new pdfjsLib.TextLayer({
        textContentSource: await page.getTextContent(),
        container: textLayer,
        viewport,
      });
      await layerBuilder.render();
      if (this.disposed) return;

      box.style.aspectRatio = "";
      box.style.height = ""; // clear any frozen height from recycling
      box.replaceChildren(canvas, textLayer, this.annotationLayerFor(n));
    } catch {
      this.rendered.delete(n);
    }
  }

  private annotationLayerFor(page: number): HTMLElement {
    return renderAnnotationLayer(
      this.annotations.filter((a) => a.page === page),
      (a) => this.openAnnotation(a),
    );
  }

  private refreshPageAnnotations(page: number): void {
    const box = this.pageEl(page);
    if (!box) return;
    box.querySelector(".pdf-page-annotations")?.remove();
    box.appendChild(this.annotationLayerFor(page));
  }

  private updateCurrentPage(): void {
    // The current page is the one with the most visible height in the viewport.
    let best = this.currentPage;
    let bestHeight = 0;
    for (const [n, height] of this.visible) {
      if (height > bestHeight) {
        bestHeight = height;
        best = n;
      }
    }
    if (best !== this.currentPage) {
      this.currentPage = best;
      this.indicator.textContent = `${best} / ${this.numPages}`;
      this.updateStar();
      this.scheduleSave();
    }
  }

  // --- bookmarks ---

  private updateStar(): void {
    const marked = this.bookmarks.some((b) => b.page === this.currentPage);
    this.bookmarkButton.textContent = marked ? "★" : "☆";
    this.bookmarkButton.classList.toggle("is-active", marked);
  }

  private async toggleBookmark(): Promise<void> {
    const page = this.currentPage;
    const existing = this.bookmarks.find((b) => b.page === page);
    if (existing) {
      this.bookmarks = this.bookmarks.filter((b) => b.id !== existing.id);
      await deleteBookmark(this.docHash, existing.id).catch(() => {});
    } else {
      const bookmark: Bookmark = { id: uid(), page, label: `Page ${page}` };
      this.bookmarks.push(bookmark);
      this.bookmarks.sort((a, b) => a.page - b.page);
      await saveBookmark(this.docHash, bookmark).catch(() => {});
    }
    this.updateStar();
    if (this.route.panel === "toc") this.buildContents();
  }

  // --- zoom ---

  private installZoomInput(): void {
    const updateOrigin = (clientX: number, clientY: number) => {
      if (this.zoomWrap.style.transform === "") {
        const rect = this.zoomWrap.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        this.zoomWrap.style.transformOrigin = `${x}px ${y}px`;
      }
    };

    this.pages.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        updateOrigin(e.clientX, e.clientY);
        // Exponential scale for smooth trackpad pinch
        const factor = Math.exp(-e.deltaY * 0.01);
        this.zoom.zoomBy(factor);
      },
      { passive: false },
    );
    this.pages.addEventListener("gesturestart", (e: Event) => {
      e.preventDefault();
      // @ts-ignore - Safari gesture event
      updateOrigin(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2);
      this.gestureStart = this.zoom.scale;
    });
    this.pages.addEventListener("gesturechange", (e: Event) => {
      e.preventDefault();
      const scale = (e as unknown as { scale: number }).scale;
      this.zoom.setScale(this.gestureStart * scale);
    });
  }

  private commitZoom(scale: number): void {
    const oldScale = Number(this.zoomWrap.style.getPropertyValue("--zoom") || 1);
    const ratio = scale / oldScale;
    
    // Remember the viewport center before layout change
    const centerRect = this.pages.getBoundingClientRect();
    const cx = centerRect.left + centerRect.width / 2;
    const cy = centerRect.top + centerRect.height / 2;
    
    // Calculate the distance from top-left of the document to the center
    const docRect = this.zoomWrap.getBoundingClientRect();
    const docX = cx - docRect.left;
    const docY = cy - docRect.top;
    
    // Unrendered pages have frozen pixel heights to prevent scroll jitter.
    // We must scale those frozen heights, otherwise the document height won't
    // grow correctly and our scroll compensation will throw us to the wrong page.
    for (const el of this.zoomWrap.children) {
      const box = el as HTMLElement;
      if (box.style.height) {
        const oldH = parseFloat(box.style.height);
        box.style.height = `${oldH * ratio}px`;
      }
    }

    // Apply the new layout scale
    this.zoomWrap.style.setProperty("--zoom", String(scale));
    this.zoomWrap.style.transform = "";
    this.zoomWrap.style.transformOrigin = "";

    // Adjust scroll to keep the visual center pinned
    this.pages.scrollBy({
      left: docX * ratio - docX,
      top: docY * ratio - docY,
      behavior: "instant"
    });

    // Re-render the currently rendered pages crisply at the new scale.
    for (const n of [...this.rendered]) {
      this.rendered.delete(n);
      void this.renderPage(n);
    }
  }

  // --- progress persistence ---

  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flushSave(), 600);
  }

  private flushSave(): void {
    window.clearTimeout(this.saveTimer);
    if (!this.docHash || this.numPages === 0) return;
    void saveProgress(this.docHash, {
      page: this.currentPage,
      pages: this.numPages,
    }).catch(() => {});
  }

  // --- selection actions (toolbar-driven) + annotations ---

  /** Current live selection, falling back to the last captured one. */
  private currentSelection(): CapturedSelection | null {
    return this.selectionHub.current() ?? this.pending;
  }

  private async doHighlight(): Promise<void> {
    const sel = this.currentSelection();
    if (!sel) return;
    const annotation: Annotation = {
      id: uid(),
      page: sel.page,
      kind: "highlight",
      color: HIGHLIGHT_COLOR,
      quote: sel.text,
      note: "",
      rects: sel.rects,
    };
    this.annotations.push(annotation);
    await saveAnnotation(this.docHash, annotation).catch(() => {});
    this.refreshPageAnnotations(sel.page);
    this.clearSelectionUI();
  }

  private openAnnotation(annotation: Annotation): void {
    this.annoContext = { mode: "edit", annotation };
    this.openPanel("annotate");
  }

  private async commitAnnotation(note: string): Promise<void> {
    const ctx = this.annoContext;
    if (!ctx) return;
    const kind = note ? "note" : "highlight";
    const color = note ? NOTE_COLOR : HIGHLIGHT_COLOR;

    let annotation: Annotation;
    if (ctx.mode === "edit") {
      annotation = { ...ctx.annotation, note, kind, color };
      const i = this.annotations.findIndex((a) => a.id === annotation.id);
      if (i >= 0) this.annotations[i] = annotation;
    } else {
      const s = ctx.selection;
      annotation = {
        id: uid(),
        page: s.page,
        kind,
        color,
        quote: s.text,
        note,
        rects: s.rects,
      };
      this.annotations.push(annotation);
    }

    await saveAnnotation(this.docHash, annotation).catch(() => {});
    this.refreshPageAnnotations(annotation.page);
    this.clearSelectionUI();
    router.pop();
  }

  private async deleteCurrent(): Promise<void> {
    const ctx = this.annoContext;
    if (!ctx || ctx.mode !== "edit") return;
    const { id, page } = ctx.annotation;
    this.annotations = this.annotations.filter((a) => a.id !== id);
    await deleteAnnotation(this.docHash, id).catch(() => {});
    this.refreshPageAnnotations(page);
    router.pop();
  }

  private clearSelectionUI(): void {
    this.pending = null;
    window.getSelection()?.removeAllRanges();
  }

  // --- routed panels (TOC + annotate share one overlay) ---

  private openPanel(panel: "toc" | "annotate"): void {
    router.navigate({
      view: "reader",
      docHash: this.docHash,
      data: { path: this.path },
      panel,
    });
  }

  private applyPanel(): void {
    const panel = this.route.panel;
    if (panel === "toc") {
      this.overlayTitle.textContent = "Contents";
      this.buildContents();
    } else if (panel === "annotate") {
      this.overlayTitle.textContent = "Annotation";
      this.buildAnnotate();
    }
    const open = panel === "toc" || panel === "annotate";
    this.overlay.classList.toggle("is-open", open);
    this.backdrop.classList.toggle("is-open", open);
  }

  private buildContents(): void {
    const sections: HTMLElement[] = [];

    // Bookmarks section.
    if (this.bookmarks.length > 0) {
      sections.push(this.sectionHeading("Bookmarks"));
      const list = document.createElement("ul");
      list.className = "bookmark-list";
      for (const b of this.bookmarks) {
        const li = document.createElement("li");
        li.className = "bookmark-item";

        const jump = document.createElement("button");
        jump.className = "bookmark-jump";
        jump.textContent = b.label;
        jump.addEventListener("click", () => {
          router.pop();
          void this.goToPage(b.page, 0);
        });

        const remove = document.createElement("button");
        remove.className = "bookmark-remove";
        remove.textContent = "✕";
        remove.title = "Remove bookmark";
        remove.addEventListener("click", () => void this.removeBookmark(b.id));

        li.append(jump, remove);
        list.appendChild(li);
      }
      sections.push(list);
    }

    // Annotations section.
    if (this.annotations.length > 0) {
      sections.push(this.sectionHeading("Annotations"));
      const list = document.createElement("ul");
      list.className = "anno-nav-list";
      const sorted = [...this.annotations].sort(
        (a, b) => a.page - b.page || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0),
      );
      for (const a of sorted) {
        const li = document.createElement("li");
        li.className = "anno-nav-item";

        const jump = document.createElement("button");
        jump.className = "anno-nav-jump";

        const dot = document.createElement("span");
        dot.className = "anno-nav-dot";
        dot.style.background = a.color;

        const text = document.createElement("span");
        text.className = "anno-nav-text";
        const bodyText = a.note.trim() ? a.note.trim() : a.quote;
        text.textContent = bodyText.length > 80 ? `${bodyText.slice(0, 80)}…` : bodyText;

        const badge = document.createElement("span");
        badge.className = "anno-nav-page";
        badge.textContent = `p.${a.page}`;

        jump.append(dot, text, badge);
        const yFraction = a.rects[0]?.y ?? 0;
        jump.addEventListener("click", () => {
          router.pop();
          void this.goToPage(a.page, yFraction);
        });
        li.appendChild(jump);
        list.appendChild(li);
      }
      sections.push(list);
    }

    // Outline section.
    sections.push(this.sectionHeading("Table of Contents"));
    if (!this.outline || this.outline.length === 0) {
      const empty = document.createElement("p");
      empty.className = "reader__overlay-empty";
      empty.textContent = "This document has no table of contents.";
      sections.push(empty);
    } else {
      sections.push(renderOutline(this.outline, (dest) => void this.goToDest(dest)));
    }

    this.overlayBody.replaceChildren(...sections);
  }

  private sectionHeading(text: string): HTMLElement {
    const h = document.createElement("h3");
    h.className = "reader__overlay-section";
    h.textContent = text;
    return h;
  }

  private async removeBookmark(id: string): Promise<void> {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    await deleteBookmark(this.docHash, id).catch(() => {});
    this.updateStar();
    this.buildContents();
  }

  private buildAnnotate(): void {
    const ctx = this.annoContext;
    if (!ctx) {
      this.overlayBody.replaceChildren();
      return;
    }
    const view =
      ctx.mode === "edit"
        ? { quote: ctx.annotation.quote, note: ctx.annotation.note, canDelete: true }
        : { quote: ctx.selection.text, note: "", canDelete: false };
    this.overlayBody.replaceChildren(
      renderAnnotationPanel(view, {
        onSave: (note) => void this.commitAnnotation(note),
        onDelete: () => void this.deleteCurrent(),
      }),
    );
  }

  private async goToDest(dest: unknown): Promise<void> {
    const target = await this.destToTarget(dest);
    router.pop();
    if (!target) return;
    await this.goToPage(target.page, target.yFraction);
  }

  /** Accurate jump. Lazy-rendered pages above the target settle to real heights
   * shortly after the jump, which would otherwise shift the target by ~a page.
   * So we re-pin the target to the top every frame for a short window until the
   * layout stops moving. */
  private async goToPage(page: number, yFraction: number): Promise<void> {
    await this.renderPage(page);
    if (page > 1) await this.renderPage(page - 1);
    this.scrollToTarget(page, yFraction, "auto");

    const deadline = performance.now() + 800;
    const repin = () => {
      if (this.disposed) return;
      this.scrollToTarget(page, yFraction, "auto");
      if (performance.now() < deadline) requestAnimationFrame(repin);
    };
    requestAnimationFrame(repin);
  }

  /** Resolve a PDF destination to a page and a vertical fraction within it. */
  private async destToTarget(
    dest: unknown,
  ): Promise<{ page: number; yFraction: number } | null> {
    if (!this.pdf) return null;
    let explicit = dest;
    if (typeof dest === "string") {
      explicit = await this.pdf.getDestination(dest).catch(() => null);
    }
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    try {
      const index = await this.pdf.getPageIndex(explicit[0]);
      const page = index + 1;

      // Pull the Y coordinate from the destination when present (XYZ / FitH).
      const name = (explicit[1] as { name?: string } | undefined)?.name;
      let yPoints: number | null = null;
      if (name === "XYZ" && typeof explicit[3] === "number") yPoints = explicit[3];
      else if ((name === "FitH" || name === "FitBH") && typeof explicit[2] === "number")
        yPoints = explicit[2];

      let yFraction = 0;
      if (yPoints != null) {
        const pageObj = await this.pdf.getPage(page);
        const height = pageObj.getViewport({ scale: 1 }).height; // points, origin bottom-left
        yFraction = Math.min(1, Math.max(0, (height - yPoints) / height));
      }
      return { page, yFraction };
    } catch {
      return null;
    }
  }

  /** Scroll so the given fractional point of a page sits at the top. */
  private scrollToTarget(page: number, yFraction: number, behavior: ScrollBehavior): void {
    const box = this.pageEl(page);
    if (!box) return;
    const pagesRect = this.pages.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const top =
      this.pages.scrollTop + (boxRect.top - pagesRect.top) + yFraction * boxRect.height;
    this.pages.scrollTo({ top, behavior });
  }

  // --- helpers ---

  private zoomButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "reader__zoom-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private pageEl(n: number): HTMLElement | null {
    return this.zoomWrap.querySelector<HTMLElement>(`[data-page="${n}"]`);
  }

  private scrollToPage(n: number, behavior: ScrollBehavior): void {
    this.pageEl(n)?.scrollIntoView({ behavior, block: "start" });
  }

  private showMessage(text: string): void {
    const wrap = document.createElement("div");
    wrap.className = "placeholder";
    const card = document.createElement("div");
    card.className = "placeholder__card";
    card.textContent = text;
    wrap.appendChild(card);
    this.zoomWrap.replaceChildren(wrap);
  }
}
