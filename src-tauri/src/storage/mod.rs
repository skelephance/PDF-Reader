// Transactional atomic JSON file engine.
//
// Durable read/write of catalog and per-document data. Writes are atomic
// (write-to-temp + rename on the same filesystem) so a crash mid-write can
// never leave a half-written, corrupt file. All persistence flows through here
// — no command writes data files directly (see skills/tauri-data-boundary).

use crate::error::AppError;
use serde::{de::DeserializeOwned, Serialize};
use std::path::{Path, PathBuf};

/// Read and deserialize JSON from `path`. Returns `Ok(None)` if the file does
/// not exist yet (a normal first-run state), `Err` only on real failures.
pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, AppError> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(Some(serde_json::from_slice(&bytes)?)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Serialize `value` to JSON and write it atomically to `path`.
///
/// Strategy: ensure the parent dir exists, write to a sibling temp file, flush
/// it to disk, then rename over the target. `rename` is atomic within a
/// filesystem, so readers always see either the old file or the complete new
/// one — never a partial write.
pub fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let data = serde_json::to_vec_pretty(value)?;
    let tmp = temp_sibling(path);

    {
        use std::io::Write;
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(&data)?;
        f.sync_all()?; // durability before the rename
    }

    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// A temp path next to `path` (same directory => same filesystem => atomic
/// rename). Includes the original file name so concurrent writes to different
/// keys don't collide.
fn temp_sibling(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "data".into());
    path.with_file_name(format!(".{name}.tmp"))
}
