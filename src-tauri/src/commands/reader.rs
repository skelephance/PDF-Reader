// Progress tracker & annotation manager.
//
// Reads document bytes for the webview's PDF.js engine and persists reading
// progress. Everything is keyed to a document's content hash, never its path
// (see skills/content-hashing); all disk access stays in Rust
// (see skills/tauri-data-boundary). Annotations arrive in Phase 6.

use crate::error::AppError;
use crate::storage;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager};

/// Reading position for a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Progress {
    /// 1-based page the reader was last on.
    pub page: u32,
    /// Total pages, stored so the UI can show "n / total" before the PDF loads.
    pub pages: u32,
}

/// A rectangle normalized to its page box (0..1), so highlights re-locate at any
/// zoom or window size.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// A saved page bookmark, anchored to a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    /// 1-based page.
    pub page: u32,
    pub label: String,
}

/// A highlight or note anchored to a document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub id: String,
    /// 1-based page the annotation lives on.
    pub page: u32,
    /// "highlight" or "note".
    pub kind: String,
    /// Highlight tint (CSS color).
    pub color: String,
    /// The selected text — the durable "text signature" anchor.
    pub quote: String,
    /// Optional note body (for "note" kind).
    pub note: String,
    /// Selection rectangles, normalized to the page box.
    pub rects: Vec<Rect>,
}

/// Command: return the raw bytes of the document at `path`.
///
/// Returned as a raw IPC `Response`, which surfaces in JS as an `ArrayBuffer` —
/// far cheaper than serializing a byte array to JSON. The path is used only to
/// open the bytes; identity remains the content hash.
#[tauri::command]
pub async fn read_document(path: String) -> Result<Response, AppError> {
    let bytes = tokio::fs::read(&path).await?;
    Ok(Response::new(bytes))
}

/// Command: load saved progress for a document, or `None` if unread.
#[tauri::command]
pub fn get_progress(doc_hash: String, app: AppHandle) -> Result<Option<Progress>, AppError> {
    storage::read_json(&hashed_path(&app, "progress", &doc_hash)?)
}

/// Command: persist reading progress for a document.
#[tauri::command]
pub fn save_progress(
    doc_hash: String,
    progress: Progress,
    app: AppHandle,
) -> Result<(), AppError> {
    storage::write_json_atomic(&hashed_path(&app, "progress", &doc_hash)?, &progress)
}

/// Command: list all annotations for a document.
#[tauri::command]
pub fn list_annotations(doc_hash: String, app: AppHandle) -> Result<Vec<Annotation>, AppError> {
    let path = hashed_path(&app, "annotations", &doc_hash)?;
    Ok(storage::read_json(&path)?.unwrap_or_default())
}

/// Command: create or update an annotation (upsert by id).
#[tauri::command]
pub fn save_annotation(
    doc_hash: String,
    annotation: Annotation,
    app: AppHandle,
) -> Result<(), AppError> {
    let path = hashed_path(&app, "annotations", &doc_hash)?;
    let mut list: Vec<Annotation> = storage::read_json(&path)?.unwrap_or_default();
    match list.iter_mut().find(|a| a.id == annotation.id) {
        Some(existing) => *existing = annotation,
        None => list.push(annotation),
    }
    storage::write_json_atomic(&path, &list)
}

/// Command: delete an annotation by id.
#[tauri::command]
pub fn delete_annotation(doc_hash: String, id: String, app: AppHandle) -> Result<(), AppError> {
    let path = hashed_path(&app, "annotations", &doc_hash)?;
    let mut list: Vec<Annotation> = storage::read_json(&path)?.unwrap_or_default();
    list.retain(|a| a.id != id);
    storage::write_json_atomic(&path, &list)
}

/// Command: list all bookmarks for a document.
#[tauri::command]
pub fn list_bookmarks(doc_hash: String, app: AppHandle) -> Result<Vec<Bookmark>, AppError> {
    let path = hashed_path(&app, "bookmarks", &doc_hash)?;
    Ok(storage::read_json(&path)?.unwrap_or_default())
}

/// Command: create or update a bookmark (upsert by id).
#[tauri::command]
pub fn save_bookmark(
    doc_hash: String,
    bookmark: Bookmark,
    app: AppHandle,
) -> Result<(), AppError> {
    let path = hashed_path(&app, "bookmarks", &doc_hash)?;
    let mut list: Vec<Bookmark> = storage::read_json(&path)?.unwrap_or_default();
    match list.iter_mut().find(|b| b.id == bookmark.id) {
        Some(existing) => *existing = bookmark,
        None => list.push(bookmark),
    }
    storage::write_json_atomic(&path, &list)
}

/// Command: delete a bookmark by id.
#[tauri::command]
pub fn delete_bookmark(doc_hash: String, id: String, app: AppHandle) -> Result<(), AppError> {
    let path = hashed_path(&app, "bookmarks", &doc_hash)?;
    let mut list: Vec<Bookmark> = storage::read_json(&path)?.unwrap_or_default();
    list.retain(|b| b.id != id);
    storage::write_json_atomic(&path, &list)
}

/// Resolve `<app_data>/<subdir>/<hash>.json`, rejecting anything that isn't a
/// clean hex hash so a crafted value can't escape the data directory.
fn hashed_path(app: &AppHandle, subdir: &str, doc_hash: &str) -> Result<PathBuf, AppError> {
    if doc_hash.is_empty() || !doc_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::new("invalid document hash"));
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new(e.to_string()))?;
    Ok(dir.join(subdir).join(format!("{doc_hash}.json")))
}
