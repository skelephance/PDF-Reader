// Content for the routed annotation panel: shows the quoted selection, a note
// field, and save/delete actions. Presentational only — persistence and routing
// are the reader's job.

export interface AnnotationPanelContext {
  /** The selected text being annotated. */
  quote: string;
  /** Existing note text (empty when creating). */
  note: string;
  /** Whether a delete action should be offered (editing an existing one). */
  canDelete: boolean;
}

export interface AnnotationPanelHandlers {
  onSave: (note: string) => void;
  onDelete: () => void;
}

export function renderAnnotationPanel(
  ctx: AnnotationPanelContext,
  handlers: AnnotationPanelHandlers,
): HTMLElement {
  const body = document.createElement("div");
  body.className = "annotate";

  const quote = document.createElement("blockquote");
  quote.className = "annotate__quote";
  quote.textContent = ctx.quote;

  const textarea = document.createElement("textarea");
  textarea.className = "annotate__input";
  textarea.placeholder = "Add a note (optional)…";
  textarea.value = ctx.note;
  textarea.rows = 6;

  const actions = document.createElement("div");
  actions.className = "annotate__actions";

  const save = document.createElement("button");
  save.className = "annotate__save";
  save.textContent = "Save";
  save.addEventListener("click", () => handlers.onSave(textarea.value.trim()));
  actions.appendChild(save);

  if (ctx.canDelete) {
    const del = document.createElement("button");
    del.className = "annotate__delete";
    del.textContent = "Delete";
    del.addEventListener("click", () => handlers.onDelete());
    actions.appendChild(del);
  }

  body.append(quote, textarea, actions);
  // Focus shortly after the panel slides in.
  window.setTimeout(() => textarea.focus(), 50);
  return body;
}
