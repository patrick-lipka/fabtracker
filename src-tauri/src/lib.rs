//! FaB Tracker — Tauri backend entry point.
//!
//! For now the only command is `get_cards`, which serves a bundled mock card
//! catalog. Later this is where the local SQLite DB, the official-data sync,
//! and the search index will live (see `docs/PROJECT_LOG.md`).

mod card;

use card::Card;

/// The mock catalog is compiled into the binary so the app runs fully offline
/// with zero setup. Swapping this for real data is a localized change.
const MOCK_CARDS_JSON: &str = include_str!("../data/mock_cards.json");

/// Return the full card catalog.
#[tauri::command]
fn get_cards() -> Result<Vec<Card>, String> {
    serde_json::from_str(MOCK_CARDS_JSON)
        .map_err(|e| format!("failed to parse mock card data: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_cards])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
