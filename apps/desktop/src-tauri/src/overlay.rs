//! In-game overlay window: transparent, always on top, no taskbar entry, never takes keyboard focus. The window is click-through ALWAYS
//! (mouse events pass to the game, the cursor stays the game's). Moving the card (D.4) is done by a Windows mouse hook: a LEFT press that
//! starts on the card is taken for the card (the game does not see it) and the window follows the cursor until the button is released.
//! Right/middle clicks, hover, wheel and every click outside the card are never touched. The main window decides what the overlay shows
//! and when (see src/lib/overlay.ts). No input is ever sent to the game.
use serde_json::{json, Value};
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
pub async fn set_overlay(app: AppHandle, visible: bool, corner: String, x: Option<i32>, y: Option<i32>, preview: Option<bool>) -> Result<(), String> {
    // The watcher (hook module) hides the overlay while League is not the foreground window, unless this is a manual preview from Settings.
    #[cfg(windows)]
    { hook::WANT.store(visible, std::sync::atomic::Ordering::Relaxed); hook::PREVIEW.store(preview.unwrap_or(false), std::sync::atomic::Ordering::Relaxed); }
    #[cfg(not(windows))]
    let _ = preview;
    // A saved free position (absolute physical pixels, already clamped by the caller) wins over the corner preset.
    let put = |w: &WebviewWindow| match (x, y) {
        (Some(x), Some(y)) => w.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string()),
        _ => place(w, &corner),
    };
    if let Some(w) = app.get_webview_window("overlay") {
        if visible { put(&w)?; if show_now() { w.show().map_err(|e| e.to_string())?; } } else { w.hide().map_err(|e| e.to_string())?; }
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
    // Click-through for good: dragging is done by the mouse hook (`start`), the window itself never takes the mouse.
    w.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    if let Ok(h) = w.hwnd() { hook::OVERLAY_HWND.store(h.0 as isize, std::sync::atomic::Ordering::Relaxed); }
    put(&w)?;
    // Created while League is not in front (alt-tabbed): keep it hidden until the game is the foreground window again.
    if !show_now() { let _ = w.hide(); }
    Ok(())
}

/// Should the overlay be on screen right now? Windows: only while League's game window is the foreground window (or in a Settings preview).
fn show_now() -> bool {
    #[cfg(windows)]
    { hook::PREVIEW.load(std::sync::atomic::Ordering::Relaxed) || hook::game_in_front() }
    #[cfg(not(windows))]
    { true }
}

/// The overlay page reports where its card is (logical px inside the window); w or h of 0 means "no card" (nothing can be dragged).
#[tauri::command]
pub fn overlay_card(app: AppHandle, x: f64, y: f64, w: f64, h: f64) {
    #[cfg(windows)]
    {
        let scale = app.get_webview_window("overlay").and_then(|o| o.scale_factor().ok()).unwrap_or(1.0);
        hook::set_card(if w > 0.0 && h > 0.0 { Some((x, y, w, h)) } else { None }, scale);
    }
    #[cfg(not(windows))]
    let _ = (app, x, y, w, h); // the card can only be dragged on Windows
}

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

/// Windows: a low-level mouse hook (WH_MOUSE_LL) plus a mover thread. The hook sees every mouse message before it is routed. It only acts
/// on a LEFT press that lands on the card: it swallows that press (and its release) so the game never gets it, and the mover thread
/// moves the overlay window with the cursor. Everything else (moves, right/middle buttons, wheel, clicks elsewhere) is passed on untouched.
/// It reads button and cursor position only; it never sends input anywhere. The hook stays tiny (it must answer within ~300 ms).
#[cfg(windows)]
mod hook {
    use std::sync::atomic::{AtomicBool, AtomicI32, AtomicIsize, AtomicU64, Ordering::Relaxed};
    use std::sync::OnceLock;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};
    use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    /// Sent to the overlay page when a drag ends, so it can clamp the window onto a monitor and save the spot.
    const DRAG_END: &str = "overlay-drag-end";

    /// The overlay's native window handle (0 = not created yet).
    pub static OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);
    /// The card rectangle in logical px inside the window (x, y, w, h; w == 0 means no card) and the window's scale factor (f64 bits).
    static CARD: [AtomicI32; 4] = [AtomicI32::new(0), AtomicI32::new(0), AtomicI32::new(0), AtomicI32::new(0)];
    static SCALE: AtomicU64 = AtomicU64::new(0x3FF0_0000_0000_0000); // 1.0
    /// Drag state, physical px: a drag is running; cursor minus window top-left at the press; latest cursor; a new cursor spot is waiting; the drag just ended.
    static DRAG: AtomicBool = AtomicBool::new(false);
    static OFF: [AtomicI32; 2] = [AtomicI32::new(0), AtomicI32::new(0)];
    static CUR: [AtomicI32; 2] = [AtomicI32::new(0), AtomicI32::new(0)];
    static DIRTY: AtomicBool = AtomicBool::new(false);
    static ENDED: AtomicBool = AtomicBool::new(false);
    static APP: OnceLock<AppHandle> = OnceLock::new();
    /// Who runs the drag: 1 = the mouse hook (it swallowed the press), 2 = the polling fallback (the press also reaches the game).
    /// The hook gets no events while the foreground app runs elevated (UIPI) or guards input; polling still works there.
    static SRC: AtomicI32 = AtomicI32::new(0);
    /// The page wants the overlay visible; a manual preview from Settings (shown even when League is not in front).
    pub static WANT: AtomicBool = AtomicBool::new(false);
    pub static PREVIEW: AtomicBool = AtomicBool::new(false);

    /// Is League's game window (class `RiotWindowClass`) or the overlay itself the foreground window? Only reads the window class.
    pub fn game_in_front() -> bool {
        unsafe {
            let fg = GetForegroundWindow();
            if fg.is_null() { return false; }
            if fg as isize == OVERLAY_HWND.load(Relaxed) { return true; }
            let mut buf = [0u16; 64];
            let n = GetClassNameW(fg, buf.as_mut_ptr(), buf.len() as i32);
            n > 0 && String::from_utf16_lossy(&buf[..n as usize]) == "RiotWindowClass"
        }
    }

    pub fn set_card(rect: Option<(f64, f64, f64, f64)>, scale: f64) {
        let (x, y, w, h) = rect.unwrap_or((0.0, 0.0, 0.0, 0.0));
        for (a, v) in CARD.iter().zip([x, y, w, h]) { a.store(v.round() as i32, Relaxed); }
        SCALE.store(scale.to_bits(), Relaxed);
    }

    /// The window's top-left in screen px, if the overlay exists and is visible.
    unsafe fn window_origin() -> Option<(HWND, i32, i32)> {
        let hwnd = OVERLAY_HWND.load(Relaxed) as HWND;
        if hwnd.is_null() || IsWindowVisible(hwnd) == 0 { return None; }
        let mut r: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut r) == 0 { return None; }
        Some((hwnd, r.left, r.top))
    }

    /// Is the screen point (physical px) on the card? The window rect is read live, so a moved window needs no update.
    unsafe fn on_card(px: i32, py: i32) -> Option<(i32, i32)> {
        let w = CARD[2].load(Relaxed);
        if w <= 0 { return None; }
        let (_, left, top) = window_origin()?;
        let s = f64::from_bits(SCALE.load(Relaxed));
        let (x0, y0) = (left as f64 + CARD[0].load(Relaxed) as f64 * s, top as f64 + CARD[1].load(Relaxed) as f64 * s);
        let (x1, y1) = (x0 + w as f64 * s, y0 + CARD[3].load(Relaxed) as f64 * s);
        let inside = (px as f64) >= x0 && (px as f64) < x1 && (py as f64) >= y0 && (py as f64) < y1;
        if inside { Some((px - left, py - top)) } else { None }
    }

    unsafe extern "system" fn proc(code: i32, wp: usize, lp: isize) -> isize {
        if code == HC_ACTION as i32 {
            let pt = (*(lp as *const MSLLHOOKSTRUCT)).pt;
            match wp as u32 {
                WM_LBUTTONDOWN => if let Some((ox, oy)) = on_card(pt.x, pt.y) {
                    OFF[0].store(ox, Relaxed); OFF[1].store(oy, Relaxed);
                    CUR[0].store(pt.x, Relaxed); CUR[1].store(pt.y, Relaxed);
                    SRC.store(1, Relaxed);
                    DRAG.store(true, Relaxed);
                    return 1; // the press belongs to the card: the game does not get it
                },
                WM_MOUSEMOVE => if DRAG.load(Relaxed) { CUR[0].store(pt.x, Relaxed); CUR[1].store(pt.y, Relaxed); DIRTY.store(true, Relaxed); },
                WM_LBUTTONUP => if SRC.load(Relaxed) == 1 && DRAG.swap(false, Relaxed) { ENDED.store(true, Relaxed); return 1; }, // its release is swallowed too
                _ => {}
            }
        }
        CallNextHookEx(std::ptr::null_mut(), code, wp, lp)
    }

    /// Moves the window while a drag runs (about 120 times a second) and tells the page when it is over. Separate from the hook thread so
    /// a slow window move can never make the hook time out.
    fn mover() {
        let mut was_down = false;
        let mut was_shown = false;
        loop {
            std::thread::sleep(Duration::from_millis(8));
            unsafe {
                // Fallback drag: the left button state and the cursor are read directly, so it works even when the hook gets nothing.
                let down = GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000 != 0;
                let mut p: POINT = std::mem::zeroed();
                if GetCursorPos(&mut p) != 0 {
                    if !DRAG.load(Relaxed) {
                        if down && !was_down { if let Some((ox, oy)) = on_card(p.x, p.y) {
                            OFF[0].store(ox, Relaxed); OFF[1].store(oy, Relaxed);
                            SRC.store(2, Relaxed); DRAG.store(true, Relaxed);
                        } }
                    } else if SRC.load(Relaxed) == 2 && !down {
                        DRAG.store(false, Relaxed); ENDED.store(true, Relaxed);
                    }
                    if DRAG.load(Relaxed) { CUR[0].store(p.x, Relaxed); CUR[1].store(p.y, Relaxed); DIRTY.store(true, Relaxed); }
                }
                was_down = down;
                // Game-only: hide the overlay while League is not in front (alt-tab), show it again when it is. A Settings preview stays.
                if WANT.load(Relaxed) {
                    let hwnd = OVERLAY_HWND.load(Relaxed) as HWND;
                    if !hwnd.is_null() {
                        let shown = PREVIEW.load(Relaxed) || game_in_front() || DRAG.load(Relaxed);
                        if shown != was_shown {
                            ShowWindow(hwnd, if shown { SW_SHOWNOACTIVATE } else { SW_HIDE });
                            was_shown = shown;
                        }
                    }
                } else { was_shown = false; }
            }
            let moved = DIRTY.swap(false, Relaxed);
            let ended = ENDED.swap(false, Relaxed);
            if moved || ended {
                let hwnd = OVERLAY_HWND.load(Relaxed) as HWND;
                if !hwnd.is_null() {
                    let (x, y) = (CUR[0].load(Relaxed) - OFF[0].load(Relaxed), CUR[1].load(Relaxed) - OFF[1].load(Relaxed));
                    unsafe { SetWindowPos(hwnd, std::ptr::null_mut(), x, y, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE); }
                }
            }
            if ended { if let Some(app) = APP.get() { let _ = app.emit(DRAG_END, ()); } }
        }
    }

    /// Installs the hook on its own thread (a low-level hook needs a message loop on the thread that installed it) and starts the mover.
    pub fn start(app: AppHandle) {
        let _ = APP.set(app);
        std::thread::spawn(mover);
        std::thread::spawn(|| unsafe {
            let h = SetWindowsHookExW(WH_MOUSE_LL, Some(proc), GetModuleHandleW(std::ptr::null()), 0);
            if h.is_null() { eprintln!("overlay: could not install the mouse hook, the card cannot be dragged"); return; }
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 { TranslateMessage(&msg); DispatchMessageW(&msg); }
        });
    }
}

/// Starts the drag handling (call once from `setup`). Windows only; elsewhere the overlay is a plain click-through card.
pub fn start(app: AppHandle) {
    #[cfg(windows)]
    hook::start(app);
    #[cfg(not(windows))]
    let _ = app;
}
