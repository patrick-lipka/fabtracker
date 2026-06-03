# Changelog

## v0.1.1 — first public release

FaB Tracker is a **local-first, offline-capable collection & deck manager for
Flesh and Blood** — Moxfield-style, but a fast native desktop app. Browse the
card catalog, organise your collection, build and validate decks, and import or
export decklists. Everything lives on your machine; there's no account and no
telemetry.

> v0.1.1 is the first build released to users. The feature set below shipped in
> v0.1.0; v0.1.1 only swaps in the new app icon and adds the About panel
> (see "Changes in v0.1.1" at the bottom).

### Browse & search
- The **full Flesh and Blood card catalog** (~4,285 cards) with official images,
  downloaded once and cached locally for instant, offline use.
- Responsive card grid with **Small / Medium / Large / List** views; click any
  card for full details — stats, keywords, traits, rules text, and every
  printing (set, rarity, artist).
- **Query-language search** run natively, e.g. `c:ninja pitch:1 pow>=4`,
  `kw:dominate cost<=2`, `set:wtr t:hero`, `cn:mst131`,
  `name:"command and conquer"` — plus a **visual Filters builder** for the same
  power without typing. Facets (type, keyword, trait, stat, set) are clickable.
- One-click **Cardmarket price** lookup per card.

### Collection
- Organise owned cards into **binders** (create / rename / delete), with
  owned-quantity badges and a Browse ⇄ Collection toggle.
- Track copies by **specific printing, foiling, and condition**.
- Search within your collection, and an "only cards I own" filter via the Filters
  popup.

### Decks
- Build a deck around a hero with a legal-card pool, **cost curve**, pitch
  breakdown, and attack/block stats.
- **Format legality** for **Classic Constructed, Blitz, and Silver Age**: deck &
  card-pool sizes, copy limits (by name, or name + colour), class/talent rules
  (including **multi-class** cards), Silver Age rarity, per-format
  bans / Living Legend / suspensions, and the young/adult hero requirement.
  Living-Legend (and otherwise illegal) heroes are shown greyed in the picker
  but remain buildable.
- A read-only **deck view** (card gallery + stats/notes) with click-to-inspect
  and a resizable detail pane; per-deck **Markdown notes**.
- **Add a deck's cards to a binder** in one click.

### Import & export
- **Import** a decklist pasted from Fabrary as a precon or a regular deck;
  precons get their own section under **Decks**, with the source linked in the
  deck notes.
- **Export** any deck to **Fabrary**, **GEM**, or plain text.

### Data, privacy & offline
- Local **SQLite** storage; card data fetched at runtime from the community
  the-fab-cube dataset (auto-tracks the active spoiler branch; the source is
  configurable in **⚙ Settings**).
- **Image cache** with size readout, a Clear button, and an opt-in "Download all
  images" for full offline use.
- No account, no tracking; fully usable offline after the first sync.

### Install
The binaries are **unsigned**, so on first launch:
- **macOS** — right-click the app → **Open** → **Open** (once).
- **Windows** — SmartScreen → **More info → Run anyway**.
- **Linux** — `chmod +x` the `.AppImage` and run, or install the `.deb`.

Then click **Download card data** (one-time ~20 MB fetch). After that it works
offline.

### Changes in v0.1.1
- New application icon.
- Added an **About** panel (ⓘ, top-right) showing the version, disclaimer, and
  credits.

---

FaB Tracker is an unofficial, fan-made tool and is **not affiliated with,
endorsed by, or sponsored by Legend Story Studios**. "Flesh and Blood" and all
card names, text, and images are © Legend Story Studios. Card data comes from
the community
[the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards)
dataset and is not redistributed with this app. App icon:
[Flash cards icons created by manshagraphics — Flaticon](https://www.flaticon.com/free-icons/flash-cards).
