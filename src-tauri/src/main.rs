// Libra-Local — desktop entry point.
//
// Application lifecycle and the command router live in `lib.rs::run()` so the
// same setup can be shared with the Tauri v2 mobile (iOS) entry point.
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    libra_local_lib::run();
}
