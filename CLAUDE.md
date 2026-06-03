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
  `catalog.rs`. `resolve_ref(mode)` chooses the ref: "auto" = newest commit
  across all branches (GitHub API; follows the maintainer's active spoiler
  branch), else an explicit branch/tag/sha; `fetch_catalog_at(ref)` pulls it. We
  sync at the commit sha and store it; `check_updates` compares for newer commits
  and the frontend auto-re-syncs on launch. Mode persisted in `meta`
  (`data_ref_mode`), set via the ⚙ popover.
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
  binders/collection/owned-counts/detail. `catalog.rs` dedupes printings by id,
  attaches each set's release date (`released`), and sorts printings newest-first;
  the detail image defaults to newest (Browse) / newest-owned (Collection) and is
  clickable per printing. Catalog changes need a Re-sync to take effect.
- Decks: `src-tauri/src/deck.rs` — `decks` + `deck_cards` (migration v4).
  `get_deck` computes resolved cards (+owned), cost curve, pitch counts,
  missing-vs-collection, and legality. Class/talent legality uses separate
  `CLASSES`/`TALENTS` word sets (mirrored in `lib/fab.ts`): a card is legal if
  the hero shares ≥1 of its classes (multi-class cards work for any class) and
  ≥1 talent. Commands: list_heroes, list_decks, create_deck, get_deck,
  rename_deck, set_deck_format, delete_deck, adjust_deck_card, import_deck,
  add_deck_to_collection. Frontend: `DecksTab` (list → hero picker → editor) +
  `DeckEditor` (pool reuses `CardGrid`). Per-format legality:
  CC (deck ≥60, pool ≤80, ≤3 per name+color, adult hero),
  Blitz (deck =40, ≤2 per name, young hero),
  Silver Age (deck per-game, pool ≤55, ≤2 per name+color, young hero,
  common/rare/basic rarity by ever-printed). Card-pools are a *maximum* size.
  Plus per-format bans / Living Legend / suspensions (flags ingested onto `Card`
  as `Option<bool>` — need a Re-sync to populate; `formatAllowed`/`legalForDeck`
  mirror in `fab.ts`). Formats: CC / Blitz / Silver Age. Slots overview is
  informational. Deferred: specialization cards, Commoner, hard slot caps. Per-deck Markdown notes via Milkdown Crepe (`NotesEditor`); `set_deck_notes` + `notes` column (migration v5).
- Deck import: `Decks → Import` pastes a Fabrary text export → `DeckImport`
  parses it (`src/lib/decklist.ts`: `Name:`/`Hero:`/`Format:` header, `Nx Name`,
  `(red/yellow/blue)` pitch, collector numbers) and resolves names → card ids in
  the frontend; `import_deck` saves it in one tx. An "Import as: Precon / Deck"
  toggle sets `decks.is_precon` (migration v6, with `source_url`); precons render
  in a separate section of `DecksTab`. Source URL is seeded into the deck notes.
  Import is paste-based by design (no automated pull from other tools): export a
  list from your own browser and paste it here. An embedded browser was tried
  but dropped — embedded WebKit can't run the async clipboard copy reliably.
- Backend tests: `cd src-tauri && cargo test --lib` (search parser + end-to-end
  search + DB round-trip; no network). The real network fetch test is
  `#[ignore]`d: `cargo test -- --ignored`.

## House style
- Match the surrounding code's idiom and comment density.
- Prefer small, focused components and pure helpers.
