// A single document tile. Clicking it opens the reader via the UniversalRouter
// — never by directly swapping views (see skills/router-isolation). The route
// carries the path; the reader derives the content hash from the bytes on open
// (see skills/content-hashing).

import { router } from "@/core/navigation";
import type { DocumentNode } from "@/core/library";

export function renderDocumentTile(doc: DocumentNode): HTMLElement {
  const tile = document.createElement("button");
  tile.className = "doc-tile";

  tile.addEventListener("click", () =>
    router.navigate({
      view: "reader",
      data: { path: doc.path },
    }),
  );

  const name = document.createElement("span");
  name.className = "doc-tile__name";
  name.textContent = doc.name;

  const meta = document.createElement("span");
  meta.className = "doc-tile__meta";
  meta.textContent = formatSize(doc.size);

  tile.append(name, meta);
  return tile;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
