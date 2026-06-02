import { useEffect, useState } from "react";
import type {
  Binder,
  Card,
  CardCollectionEntry,
  DeckCardEntry,
  DeckDetail,
  EntryKey,
  ViewMode,
} from "../types/card";
import { adjustEntry, cardEntries, getDeck, listBinders, moveEntry } from "../lib/api";
import { pitchColor } from "../lib/fab";
import { CardDetail } from "./CardDetail";
import { DeckStats } from "./DeckStats";
import { NotesEditor } from "./NotesEditor";
import { ResizablePane } from "./ResizablePane";
import { ViewModeToggle } from "./ViewModeToggle";

interface DeckViewProps {
  deckId: number;
  onEdit: () => void;
  onBack: () => void;
}

const FORMAT_NAME: Record<string, string> = {
  cc: "Classic Constructed",
  blitz: "Blitz",
  silver_age: "Silver Age",
};

type ImgView = Exclude<ViewMode, "list">;
/** Image-grid column width and hero-card width per view size. */
const COL_MIN: Record<ImgView, string> = { small: "110px", medium: "150px", large: "220px" };
const HERO_W: Record<ImgView, string> = { small: "140px", medium: "180px", large: "240px" };

/** Read-only deck view: full card images on the left, stats on the right. */
export function DeckView({ deckId, onEdit, onBack }: DeckViewProps) {
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("fabtracker:deckCardView") as ViewMode) || "medium",
  );
  useEffect(() => localStorage.setItem("fabtracker:deckCardView", view), [view]);

  const [rightTab, setRightTab] = useState<"stats" | "notes">("stats");

  // Card inspected in the right pane (clicked in the gallery).
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [binders, setBinders] = useState<Binder[]>([]);
  const [entries, setEntries] = useState<CardCollectionEntry[]>([]);
  const [collVersion, setCollVersion] = useState(0);

  useEffect(() => {
    getDeck(deckId).then(setDeck).catch(() => {});
    setSelectedCard(null);
  }, [deckId]);

  // Refetch the deck after a collection edit so owned/missing stay correct.
  function bumpColl() {
    setCollVersion((v) => v + 1);
    getDeck(deckId).then(setDeck).catch(() => {});
  }

  useEffect(() => {
    listBinders().then(setBinders).catch(() => {});
  }, [collVersion]);

  useEffect(() => {
    if (!selectedCard) {
      setEntries([]);
      return;
    }
    cardEntries(selectedCard.id).then(setEntries).catch(() => setEntries([]));
  }, [selectedCard, collVersion]);

  const handleAdjustEntry = (binderId: number, key: EntryKey, delta: number) =>
    adjustEntry(binderId, key, delta).then(bumpColl).catch(() => {});
  const handleMoveEntry = (from: number, to: number, key: EntryKey, qty: number) =>
    moveEntry(from, to, key, qty).then(bumpColl).catch(() => {});

  if (!deck) {
    return <div className="flex h-full items-center justify-center text-muted">Loading deck…</div>;
  }

  const isW = (e: DeckCardEntry) => e.card.types.includes("Weapon");
  const isE = (e: DeckCardEntry) => e.card.types.includes("Equipment") && !isW(e);
  const byCostName = (a: DeckCardEntry, b: DeckCardEntry) =>
    (a.card.cost ?? 99) - (b.card.cost ?? 99) || a.card.name.localeCompare(b.card.name);

  const weapons = deck.cards.filter(isW);
  const equipment = deck.cards.filter(isE);
  const main = deck.cards
    .filter((e) => !isW(e) && !isE(e) && !e.card.types.includes("Token"))
    .sort(byCostName);

  return (
    <div className="flex h-full min-h-0">
      {/* Card gallery */}
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3 flex justify-end">
          <ViewModeToggle mode={view} onChange={setView} />
        </div>
        {deck.hero &&
          (view === "list" ? (
            <Group
              title="Hero"
              entries={[{ card: deck.hero, quantity: 1, owned: 1, legal: true }]}
              view={view}
              selectedId={selectedCard?.id ?? null}
              onSelect={setSelectedCard}
            />
          ) : (
            <HeroCard
              card={deck.hero}
              view={view}
              selected={selectedCard?.id === deck.hero.id}
              onSelect={setSelectedCard}
            />
          ))}
        <Group title="Weapons" entries={weapons} view={view} selectedId={selectedCard?.id ?? null} onSelect={setSelectedCard} />
        <Group title="Equipment" entries={equipment} view={view} selectedId={selectedCard?.id ?? null} onSelect={setSelectedCard} />
        <Group title={`Main deck · ${deck.legality.mainDeckCount}`} entries={main} view={view} selectedId={selectedCard?.id ?? null} onSelect={setSelectedCard} />
      </div>

      {/* Stats */}
      <ResizablePane className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-border px-2 py-1 text-xs text-gray-200 hover:border-accent"
          >
            ← Decks
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {deck.name}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
          >
            Edit deck
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {deck.hero && (
            <div className="mb-3 text-sm">
              <span className="font-semibold text-white">{deck.hero.name}</span>
              <span className="text-muted"> · {FORMAT_NAME[deck.format] ?? deck.format}</span>
            </div>
          )}

          {/* Legality */}
          <div className="mb-3 rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wide text-muted">Legality</span>
              <span className={deck.legality.ok ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>
                {deck.legality.ok ? "Legal" : "Not legal"}
              </span>
            </div>
            {!deck.legality.ok && (
              <ul className="mt-1.5 list-disc pl-4 text-muted">
                {deck.legality.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <div className="mt-1.5 text-muted">
              {deck.missing > 0 ? (
                <span className="text-amber-300">{deck.missing} card(s) missing from your collection</span>
              ) : (
                <span className="text-emerald-400">You own every card in this deck</span>
              )}
            </div>
          </div>

          {/* Stats ⇄ Notes toggle (card details below stay put). */}
          <div className="mb-3 flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
            {(["stats", "notes"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRightTab(t)}
                className={`flex-1 rounded-md px-2 py-1.5 capitalize ${
                  rightTab === t ? "bg-accent font-semibold text-black" : "text-gray-300 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {rightTab === "stats" ? (
            <DeckStats deck={deck} />
          ) : deck.notes?.trim() ? (
            <NotesEditor key={`notes-${deckId}`} initial={deck.notes} readOnly />
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              No notes yet. Use <span className="text-gray-300">Edit deck</span> to add some.
            </p>
          )}

          {selectedCard && (
            <div className="-mx-4 mt-4 border-t border-border pt-1">
              <CardDetail
                card={selectedCard}
                view="browse"
                onSearch={() => {}}
                binders={binders}
                entries={entries}
                onAdjustEntry={handleAdjustEntry}
                onMoveEntry={handleMoveEntry}
              />
            </div>
          )}
        </div>
      </ResizablePane>
    </div>
  );
}

function HeroCard({
  card,
  view,
  selected,
  onSelect,
}: {
  card: Card;
  view: ImgView;
  selected: boolean;
  onSelect: (card: Card) => void;
}) {
  return (
    <div className="mb-4">
      <SectionLabel>Hero</SectionLabel>
      <button
        type="button"
        onClick={() => onSelect(card)}
        style={{ width: HERO_W[view] }}
        className={`block overflow-hidden rounded-lg ${selected ? "ring-2 ring-accent" : ""}`}
      >
        <CardImage card={card} />
      </button>
    </div>
  );
}

function Group({
  title,
  entries,
  view,
  selectedId,
  onSelect,
}: {
  title: string;
  entries: DeckCardEntry[];
  view: ViewMode;
  selectedId: string | null;
  onSelect: (card: Card) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-4">
      <SectionLabel>{title}</SectionLabel>
      {view === "list" ? (
        <div className="flex flex-col gap-1">
          {entries.map((e) => (
            <CardRow key={e.card.id} entry={e} selected={e.card.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${COL_MIN[view]},1fr))` }}
        >
          {entries.map((e) => (
            <button
              type="button"
              key={e.card.id}
              onClick={() => onSelect(e.card)}
              className={`relative block overflow-hidden rounded-lg ${
                e.card.id === selectedId ? "ring-2 ring-accent" : ""
              }`}
            >
              <CardImage card={e.card} />
              {e.quantity > 1 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-white/10">
                  ×{e.quantity}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardRow({
  entry,
  selected,
  onSelect,
}: {
  entry: DeckCardEntry;
  selected: boolean;
  onSelect: (card: Card) => void;
}) {
  const { card, quantity } = entry;
  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className={`flex w-full items-center gap-2 rounded-md border bg-surface-2 px-2 py-1 text-left text-sm ${
        selected ? "border-accent ring-1 ring-accent/50" : "border-border"
      }`}
    >
      <span className="w-7 shrink-0 text-right font-mono text-xs text-muted">{quantity}×</span>
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-white/10"
        style={{ background: pitchColor(card.color) }}
        title={card.color ? `Pitch ${card.pitch ?? "—"}` : undefined}
      />
      <span className="min-w-0 flex-1 truncate text-white">{card.name}</span>
      <span className="shrink-0 text-xs text-muted">{card.typeText}</span>
      {card.cost != null && (
        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">{card.cost}</span>
      )}
    </button>
  );
}

function CardImage({ card }: { card: Card }) {
  if (card.imageUrl) {
    return <img src={card.imageUrl} alt={card.name} loading="lazy" className="w-full rounded-lg" />;
  }
  return (
    <div
      className="flex aspect-[2.5/3.5] w-full flex-col items-center justify-center rounded-lg border border-border bg-surface-2 p-3 text-center"
      style={{ boxShadow: `inset 0 0 0 3px ${pitchColor(card.color)}` }}
    >
      <div className="text-sm font-semibold text-white">{card.name}</div>
      <div className="mt-1 text-[10px] text-muted">{card.typeText}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</h3>
  );
}
