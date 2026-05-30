import { useEffect, useMemo, useState } from "react";
import type { Binder, BinderEntry, Card, CollectionCard, OwnedCounts } from "./types/card";
import {
  getCards,
  searchCards,
  syncCards,
  getCatalogInfo,
  listBinders,
  createBinder,
  renameBinder,
  deleteBinder,
  searchCollection,
  cardBinders,
  adjustCard,
  moveCard,
  ownedCounts,
} from "./lib/api";
import { CardGrid } from "./components/CardGrid";
import { CardDetail } from "./components/CardDetail";
import { SearchBar } from "./components/SearchBar";
import { BinderBar } from "./components/BinderBar";
import { BinderMenu, type BinderMenuState } from "./components/BinderMenu";

type Status = "loading" | "empty" | "ready" | "error";
type View = "browse" | "collection";

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [results, setResults] = useState<Card[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Browse view: restrict to cards in the collection ("Owned" switch / have:).
  const [ownedOnly, setOwnedOnly] = useState(false);

  // Collection state.
  const [view, setView] = useState<View>("browse");
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<number | null>(null);
  const [collectionCards, setCollectionCards] = useState<CollectionCard[]>([]);
  const [owned, setOwned] = useState<OwnedCounts>({});
  const [selectedCardBinders, setSelectedCardBinders] = useState<BinderEntry[]>([]);
  const [binderMenu, setBinderMenu] = useState<BinderMenuState | null>(null);
  // Bumped after any collection mutation to trigger reloads.
  const [collVersion, setCollVersion] = useState(0);
  const bumpColl = () => setCollVersion((v) => v + 1);

  function refreshInfo() {
    getCatalogInfo()
      .then((info) => setLastSynced(info.lastSynced))
      .catch(() => {});
  }

  // On launch, load the cached catalog.
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

  // Binders + owned counts, refreshed after any collection change.
  useEffect(() => {
    listBinders().then(setBinders).catch(() => {});
    ownedCounts().then(setOwned).catch(() => {});
  }, [collVersion]);

  // Collection cards for the current binder scope + query (collection view).
  // Debounced and run in the backend, so the full query language works here too.
  useEffect(() => {
    if (view !== "collection") return;
    setSearching(true);
    const handle = setTimeout(() => {
      searchCollection(query.trim(), selectedBinderId)
        .then(setCollectionCards)
        .catch(() => setCollectionCards([]))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(handle);
  }, [view, selectedBinderId, query, collVersion]);

  // The selected card's per-binder quantities (for the detail steppers).
  useEffect(() => {
    if (!selectedId) {
      setSelectedCardBinders([]);
      return;
    }
    cardBinders(selectedId)
      .then(setSelectedCardBinders)
      .catch(() => setSelectedCardBinders([]));
  }, [selectedId, collVersion]);

  // Debounced backend search (browse view only; collection filters client-side).
  // An empty query is handled in-memory below (including the owned filter), so
  // we only hit the backend when there's an actual query.
  useEffect(() => {
    if (view !== "browse") return;
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchCards(q, ownedOnly)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(handle);
  }, [query, view, ownedOnly]);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const data = await syncCards();
      setCards(data);
      setSelectedId(data[0]?.id ?? null);
      setStatus(data.length > 0 ? "ready" : "empty");
      refreshInfo();
      bumpColl();
    } catch (e) {
      setError(String(e));
      if (cards.length === 0) setStatus("error");
    } finally {
      setSyncing(false);
    }
  }

  // --- Collection mutations -------------------------------------------------
  const handleAdjust = (binderId: number, cardId: string, delta: number) =>
    adjustCard(binderId, cardId, delta).then(bumpColl).catch(() => {});
  const handleMove = (from: number, to: number, cardId: string, qty: number) =>
    moveCard(from, to, cardId, qty).then(bumpColl).catch(() => {});
  const handleCreateBinder = (name: string) =>
    createBinder(name).then(setBinders).then(bumpColl).catch(() => {});
  const handleRenameBinder = (id: number, name: string) =>
    renameBinder(id, name).then(setBinders).catch(() => {});
  const handleDeleteBinder = (id: number) =>
    deleteBinder(id)
      .then((bs) => {
        setBinders(bs);
        if (selectedBinderId === id) setSelectedBinderId(null);
        bumpColl();
      })
      .catch(() => {});

  // --- Derived view data ----------------------------------------------------
  // With an active query the backend already applied the owned filter; for an
  // empty query we apply it in-memory against the owned map (instant, no IPC).
  const browseCards =
    results ?? (ownedOnly ? cards.filter((c) => (owned[c.id] ?? 0) > 0) : cards);

  const isBrowse = view === "browse";
  // In the collection view, `collectionCards` is already the backend-filtered
  // result for the current query + binder.
  const displayCards = isBrowse ? browseCards : collectionCards.map((cc) => cc.card);
  const quantities = useMemo<Record<string, number>>(() => {
    if (isBrowse) return owned;
    return Object.fromEntries(collectionCards.map((cc) => [cc.card.id, cc.quantity]));
  }, [isBrowse, owned, collectionCards]);
  const resultCount = displayCards.length;
  const totalCount = isBrowse ? cards.length : collectionCards.length;

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId],
  );

  const ready = status === "ready";

  // --- Binder menu (grid) ---------------------------------------------------
  function openBinderMenu(card: Card, x: number, y: number) {
    setBinderMenu({
      card,
      x,
      y,
      currentBinderId: !isBrowse ? selectedBinderId : null,
      currentQty: quantities[card.id] ?? 0,
    });
  }

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
            <ViewTabs view={view} onChange={setView} />
            <div className="ml-2 flex-1">
              <SearchBar
                value={query}
                onChange={setQuery}
                resultCount={resultCount}
                totalCount={totalCount}
                searching={searching}
              />
            </div>
            {isBrowse && (
              <Switch label="Owned" checked={ownedOnly} onChange={setOwnedOnly} />
            )}
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
        <main className="flex min-w-0 flex-1 flex-col">
          {ready && !isBrowse && (
            <BinderBar
              binders={binders}
              selectedBinderId={selectedBinderId}
              totalQuantity={binders.reduce((n, b) => n + b.totalQuantity, 0)}
              onSelect={setSelectedBinderId}
              onCreate={handleCreateBinder}
              onRename={handleRenameBinder}
              onDelete={handleDeleteBinder}
            />
          )}

          <div className="min-h-0 flex-1">
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

            {ready && !isBrowse && collectionCards.length === 0 && !query.trim() ? (
              <Centered>
                <div className="max-w-sm text-center">
                  <p className="text-gray-300">This binder is empty.</p>
                  <p className="mt-1 text-sm text-muted">
                    Add cards from <strong>Browse</strong> — hover a card and click
                    the <strong>+</strong> (or right-click it), or use the steppers
                    in the detail pane.
                  </p>
                </div>
              </Centered>
            ) : (
              ready && (
                <CardGrid
                  cards={displayCards}
                  selectedId={selectedId}
                  onSelect={(c) => setSelectedId(c.id)}
                  quantities={quantities}
                  onCardMenu={openBinderMenu}
                />
              )
            )}
          </div>
        </main>

        <aside className="w-[340px] shrink-0 border-l border-border bg-surface">
          <CardDetail
            card={selected}
            onSearch={setQuery}
            cardBinders={selectedCardBinders}
            onAdjustCard={(binderId, delta) =>
              selected && handleAdjust(binderId, selected.id, delta)
            }
          />
        </aside>
      </div>

      {binderMenu && (
        <BinderMenu
          state={binderMenu}
          binders={binders}
          onAdd={(binderId) => {
            handleAdjust(binderId, binderMenu.card.id, 1);
            setBinderMenu(null);
          }}
          onMove={(toId) => {
            if (binderMenu.currentBinderId !== null) {
              handleMove(binderMenu.currentBinderId, toId, binderMenu.card.id, binderMenu.currentQty);
            }
            setBinderMenu(null);
          }}
          onRemove={() => {
            if (binderMenu.currentBinderId !== null) {
              handleAdjust(binderMenu.currentBinderId, binderMenu.card.id, -binderMenu.currentQty);
            }
            setBinderMenu(null);
          }}
          onClose={() => setBinderMenu(null)}
        />
      )}
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title="Show only cards in your collection"
      className="flex items-center gap-2 text-xs text-gray-300"
    >
      <span
        className={`relative h-4 w-7 rounded-full transition ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
      {(["browse", "collection"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 capitalize ${
            view === v ? "bg-accent font-semibold text-black" : "text-gray-300 hover:text-white"
          }`}
        >
          {v}
        </button>
      ))}
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
