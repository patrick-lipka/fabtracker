# Project Log & Roadmap

A running journal so work can be picked up at any time. Newest entries on top.
The roadmap below it is the north star; the original vision follows.

---

## Log

### 2026-06-03 — Security hardening + local image cache ✅
- **Audit:** no secrets/API keys (no AI SDK at all), no `.env`/credentials, no
  card data/DB/build artifacts tracked, SQL fully parameterized, no XSS sinks,
  no remote IPC. Set a **Content Security Policy** (was `null`) and narrowed the
  opener capability to `allow-open-url`; fixed the default `index.html` title.
- **Image cache:** card images now route through a `cardimg://` custom protocol
  (`imagecache.rs`) that downloads each image once to the app cache dir and
  serves it from disk — faster reloads + offline. Frontend `cachedImg()` wraps
  every `<img>`; CSP `img-src` allows the scheme.

### 2026-06-02 — Legality: multi-class cards + CC/Silver Age rules ✅
- **Multi-class cards** (e.g. Brute/Warrior, Pirate/Necromancer) are now legal
  for a hero of *any* of their classes (talent must still match). Split the
  IDENTITY set into CLASSES/TALENTS and changed the rule from "hero shares all
  identity words" to "shares ≥1 class and ≥1 talent" (backend + `fab.ts`).
- **Silver Age**: only common/rare/basic rarity (by *ever-printed* rarity, cards
  + hero); pool (arena + deck) **max 55**; ≤2 per unique (name+color); young
  hero. The 40-card deck is per-game, so we cap the pool rather than fix the deck.
- **Classic Constructed**: copies are now per unique (**name + color**), max 3
  (was per name); deck ≥60 **and** pool **max 80**; adult (non-young) hero.
- Card-pools are a **maximum**, not a fixed size — only flagged when exceeded.
- The hero young/adult requirement is now enforced in the deck legality too (was
  only at hero-pick time). Per-format ban/LL/suspended lists still need a Re-sync.

### 2026-06-02 — Add a deck's cards to a binder ✅
- The deck view's right pane gains an **Add to collection** block: pick a binder
  and **Add all** adds the hero + every card at the deck's quantities (newest
  printing, Standard / NM) to that binder. Backend `add_deck_to_collection`
  loops `collection::adjust_entry`; the deck refetches so missing/owned update.

### 2026-06-02 — Import decklists from Fabrary (precons + decks) ✅
- **Decks → Import**: paste a Fabrary text export (`Copy card list to clipboard`)
  and save it as a deck. An **Import as: Precon / Deck** toggle flags it; precons
  show in a separate **Imported precons** section on the Decks tab, regular
  imports go to **My Decks**. Source URL (parsed from the export, editable) is
  stored and seeded into the deck notes as a link.
- Parser/resolver in `src/lib/decklist.ts`: reads the `Name:` / `Hero:` /
  `Format:` header (resolves the hero from the `Hero:` line), skips
  `Arena cards` / `Deck cards` headers and the footer, handles `Nx Name`,
  `(red/yellow/blue)` pitch, and collector numbers; resolves names → catalog
  card ids in the frontend; surfaces unmatched lines. Backend `import_deck`
  (migration v6: `decks.is_precon` + `source_url`) inserts in one transaction.
- **Why no in-app browser / API pull:** researched LSS CardVault (official
  product list, but no decklists/quantities), the-fab-cube (precon *sets* =
  distinct cards only, no copy counts), and Fabrary (full lists, but key-gated
  backend — off limits). An embedded Fabrary webview was prototyped and dropped:
  WKWebView can't run Fabrary's async `clipboard.write([ClipboardItem])` copy
  (only sync `writeText` works), making the copy step a dead end. So the user
  copies in their own browser and pastes here — the principled, reliable path.

### 2026-06-02 — Deck view (card gallery) as the default; Edit Deck button ✅
- Opening a deck now shows a read-only **deck view** (`DeckView`): full card
  images grouped Hero / Weapons / Equipment / Main deck (×N badges) on the left,
  and the stats panel (legality + missing + `DeckStats`) on the right.
- An **Edit deck** button opens the builder (`DeckEditor`) as before; its back
  button ("← Done") returns to the view. New decks still open the builder;
  deleting returns to the list. Navigation is now list → view → editor.

### 2026-06-01 — Fabrary-style deck statistics ✅
- New `DeckStats` (in the deck editor's Deck tab), modelled on Fabrary's stats:
  Cards / Resources / Avg cost summary; **pitch** distribution (Red/Yellow/Blue
  counts + % + blank-pitch + avg pitch); **cost curve**; **card types** (attack
  actions, attack/defense reactions, instants, other actions); **Attacks**
  (count·power·avg) and **Blocks** (count·def·avg·block 3+). Computed client-side
  from the deck's cards.
- Fixed the cost-curve bars (were collapsing — percentage height on a flex child
  with no definite parent height → now computed pixel heights).
- Not (yet) reproduced from Fabrary: the hypergeometric hand-probability
  calculator (a larger standalone feature).

### 2026-06-01 — Deck notes (WYSIWYG Markdown) + clearer name editing ✅
- Markdown `notes` column on decks (migration v5) + `set_deck_notes` command;
  `get_deck` returns it.
- Deck editor: a **Deck / Notes** tab in the right panel. Notes is an
  Obsidian-style **live WYSIWYG Markdown editor** (Milkdown "Crepe", nord-dark),
  round-tripping to Markdown, autosaved (debounced 700 ms; a pending save still
  fires after navigating away). New dep: `@milkdown/crepe`.
- Deck name is a clearly-editable field (Enter or blur to save; reverts if
  cleared).

### 2026-06-01 — Richer deck legality (bans/LL/suspended, Silver Age) ✅
- Ingested per-format legality flags from `card.json` onto `Card` (Option<bool>,
  so older cached cards degrade to "unknown"): `*_legal`, `*_banned`,
  `*_living_legend`, `*_suspended` for CC / Blitz / Silver Age.
- `deck.rs` legality now flags, per the deck's format: cards **not legal**,
  **banned**, **Living Legend**, or **suspended** (incl. the hero), on top of
  size + copy limits + class/talent. Per-card `legal` (pool filter + red
  highlight) factors format legality too (`formatAllowed`/`legalForDeck` mirror
  in `fab.ts`).
- **Silver Age** format added (Blitz-shaped per LSS: young hero, 40-card deck,
  **max 2 per name+color**, Silver Age pool/bans). Format selector now CC /
  Blitz / Silver Age.
- **Deck creation is now format-first**: pick the format, then the hero picker
  shows only that format's heroes (Blitz/Silver Age → young, CC → adult, via the
  `Young` type tag + ban flags), then the editor pool filters to legal cards.
- **Slots overview** in the deck panel (Weapons + Head/Chest/Arms/Legs/Off-Hand
  counts) — guidance, not a hard cap (FaB doesn't limit equipment per slot at
  construction).
- **Sync resilience:** if the GitHub branch-resolution API is unavailable (e.g.
  rate-limited), sync falls back to the raw CDN (not rate-limited) using the
  last-synced branch; the launch update-check is throttled to once / 6 h.
- **Re-sync required** to populate the new flags. Tests: `format_bans_and_silver_age`
  + the network test asserts flags parse.

### 2026-06-01 — Step 6: deck building + My Decks tab ✅
- Backend: migration v4 (`decks`, `deck_cards`). New `deck.rs`: CRUD,
  `adjust_deck_card`, `list_heroes(ownedOnly)`, and `get_deck` computing resolved
  cards (+owned), **cost curve + pitch counts**, **missing-vs-collection**, and
  **legality** — format size (CC ≥60 / Blitz =40 main-deck cards), per-name copy
  limits (3 / 2), and hero **class/talent legality** via an `IDENTITY` word set
  (lenient on unknown new words). Commands wired; tests for legality/stats and
  copy-limit/delete.
- Deferred (noted): ban/suspended/Living-Legend lists, weapon/equipment slot
  limits, specialization cards, Commoner format.
- Frontend (MTG-Arena-inspired): a **Decks** tab — My Decks list → **New deck**
  → **hero picker** (all heroes or owned-only) → two-pane **editor**: legal card
  pool (search + "Legal only" toggle, click to add) on the left; deck panel on
  the right with editable name, CC/Blitz selector, hero, legality status +
  issues, **cost curve + pitch bars**, missing-from-collection count, and the
  card list grouped Weapons/Equipment/Main with steppers.
- Verified: 15 backend tests, `npm run build`, v4 migration applied to the real
  DB (144 heroes), app boots clean.

### 2026-06-01 — `binder:` search filter + Cardmarket link ✅
- `binder:<name>` (alias `bin:`) restricts results to cards held in a binder
  whose name matches — `search::BINDER_CLAUSE` (EXISTS over `collection_entries`
  joined to `binders`), works in Browse and Collection via `build_where`. Added
  to the syntax popup. Tests: `binder_field`, `binder_search_filter`.
- Detail pane: a "Cardmarket prices ↗" button opens a Cardmarket (EU) search
  for the card in the system browser (opener plugin). No price data stored.

### 2026-06-01 — Card view options (image sizes + list) ✅
- Header toggle `[S] [M] [L] [☰]` (shared by Browse and Collection, persisted in
  localStorage): **small / medium (default) / large** image sizes, plus a
  **list** view (no images — a dense, virtualized data table: name, type, pitch,
  cost, P/D, rarity, owned qty).
- `CardGrid` parameterized by `size` (min tile width + column cap); **large** is
  capped at **2 columns at any window width**. New `CardList` component
  (virtualized rows, right-click / + binder menu, owned-qty column). List
  columns are **sortable** — click a heading to sort, click again to flip
  direction (missing values sort last; rarity sorts by rank).

### 2026-05-31 — Auto-tracking, configurable data source ✅
- **Why:** the maintainer keeps newest/spoiler-season cards on rotating feature
  branches (e.g. `omens-of-the-third-age`), ahead of `develop`. A card the user
  physically owned (Basalt Boots, SBR012/PEN019) was only on that branch.
- `catalog.rs`: `resolve_ref(mode)` — "auto" picks the branch with the **newest
  commit across all branches** (via the GitHub API), so it follows whichever
  branch is currently active; or an explicit branch/tag/sha. `fetch_catalog_at`
  pulls a specific ref; we sync at the resolved **commit sha** and record it.
- Update detection: `check_updates` compares the resolved sha to the last-synced
  sha. The frontend runs it on launch and **auto-re-syncs when the remote is
  ahead**. `set_data_ref` persists the mode (default "auto") in `meta`.
- UI: a ⚙ data-source popover (Auto vs specific branch/tag) and the header now
  shows the synced branch. New generic `db::get_meta` / `set_meta`.
- Verified: auto-detected `omens-of-the-third-age` on launch, pulled 4857 cards,
  Basalt Boots now present.

### 2026-05-31 — Search by collector number ✅
- Collector numbers (e.g. `MST131`, `WTR043`) are now searchable: folded into
  bare-word free text and exposed as a `cn:` / `num:` field, matching any of a
  card's printing ids (`json_each` over `printings`). Works in both Browse and
  Collection (both go through `build_where`). Added a tip + `cn:` to the syntax
  popup. Test: `collector_number_field`.

### 2026-05-31 — Detail image follows the selected printing ✅
- Pulled set **release dates** from `set.json` into the catalog; each `Printing`
  now carries `released`, and a card's printings are **sorted newest-first**
  (`catalog.rs`). Verified against real data (all 4285 cards correctly ordered).
- The detail pane shows the chosen printing's art: defaults to the **newest**
  printing in Browse and the **newest owned** printing in Collection, and the
  Printings list is clickable to switch (with the shown one highlighted + the
  release date displayed). Image element is keyed by URL so it reloads cleanly.
- **Re-sync** needed to populate dates / ordering for the already-cached catalog.

### 2026-05-31 — Printing, foiling & condition tracking ✅
- Collection entries are now keyed by **(binder, card, printing, foiling,
  condition)** + quantity. Migration v3 rebuilds `collection_entries`,
  preserving existing rows (mapped to each card's first printing, Standard, NM).
  Applied cleanly to the real v2 DB.
- `collection.rs`: `adjust_entry` / `move_entry` (specific stack),
  `move_card_all` + `remove_card_from_binder` (bulk, for the grid menu),
  `card_entries` (a card's stacks across binders). `list_binders.card_count` is
  now `COUNT(DISTINCT card_id)`. `get_collection` / `search_collection` still
  aggregate per card, so the grid stays one tile + total-owned badge.
- `catalog.rs` dedupes printings by collector id (the source lists one entry per
  foiling). **Re-sync** to refresh the cached catalog's printing lists.
- Foilings: Standard / Rainbow Foil / Cold Foil / Gold Cold Foil. Conditions:
  NM / LP / MP / HP / DMG.
- Frontend: the detail "Collection" section is now an **add-copy form**
  (binder · printing · foiling · condition) plus a list of your actual copies
  with +/- steppers and a per-copy "Move to…". The grid "+" quick-adds the
  representative printing (Standard/NM); the grid menu keeps bulk move-all /
  remove-from-binder.
- Verified: `cargo test --lib` (10), `npm run build`, and the v3 migration on
  the real DB (schema rebuilt, rows preserved).

### 2026-05-31 — Search within the Collection tab / binders ✅
- The Collection view now runs the full query language in the backend instead of
  a client-side name filter. New `collection::search_collection(query, binderId)`
  joins `collection_entries` to `cards`, applies the parsed `WHERE`, and
  aggregates quantities — scoped to a binder or across all. Command
  `search_collection`; the frontend calls it debounced on query/binder change.
- Empty-state copy distinguishes "binder is empty" from "no matches".
- Test: `search_within_collection_and_binders` (query filtering + binder scope,
  including after a move).

### 2026-05-31 — `have:` / "Owned" search filter ✅
- Search can now restrict to cards in the collection. Backend: a shared
  `search::OWNED_CLAUSE` (EXISTS over `collection_entries`), exposed both as a
  `have:`/`owned:` query field and as an `owned_only` flag on `search_cards`.
- Frontend: an "Owned" toggle switch in the header (Browse view). With an active
  query it's applied in SQL; with an empty query it's applied in-memory against
  the owned map (instant). Tests cover the owned filter + the `have:` token.

### 2026-05-31 — Step 5: collection management with binders ✅
- DB migration v2 adds `binders` and `collection_entries` (PK binder_id+card_id,
  quantity), with a seeded "Main" binder. Applied cleanly to the existing v1 DB.
- New `collection.rs`: binders CRUD, `adjust_card` (delta, deletes at 0),
  `move_card` (atomic, between binders), `get_collection(binderId?)` (aggregates
  across binders for "All"), `card_binders` (per-binder quantities for a card),
  `owned_counts`. Commands wired in `lib.rs`. Tests cover add/move/aggregate +
  cascade-on-delete.
- Model (v1): cards tracked by unique id with a quantity; a card can live in
  several binders. **Deferred:** per-printing / foiling granularity, and a
  `have:` search filter.
- Frontend: **Browse / Collection** tab toggle. Collection view has a binder bar
  (All + binders + inline create/rename/delete). Grid tiles show an owned-qty
  badge and a "+" / right-click binder menu (add, and in a binder: move all /
  remove). Detail pane gained a Collection section with per-binder quantity
  steppers (which also serves as the move UI). All mutations refresh via a
  `collVersion` bump.
- Verified: `cargo test --lib` (9 tests), `npm run build`, `tauri dev` with the
  v2 migration applied to the real DB (binders table seeded, 4285 cards intact).

### 2026-05-30 — Clickable facets in the detail pane ✅
- The card detail pane is now a set of clickable facets: types, keywords and
  traits (chips), the stat boxes (pitch/cost/power/defense/health/intellect/
  arcane, when numeric), and each printing's set name. Clicking one populates
  the search box with the matching query (e.g. `t:Instant`, `kw:"Go again"`,
  `power:6`, `set:"Welcome to Rathe"`) via an `onSearch` callback threaded from
  `App` → `CardDetail`. Multi-word values are auto-quoted. Pure frontend; reuses
  the existing search backend.

### 2026-05-30 — Step 4: rich search syntax ✅
- New `search.rs`: a Scryfall/Moxfield-style query language. Tokenizes (respects
  quoted phrases), parses `field<op>value` terms, and builds a parameterized SQL
  `WHERE` clause + bound params. Implicit AND between terms; unknown fields fall
  back to free text.
- Fields: `name`, `text`/`o`, `type`/`t`, `class`/`c`, `keyword`/`kw`, `trait`,
  `set`/`s`, `rarity`/`r`, `color`; numeric (`: = > < >= <=`) `pitch`, `cost`,
  `power`/`pow`/`p`, `defense`/`def`/`d`, `health`/`hp`, `intellect`/`int`,
  `arcane`. Bare words match name + type line + rules text.
- Scalar columns back numeric/equality filters; SQLite `json_each` /
  `json_extract` over the `data` blob back the array fields (types, keywords,
  sets incl. set codes via printings).
- New `search_cards(query)` command (`db::search_cards`). Frontend runs it
  debounced (180 ms); empty query shows the in-memory full list (no round-trip).
  Added a "?" syntax-help popover with clickable examples.
- Verified: `cargo test --lib` (parser unit tests + end-to-end search over an
  in-memory DB: `c:ninja`, `pow>=10`, `t:hero`, `color:blue`, `kw:crush`, quoted
  phrase, combined terms, free text), `npm run build`, `tauri dev`.

### 2026-05-30 — Step 3: SQLite persistence ✅
- Added `rusqlite` (bundled — no system SQLite dep) + `rusqlite_migration`.
- New `db.rs`: opens `fabtracker.db` in the OS **app-data** dir (persistent,
  distinct from the re-downloadable cache), runs ordered migrations, and
  stores/loads cards. Storage strategy: indexed scalar columns (name, pitch,
  cost, power, …) **plus a `data` JSON column** holding the full `Card` — cheap
  full reconstruction now, SQL filtering when richer search lands. A `meta`
  table tracks `last_synced`.
- `catalog.rs` slimmed to fetch+parse only (`fetch_catalog`); file caching
  removed — the DB is now the single source of truth.
- The connection is opened once in `setup` and shared via Tauri managed state
  (`Mutex<Connection>`); `sync_cards` downloads then replaces the table in one
  transaction (no DB lock held across the network await). `get_cards` now reads
  the DB instead of re-parsing 20 MB of JSON on every launch.
- New `get_catalog_info` command + a "Synced …" indicator in the header.
- Verified: `cargo test --lib` (DB round-trip + meta), `cargo test -- --ignored`
  (real network fetch), `npm run build`, and `tauri dev` loading 4285 cards from
  SQLite.

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

> Steps 1–6 are done (browse, real data, SQLite, search, collection, decks).
> Next candidates: richer deck legality (bans/LL, slot limits), deck export/
> import, set/value totals, collection stats.

1. **Card browser (mock data)** — ✅ done. Browse + inspect.
2. **Real card data** — ✅ done. Runtime download + cache + parse of the
   the-fab-cube dataset (4285 cards), real images, first-run sync flow.
3. **Local persistence** — ✅ done. SQLite (`rusqlite`) in the app-data dir,
   migrations, catalog stored as indexed columns + JSON. Collection/decks will
   add tables here. (Still sent to the frontend in one shot — paging/filtering
   in SQL comes with the search step.)
4. **Rich search syntax** — ✅ done. Query language parsed in Rust, run against
   SQLite (scalar columns + JSON functions). FTS5 for faster/fuzzier text search
   is a possible future optimization but not needed at this scale.
5. **Collection management** — ✅ done. Binders, per-card quantities,
   add/move/remove, owned badges, a `have:` / "Owned" search filter, and
   per-printing / foiling / condition tracking. Follow-ups: a `binder:` search
   filter, set/value totals (e.g. via the TCGplayer ids in the data).
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
