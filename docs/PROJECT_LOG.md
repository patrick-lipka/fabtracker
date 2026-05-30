# Project Log & Roadmap

A running journal so work can be picked up at any time. Newest entries on top.
The roadmap below it is the north star; the original vision follows.

---

## Log

### 2026-05-30 — Step 2: real card data ✅
- Source: the community [the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards)
  dataset (English, `develop` ref) — `card.json` (~20 MB, **4285 unique cards**)
  + `set.json` for set names. Real LSS card images via per-printing `image_url`.
- **Licensing decision:** the dataset has no license and the data/images are LSS
  IP, so we do **not** vendor it. The Rust backend downloads it at runtime into
  the app cache dir (`app_cache_dir`) and parses on load. Removed the bundled
  mock catalog.
- New Rust module `catalog.rs`: `Raw*` structs for the source schema, mapped
  into our domain model; `sync()` (download + cache + parse) and `load_cached()`.
  Added `reqwest` (rustls + gzip).
- Revised `Card` model to match reality: string stats parsed to numbers + raw
  text fallback (`*`/`X`/`XX`), `types`/`traits`/`keywords`, printed `typeText`,
  and a `printings` list (set/rarity/artist/image/flavor).
- Commands: `get_cards` (cache-aware, empty ⇒ not synced) and async `sync_cards`.
- Frontend: real card images in grid + detail with the styled frame as fallback;
  first-run "Download card data" flow and a header "Re-sync" button.
- Verified: `cargo check --tests`, network-gated test
  `cargo test -- --ignored` (downloads + parses 4285 cards, cache round-trips),
  `npm run build`, and `tauri dev` with a seeded cache rendering the real grid.

### 2026-05-30 — Step 1: card browser (mock data) ✅
- Scaffolded Tauri v2 + React 19 + TypeScript + Vite; added Tailwind v4 (Vite
  plugin) and `@tanstack/react-virtual`.
- Defined the `Card` domain model in Rust (`src-tauri/src/card.rs`) and mirrored
  it in TS (`src/types/card.ts`).
- Mock catalog of ~23 cards in `src-tauri/data/mock_cards.json`, served by the
  `get_cards` Tauri command (loaded via `include_str!`).
- UI: responsive virtualized `CardGrid`, `CardTile` placeholder frames with
  pitch-color accents, `CardDetail` inspector, live substring `SearchBar`.
- Verified: `npm run build` and `cargo check` both clean; `npm run tauri dev`
  launches the window successfully.
- Note: required bumping the Rust toolchain (was 1.77, a transitive dep needs
  edition 2024) → `rustup update stable` brought it to 1.96.

---

## Roadmap

Rough order; each is its own focused chunk of work.

1. **Card browser (mock data)** — ✅ done. Browse + inspect.
2. **Real card data** — ✅ done. Runtime download + cache + parse of the
   the-fab-cube dataset (4285 cards), real images, first-run sync flow.
3. **Local persistence.** SQLite in the Rust core (e.g. `sqlx`/`rusqlite`) for
   the card catalog + the user's collection. Migrations. This unlocks fast
   queries and offline-by-default. Currently the full catalog is parsed from the
   cached JSON on every launch and sent over IPC in one shot — fine at 4285
   cards, but SQLite + querying/paging in Rust is the next scalability step.
4. **Rich search syntax.** Grow `SearchBar` into a real query language
   (`c:ninja pitch:1 pow>=4 set:wtr`). Parse in Rust against the DB / an index;
   keep the current substring search as the fallback.
5. **Collection management.** Track owned quantities (per edition/foiling), add
   from sets, see totals/value.
6. **Deck building.** Build decks against a hero, validate legality (class,
   talent, card limits, format), show the curve/breakdown.
7. **"Missing cards" view.** Diff a deck (or a precon) against the collection.
8. **Precons / sets.** Inspect sets and preconstructed decks; import a precon
   straight into the collection.

## Cross-cutting things to set up when they start to hurt

- **Tests.** Rust unit tests for parsing/search/deck rules; a component test
  setup (Vitest) for the frontend.
- **TS/Rust model drift.** If `Card` changes often, generate `types/card.ts`
  from Rust with `ts-rs` instead of hand-mirroring.
- **State management.** Plain React state is fine now. Revisit (e.g. Zustand /
  TanStack Query) when collection + deck state gets shared across many views.
- **Component library.** Consider shadcn/ui or Radix when the UI grows beyond a
  handful of bespoke components.
- **Content Security Policy.** `tauri.conf.json` currently has `csp: null` so
  remote card images load freely. Before shipping, set a real CSP (allow
  `img-src https://storage.googleapis.com` etc.) — or cache images locally.
- **Data source / freshness.** Pinned to the `develop` ref in `catalog.rs`
  (`DATA_REF`). Consider pinning to a release tag for reproducibility, and
  showing the last-synced date / catalog version in the UI.

---

## Original vision (from the owner)

> Just started playing Flesh and Blood. What's missing is a great, easy-to-use
> tool like Moxfield for MTG: manage your collection, build decks, see which
> cards are missing, import precons directly to the collection, inspect precons,
> inspect sets, search for cards with nice syntax. Fabrary exists but feels
> clunky. Goal: a self-hosted or local app that pulls card data from official
> servers, using modern, natively-fast technology.
