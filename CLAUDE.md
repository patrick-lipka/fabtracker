# Working notes for Claude

FaB Tracker — a local-first Flesh and Blood collection & deck manager.
**Tauri v2 (Rust) + React 19 + TypeScript + Vite + Tailwind v4.**

## Read these first
- `docs/PROJECT_LOG.md` — where we are + the roadmap. Update the log when you
  finish a chunk of work.
- `docs/ARCHITECTURE.md` — decisions and why.

## Run / check
- `npm run tauri dev` — full app (needed for `invoke` / real data).
- `npm run dev` — frontend only; the grid is empty without the Tauri runtime.
- `npm run build` — type-check + frontend build.
- `cd src-tauri && cargo check` — type-check the backend.

Requires Rust ≥ 1.85 (`rustup update stable`) and Node ≥ 20.

## Conventions
- All Tauri `invoke` calls go through `src/lib/api.ts` — nowhere else.
- Display logic (colors, labels, type lines) lives in `src/lib/fab.ts`, not in
  components.
- The `Card`/`Printing` model is defined in `src-tauri/src/card.rs` and
  hand-mirrored in `src/types/card.ts` (Rust serializes camelCase). Keep them in
  sync; if it churns, switch to generating the TS (`ts-rs`).
- Card data is downloaded at runtime by `src-tauri/src/catalog.rs` (the
  the-fab-cube dataset) — never committed. Source-schema mapping lives only in
  `catalog.rs` (`fetch_catalog`).
- Persistence: `src-tauri/src/db.rs` — SQLite (`fabtracker.db` in the app-data
  dir), opened once in `setup`, shared as `Mutex<Connection>` managed state.
  Cards stored as indexed columns + a `data` JSON blob; schema via
  `rusqlite_migration`. `get_cards` reads the DB; `sync_cards` downloads +
  replaces it; `get_catalog_info` returns count + last-synced.
- Search: `src-tauri/src/search.rs` parses the query language into a
  parameterized SQL WHERE; `db::search_cards` runs it. Command `search_cards`;
  frontend calls it debounced (empty query → show in-memory full list). Numeric
  filters use indexed columns; array fields use `json_each`/`json_extract`.
  `search_cards(query, ownedOnly)` and the `have:` field restrict to collected
  cards (shared `search::OWNED_CLAUSE`); the header "Owned" switch sets ownedOnly.
- Collection: `src-tauri/src/collection.rs` — `binders` + `collection_entries`
  tables (migrations v2/v3 in `db.rs`). Entries are stacks keyed by
  (binder, card, printing, foiling, condition) + quantity; multi-binder; deleting
  a binder cascades. Commands: list/create/rename/delete_binder, get_collection,
  search_collection (query language scoped to a binder/all), card_entries,
  adjust_entry, move_entry, move_card_all, remove_card_from_binder, owned_counts.
  get_collection/search_collection aggregate by card_id (grid = one tile + total).
  Frontend: Browse/Collection toggle in `App`; detail pane has the add-copy form +
  per-copy steppers/move; mutations bump a `collVersion` to refresh
  binders/collection/owned-counts/detail. `catalog.rs` dedupes printings by id.
- Backend tests: `cd src-tauri && cargo test --lib` (search parser + end-to-end
  search + DB round-trip; no network). The real network fetch test is
  `#[ignore]`d: `cargo test -- --ignored`.

## House style
- Match the surrounding code's idiom and comment density.
- Prefer small, focused components and pure helpers.
