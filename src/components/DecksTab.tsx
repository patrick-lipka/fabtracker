import { useEffect, useMemo, useState } from "react";
import type { Card, DeckFormat, DeckSummary, OwnedCounts } from "../types/card";
import { createDeck, listDecks, listHeroes } from "../lib/api";
import { heroLegalForFormat } from "../lib/fab";
import { CardGrid } from "./CardGrid";
import { DeckEditor } from "./DeckEditor";

const FORMATS: { value: DeckFormat; name: string; blurb: string }[] = [
  { value: "cc", name: "Classic Constructed", blurb: "≥60 cards · max 3 of a name · adult heroes" },
  { value: "blitz", name: "Blitz", blurb: "40 cards · max 2 of a name · young heroes" },
  { value: "silver_age", name: "Silver Age", blurb: "40 cards · max 2 per name+color · young heroes · Silver Age pool" },
];

interface DecksTabProps {
  cards: Card[];
  owned: OwnedCounts;
}

type Screen = "list" | "new" | "editor";

/** The "Decks" tab: deck list → hero picker → editor. */
export function DecksTab({ cards, owned }: DecksTabProps) {
  const [screen, setScreen] = useState<Screen>("list");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newFormat, setNewFormat] = useState<DeckFormat | null>(null);

  function refreshDecks() {
    listDecks().then(setDecks).catch(() => {});
  }
  useEffect(refreshDecks, []);

  if (screen === "editor" && editingId !== null) {
    return (
      <DeckEditor
        deckId={editingId}
        cards={cards}
        owned={owned}
        onBack={() => {
          setScreen("list");
          refreshDecks();
        }}
        onChanged={refreshDecks}
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

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {decks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-muted">
            No decks yet. Click <span className="mx-1 font-semibold text-gray-300">+ New deck</span> to
            pick a hero and start building.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {decks.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setEditingId(d.id);
                  setScreen("editor");
                }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left transition hover:-translate-y-0.5 hover:border-accent"
              >
                {d.heroImage ? (
                  <img src={d.heroImage} alt="" className="h-16 w-12 shrink-0 rounded object-cover object-top" />
                ) : (
                  <div className="h-16 w-12 shrink-0 rounded bg-surface" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{d.name}</div>
                  <div className="truncate text-xs text-muted">{d.heroName ?? "—"}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted">
                    <span className="rounded bg-black/40 px-1.5 py-0.5">
                      {d.format === "blitz" ? "Blitz" : "CC"}
                    </span>
                    <span>{d.cardCount} cards</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes
      .filter((h) => heroLegalForFormat(h, format))
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
          <CardGrid cards={filtered} selectedId={null} onSelect={onPick} size="medium" />
        )}
      </div>
    </div>
  );
}
