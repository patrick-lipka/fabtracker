import { useEffect, useMemo, useState } from "react";
import type { Card } from "./types/card";
import { getCards, syncCards, getCatalogInfo } from "./lib/api";
import { searchText } from "./lib/fab";
import { CardGrid } from "./components/CardGrid";
import { CardDetail } from "./components/CardDetail";
import { SearchBar } from "./components/SearchBar";

type Status = "loading" | "empty" | "ready" | "error";

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  function refreshInfo() {
    getCatalogInfo()
      .then((info) => setLastSynced(info.lastSynced))
      .catch(() => {});
  }

  // On launch, load whatever is cached.
  useEffect(() => {
    getCards()
      .then((data) => {
        if (data.length > 0) {
          setCards(data);
          setSelectedId(data[0].id);
          setStatus("ready");
          refreshInfo();
        } else {
          setStatus("empty");
        }
      })
      .catch((e) => {
        setError(String(e));
        setStatus("error");
      });
  }, []);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const data = await syncCards();
      setCards(data);
      setSelectedId(data[0]?.id ?? null);
      setStatus(data.length > 0 ? "ready" : "empty");
      refreshInfo();
    } catch (e) {
      setError(String(e));
      if (cards.length === 0) setStatus("error");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => searchText(c).includes(q));
  }, [cards, query]);

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId],
  );

  const ready = status === "ready";

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex items-center gap-4 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-accent">⬢</span>
          <h1 className="text-base font-semibold tracking-tight text-white">
            FaB Tracker
          </h1>
        </div>
        {ready && (
          <>
            <div className="ml-4 flex-1">
              <SearchBar
                value={query}
                onChange={setQuery}
                resultCount={filtered.length}
                totalCount={cards.length}
              />
            </div>
            {lastSynced && (
              <span className="whitespace-nowrap text-[11px] text-muted">
                Synced {formatSynced(lastSynced)}
              </span>
            )}
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-gray-200 hover:border-accent disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Re-sync"}
            </button>
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          {status === "loading" && <Centered>Loading cards…</Centered>}

          {status === "error" && (
            <Centered>
              <div className="max-w-md text-center">
                <p className="text-red-400">Failed to load cards.</p>
                <p className="mt-1 text-xs text-muted">{error}</p>
                <SyncButton onClick={sync} syncing={syncing} />
              </div>
            </Centered>
          )}

          {status === "empty" && (
            <Centered>
              <div className="max-w-md text-center">
                <h2 className="text-lg font-semibold text-white">
                  No card data yet
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Download the latest Flesh and Blood card catalog (~20&nbsp;MB)
                  from the public dataset. It's cached locally for offline use.
                </p>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                <SyncButton onClick={sync} syncing={syncing} />
              </div>
            </Centered>
          )}

          {ready && (
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

/** Compact, locale-aware "last synced" label. */
function formatSynced(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-muted">
      {children}
    </div>
  );
}

function SyncButton({
  onClick,
  syncing,
}: {
  onClick: () => void;
  syncing: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
    >
      {syncing ? "Downloading…" : "Download card data"}
    </button>
  );
}
