// App settings persistence.
//
// Remembers the user's chosen library root across launches. Stored as JSON in
// the app data dir via the transactional storage engine — the webview never
// touches this file directly (see skills/tauri-data-boundary).

use crate::error::AppError;
use crate::storage;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Settings {
    /// The mirrored library directory the user selected, if any.
    pub library_root: Option<String>,
    /// Reading theme id ("day" | "night" | "sepia"); None means default.
    pub reading_theme: Option<String>,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new(e.to_string()))?;
    Ok(dir.join("settings.json"))
}

fn load(app: &AppHandle) -> Result<Settings, AppError> {
    let path = settings_path(app)?;
    Ok(storage::read_json(&path)?.unwrap_or_default())
}

/// Command: return the saved library root, or `None` on first run.
#[tauri::command]
pub fn get_library_root(app: AppHandle) -> Result<Option<String>, AppError> {
    Ok(load(&app)?.library_root)
}

/// Command: persist the chosen library root.
#[tauri::command]
pub fn set_library_root(root: String, app: AppHandle) -> Result<(), AppError> {
    let mut settings = load(&app)?;
    settings.library_root = Some(root);
    storage::write_json_atomic(&settings_path(&app)?, &settings)?;
    Ok(())
}

/// Command: return the saved reading theme, or `None` for the default.
#[tauri::command]
pub fn get_reading_theme(app: AppHandle) -> Result<Option<String>, AppError> {
    Ok(load(&app)?.reading_theme)
}

/// Command: persist the chosen reading theme.
#[tauri::command]
pub fn set_reading_theme(theme: String, app: AppHandle) -> Result<(), AppError> {
    let mut settings = load(&app)?;
    settings.reading_theme = Some(theme);
    storage::write_json_atomic(&settings_path(&app)?, &settings)?;
    Ok(())
}

/// Command: the app's Documents directory. On iOS this is the in-sandbox folder
/// the Files app exposes (when UIFileSharingEnabled is set), so users can drop
/// PDFs in and the library can read them without security-scoped bookmarks.
#[tauri::command]
pub fn app_documents_dir(app: AppHandle) -> Result<String, AppError> {
    let dir = app
        .path()
        .document_dir()
        .map_err(|e| AppError::new(e.to_string()))?;
    Ok(dir.to_string_lossy().into_owned())
}
