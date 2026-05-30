//! FaB Tracker — Tauri backend entry point.
//!
//! Commands:
//! - `get_cards`  — return the locally cached catalog (empty if never synced).
//! - `sync_cards` — download the latest catalog from the data source and cache it.
//!
//! Later this is where the SQLite DB, the collection, and the search index live
//! (see `docs/PROJECT_LOG.md`).

mod card;
mod catalog;

use std::path::PathBuf;

use card::Card;
use tauri::{AppHandle, Manager};

/// Where downloaded catalog files are cached on disk.
fn cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map_err(|e| format!("could not resolve cache dir: {e}"))
}

/// Return the cached catalog. Empty vec means "not synced yet" — the frontend
/// uses that to prompt the user to download.
#[tauri::command]
fn get_cards(app: AppHandle) -> Result<Vec<Card>, String> {
    let dir = cache_dir(&app)?;
    Ok(catalog::load_cached(&dir)?.unwrap_or_default())
}

/// Download the latest catalog, cache it, and return the parsed cards.
#[tauri::command]
async fn sync_cards(app: AppHandle) -> Result<Vec<Card>, String> {
    let dir = cache_dir(&app)?;
    catalog::sync(&dir).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_cards, sync_cards])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
