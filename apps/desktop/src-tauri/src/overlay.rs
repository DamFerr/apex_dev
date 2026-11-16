//! Overlay window groundwork: transparent, always on top, no taskbar entry, and click-through
//! (mouse events pass to the game). Not reachable from the UI yet; it returns when the overlay has real content.
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

// async so window creation does not block the main thread (a known deadlock risk on Windows).
#[tauri::command]
pub async fn set_overlay(app: AppHandle, visible: bool) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        if visible { w.show().map_err(|e| e.to_string())?; } else { w.hide().map_err(|e| e.to_string())?; }
        return Ok(());
    }
    if !visible { return Ok(()); }
    let w = WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("index.html".into()))
        .title("Apex Overlay")
        .inner_size(360.0, 160.0)
        .position(24.0, 120.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    Ok(())
}
