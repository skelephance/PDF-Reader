// Renders an extracted PDF outline (table of contents) as a nested list.
// Purely presentational; resolving a destination to a page number and scrolling
// is the reader's job (passed in as `onSelect`).

/** A node from PDF.js `getOutline()` (loosely typed — the dest shape varies). */
export interface OutlineItem {
  title: string;
  dest: unknown;
  items: OutlineItem[];
}

export function renderOutline(
  items: OutlineItem[],
  onSelect: (dest: unknown) => void,
): HTMLElement {
  const list = document.createElement("ul");
  list.className = "toc-list";

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "toc-item";

    const entry = document.createElement("button");
    entry.className = "toc-entry";
    entry.textContent = item.title;
    entry.addEventListener("click", () => onSelect(item.dest));
    li.appendChild(entry);

    if (item.items && item.items.length) {
      li.appendChild(renderOutline(item.items, onSelect));
    }
    list.appendChild(li);
  }

  return list;
}
