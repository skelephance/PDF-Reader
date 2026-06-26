// Async directory traverser & tree scanner.
//
// Traverses a public directory, mirroring its structure without mutating any
// source file, and catalogs every PDF by its SHA-256 content hash (see
// commands/crypto.rs and skills/content-hashing). All I/O runs asynchronously
// off the UI thread.

use crate::error::AppError;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::future::Future;
use std::path::Path;
use std::pin::Pin;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Holds the active filesystem watcher. Kept in Tauri-managed state so it lives
/// as long as the app; replacing it drops (and stops) the previous watcher.
#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

/// A discovered document. The content hash (its durable identity) is computed
/// lazily when the document is opened — not during the scan — so the library
/// appears instantly even for large collections (see skills/content-hashing).
#[derive(Debug, Serialize)]
pub struct DocumentNode {
    pub name: String,
    /// Current location, used to open the bytes and derive the content hash.
    pub path: String,
    pub size: u64,
}

/// A folder in the mirrored tree.
#[derive(Debug, Serialize)]
pub struct FolderNode {
    pub name: String,
    pub path: String,
    pub folders: Vec<FolderNode>,
    pub documents: Vec<DocumentNode>,
}

/// Command: scan `root` and return the mirrored folder/document tree.
#[tauri::command]
pub async fn scan_library(root: String) -> Result<FolderNode, AppError> {
    scan_dir(Path::new(&root)).await
}

/// Event emitted to the webview whenever the watched library changes. The
/// frontend debounces these and re-scans (see skills/router-isolation note:
/// this is data flow, not navigation).
const LIBRARY_CHANGED: &str = "library:changed";

/// Command: watch `root` recursively and emit `library:changed` on any change,
/// so the UI mirrors external modifications in real time without polling.
/// Calling again with a new root transparently replaces the previous watcher.
#[tauri::command]
pub fn watch_library(
    root: String,
    app: AppHandle,
    state: State<'_, WatcherState>,
) -> Result<(), AppError> {
    let handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        // Fire on any successful event; the frontend coalesces the bursts.
        if res.is_ok() {
            let _ = handle.emit(LIBRARY_CHANGED, ());
        }
    })
    .map_err(|e| AppError::new(e.to_string()))?;

    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| AppError::new(e.to_string()))?;

    // Replacing the stored watcher drops the old one, stopping prior watches.
    *state.0.lock().map_err(|e| AppError::new(e.to_string()))? = Some(watcher);
    Ok(())
}

/// Recursively scan a directory. Boxed because async fns can't recurse directly.
fn scan_dir<'a>(
    dir: &'a Path,
) -> Pin<Box<dyn Future<Output = Result<FolderNode, AppError>> + Send + 'a>> {
    Box::pin(async move {
        let mut folders = Vec::new();
        let mut documents = Vec::new();

        let mut entries = tokio::fs::read_dir(dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            let file_type = entry.file_type().await?;

            if file_type.is_dir() {
                folders.push(scan_dir(&path).await?);
            } else if file_type.is_file() && is_pdf(&path) {
                let size = entry.metadata().await?.len();
                documents.push(DocumentNode {
                    name: file_name(&path),
                    path: path.to_string_lossy().into_owned(),
                    size,
                });
            }
        }

        // Stable ordering so the UI doesn't reshuffle between scans.
        folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        documents.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        Ok(FolderNode {
            name: file_name(dir),
            path: dir.to_string_lossy().into_owned(),
            folders,
            documents,
        })
    })
}

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}
