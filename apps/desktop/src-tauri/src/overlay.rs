//! In-game overlay window: transparent, always on top, no taskbar entry, never takes keyboard focus. It is click-through
//! (mouse events pass to the game) ALWAYS, except for a LEFT-button press that starts on the card: that press (and its drag) goes to
//! the card so it can be moved (D.4). Right/middle clicks, hover, wheel and every click outside the card reach the game, and the
//! cursor stays the game's own. The main window decides what it shows and when (see src/lib/overlay.ts). No input is ever sent to the game.
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 340.0;
const MARGIN: f64 = 24.0;
/// Top corners sit a little lower, below the game's own top bar and minimap-free area.
const TOP_OFFSET: f64 = 120.0;

/// The card's rectangle inside the overlay window, in logical pixels from the window's top-left (reported by the overlay page).
#[derive(Clone, Copy)]
#[cfg_attr(windows, allow(dead_code))] // read only by the non-Windows fallback
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
    // Click-through by default; the mouse hook (`start`) lets a left press on the card in, and only that.
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    if let Ok(h) = w.hwnd() { hook::OVERLAY_HWND.store(h.0 as isize, Ordering::Relaxed); }
    put(&w)
}

/// The overlay page reports where its card is (logical px inside the window); w or h of 0 means "no card".
#[tauri::command]
pub fn overlay_card(app: AppHandle, state: State<'_, OverlayState>, x: f64, y: f64, w: f64, h: f64) {
    *state.card.lock().unwrap() = if w > 0.0 && h > 0.0 { Some(CardRect { x, y, w, h }) } else { None };
    #[cfg(windows)]
    {
        let scale = app.get_webview_window("overlay").and_then(|o| o.scale_factor().ok()).unwrap_or(1.0);
        hook::set_card(if w > 0.0 && h > 0.0 { Some((x, y, w, h)) } else { None }, scale);
    }
    #[cfg(not(windows))]
    let _ = app;
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

/// Windows: a low-level mouse hook (WH_MOUSE_LL). The hook sees every mouse message BEFORE it is routed to a window, so it can make the
/// overlay accept a left press that lands on the card (no race, unlike polling the cursor) and leave every other button to the game.
/// It only reads the button and the cursor position; it never blocks, changes or sends any input (it always calls the next hook).
#[cfg(windows)]
mod hook {
    use std::sync::atomic::{AtomicBool, AtomicI32, AtomicIsize, AtomicU64, Ordering::Relaxed};
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    /// The overlay's native window handle (0 = not created yet).
    pub static OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);
    /// The card rectangle in logical px inside the window (x, y, w, h; w == 0 means no card) and the window's scale factor (f64 bits).
    static CARD: [AtomicI32; 4] = [AtomicI32::new(0), AtomicI32::new(0), AtomicI32::new(0), AtomicI32::new(0)];
    static SCALE: AtomicU64 = AtomicU64::new(0x3FF0_0000_0000_0000); // 1.0
    /// True while a left press that started on the card owns the mouse.
    static TAKING: AtomicBool = AtomicBool::new(false);

    pub fn set_card(rect: Option<(f64, f64, f64, f64)>, scale: f64) {
        let (x, y, w, h) = rect.unwrap_or((0.0, 0.0, 0.0, 0.0));
        for (a, v) in CARD.iter().zip([x, y, w, h]) { a.store(v.round() as i32, Relaxed); }
        SCALE.store(scale.to_bits(), Relaxed);
    }

    /// Switches the window between click-through (WS_EX_TRANSPARENT set) and normal hit-testing, immediately.
    unsafe fn set_click_through(hwnd: HWND, on: bool) {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let want = if on { ex | WS_EX_TRANSPARENT as isize } else { ex & !(WS_EX_TRANSPARENT as isize) };
        if want != ex { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, want); }
    }

    /// Is the screen point (physical px) on the card? The window rect is read live, so a moved window needs no update.
    unsafe fn on_card(hwnd: HWND, px: i32, py: i32) -> bool {
        let w = CARD[2].load(Relaxed);
        if w <= 0 || IsWindowVisible(hwnd) == 0 { return false; }
        let mut r: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut r) == 0 { return false; }
        let s = f64::from_bits(SCALE.load(Relaxed));
        let (x0, y0) = (r.left as f64 + CARD[0].load(Relaxed) as f64 * s, r.top as f64 + CARD[1].load(Relaxed) as f64 * s);
        let (x1, y1) = (x0 + w as f64 * s, y0 + CARD[3].load(Relaxed) as f64 * s);
        (px as f64) >= x0 && (px as f64) < x1 && (py as f64) >= y0 && (py as f64) < y1
    }

    unsafe extern "system" fn proc(code: i32, wp: usize, lp: isize) -> isize {
        let hwnd = OVERLAY_HWND.load(Relaxed) as HWND;
        if code == HC_ACTION as i32 && !hwnd.is_null() {
            match wp as u32 {
                WM_LBUTTONDOWN => {
                    let pt = (*(lp as *const MSLLHOOKSTRUCT)).pt;
                    if on_card(hwnd, pt.x, pt.y) { set_click_through(hwnd, false); TAKING.store(true, Relaxed); }
                }
                // Drag over: give the mouse back to the game. Any other button ends it too (safety net if an up event was missed).
                WM_LBUTTONUP | WM_RBUTTONDOWN | WM_MBUTTONDOWN | WM_XBUTTONDOWN => {
                    if TAKING.swap(false, Relaxed) { set_click_through(hwnd, true); }
                }
                _ => {}
            }
        }
        CallNextHookEx(std::ptr::null_mut(), code, wp, lp)
    }

    /// Runs the hook on its own thread (a low-level hook needs a message loop on the thread that installed it).
    pub fn start() {
        std::thread::spawn(|| unsafe {
            let h = SetWindowsHookExW(WH_MOUSE_LL, Some(proc), GetModuleHandleW(std::ptr::null()), 0);
            if h.is_null() { eprintln!("overlay: could not install the mouse hook, the card cannot be dragged"); return; }
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 { TranslateMessage(&msg); DispatchMessageW(&msg); }
        });
    }
}

/// Starts the drag handling (call once from `setup`). Windows: the mouse hook above. Other systems (development only): hover over the
/// card lets the mouse in, polled 25 times a second, because there is no hook; Apex itself ships for Windows.
pub fn start(app: AppHandle) {
    #[cfg(windows)]
    { let _ = app; hook::start(); }
    #[cfg(not(windows))]
    tauri::async_runtime::spawn(async move {
        let mut takes_mouse = false;
        let mut tick = tokio::time::interval(std::time::Duration::from_millis(40));
        loop {
            tick.tick().await;
            let Some(w) = app.get_webview_window("overlay") else { takes_mouse = false; continue };
            let state = app.state::<OverlayState>();
            let card = *state.card.lock().unwrap();
            let want = state.dragging.load(Ordering::Relaxed) || card.map_or(false, |c| over_card(&w, c).unwrap_or(false));
            if want != takes_mouse && w.set_ignore_cursor_events(!want).is_ok() { takes_mouse = want; }
        }
    });
}

/// Non-Windows fallback only: is the mouse cursor over the card right now? None when the OS cannot tell.
#[cfg(not(windows))]
fn over_card(w: &WebviewWindow, c: CardRect) -> Option<bool> {
    if !w.is_visible().ok()? { return Some(false); }
    let (cur, pos, s) = (w.cursor_position().ok()?, w.outer_position().ok()?, w.scale_factor().ok()?);
    let (lx, ly) = ((cur.x - pos.x as f64) / s, (cur.y - pos.y as f64) / s);
    Some(lx >= c.x && lx <= c.x + c.w && ly >= c.y && ly <= c.y + c.h)
}
