# Architecture

This document records the *why* behind the structural decisions, so we (and any
future contributor) don't have to re-litigate them.

## Goals

1. **Local-first.** Works fully offline; your collection lives on your machine.
2. **Self-hostable / portable.** No mandatory cloud account or server.
3. **Native-fast.** Snappy with the full card pool (several thousand cards) and
   large collections.
4. **Approachable to extend.** The owner is a senior systems engineer (C++/HPC)
   growing into frontend work — so the heavy/logic-rich parts live in Rust where
   that experience transfers, and the UI uses a mainstream, well-documented stack.

## The shape: Tauri (Rust core) + React frontend

A **Tauri v2** desktop app. The frontend is a normal web app (React + TS + Vite)
rendered in the OS webview; the backend is a Rust process the frontend talks to
over Tauri's IPC (`invoke`).

```
┌─────────────────────────────────────────────┐
│  OS Webview (React + TS + Tailwind)          │
│   components/ ── lib/api.ts ──► invoke(...)   │
└───────────────────────┬─────────────────────┘
                        │ Tauri IPC
┌───────────────────────▼─────────────────────┐
│  Rust core (src-tauri)                        │
│   commands ─ card model ─ [future: DB, sync,  │
│                            search index]      │
└─────────────────────────────────────────────┘
```

### Why Tauri over Electron
- OS-native webview → binaries in the single-digit MBs, not ~100+ MB.
- The backend is **Rust**, not Node — better fit for the owner's background and
  for CPU/IO-heavy work (search indexing, DB, data sync).
- First-class cross-platform packaging (macOS / Windows / Linux).

### Why React + TypeScript for the UI
- Biggest ecosystem and the widest selection of component libraries — important
  for reaching Moxfield-grade polish without building everything from scratch.
- Best learning resources, which matches the owner's goal of growing frontend
  skill.
- Vite gives a near-instant HMR dev loop.

### Why Rust holds the logic
The interesting, durable work is not the rendering — it's the **collection DB,
the card search index, syncing official data, and deck math**. Putting that in
Rust means it's fast, strongly-typed, and plays to existing strengths. The
frontend stays a relatively thin (if pretty) view layer.

## Alternatives considered (and why not, *for now*)

- **Pure web SPA + WebAssembly search.** Simplest to deploy (static files), and
  we can still emit a web build from the same React code later. But: CORS pain
  when fetching official card data/images, and no native filesystem for the
  local collection. Rejected as the *primary* target; kept as a possible future
  export.
- **All-Rust frontend (Leptos / Dioxus).** Elegant and all-one-language, but the
  UI component ecosystem is immature, which hurts both polish and the owner's
  frontend-learning goal.
- **Electron.** Rejected on binary size and the Node-vs-Rust backend point above.

## Data flow & the Card model

`Card` is defined once in Rust (`src-tauri/src/card.rs`) and mirrored in TS
(`src/types/card.ts`). The Rust struct serializes to camelCase JSON, so the two
line up field-for-field.

The model describes the **game domain**, not any particular data source. Fields
are `Option` where the game makes them optional (a Hero has `health`/`intellect`
but no `pitch`/`cost`; an attack has `power`/`pitch`/`cost` but no `health`).
When we ingest real data later, we map that source into this model in one place.

## Card data: source, sync & caching

The catalog comes from the community-maintained
[the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards)
dataset (English) — `card.json` (the cards, ~4285 of them) plus `set.json` (set
names). It carries official LSS card image URLs.

**We deliberately do not vendor this data into the repo.** It has no license and
the card data/images are Legend Story Studios IP. Instead the Rust backend
(`catalog.rs`) downloads it at runtime, parses it, and persists it locally
(`db.rs`). This keeps the repo lean, respects the IP, and directly realizes the
"pull from official servers" goal.

- `sync_cards` (async command) — downloads + parses, then replaces the DB copy
  in one transaction. Returns the cards. The DB lock is **not** held across the
  network await.
- `get_cards` (command) — reads the catalog from the DB (empty list ⇒ nothing
  synced yet, which the frontend uses to show a one-time download prompt).
- `get_catalog_info` (command) — card count + last-synced timestamp.
- `catalog.rs` owns the *source* schema (`Raw*` structs) and maps it into our
  domain `Card`/`Printing` model in one place — `parse_catalog` / `map_card`.
  Source quirks handled here: stats are strings that may be `""`/`*`/`X`/`XX`
  (parsed to a number when possible, raw text kept as a fallback), printings are
  denormalized (we resolve set names + rarity shortcodes and pick a
  representative image), and the dataset ref is pinned via `DATA_REF`.

## Persistence (SQLite)

`db.rs` opens `fabtracker.db` in the OS **app-data** dir
(`AppHandle::path().app_data_dir()`) — persistent, distinct from the
re-downloadable cache. The connection is opened once in Tauri's `setup` and
shared as managed state (`Mutex<Connection>`; queries are short, so a single
guarded connection is plenty for a desktop app). Schema changes go through
ordered `rusqlite_migration` migrations.

**Storage strategy — document + indexed columns.** Each card is stored as its
full JSON in a `data` column, alongside indexed scalar columns (`name`, `pitch`,
`cost`, `power`, `type_text`, `rarity`, …). That gives cheap full reconstruction
today and SQL filtering once the rich search lands — without locking in a rigid
relational schema prematurely. The collection and decks will add their own
tables here.

## Search (query language)

`search.rs` implements a Scryfall/Moxfield-style query language. `build_where`
tokenizes the query (keeping quoted phrases intact), parses each `field<op>value`
term, and returns a parameterized SQL `WHERE` clause plus its bound parameters.
`db::search_cards` runs it: `SELECT data FROM cards WHERE <clause> ORDER BY name`.

Terms combine with implicit AND. Numeric/equality filters use the indexed scalar
columns; the array fields (types, keywords, sets) use SQLite's `json_each` /
`json_extract` over the `data` blob (correlated subqueries). Unknown fields fall
back to free-text matching, so the box is forgiving. Everything is parameterized
— no string interpolation of user values into SQL.

The frontend calls `search_cards` debounced; an empty query just shows the
already-loaded full list, so there's no round-trip while idle.

> **Scalability note:** the catalog is still sent to the frontend in one shot on
> load (fine at ~4285 cards). If the pool or collection grows large, the next
> moves are paging results and adding an FTS5 index for text search — both reuse
> the structure already in place.

## Collection (binders)

`collection.rs` owns the user's collection. Two tables (migration v2):
`binders` and `collection_entries` (PK `binder_id` + `card_id`, with a
`quantity`). A default "Main" binder is seeded.

Model: an entry is a **stack of identical physical copies** — keyed by
`(binder, card, printing, foiling, condition)` with a quantity. A card may have
several stacks across binders. "All collection" and per-card displays aggregate
by `card_id` (so the grid stays one tile + total-owned badge); **moving** shifts
copies between binders. Deleting a binder cascades to its entries (FK
`ON DELETE CASCADE`, with the `foreign_keys` pragma on). Foilings come from the
dataset (Standard / Rainbow Foil / Cold Foil / Gold Cold Foil); conditions are
the usual NM / LP / MP / HP / DMG.

Commands: binder CRUD, `get_collection(binderId?)`,
`search_collection(query, binderId?)` (the catalog query language run against the
collection, scoped to a binder or all), `card_entries(cardId)` (a card's stacks
across binders — drives the detail copy list), `adjust_entry` (delta on a
specific stack; row removed at 0), `move_entry` (a specific stack),
`move_card_all` + `remove_card_from_binder` (bulk, for the grid menu), and
`owned_counts` (card id → total, for grid badges). The catalog search itself
takes an `owned_only` flag (the "Owned" switch / `have:`).

Catalog printings are deduped by collector id in `catalog.rs` (the source lists
one printing entry per foiling); foiling is tracked on the collection side
instead.

On the frontend, a **Browse / Collection** view toggle in `App` switches the
grid's data source; mutations bump a `collVersion` counter that the binder /
collection / owned-count / detail effects depend on, so everything refreshes
consistently from one place.

> **CSP:** `tauri.conf.json` has `csp: null` so remote images load during
> development. Set a real CSP (or cache images locally) before shipping.

## Frontend structure

- `lib/api.ts` — the **only** place that calls Tauri `invoke`. Keeps the IPC
  surface in one file.
- `lib/fab.ts` — pure presentation helpers (pitch colors, type line, rarity
  labels). No I/O.
- `components/` — `CardGrid` (responsive + row-virtualized), `CardTile` (a
  styled placeholder frame, ready to become an `<img>`), `CardDetail`
  (inspector), `SearchBar`.
- `App.tsx` — owns state (loaded cards, query, selection) and layout.

### Virtualization
`CardGrid` measures its width with a `ResizeObserver`, derives the column count,
and row-virtualizes via `@tanstack/react-virtual`. Only on-screen rows mount, so
the grid stays smooth as the catalog grows to thousands of cards.

## Conventions

- All backend access goes through `lib/api.ts`.
- Keep `card.rs` and `types/card.ts` in sync by hand for now. If the model
  churns a lot, generate the TS from Rust (e.g. `ts-rs`).
- Display logic (colors/labels/formatting) lives in `lib/fab.ts`, not in
  components.
