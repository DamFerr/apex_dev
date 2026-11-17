//! In-game overlay window: transparent, always on top, no taskbar entry, and click-through
//! (mouse events pass to the game). The main window decides what it shows and when (see src/lib/overlay.ts).
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 340.0;
const MARGIN: f64 = 24.0;
/// Top corners sit a little lower, below the game's own top bar and minimap-free area.
const TOP_OFFSET: f64 = 120.0;

/// Puts the window in one of the four screen corners of the primary monitor ("top-left", "top-right", "bottom-left", "bottom-right").
fn place(w: &WebviewWindow, corner: &str) -> Result<(), String> {
    if !matches!(corner, "top-left" | "top-right" | "bottom-left" | "bottom-right") {
        return Err(format!("unknown corner: {corner}"));
    }
    let m = w.primary_monitor().map_err(|e| e.to_string())?.ok_or("no monitor found")?;
    let (s, origin, size) = (m.scale_factor(), m.position(), m.size());
    let x = if corner.ends_with("right") { size.width as f64 - (WIDTH + MARGIN) * s } else { MARGIN * s };
    let y = if corner.starts_with("bottom") { size.height as f64 - (HEIGHT + MARGIN) * s } else { TOP_OFFSET * s };
    w.set_position(PhysicalPosition::new(origin.x as f64 + x, origin.y as f64 + y)).map_err(|e| e.to_string())
}

// async so window creation does not block the main thread (a known deadlock risk on Windows).
#[tauri::command]
pub async fn set_overlay(app: AppHandle, visible: bool, corner: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        if visible { place(&w, &corner)?; w.show().map_err(|e| e.to_string())?; } else { w.hide().map_err(|e| e.to_string())?; }
        return Ok(());
    }
    if !visible { return Ok(()); }
    let w = WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("index.html".into()))
        .title("Apex Overlay")
        .inner_size(WIDTH, HEIGHT)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;
    // Never takes mouse input from the game.
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    place(&w, &corner)
}
