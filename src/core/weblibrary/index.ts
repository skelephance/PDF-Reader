// Web library: imported PDFs live in the app's private storage (OPFS) and a
// manifest of them in IndexedDB. Each document's id is its content hash, so
// identity matches the rest of the app (see skills/content-hashing).

import { sha256Hex } from "@/core/hash";
import { idbGetAll, idbSet, idbDelete } from "@/core/backend/idb";
import { writeFile, deleteFile } from "@/core/backend/opfs";

export interface WebDoc {
  /** Content hash — also the OPFS file name and the reader's open ref. */
  id: string;
  name: string;
  size: number;
}

/** All imported documents, newest-friendly (sorted by name). */
export async function listWebDocs(): Promise<WebDoc[]> {
  const docs = await idbGetAll<WebDoc>("docs");
  return docs.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** Prompt to pick PDFs and import them. Returns the number added. */
export async function importWebDocs(): Promise<number> {
  const files = await pickFiles();
  let added = 0;
  for (const file of files) {
    const buf = await file.arrayBuffer();
    const id = await sha256Hex(buf);
    await writeFile(id, buf);
    await idbSet<WebDoc>("docs", id, { id, name: file.name, size: file.size });
    added++;
  }
  return added;
}

/** Remove a document and its associated data. */
export async function deleteWebDoc(id: string): Promise<void> {
  await deleteFile(id);
  await idbDelete("docs", id);
  await idbDelete("progress", id);
  await idbDelete("annotations", id);
  await idbDelete("bookmarks", id);
}

function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.multiple = true;
    input.addEventListener("change", () =>
      resolve(input.files ? Array.from(input.files) : []),
    );
    input.click();
  });
}
