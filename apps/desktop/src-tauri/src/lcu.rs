//! Real League client (LCU) connector. Finds the lockfile, authenticates, subscribes to client events
//! over the local WebSocket and forwards raw frames to the UI as Tauri events ("lcu-message", "lcu-status").
//! All champ select logic stays in TypeScript (packages/lcu-core); Rust only does what the browser can't.
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::{fs, sync::Mutex, time::Duration};
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{
    connect_async_tls_with_config,
    tungstenite::{client::IntoClientRequest, http::HeaderValue, Message},
    Connector,
};

type Res<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;
struct Creds { port: u16, auth: String }
/// Credentials of the live connection, so the UI can ask for a resync after it starts listening.
static CREDS: Mutex<Option<(u16, String)>> = Mutex::new(None);

/// Lockfile format: name:pid:port:password:protocol. The client is only reachable from this machine.
fn find_lockfile() -> Option<Creds> {
    let mut paths: Vec<String> = Vec::new();
    if let Ok(p) = std::env::var("LOL_LOCKFILE") { paths.push(p); }
    for d in ["C", "D", "E"] { paths.push(format!(r"{d}:\Riot Games\League of Legends\lockfile")); }
    for p in paths {
        let Ok(text) = fs::read_to_string(&p) else { continue };
        let parts: Vec<&str> = text.trim().split(':').collect();
        if parts.len() >= 5 {
            if let Ok(port) = parts[2].parse::<u16>() {
                return Some(Creds { port, auth: STANDARD.encode(format!("riot:{}", parts[3])) });
            }
        }
    }
    None
}

fn emit_update(app: &AppHandle, uri: &str, data: Value) {
    let frame = json!([8, "OnJsonApiEvent", { "uri": uri, "eventType": "Update", "data": data }]).to_string();
    let _ = app.emit("lcu-message", frame);
}

/// If the app starts while you are already in champ select, subscribe-only would miss the current state.
async fn snapshot(app: &AppHandle, c: &Creds) {
    let Ok(client) = reqwest::Client::builder().danger_accept_invalid_certs(true).build() else { return };
    for uri in ["/lol-gameflow/v1/gameflow-phase", "/lol-champ-select/v1/session"] {
        let url = format!("https://127.0.0.1:{}{}", c.port, uri);
        let Ok(r) = client.get(url).header("Authorization", format!("Basic {}", c.auth)).send().await else { continue };
        if !r.status().is_success() { continue; }
        if let Ok(v) = r.json::<Value>().await { emit_update(app, uri, v); }
    }
}

async fn run_session(app: &AppHandle, c: &Creds) -> Res<()> {
    let mut req = format!("wss://127.0.0.1:{}/", c.port).into_client_request()?;
    req.headers_mut().insert("Authorization", HeaderValue::from_str(&format!("Basic {}", c.auth))?);
    // The client uses a self-signed certificate on localhost.
    let tls = native_tls::TlsConnector::builder().danger_accept_invalid_certs(true).build()?;
    let (ws, _) = connect_async_tls_with_config(req, None, false, Some(Connector::NativeTls(tls))).await?;
    let (mut write, mut read) = ws.split();
    write.send(Message::Text("[5, \"OnJsonApiEvent\"]".to_string())).await?;
    if let Ok(mut g) = CREDS.lock() { *g = Some((c.port, c.auth.clone())); }
    let _ = app.emit("lcu-status", "connected");
    snapshot(app, c).await;
    while let Some(msg) = read.next().await {
        if let Message::Text(t) = msg? { if !t.is_empty() { let _ = app.emit("lcu-message", t); } }
    }
    Ok(())
}

/// Background loop: looks for the client every 3 s, connects, and reconnects if it closes.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Some(c) = find_lockfile() {
                let _ = run_session(&app, &c).await;
                if let Ok(mut g) = CREDS.lock() { *g = None; }
                let _ = app.emit("lcu-status", "disconnected");
            }
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    });
}

/// Called by the UI once its event listeners exist. The connection often succeeds before the window is
/// ready, so the first "connected" event would be lost; this re-sends the current state and reports status.
#[tauri::command]
pub async fn lcu_sync(app: AppHandle) -> bool {
    let creds = CREDS.lock().ok().and_then(|g| g.clone());
    match creds {
        Some((port, auth)) => { snapshot(&app, &Creds { port, auth }).await; true }
        None => false,
    }
}

/// Limited write access to the League client. Allowed: rune page reads/writes, item set reads/writes for your own summoner id
/// (plus reading that id), and setting your own summoner
/// spells in champ select (PATCH my-selection), and your own champ select action (PATCH actions/<id> to hover, lock in or ban; POST actions/<id>/complete). Everything else is refused.
#[tauri::command]
pub async fn lcu_request(method: String, path: String, body: Option<Value>) -> Result<Value, String> {
    const PERKS: [&str; 2] = ["/lol-perks/v1/pages", "/lol-perks/v1/currentpage"];
    const SELECTION: &str = "/lol-champ-select/v1/session/my-selection";
    const SUMMONER: &str = "/lol-summoner/v1/current-summoner";
    const GAMEFLOW_SESSION: &str = "/lol-gameflow/v1/session"; // read-only: your own champion when Apex starts mid-game
    const ACTIONS: &str = "/lol-champ-select/v1/session/actions/";
    let perks_path = PERKS.iter().any(|p| path == *p || path.starts_with(&format!("{p}/")));
    // Item sets: /lol-item-sets/v1/item-sets/<numeric summoner id>/sets, read and write. Nothing else under /lol-item-sets.
    let item_sets_path = path
        .strip_prefix("/lol-item-sets/v1/item-sets/")
        .and_then(|rest| rest.strip_suffix("/sets"))
        .map_or(false, |id| !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit()));
    // Your own champ select action (opt-in, one click in the UI): /actions/<numeric id> PATCH with exactly {championId} (hover) or {championId, completed: true}
    // (lock in / ban), and POST /actions/<numeric id>/complete as the fallback. Nothing else, and no other body.
    let action_rest = path.strip_prefix(ACTIONS);
    let action_id_ok = |id: &str| !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit());
    let action_patch = action_rest.map_or(false, |id| action_id_ok(id)) && body.as_ref().and_then(|b| b.as_object()).map_or(false, |o| {
        o.get("championId").map_or(false, |v| v.is_u64())
            && o.iter().all(|(k, v)| k == "championId" || (k == "completed" && v.as_bool() == Some(true)))
    });
    let action_complete = action_rest.and_then(|r| r.strip_suffix("/complete")).map_or(false, |id| action_id_ok(id)) && body.is_none();
    let allowed = !path.contains("..")
        && if path == SELECTION {
            method == "PATCH"
        } else if action_patch || action_complete {
            (method == "PATCH" && action_patch) || (method == "POST" && action_complete)
        } else if path == SUMMONER || path == GAMEFLOW_SESSION {
            method == "GET"
        } else if item_sets_path {
            matches!(method.as_str(), "GET" | "PUT")
        } else {
            perks_path && matches!(method.as_str(), "GET" | "POST" | "PUT")
        };
    if !allowed { return Err("request not allowed".into()); }
    let creds = CREDS.lock().ok().and_then(|g| g.clone());
    let Some((port, auth)) = creds else { return Err("League client not connected".into()) };
    let m = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
    let client = reqwest::Client::builder().danger_accept_invalid_certs(true).build().map_err(|e| e.to_string())?;
    let mut req = client.request(m, format!("https://127.0.0.1:{port}{path}")).header("Authorization", format!("Basic {auth}"));
    if let Some(b) = body { req = req.json(&b); }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("League client returned {status}: {text}")); }
    Ok(serde_json::from_str(&text).unwrap_or(Value::Null))
}
