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
- The `Card` model is defined in `src-tauri/src/card.rs` and hand-mirrored in
  `src/types/card.ts` (Rust serializes camelCase). Keep them in sync; if it
  churns, switch to generating the TS (`ts-rs`).
- Mock catalog: `src-tauri/data/mock_cards.json`, served by `get_cards`.

## House style
- Match the surrounding code's idiom and comment density.
- Prefer small, focused components and pure helpers.
