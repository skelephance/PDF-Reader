// Thread-isolated core capabilities. Each module exposes `#[tauri::command]`
// handlers that the webview invokes; the webview never touches disk directly.

pub mod crypto;
pub mod library;
pub mod reader;
pub mod settings;
