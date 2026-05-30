import { useEffect, useMemo, useState } from "react";
import type { Card } from "./types/card";
import { getCards } from "./lib/api";
import { typeLine } from "./lib/fab";
import { CardGrid } from "./components/CardGrid";
import { CardDetail } from "./components/CardDetail";
import { SearchBar } from "./components/SearchBar";

/** Build the haystack we match a search query against. */
function searchText(card: Card): string {
  return [
    card.name,
    card.text,
    typeLine(card),
    ...card.classes,
    ...card.talents,
    ...card.keywords,
    card.setName,
  ]
    .join(" ")
    .toLowerCase();
}

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getCards()
      .then((data) => {
        setCards(data);
        setSelectedId(data[0]?.id ?? null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => searchText(c).includes(q));
  }, [cards, query]);

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId],
  );

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-accent">⬢</span>
          <h1 className="text-base font-semibold tracking-tight text-white">
            FaB Tracker
          </h1>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            mock data
          </span>
        </div>
        <div className="ml-4 flex-1">
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={filtered.length}
            totalCount={cards.length}
          />
        </div>
      </header>

      {/* Body: grid + detail */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted">
              Loading cards…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-red-400">
              Failed to load cards: {error}
            </div>
          ) : (
            <CardGrid
              cards={filtered}
              selectedId={selectedId}
              onSelect={(c) => setSelectedId(c.id)}
            />
          )}
        </main>

        <aside className="w-[340px] shrink-0 border-l border-border bg-surface">
          <CardDetail card={selected} />
        </aside>
      </div>
    </div>
  );
}
