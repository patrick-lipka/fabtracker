# FaB Tracker

A local-first, self-hostable collection & deck manager for **Flesh and Blood** —
think Moxfield, but native-fast and offline-capable.

> **Status:** Step 1 — browse & inspect cards (mock data). See
> [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md) for the roadmap and where we are.

## What it does today

- Loads a card catalog from the Rust backend and displays it in a responsive,
  virtualized grid.
- Click any card to inspect full details (stats, type line, keywords, text,
  set/rarity/artist).
- Live substring search across name, text, type, class, talent and keywords.

The card data is currently a **bundled mock catalog** (`src-tauri/data/mock_cards.json`).
Pulling real, official card data is a later step — the architecture is set up so
that's a localized change.

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

> Frontend-only (`npm run dev`) works for UI work, but `invoke("get_cards")`
> only resolves inside the Tauri runtime, so the grid will be empty in a plain
> browser. Use `npm run tauri dev` to see real data.

## Project layout

```
fabtracker/
├── src/                      # React + TypeScript frontend
│   ├── components/           # CardGrid, CardTile, CardDetail, SearchBar
│   ├── lib/                  # api.ts (Tauri IPC), fab.ts (display helpers)
│   ├── types/card.ts         # Card type — mirror of the Rust model
│   └── App.tsx               # layout + state
├── src-tauri/                # Rust backend (Tauri)
│   ├── src/card.rs           # Card domain model
│   ├── src/lib.rs            # Tauri app + commands (get_cards)
│   └── data/mock_cards.json  # bundled mock catalog
└── docs/
    ├── ARCHITECTURE.md       # decisions & rationale
    └── PROJECT_LOG.md        # roadmap + running log to resume work
```
