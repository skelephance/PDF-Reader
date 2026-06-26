// Scale-Then-Render Debounce Controller.
//
// Re-rasterizing PDF pages is expensive; doing it on every zoom tick clips text
// and stutters on weak chipsets. So zoom runs as a two-stage pipeline:
//   1. immediate — a GPU-composited CSS transform for instant 60fps feedback;
//   2. debounced — a single crisp re-render at the settled scale (~300ms later),
//      after which the transform resets to 1.
// Never trigger a vector redraw on every tick (see skills/pdfjs-reader-engine).

/** Trailing-edge debounce using the window timer. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  let timer: number | undefined;
  return (...args: A) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

export interface ScaleThenRenderConfig {
  /** Clamp bounds for the zoom factor. */
  min: number;
  max: number;
  /** How long to wait after the last change before the crisp redraw (ms). */
  redrawDelay: number;
  /** Stage 1: apply an instant CSS transform. `ratio` = target / committed. */
  applyTransform: (ratio: number) => void;
  /** Stage 2: commit `scale` as the new layout/raster scale and reset transform. */
  commit: (scale: number) => void;
  /** Optional: notified of the live target on every change (for UI readouts). */
  onChange?: (scale: number) => void;
}

/**
 * Coordinates the two zoom stages. `committed` is the scale the pages are
 * currently rasterized at; `target` is where the user is heading. Between
 * changes we only paint a cheap transform; once motion settles we redraw once.
 */
export class ScaleThenRender {
  private committed = 1;
  private target = 1;
  private readonly scheduleCommit: () => void;

  constructor(private readonly cfg: ScaleThenRenderConfig) {
    this.scheduleCommit = debounce(() => this.doCommit(), cfg.redrawDelay);
  }

  get scale(): number {
    return this.target;
  }

  setScale(next: number): void {
    const clamped = Math.min(this.cfg.max, Math.max(this.cfg.min, next));
    if (clamped === this.target) return;
    this.target = clamped;
    // Stage 1: instant, GPU-composited. Display = committed * (target/committed).
    this.cfg.applyTransform(this.target / this.committed);
    this.cfg.onChange?.(this.target);
    // Stage 2: scheduled crisp redraw once the user stops.
    this.scheduleCommit();
  }

  zoomBy(factor: number): void {
    this.setScale(this.target * factor);
  }

  reset(): void {
    this.setScale(1);
  }

  private doCommit(): void {
    if (this.target === this.committed) return;
    this.committed = this.target;
    this.cfg.commit(this.committed);
  }
}
