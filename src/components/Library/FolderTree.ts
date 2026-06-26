// Renders a mirrored library tree: documents as a tile grid, subfolders nested
// recursively beneath their name. Purely presentational — all data came from
// the Rust scan (see skills/tauri-data-boundary).

import type { FolderNode } from "@/core/library";
import { renderDocumentTile } from "./DocumentTile";

export function renderFolderTree(node: FolderNode, isRoot = true): HTMLElement {
  const section = document.createElement("section");
  section.className = isRoot ? "folder folder--root" : "folder";

  if (!isRoot) {
    const heading = document.createElement("h2");
    heading.className = "folder__name";
    heading.textContent = node.name;
    section.appendChild(heading);
  }

  if (node.documents.length) {
    const grid = document.createElement("div");
    grid.className = "doc-grid";
    for (const doc of node.documents) grid.appendChild(renderDocumentTile(doc));
    section.appendChild(grid);
  }

  for (const folder of node.folders) {
    section.appendChild(renderFolderTree(folder, false));
  }

  return section;
}

/** Total document count across the whole tree (for empty-state messaging). */
export function countDocuments(node: FolderNode): number {
  return (
    node.documents.length +
    node.folders.reduce((sum, f) => sum + countDocuments(f), 0)
  );
}
