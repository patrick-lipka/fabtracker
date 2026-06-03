import { useEffect, useMemo, useState } from "react";
import type {
  Binder,
  Card,
  CardCollectionEntry,
  CollectionCard,
  EntryKey,
  OwnedCounts,
  ViewMode,
} from "./types/card";
import {
  getCards,
  searchCards,
  syncCards,
  getCatalogInfo,
  checkUpdates,
  setDataRef,
  listBinders,
  createBinder,
  renameBinder,
  deleteBinder,
  searchCollection,
  cardEntries,
  adjustEntry,
  moveEntry,
  moveCardAll,
  removeCardFromBinder,
  ownedCounts,
  type CatalogInfo,
} from "./lib/api";
import { CardGrid } from "./components/CardGrid";
import { CardList } from "./components/CardList";
import { CardDetail } from "./components/CardDetail";
import { ResizablePane } from "./components/ResizablePane";
import { SearchBar } from "./components/SearchBar";
import { BinderBar } from "./components/BinderBar";
import { BinderMenu, type BinderMenuState } from "./components/BinderMenu";
import { AboutButton } from "./components/AboutButton";
import { DataSourceButton } from "./components/DataSourceButton";
import { DecksTab } from "./components/DecksTab";
import { ViewModeToggle } from "./components/ViewModeToggle";

type Status = "loading" | "empty" | "ready" | "error";
type View = "browse" | "collection" | "decks";

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogInfo, setCatalogInfo] = useState<CatalogInfo | null>(null);
  const [results, setResults] = useState<Card[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Card display mode (shared across Browse/Collection), persisted locally.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = localStorage.getItem("fabtracker:viewMode");
    return v === "small" || v === "medium" || v === "large" || v === "list"
      ? v
      : "medium";
  });
  useEffect(() => {
    localStorage.setItem("fabtracker:viewMode", viewMode);
  }, [viewMode]);

  // Collection state.
  const [view, setView] = useState<View>("browse");
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<number | null>(null);
  const [collectionCards, setCollectionCards] = useState<CollectionCard[]>([]);
  const [owned, setOwned] = useState<OwnedCounts>({});
  const [selectedCardEntries, setSelectedCardEntries] = useState<CardCollectionEntry[]>([]);
  const [binderMenu, setBinderMenu] = useState<BinderMenuState | null>(null);
  // Bumped after any collection mutation to trigger reloads.
  const [collVersion, setCollVersion] = useState(0);
  const bumpColl = () => setCollVersion((v) => v + 1);

  function refreshInfo() {
    getCatalogInfo()
      .then(setCatalogInfo)
      .catch(() => {});
  }

  // If the resolved ref is ahead of our last sync, pull it automatically.
  // Throttled to keep well under the GitHub API rate limit (resolving "auto"
  // costs a few API calls), since this runs on every launch.
  function maybeAutoSync() {
    const KEY = "fabtracker:lastUpdateCheck";
    const last = Number(localStorage.getItem(KEY) || "0");
    if (Date.now() - last < 6 * 60 * 60 * 1000) return; // at most every 6h
    localStorage.setItem(KEY, String(Date.now()));
    checkUpdates()
      .then((u) => {
        if (u.updateAvailable) sync();
      })
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
          maybeAutoSync();
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

  // The selected card's collection stacks (for the detail copy list).
  useEffect(() => {
    if (!selectedId) {
      setSelectedCardEntries([]);
      return;
    }
    cardEntries(selectedId)
      .then(setSelectedCardEntries)
      .catch(() => setSelectedCardEntries([]));
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
      // Owned filtering is now via the `have:` query field (Filters popup).
      searchCards(q, false)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(handle);
  }, [query, view]);

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

  // Change the data-source ref mode, then re-sync from it.
  const applyDataRef = (mode: string) =>
    setDataRef(mode).then(() => sync()).catch(() => {});

  // --- Collection mutations -------------------------------------------------
  const handleAdjustEntry = (binderId: number, key: EntryKey, delta: number) =>
    adjustEntry(binderId, key, delta).then(bumpColl).catch(() => {});
  const handleMoveEntry = (from: number, to: number, key: EntryKey, qty: number) =>
    moveEntry(from, to, key, qty).then(bumpColl).catch(() => {});

  /** A card's representative stack (default printing, Standard, NM) for quick add. */
  const defaultKey = (card: Card): EntryKey => ({
    cardId: card.id,
    printingId: card.printings[0]?.id ?? card.id,
    setId: card.printings[0]?.setId ?? "",
    foiling: "Standard",
    condition: "NM",
  });

  const handleMoveCardAll = (from: number, to: number, cardId: string) =>
    moveCardAll(from, to, cardId).then(bumpColl).catch(() => {});
  const handleRemoveFromBinder = (binderId: number, cardId: string) =>
    removeCardFromBinder(binderId, cardId).then(bumpColl).catch(() => {});
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
  // With an active query the backend returns the matches; an empty query shows
  // the full catalog. (Owned filtering is via the `have:` field / Filters.)
  const browseCards = results ?? cards;

  const isBrowse = view === "browse";
  // In the collection view, `collectionCards` is already the backend-filtered
  // result for the current query + binder. Show the owned printing's art
  // (newest owned, since printings are ordered newest-first).
  const displayCards = isBrowse
    ? browseCards
    : collectionCards.map((cc) => {
        const owned = new Set(cc.ownedPrintingIds);
        const ownedPrinting = cc.card.printings.find((p) => owned.has(p.id));
        return ownedPrinting?.imageUrl
          ? { ...cc.card, imageUrl: ownedPrinting.imageUrl }
          : cc.card;
      });
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
            {view === "decks" ? (
              <div className="flex-1" />
            ) : (
              <>
                <div className="ml-2 flex-1">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    resultCount={resultCount}
                    totalCount={totalCount}
                    searching={searching}
                  />
                </div>
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              </>
            )}
            <DataSourceButton
              info={catalogInfo}
              syncing={syncing}
              onApply={applyDataRef}
              onSync={sync}
            />
            <AboutButton />
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {view === "decks" ? (
          <div className="min-w-0 flex-1">
            {ready ? (
              <DecksTab cards={cards} owned={owned} />
            ) : (
              <Centered>Download the card data first from the Browse tab.</Centered>
            )}
          </div>
        ) : (
          <>
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
              ready &&
              (viewMode === "list" ? (
                <CardList
                  cards={displayCards}
                  selectedId={selectedId}
                  onSelect={(c) => setSelectedId(c.id)}
                  quantities={quantities}
                  onCardMenu={openBinderMenu}
                />
              ) : (
                <CardGrid
                  cards={displayCards}
                  selectedId={selectedId}
                  onSelect={(c) => setSelectedId(c.id)}
                  quantities={quantities}
                  onCardMenu={openBinderMenu}
                  size={viewMode}
                />
              ))
            )}
          </div>
        </main>

        <ResizablePane>
          <CardDetail
            card={selected}
            view={view}
            onSearch={setQuery}
            binders={binders}
            entries={selectedCardEntries}
            onAdjustEntry={handleAdjustEntry}
            onMoveEntry={handleMoveEntry}
          />
        </ResizablePane>
          </>
        )}
      </div>

      {binderMenu && (
        <BinderMenu
          state={binderMenu}
          binders={binders}
          onAdd={(binderId) => {
            handleAdjustEntry(binderId, defaultKey(binderMenu.card), 1);
            setBinderMenu(null);
          }}
          onMove={(toId) => {
            if (binderMenu.currentBinderId !== null) {
              handleMoveCardAll(binderMenu.currentBinderId, toId, binderMenu.card.id);
            }
            setBinderMenu(null);
          }}
          onRemove={() => {
            if (binderMenu.currentBinderId !== null) {
              handleRemoveFromBinder(binderMenu.currentBinderId, binderMenu.card.id);
            }
            setBinderMenu(null);
          }}
          onClose={() => setBinderMenu(null)}
        />
      )}
    </div>
  );
}

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
      {(["browse", "collection", "decks"] as const).map((v) => (
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
