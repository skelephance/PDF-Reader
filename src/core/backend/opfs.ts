// Origin Private File System storage for imported PDFs (web target). Files are
// named by their content hash, so identity is the same as everywhere else.

async function root(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

export async function writeFile(id: string, data: ArrayBuffer): Promise<void> {
  const handle = await (await root()).getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function readFile(id: string): Promise<ArrayBuffer> {
  const handle = await (await root()).getFileHandle(id);
  const file = await handle.getFile();
  return file.arrayBuffer();
}

export async function deleteFile(id: string): Promise<void> {
  try {
    await (await root()).removeEntry(id);
  } catch {
    /* already gone */
  }
}
