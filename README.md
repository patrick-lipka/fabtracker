# FaB Tracker

A local-first, self-hostable collection & deck manager for **Flesh and Blood** —
think Moxfield, but native-fast and offline-capable.

> **Status:** Step 6 — browse, search, build a binder **collection**, and build
> **decks** (all in local SQLite). See [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md)
> for the roadmap and where we are.

## What it does today

- Downloads the **full real Flesh and Blood card catalog** (~4285 cards, with
  official card images) on first run and stores it in a local **SQLite**
  database for instant, offline loading; a "Re-sync" button refreshes it, and
  the header shows when it was last synced.
- Displays the catalog in a responsive, virtualized grid with real card images
  (a styled frame is shown while images load or if one is missing). Switch
  between **small / medium / large** image sizes (large = max 2 per row) or a
  **list** view (image-free data table) — applies to Browse and Collection.
- Click any card to inspect full details (stats, type line, keywords, traits,
  rules text, and every printing with its set/rarity/artist). Detail facets are
  **clickable** — click a type, keyword, trait, stat, or a printing's set to
  search for it (e.g. click "Instant" → `t:Instant`).
- **Query-language search** parsed and run in the Rust/SQLite backend, e.g.
  `c:ninja pitch:1 pow>=4`, `kw:dominate cost<=2`, `set:wtr t:hero`,
  `cn:mst131`, `name:"command and conquer"`. A "?" popover documents the syntax.
  Bare words match name + type + rules text + collector number.
- **Collection in binders.** A Browse / Collection toggle; organize owned cards
  into binders (create/rename/delete), with owned-quantity badges. Track copies
  by **specific printing, foiling (Standard / Rainbow / Cold / Gold), and
  condition (NM…DMG)** via the detail pane's add-copy form + per-copy steppers.
  Quick-add a card from the grid ("+" on hover or right-click); move cards
  between binders from the grid (bulk) or per copy in the detail pane. "All"
  aggregates across binders. The same query language works **within the
  Collection tab** (scoped to the selected binder or all), and an **"Owned"**
  switch (or `have:` in a query) restricts Browse search to cards you own.
- **Deck building** (Decks tab, MTG-Arena-style). Start a deck by picking a hero
  (all heroes, or owned-only), then build in a two-pane editor: a hero-legal
  card pool on the left, the deck on the right with a **cost curve + pitch
  breakdown**, **format legality** (Classic Constructed / Blitz / Silver Age:
  size, copy limits, class/talent, bans / Living Legend / suspensions), a slots
  overview, and a **missing-vs-collection** count.

### Where the data comes from

The card data is fetched at runtime from the community-maintained
[the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards)
dataset (English). We **don't** vendor it into this repo — the data and images
are Legend Story Studios IP — so the app downloads it and stores it in a local
SQLite database. By default it **auto-tracks the newest data across the dataset's
branches** (the maintainer keeps spoiler-season cards on rotating feature
branches) and re-syncs on launch when the remote is ahead; you can pin a specific
branch/tag via the ⚙ data-source control. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) | Native webview, ~MBs not ~100MBs, Rust backend, cross-platform. |
| Backend / core | Rust | Where the heavy lifting goes: SQLite collection DB, search index, official-data sync, deck math. |
| Frontend | React 19 + TypeScript + [Vite](https://vite.dev) | Largest ecosystem & component options for a polished, data-dense UI. |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) | Fast iteration on dense layouts. |
| Grid virtualization | [@tanstack/react-virtual](https://tanstack.com/virtual) | Keeps the grid smooth at thousands of cards. |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full rationale and
alternatives considered.

## Prerequisites

- **Node.js** ≥ 20 (tested on 24) and npm
- **Rust** ≥ 1.85 (tested on 1.96) via [rustup](https://rustup.rs) — `rustup update stable`
- Platform deps for Tauri: see <https://tauri.app/start/prerequisites/>
  (on macOS, Xcode Command Line Tools are enough)

## Run it

```bash
npm install            # first time only
npm run tauri dev      # launch the desktop app with hot reload
```

Other useful commands:

```bash
npm run dev            # frontend only, in the browser (http://localhost:1420)
npm run build          # type-check + production build of the frontend
npm run tauri build    # produce a distributable desktop binary
```

> Frontend-only (`npm run dev`) works for UI work, but the Tauri `invoke`
> commands only resolve inside the Tauri runtime, so the grid will be empty in a
> plain browser. Use `npm run tauri dev` to see real data.
>
> On first launch the app shows a **Download card data** button (one-time ~20 MB
> fetch). It's stored in a SQLite database in the OS app-data dir, e.g. on macOS
> `~/Library/Application Support/com.fabtracker.app/fabtracker.db`; later
> launches load instantly from there.

## Project layout

```
fabtracker/
├── src/                      # React + TypeScript frontend
│   ├── components/           # CardGrid, CardList, CardTile, CardDetail, SearchBar, BinderBar, BinderMenu, DataSourceButton, DecksTab, DeckEditor
│   ├── lib/                  # api.ts (Tauri IPC), fab.ts (display helpers)
│   ├── types/card.ts         # Card type — mirror of the Rust model
│   └── App.tsx               # layout + state
├── src-tauri/                # Rust backend (Tauri)
│   ├── src/card.rs           # Card domain model (Card + Printing)
│   ├── src/catalog.rs        # download + parse official data (fetch_catalog)
│   ├── src/db.rs             # SQLite persistence (migrations, store/load/search)
│   ├── src/search.rs         # query language → parameterized SQL WHERE
│   ├── src/collection.rs     # binders + per-card quantities
│   ├── src/deck.rs           # decks: legality, curve, missing-vs-collection
│   └── src/lib.rs            # Tauri app + commands (get_cards, search_cards, …)
└── docs/
    ├── ARCHITECTURE.md       # decisions & rationale
    └── PROJECT_LOG.md        # roadmap + running log to resume work
```
