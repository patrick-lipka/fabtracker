# Project Log & Roadmap

A running journal so work can be picked up at any time. Newest entries on top.
The roadmap below it is the north star; the original vision follows.

---

## Log

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
2. **Real card data.** Replace the mock catalog with official Flesh and Blood
   data. Candidate sources to evaluate: the community
   [flesh-and-blood-cards dataset](https://github.com/the-fab-cube/flesh-and-blood-cards)
   (structured CSV/JSON, MIT-ish), and card images. Do the fetch + parse in
   Rust, cache locally. Map the source into our `Card` model in one place.
3. **Local persistence.** SQLite in the Rust core (e.g. `sqlx`/`rusqlite`) for
   the card catalog + the user's collection. Migrations. This unlocks fast
   queries and offline-by-default.
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

---

## Original vision (from the owner)

> Just started playing Flesh and Blood. What's missing is a great, easy-to-use
> tool like Moxfield for MTG: manage your collection, build decks, see which
> cards are missing, import precons directly to the collection, inspect precons,
> inspect sets, search for cards with nice syntax. Fabrary exists but feels
> clunky. Goal: a self-hosted or local app that pulls card data from official
> servers, using modern, natively-fast technology.
