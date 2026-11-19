//! In-game overlay window: transparent, always on top, no taskbar entry, never takes keyboard focus. It is click-through
//! (mouse events pass to the game) EVERYWHERE EXCEPT over the card, which takes the mouse so it can be dragged (D.4).
//! The main window decides what it shows and when (see src/lib/overlay.ts). No input is ever sent to the game.
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 340.0;
const MARGIN: f64 = 24.0;
/// Top corners sit a little lower, below the game's own top bar and minimap-free area.
const TOP_OFFSET: f64 = 120.0;

/// The card's rectangle inside the overlay window, in logical pixels from the window's top-left (reported by the overlay page).
#[derive(Clone, Copy)]
pub struct CardRect { x: f64, y: f64, w: f64, h: f64 }

/// Shared state: where the card is (None = no card, everything click-through) and whether a drag is in progress.
#[derive(Default)]
pub struct OverlayState { card: Mutex<Option<CardRect>>, dragging: AtomicBool }

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
pub async fn set_overlay(app: AppHandle, visible: bool, corner: String, x: Option<i32>, y: Option<i32>) -> Result<(), String> {
    // A saved free position (absolute physical pixels, already clamped by the caller) wins over the corner preset.
    let put = |w: &WebviewWindow| match (x, y) {
        (Some(x), Some(y)) => w.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string()),
        _ => place(w, &corner),
    };
    if let Some(w) = app.get_webview_window("overlay") {
        if visible { put(&w)?; w.show().map_err(|e| e.to_string())?; } else { w.hide().map_err(|e| e.to_string())?; }
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
        // No-activate: clicking the card must not take keyboard focus from the game.
        .focusable(false)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;
    // Click-through by default; `start` below lets the mouse in only while the cursor is over the card.
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    put(&w)
}

/// The overlay page reports where its card is (logical px inside the window); w or h of 0 means "no card".
#[tauri::command]
pub fn overlay_card(state: State<'_, OverlayState>, x: f64, y: f64, w: f64, h: f64) {
    *state.card.lock().unwrap() = if w > 0.0 && h > 0.0 { Some(CardRect { x, y, w, h }) } else { None };
}

/// The page tells us a drag started or ended, so the card keeps the mouse for the whole drag even if the cursor lags behind the window.
#[tauri::command]
pub fn overlay_dragging(state: State<'_, OverlayState>, on: bool) { state.dragging.store(on, Ordering::Relaxed); }

/// Monitors and the overlay window's rectangle, all in physical pixels, in the shape of `MonitorInfo` (packages/lcu-core/src/overlay.ts),
/// for `clampOverlayPosition` in TypeScript: `{ monitors: [{ id, x, y, width, height, scale, primary }], window: { x, y, width, height } }`.
#[tauri::command]
pub fn overlay_layout(app: AppHandle) -> Result<Value, String> {
    let w = app.get_webview_window("overlay").ok_or("overlay is not open")?;
    let primary = w.primary_monitor().map_err(|e| e.to_string())?;
    let monitors: Vec<Value> = w.available_monitors().map_err(|e| e.to_string())?.iter().enumerate().map(|(i, m)| json!({
        "id": m.name().cloned().unwrap_or_else(|| format!("monitor-{i}")),
        "x": m.position().x, "y": m.position().y, "width": m.size().width, "height": m.size().height, "scale": m.scale_factor(),
        "primary": primary.as_ref().map_or(false, |p| p.position() == m.position() && p.size() == m.size()),
    })).collect();
    let (p, s) = (w.outer_position().map_err(|e| e.to_string())?, w.outer_size().map_err(|e| e.to_string())?);
    Ok(json!({ "monitors": monitors, "window": { "x": p.x, "y": p.y, "width": s.width, "height": s.height } }))
}

/// Moves the overlay window to an absolute physical position (after a drag, once the spot has been clamped onto a monitor).
#[tauri::command]
pub fn overlay_move(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let w = app.get_webview_window("overlay").ok_or("overlay is not open")?;
    w.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string())
}

/// Is the mouse cursor over the card right now? None when the OS cannot tell.
fn over_card(w: &WebviewWindow, c: CardRect) -> Option<bool> {
    if !w.is_visible().ok()? { return Some(false); }
    let (cur, pos, s) = (w.cursor_position().ok()?, w.outer_position().ok()?, w.scale_factor().ok()?);
    let (lx, ly) = ((cur.x - pos.x as f64) / s, (cur.y - pos.y as f64) / s);
    Some(lx >= c.x && lx <= c.x + c.w && ly >= c.y && ly <= c.y + c.h)
}

/// Starts the hit-test loop (call once from `setup`). About 25 times a second it switches the overlay between click-through and
/// "takes the mouse" depending on whether the cursor is over the card (or a drag is running). It only reads the cursor position over
/// Apex's own window; nothing is sent to the game and no game state is read.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut takes_mouse = false; // what the window is currently set to (it is created click-through)
        let mut tick = tokio::time::interval(Duration::from_millis(40));
        loop {
            tick.tick().await;
            let Some(w) = app.get_webview_window("overlay") else { takes_mouse = false; continue };
            let state = app.state::<OverlayState>();
            let card = *state.card.lock().unwrap();
            let want = if state.dragging.load(Ordering::Relaxed) { true } else {
                match card { Some(c) => over_card(&w, c).unwrap_or(false), None => false }
            };
            if want != takes_mouse && w.set_ignore_cursor_events(!want).is_ok() { takes_mouse = want; }
        }
    });
}
