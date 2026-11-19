// Native core. Later steps add modules here: live_client, store.
mod lcu;
mod overlay;

use tauri::Manager; // window.app_handle() and get_webview_window()

pub fn run() {
    tauri::Builder::default()
        // Remembers window size and position between launches.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            lcu::lcu_sync, lcu::lcu_request,
            overlay::set_overlay, overlay::overlay_card, overlay::overlay_layout, overlay::overlay_move, overlay::overlay_drag_begin, overlay::overlay_drag_end
        ])
        // The overlay has no taskbar entry, so it must not keep Apex running after the main window is closed.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    if let Some(o) = window.app_handle().get_webview_window("overlay") { let _ = o.destroy(); }
                }
            }
        })
        .setup(|app| {
            lcu::start(app.handle().clone());
            overlay::start(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Apex");
}
