//! FaB Tracker — Tauri backend entry point.
//!
//! Persistence lives in SQLite (`db.rs`), opened once at startup and shared via
//! Tauri managed state. Commands:
//! - `get_cards`        — read the cached catalog from the DB.
//! - `sync_cards`       — download the latest catalog and replace the DB copy.
//! - `get_catalog_info` — card count + last-synced timestamp.
//!
//! Next: the collection + decks build on the same DB (see `docs/PROJECT_LOG.md`).

mod card;
mod catalog;
mod db;

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use card::Card;
use rusqlite::Connection;
use serde::Serialize;
use tauri::{Manager, State};

/// The single shared SQLite connection, guarded by a mutex (queries are short).
type Db = Mutex<Connection>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogInfo {
    count: i64,
    /// Unix epoch milliseconds of the last successful sync, if any.
    last_synced: Option<i64>,
}

/// Read the cached catalog from the database (empty ⇒ not synced yet).
#[tauri::command]
fn get_cards(db: State<'_, Db>) -> Result<Vec<Card>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::load_cards(&conn)
}

#[tauri::command]
fn get_catalog_info(db: State<'_, Db>) -> Result<CatalogInfo, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    Ok(CatalogInfo {
        count: db::card_count(&conn)?,
        last_synced: db::get_last_synced(&conn)?,
    })
}

/// Download the latest catalog, replace the DB copy, and return the cards.
#[tauri::command]
async fn sync_cards(db: State<'_, Db>) -> Result<Vec<Card>, String> {
    // Network first — we deliberately don't hold the DB lock across the await.
    let cards = catalog::fetch_catalog().await?;
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    {
        let mut conn = db.lock().map_err(|e| e.to_string())?;
        db::replace_cards(&mut conn, &cards)?;
        db::set_last_synced(&conn, now_ms)?;
    }
    Ok(cards)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .expect("resolve app data dir");
            std::fs::create_dir_all(&dir).expect("create app data dir");
            let conn = db::open(&dir.join("fabtracker.db")).expect("open database");
            app.manage(Mutex::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_cards,
            sync_cards,
            get_catalog_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
