// Libra-Local — systems layer entry.
//
// Owns application lifecycle and the command router. All filesystem access,
// content hashing, and data persistence are performed here in async Rust
// commands — never in the webview (see skills/tauri-data-boundary).

mod commands;
mod error;
mod storage;

/// Shared application bootstrap. Invoked by the desktop entry (`main.rs`) and,
/// on iOS, by the Tauri mobile entry-point macro below.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::library::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            commands::crypto::hash_document,
            commands::library::scan_library,
            commands::library::watch_library,
            commands::settings::get_library_root,
            commands::settings::set_library_root,
            commands::settings::get_reading_theme,
            commands::settings::set_reading_theme,
            commands::settings::app_documents_dir,
            commands::reader::read_document,
            commands::reader::get_progress,
            commands::reader::save_progress,
            commands::reader::list_annotations,
            commands::reader::save_annotation,
            commands::reader::delete_annotation,
            commands::reader::list_bookmarks,
            commands::reader::save_bookmark,
            commands::reader::delete_bookmark,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Libra-Local");
}
