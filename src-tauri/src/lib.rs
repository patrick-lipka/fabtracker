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
mod deck;
mod search;

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use std::collections::HashMap;

use card::Card;
use collection::{Binder, CardCollectionEntry, CollectionCard, EntryKey};
use deck::{DeckDetail, DeckSummary};
use rusqlite::Connection;
use serde::Serialize;
use tauri::{Manager, State};

/// The single shared SQLite connection, guarded by a mutex (queries are short).
type Db = Mutex<Connection>;

const META_REF_MODE: &str = "data_ref_mode";
const META_SYNCED_SHA: &str = "last_synced_sha";
const META_SYNCED_BRANCH: &str = "last_synced_branch";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogInfo {
    count: i64,
    /// Unix epoch milliseconds of the last successful sync, if any.
    last_synced: Option<i64>,
    /// Branch the cached catalog was synced from.
    branch: Option<String>,
    /// Configured ref mode ("auto" or an explicit branch/tag/sha).
    mode: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    update_available: bool,
    branch: String,
    sha: String,
    date: String,
    current_sha: Option<String>,
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
        branch: db::get_meta(&conn, META_SYNCED_BRANCH)?,
        mode: db::get_meta(&conn, META_REF_MODE)?.unwrap_or_else(|| "auto".to_string()),
    })
}

/// Set the data-source ref mode: "auto" (newest commit across branches) or an
/// explicit branch/tag/sha.
#[tauri::command]
fn set_data_ref(mode: String, db: State<'_, Db>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    db::set_meta(&conn, META_REF_MODE, mode.trim())
}

/// Check whether the resolved ref is newer than what we last synced.
#[tauri::command]
async fn check_updates(db: State<'_, Db>) -> Result<UpdateInfo, String> {
    let (mode, current_sha) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        (
            db::get_meta(&conn, META_REF_MODE)?.unwrap_or_else(|| "auto".to_string()),
            db::get_meta(&conn, META_SYNCED_SHA)?,
        )
    };
    // If the GitHub API is unavailable (e.g. rate-limited), report "no update"
    // rather than failing — the user can still sync.
    let info = match catalog::resolve_ref(&mode).await {
        Ok(i) => i,
        Err(_) => {
            return Ok(UpdateInfo {
                update_available: false,
                branch: String::new(),
                sha: String::new(),
                date: String::new(),
                current_sha,
            })
        }
    };
    Ok(UpdateInfo {
        update_available: current_sha.as_deref() != Some(info.sha.as_str()),
        branch: info.branch,
        sha: info.sha,
        date: info.date,
        current_sha,
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

/// Download the catalog at the resolved ref, replace the DB copy, record the
/// synced branch/sha, and return the cards.
#[tauri::command]
async fn sync_cards(db: State<'_, Db>) -> Result<Vec<Card>, String> {
    let (mode, last_branch) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        (
            db::get_meta(&conn, META_REF_MODE)?.unwrap_or_else(|| "auto".to_string()),
            db::get_meta(&conn, META_SYNCED_BRANCH)?,
        )
    };
    // Resolve the target ref. If the GitHub API is unavailable (e.g. rate-
    // limited), fall back to a branch we can pull straight from the raw CDN,
    // which isn't rate-limited — so syncing keeps working.
    let (git_ref, branch, sha) = match catalog::resolve_ref(&mode).await {
        Ok(info) => (info.sha.clone(), info.branch, info.sha),
        Err(_) => {
            let branch = if mode != "auto" && !mode.is_empty() {
                mode.clone()
            } else {
                last_branch.unwrap_or_else(|| "develop".to_string())
            };
            (branch.clone(), branch, String::new())
        }
    };
    let cards = catalog::fetch_catalog_at(&git_ref).await?;
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    {
        let mut conn = db.lock().map_err(|e| e.to_string())?;
        db::replace_cards(&mut conn, &cards)?;
        db::set_last_synced(&conn, now_ms)?;
        if !sha.is_empty() {
            db::set_meta(&conn, META_SYNCED_SHA, &sha)?;
        }
        db::set_meta(&conn, META_SYNCED_BRANCH, &branch)?;
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
fn card_entries(card_id: String, db: State<'_, Db>) -> Result<Vec<CardCollectionEntry>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::card_entries(&conn, &card_id)
}

/// A specific (printing, foiling, condition) stack of a card, from the frontend.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntryKeyArg {
    card_id: String,
    printing_id: String,
    set_id: String,
    foiling: String,
    condition: String,
}

impl EntryKeyArg {
    fn key(&self) -> EntryKey<'_> {
        EntryKey {
            card_id: &self.card_id,
            printing_id: &self.printing_id,
            set_id: &self.set_id,
            foiling: &self.foiling,
            condition: &self.condition,
        }
    }
}

#[tauri::command]
fn adjust_entry(
    binder_id: i64,
    entry: EntryKeyArg,
    delta: i64,
    db: State<'_, Db>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::adjust_entry(&conn, binder_id, &entry.key(), delta)
}

#[tauri::command]
fn move_entry(
    from_binder: i64,
    to_binder: i64,
    entry: EntryKeyArg,
    quantity: i64,
    db: State<'_, Db>,
) -> Result<(), String> {
    let mut conn = db.lock().map_err(|e| e.to_string())?;
    collection::move_entry(&mut conn, from_binder, to_binder, &entry.key(), quantity)
}

#[tauri::command]
fn move_card_all(
    from_binder: i64,
    to_binder: i64,
    card_id: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    let mut conn = db.lock().map_err(|e| e.to_string())?;
    collection::move_card_all(&mut conn, from_binder, to_binder, &card_id)
}

#[tauri::command]
fn remove_card_from_binder(
    binder_id: i64,
    card_id: String,
    db: State<'_, Db>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::remove_card_from_binder(&conn, binder_id, &card_id)
}

#[tauri::command]
fn owned_counts(db: State<'_, Db>) -> Result<HashMap<String, i64>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    collection::owned_counts(&conn)
}

// --- Decks ------------------------------------------------------------------

#[tauri::command]
fn list_heroes(owned_only: bool, db: State<'_, Db>) -> Result<Vec<Card>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::list_heroes(&conn, owned_only)
}

#[tauri::command]
fn list_decks(db: State<'_, Db>) -> Result<Vec<DeckSummary>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::list_decks(&conn)
}

#[tauri::command]
fn create_deck(
    name: String,
    format: String,
    hero_id: String,
    db: State<'_, Db>,
) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::create_deck(&conn, name.trim(), &format, &hero_id)
}

#[tauri::command]
fn get_deck(id: i64, db: State<'_, Db>) -> Result<DeckDetail, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::get_deck(&conn, id)
}

#[tauri::command]
fn rename_deck(id: i64, name: String, db: State<'_, Db>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::rename_deck(&conn, id, name.trim())
}

#[tauri::command]
fn set_deck_format(id: i64, format: String, db: State<'_, Db>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::set_deck_format(&conn, id, &format)
}

#[tauri::command]
fn delete_deck(id: i64, db: State<'_, Db>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::delete_deck(&conn, id)
}

#[tauri::command]
fn adjust_deck_card(
    deck_id: i64,
    card_id: String,
    delta: i64,
    db: State<'_, Db>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    deck::adjust_deck_card(&conn, deck_id, &card_id, delta)
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
            set_data_ref,
            check_updates,
            list_binders,
            create_binder,
            rename_binder,
            delete_binder,
            get_collection,
            search_collection,
            card_entries,
            adjust_entry,
            move_entry,
            move_card_all,
            remove_card_from_binder,
            owned_counts,
            list_heroes,
            list_decks,
            create_deck,
            get_deck,
            rename_deck,
            set_deck_format,
            delete_deck,
            adjust_deck_card,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
