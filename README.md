# FaB Tracker

A local-first, self-hostable collection & deck manager for **Flesh and Blood** —
think Moxfield, but native-fast and offline-capable.

> **Status:** Step 3 — browse & inspect the full real card pool, persisted in a
> local SQLite database. See [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md) for the
> roadmap and where we are.

## What it does today

- Downloads the **full real Flesh and Blood card catalog** (~4285 cards, with
  official card images) on first run and stores it in a local **SQLite**
  database for instant, offline loading; a "Re-sync" button refreshes it, and
  the header shows when it was last synced.
- Displays the catalog in a responsive, virtualized grid with real card images
  (a styled frame is shown while images load or if one is missing).
- Click any card to inspect full details (stats, type line, keywords, traits,
  rules text, and every printing with its set/rarity/artist).
- Live substring search across name, text, type, traits, keywords and sets.

### Where the data comes from

The card data is fetched at runtime from the community-maintained
[the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards)
dataset (English). We **don't** vendor it into this repo — the data and images
are Legend Story Studios IP — so the app downloads it and stores it in a local
SQLite database. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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
│   ├── components/           # CardGrid, CardTile, CardDetail, SearchBar
│   ├── lib/                  # api.ts (Tauri IPC), fab.ts (display helpers)
│   ├── types/card.ts         # Card type — mirror of the Rust model
│   └── App.tsx               # layout + state
├── src-tauri/                # Rust backend (Tauri)
│   ├── src/card.rs           # Card domain model (Card + Printing)
│   ├── src/catalog.rs        # download + parse official data (fetch_catalog)
│   ├── src/db.rs             # SQLite persistence (migrations, store/load)
│   └── src/lib.rs            # Tauri app + commands (get_cards, sync_cards, …)
└── docs/
    ├── ARCHITECTURE.md       # decisions & rationale
    └── PROJECT_LOG.md        # roadmap + running log to resume work
```
