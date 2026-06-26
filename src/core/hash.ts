// Content hashing shared by the reader and the web import flow.
// Uses the platform's native crypto (off the main thread) over bytes already in
// memory — no extra file read (see skills/content-hashing).

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
