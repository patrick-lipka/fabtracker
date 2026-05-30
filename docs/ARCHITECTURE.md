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

Currently the catalog is a JSON file (`src-tauri/data/mock_cards.json`) compiled
into the binary via `include_str!` and served by the `get_cards` command. This is
deliberately the same *shape* we expect real data to arrive in (JSON), so the
swap is localized to "where the bytes come from".

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
