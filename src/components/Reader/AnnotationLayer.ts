// Renders saved highlights/notes for one page as positioned overlays above the
// canvas and text layer. Rects are normalized (0..1), so they hold at any zoom.
// The layer ignores pointer events except on the highlight rects themselves, so
// fresh text selection elsewhere still works (see skills/annotation-layer).

import type { Annotation } from "@/core/reader";

export function renderAnnotationLayer(
  annotations: Annotation[],
  onOpen: (annotation: Annotation) => void,
): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "pdf-page-annotations";

  for (const annotation of annotations) {
    for (const rect of annotation.rects) {
      const mark = document.createElement("button");
      mark.className =
        annotation.kind === "note" ? "pdf-mark pdf-mark--note" : "pdf-mark";
      mark.style.left = `${rect.x * 100}%`;
      mark.style.top = `${rect.y * 100}%`;
      mark.style.width = `${rect.w * 100}%`;
      mark.style.height = `${rect.h * 100}%`;
      mark.style.background = annotation.color;
      mark.title = annotation.note || annotation.quote;
      mark.addEventListener("click", () => onOpen(annotation));
      layer.appendChild(mark);
    }
  }

  return layer;
}
