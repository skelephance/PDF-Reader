// Non-blocking SHA-256 calculation utility.
//
// Computes an unalterable SHA-256 hash from a file's raw binary content. This
// hash is the document's permanent identity — annotations, progress, bookmarks,
// and asset pairings all lock to it (see skills/content-hashing).
//
// The file is streamed in chunks on Tokio's async runtime, so even large
// documents never block discovery or the UI thread.

use crate::error::AppError;
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::AsyncReadExt;

const CHUNK: usize = 64 * 1024;

/// Hash a file's raw bytes and return the lowercase hex digest.
/// Internal helper so other commands (e.g. the library scan) can reuse it.
pub async fn hash_file(path: &Path) -> Result<String, AppError> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; CHUNK];

    loop {
        let n = file.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }

    Ok(to_hex(hasher.finalize().as_slice()))
}

/// Command: hash the document at `path`, returning its content identity.
#[tauri::command]
pub async fn hash_document(path: String) -> Result<String, AppError> {
    hash_file(Path::new(&path)).await
}

fn to_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(s, "{:02x}", b);
    }
    s
}
