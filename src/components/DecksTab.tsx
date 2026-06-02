import { useEffect, useMemo, useState } from "react";
import type { Card, DeckFormat, DeckSummary, OwnedCounts, ViewMode } from "../types/card";
import { createDeck, listDecks, listHeroes } from "../lib/api";
import { heroCategoryOk, heroFormatIssue } from "../lib/fab";
import { CardGrid } from "./CardGrid";
import { DeckEditor } from "./DeckEditor";
import { DeckImport } from "./DeckImport";
import { DeckView } from "./DeckView";
import { ViewModeToggle } from "./ViewModeToggle";

const FORMAT_NAME: Record<string, string> = {
  cc: "Classic Constructed",
  blitz: "Blitz",
  silver_age: "Silver Age",
};
const FORMAT_ORDER = ["cc", "blitz", "silver_age"];

/** Grid column width per view size; list is handled separately. */
const COL_MIN: Record<Exclude<ViewMode, "list">, string> = {
  small: "180px",
  medium: "240px",
  large: "320px",
};

const FORMATS: { value: DeckFormat; name: string; blurb: string }[] = [
  { value: "cc", name: "Classic Constructed", blurb: "60+ card deck · up to 80-card pool · max 3 per name+color · adult hero" },
  { value: "blitz", name: "Blitz", blurb: "40 cards · max 2 of a name · young heroes" },
  { value: "silver_age", name: "Silver Age", blurb: "40-card deck · up to 55-card pool · max 2 per name+color · young hero · common/rare/basic only" },
];

interface DecksTabProps {
  cards: Card[];
  owned: OwnedCounts;
}

type Screen = "list" | "new" | "view" | "editor" | "import";

/** The "Decks" tab: deck list → hero picker → editor. */
export function DecksTab({ cards, owned }: DecksTabProps) {
  const [screen, setScreen] = useState<Screen>("list");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newFormat, setNewFormat] = useState<DeckFormat | null>(null);
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("fabtracker:deckListView") as ViewMode) || "medium",
  );
  useEffect(() => localStorage.setItem("fabtracker:deckListView", view), [view]);

  function refreshDecks() {
    listDecks().then(setDecks).catch(() => {});
  }
  useEffect(refreshDecks, []);

  function open(id: number) {
    setEditingId(id);
    setScreen("view");
  }

  const myDecks = decks.filter((d) => !d.isPrecon);
  const precons = decks.filter((d) => d.isPrecon);

  // Group a deck list by format for the image views; known formats first.
  const groupByFormat = (list: DeckSummary[]) => {
    const present = [...new Set(list.map((d) => d.format))].sort(
      (a, b) => (FORMAT_ORDER.indexOf(a) + 1 || 99) - (FORMAT_ORDER.indexOf(b) + 1 || 99),
    );
    return present.map((fmt) => [fmt, list.filter((d) => d.format === fmt)] as const);
  };

  // Render one deck list in the current view (list rows or format-grouped grid).
  const renderDecks = (list: DeckSummary[]) =>
    view === "list" ? (
      <div className="flex flex-col gap-1.5">
        {list.map((d) => (
          <DeckRow key={d.id} deck={d} onOpen={() => open(d.id)} />
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-6">
        {groupByFormat(list).map(([fmt, group]) => (
          <section key={fmt}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {FORMAT_NAME[fmt] ?? fmt}
              <span className="ml-2 normal-case text-muted/70">{group.length}</span>
            </h3>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${COL_MIN[view]},1fr))` }}
            >
              {group.map((d) => (
                <DeckCard key={d.id} deck={d} onOpen={() => open(d.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );

  if (screen === "view" && editingId !== null) {
    return (
      <DeckView
        deckId={editingId}
        onEdit={() => setScreen("editor")}
        onBack={() => {
          setScreen("list");
          refreshDecks();
        }}
      />
    );
  }

  if (screen === "editor" && editingId !== null) {
    return (
      <DeckEditor
        deckId={editingId}
        cards={cards}
        owned={owned}
        onBack={() => {
          setScreen("view");
          refreshDecks();
        }}
        onChanged={refreshDecks}
        onDeleted={() => {
          setScreen("list");
          refreshDecks();
        }}
      />
    );
  }

  if (screen === "import") {
    return (
      <DeckImport
        cards={cards}
        onCancel={() => setScreen("list")}
        onImported={(id) => {
          refreshDecks();
          setEditingId(id);
          setScreen("view");
        }}
      />
    );
  }

  if (screen === "new") {
    // Step 1: pick a format. Step 2: pick a hero legal in that format.
    if (!newFormat) {
      return <FormatPicker onCancel={() => setScreen("list")} onPick={setNewFormat} />;
    }
    return (
      <HeroPicker
        format={newFormat}
        onCancel={() => setNewFormat(null)}
        onPick={(hero) =>
          createDeck(hero.name, newFormat, hero.id).then((id) => {
            setEditingId(id);
            setScreen("editor");
          })
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold text-white">My Decks</h2>
        <div className="flex items-center gap-3">
          {decks.length > 0 && <ViewModeToggle mode={view} onChange={setView} />}
          <button
            type="button"
            onClick={() => setScreen("import")}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-gray-200 hover:border-accent hover:text-white"
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              setNewFormat(null);
              setScreen("new");
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110"
          >
            + New deck
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {decks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-muted">
            No decks yet. Click <span className="mx-1 font-semibold text-gray-300">+ New deck</span> to
            pick a hero and start building, or <span className="mx-1 font-semibold text-gray-300">Import</span>{" "}
            a decklist from Fabrary.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {myDecks.length > 0 && renderDecks(myDecks)}
            {precons.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold text-white">
                  Imported precons
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted">
                    {precons.length}
                  </span>
                </h2>
                {renderDecks(precons)}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A deck tile with the hero's card art zoomed in as a background banner. */
function DeckCard({ deck, onOpen }: { deck: DeckSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[5/3] overflow-hidden rounded-xl border border-border text-left transition hover:-translate-y-0.5 hover:border-accent"
    >
      {deck.heroImage ? (
        <img
          src={deck.heroImage}
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.6] object-cover object-[center_10%] transition group-hover:scale-[1.7]"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-2" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="truncate font-semibold text-white drop-shadow">{deck.name}</div>
        <div className="truncate text-xs text-gray-300 drop-shadow">{deck.heroName ?? "—"}</div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-300">{deck.cardCount} cards</div>
      </div>
    </button>
  );
}

/** Compact one-line deck entry for list view. */
function DeckRow({ deck, onOpen }: { deck: DeckSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left transition hover:border-accent"
    >
      {deck.heroImage ? (
        <img src={deck.heroImage} alt="" className="h-10 w-8 shrink-0 rounded object-cover object-top" />
      ) : (
        <div className="h-10 w-8 shrink-0 rounded bg-surface" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{deck.name}</div>
        <div className="truncate text-xs text-muted">{deck.heroName ?? "—"}</div>
      </div>
      <span className="w-40 whitespace-nowrap text-right text-xs text-muted">
        {FORMAT_NAME[deck.format] ?? deck.format}
      </span>
      <span className="w-16 whitespace-nowrap text-right text-xs text-muted">{deck.cardCount} cards</span>
    </button>
  );
}

function FormatPicker({
  onPick,
  onCancel,
}: {
  onPick: (format: DeckFormat) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-2 py-1 text-xs text-gray-200 hover:border-accent"
        >
          ← Decks
        </button>
        <h2 className="text-base font-semibold text-white">Choose a format</h2>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="grid w-full max-w-xl gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onPick(f.value)}
              className="rounded-xl border border-border bg-surface-2 p-4 text-left transition hover:border-accent hover:bg-surface"
            >
              <div className="font-semibold text-white">{f.name}</div>
              <div className="mt-0.5 text-sm text-muted">{f.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroPicker({
  format,
  onPick,
  onCancel,
}: {
  format: DeckFormat;
  onPick: (hero: Card) => void;
  onCancel: () => void;
}) {
  const [heroes, setHeroes] = useState<Card[]>([]);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listHeroes(ownedOnly).then(setHeroes).catch(() => setHeroes([]));
  }, [ownedOnly]);

  // Show heroes of the right category (young/adult); tournament-illegal ones
  // (e.g. Living Legend in CC) are kept but greyed out + badged, still pickable.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes
      .filter((h) => heroCategoryOk(h, format))
      .filter((h) => (q ? h.name.toLowerCase().includes(q) : true));
  }, [heroes, query, format]);

  const formatName = FORMATS.find((f) => f.value === format)?.name ?? format;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-2 py-1 text-xs text-gray-200 hover:border-accent"
        >
          ← Format
        </button>
        <h2 className="text-base font-semibold text-white">
          Choose a hero <span className="text-muted">· {formatName}</span>
        </h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter heroes…"
          className="ml-2 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-300">
          <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
          Owned only
        </label>
        <span className="whitespace-nowrap text-xs text-muted">{filtered.length}</span>
      </div>
      <div className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted">
            {ownedOnly ? "You don't own any heroes yet." : "No heroes found."}
          </div>
        ) : (
          <CardGrid
            cards={filtered}
            selectedId={null}
            onSelect={onPick}
            size="medium"
            annotate={(h) => {
              const issue = heroFormatIssue(h, format);
              return issue ? { dim: true, badge: issue } : null;
            }}
          />
        )}
      </div>
    </div>
  );
}
