// Library View — folder system tree & metadata display.
//
// Flow: resolve the saved root (or prompt the user to pick one), scan it via the
// Rust systems layer, render the hash-cataloged tree, and keep it live by
// re-scanning when the backend reports a filesystem change. The UI never touches
// the filesystem itself (see skills/tauri-data-boundary).

import {
  scanLibrary,
  getLibraryRoot,
  setLibraryRoot,
  watchLibrary,
  onLibraryChanged,
  pickLibraryFolder,
  appDocumentsDir,
  type FolderNode,
} from "@/core/library";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ViewController } from "@/core/view";
import { renderFolderTree, countDocuments } from "./FolderTree";

export function createLibraryView(): ViewController {
  const el = document.createElement("section");
  el.className = "app-shell__view";

  let root: string | null = null;
  let unlisten: UnlistenFn | null = null;
  let rescanTimer: number | undefined;
  let disposed = false;

  void mount();

  async function mount(): Promise<void> {
    root = await getLibraryRoot();
    if (disposed) return;
    if (!root) {
      renderEmpty();
      return;
    }
    await ensureLive(root);
    await refresh(root);
  }

  async function ensureLive(dir: string): Promise<void> {
    if (!unlisten) {
      unlisten = await onLibraryChanged(() => {
        window.clearTimeout(rescanTimer);
        rescanTimer = window.setTimeout(() => {
          if (!disposed && root) void refresh(root);
        }, 250);
      });
    }
    await watchLibrary(dir).catch(() => {
      /* watching is best-effort; manual refresh still works */
    });
  }

  async function refresh(dir: string): Promise<void> {
    try {
      const tree = await scanLibrary(dir);
      if (disposed) return;
      el.replaceChildren(toolbar(), body(tree));
    } catch (err) {
      if (disposed) return;
      el.replaceChildren(toolbar(), message(`Couldn't read that folder: ${String(err)}`));
    }
  }

  function body(tree: FolderNode): HTMLElement {
    return countDocuments(tree) === 0
      ? message("No PDFs found in this folder yet.")
      : renderFolderTree(tree);
  }

  function toolbar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "library-toolbar";
    bar.append(
      action("Refresh", () => {
        if (root) void refresh(root);
      }),
      action("Change folder", choose),
    );
    return bar;
  }

  function renderEmpty(): void {
    const wrap = document.createElement("div");
    wrap.className = "placeholder";
    const buttons = document.createElement("div");
    buttons.className = "library-toolbar";
    buttons.append(
      action("Use Documents folder", useDocuments),
      action("Choose folder", choose),
    );
    wrap.append(
      card("Add PDFs to the app's Documents folder (via the Files app), or choose any folder to mirror as your library."),
      buttons,
    );
    el.replaceChildren(wrap);
  }

  async function choose(): Promise<void> {
    const picked = await pickLibraryFolder();
    if (!picked || disposed) return;
    await useRoot(picked);
  }

  async function useDocuments(): Promise<void> {
    const dir = await appDocumentsDir().catch(() => null);
    if (!dir || disposed) return;
    await useRoot(dir);
  }

  async function useRoot(dir: string): Promise<void> {
    await setLibraryRoot(dir);
    root = dir;
    await ensureLive(dir);
    await refresh(dir);
  }

  return {
    el,
    update() {
      /* Library has no sub-routes; nothing to update. */
    },
    destroy() {
      disposed = true;
      window.clearTimeout(rescanTimer);
      unlisten?.();
      unlisten = null;
    },
  };
}

// --- small DOM helpers ---

function action(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "library-toolbar__action";
  btn.textContent = label;
  btn.addEventListener("click", () => void onClick());
  return btn;
}

function card(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "placeholder__card";
  el.textContent = text;
  return el;
}

function message(text: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "placeholder";
  wrap.appendChild(card(text));
  return wrap;
}
