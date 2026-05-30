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
mod collection;
mod db;
mod search;

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use std::collections::HashMap;

use card::Card;
use collection::{Binder, BinderEntry, CollectionCard};
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

/// Run a query-language search against the catalog (see `search.rs`).
/// `owned_only` additionally restricts results to cards in the collection.
#[tauri::command]
fn search_cards(
    query: String,
    owned_only: bool,
    db: State<'_, Db>,
) -> Result<Vec<Card>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::search_cards(&conn, &query, owned_only)
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

// --- Collection -----------------------------------------------------------

#[tauri::command]
fn list_binders(db: State<'_, Db>) -> Result<Vec<Binder>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::list_binders(&conn)
}

#[tauri::command]
fn create_binder(name: String, db: State<'_, Db>) -> Result<Vec<Binder>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::create_binder(&conn, name.trim())?;
    collection::list_binders(&conn)
}

#[tauri::command]
fn rename_binder(id: i64, name: String, db: State<'_, Db>) -> Result<Vec<Binder>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::rename_binder(&conn, id, name.trim())?;
    collection::list_binders(&conn)
}

#[tauri::command]
fn delete_binder(id: i64, db: State<'_, Db>) -> Result<Vec<Binder>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::delete_binder(&conn, id)?;
    collection::list_binders(&conn)
}

#[tauri::command]
fn get_collection(
    binder_id: Option<i64>,
    db: State<'_, Db>,
) -> Result<Vec<CollectionCard>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::get_collection(&conn, binder_id)
}

#[tauri::command]
fn search_collection(
    query: String,
    binder_id: Option<i64>,
    db: State<'_, Db>,
) -> Result<Vec<CollectionCard>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::search_collection(&conn, &query, binder_id)
}

#[tauri::command]
fn card_binders(card_id: String, db: State<'_, Db>) -> Result<Vec<BinderEntry>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::card_binders(&conn, &card_id)
}

#[tauri::command]
fn adjust_card(
    binder_id: i64,
    card_id: String,
    delta: i64,
    db: State<'_, Db>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::adjust_card(&conn, binder_id, &card_id, delta)
}

#[tauri::command]
fn move_card(
    from_binder: i64,
    to_binder: i64,
    card_id: String,
    quantity: i64,
    db: State<'_, Db>,
) -> Result<(), String> {
    let mut conn = db.lock().map_err(|e| e.to_string())?;
    collection::move_card(&mut conn, from_binder, to_binder, &card_id, quantity)
}

#[tauri::command]
fn owned_counts(db: State<'_, Db>) -> Result<HashMap<String, i64>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::owned_counts(&conn)
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
            search_cards,
            sync_cards,
            get_catalog_info,
            list_binders,
            create_binder,
            rename_binder,
            delete_binder,
            get_collection,
            search_collection,
            card_binders,
            adjust_card,
            move_card,
            owned_counts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
