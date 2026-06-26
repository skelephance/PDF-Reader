// Library view for the web/PWA target: import PDFs into the app's private
// storage and open them. Opening routes through the UniversalRouter exactly like
// the desktop library (see skills/router-isolation); the route carries the
// document's content id as its open ref.

import { router } from "@/core/navigation";
import type { ViewController } from "@/core/view";
import {
  listWebDocs,
  importWebDocs,
  deleteWebDoc,
  type WebDoc,
} from "@/core/weblibrary";

export function createWebLibraryView(): ViewController {
  const el = document.createElement("section");
  el.className = "app-shell__view";
  let disposed = false;

  void render();

  async function render(): Promise<void> {
    const docs = await listWebDocs().catch(() => [] as WebDoc[]);
    if (disposed) return;
    el.replaceChildren(toolbar(), docs.length ? grid(docs) : empty());
  }

  function toolbar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "library-toolbar";
    bar.appendChild(action("Import PDFs", doImport));
    return bar;
  }

  function empty(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "placeholder";
    const card = document.createElement("div");
    card.className = "placeholder__card";
    card.textContent =
      "Import PDFs to build your library. They're stored privately in this app and available offline.";
    wrap.appendChild(card);
    return wrap;
  }

  function grid(docs: WebDoc[]): HTMLElement {
    const g = document.createElement("div");
    g.className = "doc-grid";
    for (const doc of docs) g.appendChild(tile(doc));
    return g;
  }

  function tile(doc: WebDoc): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "doc-tile-wrap";

    const open = document.createElement("button");
    open.className = "doc-tile";
    open.addEventListener("click", () =>
      router.navigate({ view: "reader", data: { path: doc.id } }),
    );
    const name = document.createElement("span");
    name.className = "doc-tile__name";
    name.textContent = doc.name;
    const meta = document.createElement("span");
    meta.className = "doc-tile__meta";
    meta.textContent = formatSize(doc.size);
    open.append(name, meta);

    const del = document.createElement("button");
    del.className = "doc-tile__delete";
    del.textContent = "✕";
    del.title = "Remove";
    del.addEventListener("click", async () => {
      await deleteWebDoc(doc.id);
      if (!disposed) void render();
    });

    wrap.append(open, del);
    return wrap;
  }

  async function doImport(): Promise<void> {
    await importWebDocs().catch(() => 0);
    if (!disposed) void render();
  }

  return {
    el,
    update() {
      /* no sub-routes */
    },
    destroy() {
      disposed = true;
    },
  };
}

function action(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "library-toolbar__action";
  btn.textContent = label;
  btn.addEventListener("click", () => void onClick());
  return btn;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
