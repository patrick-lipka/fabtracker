import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Card,
  DeckCardEntry,
  DeckDetail,
  OwnedCounts,
  ViewMode,
} from "../types/card";
import {
  adjustDeckCard,
  deleteDeck,
  getDeck,
  renameDeck,
  searchCards,
  setDeckFormat,
  setDeckNotes,
} from "../lib/api";
import { legalForDeck, pitchColor } from "../lib/fab";
import { CardGrid } from "./CardGrid";
import { CardList } from "./CardList";
import { DeckStats } from "./DeckStats";
import { NotesEditor } from "./NotesEditor";
import { ViewModeToggle } from "./ViewModeToggle";

interface DeckEditorProps {
  deckId: number;
  /** Catalog cards for the pool when there's no active search. */
  cards: Card[];
  owned: OwnedCounts;
  /** Leave the editor (back to the deck view). */
  onBack: () => void;
  /** Notify the parent (deck list) that something changed. */
  onChanged: () => void;
  /** The deck was deleted — go somewhere that isn't this deck. */
  onDeleted: () => void;
}

/** MTG-Arena-style editor: legal card pool on the left, the deck on the right. */
export function DeckEditor({ deckId, cards, onBack, onChanged, onDeleted }: DeckEditorProps) {
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [poolQuery, setPoolQuery] = useState("");
  const [poolResults, setPoolResults] = useState<Card[] | null>(null);
  const [legalOnly, setLegalOnly] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [panelTab, setPanelTab] = useState<"deck" | "notes">("deck");
  const notesTimer = useRef<number | null>(null);
  const saveNotes = (md: string) => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    // Not cleared on unmount — a pending save still fires after you navigate away.
    notesTimer.current = window.setTimeout(() => {
      setDeckNotes(deckId, md).catch(() => {});
    }, 700);
  };
  const [preview, setPreview] = useState<{ card: Card; x: number; y: number } | null>(null);
  const showPreview = (card: Card, e: { clientX: number; clientY: number }) =>
    setPreview({ card, x: e.clientX, y: e.clientY });
  const hidePreview = () => setPreview(null);
  const [poolView, setPoolView] = useState<ViewMode>(() => {
    const v = localStorage.getItem("fabtracker:deckPoolView");
    return v === "small" || v === "medium" || v === "large" || v === "list" ? v : "small";
  });
  useEffect(() => {
    localStorage.setItem("fabtracker:deckPoolView", poolView);
  }, [poolView]);

  function refresh() {
    getDeck(deckId)
      .then((d) => {
        setDeck(d);
        setNameDraft(d.name);
      })
      .catch(() => {});
  }

  useEffect(refresh, [deckId]);

  // Debounced pool search (empty query → use the in-memory catalog).
  useEffect(() => {
    const q = poolQuery.trim();
    if (!q) {
      setPoolResults(null);
      return;
    }
    const handle = setTimeout(() => {
      searchCards(q, false).then(setPoolResults).catch(() => setPoolResults([]));
    }, 180);
    return () => clearTimeout(handle);
  }, [poolQuery]);

  const change = (cardId: string, delta: number) =>
    adjustDeckCard(deckId, cardId, delta)
      .then(() => {
        refresh();
        onChanged();
      })
      .catch(() => {});

  const deckQty = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    deck?.cards.forEach((e) => (m[e.card.id] = e.quantity));
    return m;
  }, [deck]);

  const pool = useMemo(() => {
    const base = (poolResults ?? cards).filter((c) => !c.isHero);
    if (legalOnly && deck?.hero)
      return base.filter((c) => legalForDeck(c, deck.hero, deck.format));
    return base;
  }, [poolResults, cards, legalOnly, deck]);

  if (!deck) {
    return <div className="flex h-full items-center justify-center text-muted">Loading deck…</div>;
  }

  const group = (pred: (e: DeckCardEntry) => boolean) =>
    deck.cards.filter(pred);
  const isW = (e: DeckCardEntry) => e.card.types.includes("Weapon");
  const isE = (e: DeckCardEntry) => e.card.types.includes("Equipment") && !isW(e);
  const weapons = group(isW);
  const equipment = group(isE);
  const main = group((e) => !isW(e) && !isE(e) && !e.card.types.includes("Token"));
  const heroEntries: DeckCardEntry[] = deck.hero
    ? [{ card: deck.hero, quantity: 1, owned: 0, legal: true }]
    : [];

  return (
    <div className="flex h-full min-h-0">
      {/* Pool */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <input
            value={poolQuery}
            onChange={(e) => setPoolQuery(e.target.value)}
            placeholder="Search the pool — e.g. pow>=4, kw:go again"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-300">
            <input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} />
            Legal only
          </label>
          <ViewModeToggle mode={poolView} onChange={setPoolView} />
          <span className="whitespace-nowrap text-xs text-muted">{pool.length}</span>
        </div>
        <div className="min-h-0 flex-1">
          {poolView === "list" ? (
            <CardList
              cards={pool}
              selectedId={null}
              onSelect={(c) => change(c.id, 1)}
              quantities={deckQty}
            />
          ) : (
            <CardGrid
              cards={pool}
              selectedId={null}
              onSelect={(c) => change(c.id, 1)}
              quantities={deckQty}
              size={poolView}
            />
          )}
        </div>
      </div>

      {/* Deck panel */}
      <aside className="flex w-[380px] shrink-0 flex-col border-l border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-border px-2 py-1 text-xs text-gray-200 hover:border-accent"
          >
            ← Done
          </button>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={() => {
              const n = nameDraft.trim();
              if (n && n !== deck.name) renameDeck(deckId, n).then(() => { refresh(); onChanged(); });
              else setNameDraft(deck.name);
            }}
            title="Rename deck"
            className="min-w-0 flex-1 rounded-md border border-border/60 bg-surface-2 px-2 py-1 text-sm font-semibold text-white hover:border-border focus:border-accent focus:outline-none"
          />
          <select
            value={deck.format}
            onChange={(e) => setDeckFormat(deckId, e.target.value).then(refresh)}
            className="rounded-md border border-border bg-surface-2 px-1.5 py-1 text-xs text-gray-200"
          >
            <option value="cc">CC</option>
            <option value="blitz">Blitz</option>
            <option value="silver_age">Silver Age</option>
          </select>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-border px-3 py-1.5 text-xs">
            {(["deck", "notes"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPanelTab(t)}
                className={`rounded-md px-2.5 py-1 capitalize ${
                  panelTab === t ? "bg-accent font-semibold text-black" : "text-gray-300 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {panelTab === "notes" ? (
            <div className="min-h-0 flex-1">
              <NotesEditor key={deckId} initial={deck.notes} onChange={saveNotes} />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* Legality */}
          <Legality deck={deck} />

          {/* Statistics */}
          <DeckStats deck={deck} />

          {/* Slots */}
          <Slots weapons={weapons} equipment={equipment} />

          {/* Card groups */}
          <Section title="Hero" entries={heroEntries} onChange={change} onHover={showPreview} onLeave={hidePreview} fixed />
          <Section title="Weapons" entries={weapons} onChange={change} onHover={showPreview} onLeave={hidePreview} />
          <Section title="Equipment" entries={equipment} onChange={change} onHover={showPreview} onLeave={hidePreview} />
          <Section
            title={`Main deck (${deck.legality.mainDeckCount})`}
            entries={main}
            onChange={change}
            onHover={showPreview}
            onLeave={hidePreview}
          />

          <button
            type="button"
            onClick={() => deleteDeck(deckId).then(onDeleted)}
            className="mt-4 text-xs text-muted hover:text-red-400"
          >
            Delete deck
          </button>
            </div>
          )}
        </div>
      </aside>

      <CardPreview preview={preview} />
    </div>
  );
}

/** Floating card-image preview shown when hovering a deck card. */
function CardPreview({ preview }: { preview: { card: Card; x: number; y: number } | null }) {
  if (!preview) return null;
  const { card, x, y } = preview;
  const width = 240;
  // Show to the left of the cursor (the decklist sits on the right edge).
  const left = Math.max(8, x - width - 20);
  const top = Math.min(Math.max(8, y - 168), window.innerHeight - 348);
  return (
    <div className="pointer-events-none fixed z-50" style={{ left, top, width }}>
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-full rounded-xl shadow-2xl shadow-black/60 ring-1 ring-black/40"
        />
      ) : (
        <div className="flex aspect-[2.5/3.5] w-full flex-col items-center justify-center rounded-xl border border-border bg-surface-2 p-4 text-center shadow-2xl">
          <div className="font-bold text-white">{card.name}</div>
          <div className="mt-1 text-xs text-muted">{card.typeText}</div>
        </div>
      )}
    </div>
  );
}

function Legality({ deck }: { deck: DeckDetail }) {
  const { legality, missing } = deck;
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide text-muted">
          {deck.format === "blitz"
            ? "Blitz"
            : deck.format === "silver_age"
              ? "Silver Age"
              : "Classic Constructed"}
        </span>
        <span className={legality.ok ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>
          {legality.ok ? "Legal" : "Not legal"}
        </span>
      </div>
      {!legality.ok && (
        <ul className="mt-1.5 list-disc pl-4 text-muted">
          {legality.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 text-muted">
        {missing > 0 ? (
          <span className="text-amber-300">{missing} card(s) missing from your collection</span>
        ) : (
          <span className="text-emerald-400">You own every card in this deck</span>
        )}
      </div>
    </div>
  );
}

const EQUIP_SLOTS = ["Head", "Chest", "Arms", "Legs", "Off-Hand"];

function Slots({ weapons, equipment }: { weapons: DeckCardEntry[]; equipment: DeckCardEntry[] }) {
  if (weapons.length === 0 && equipment.length === 0) return null;
  const qty = (es: DeckCardEntry[]) => es.reduce((n, e) => n + e.quantity, 0);
  const slot = (s: string) => qty(equipment.filter((e) => e.card.types.includes(s)));
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Slots</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-200">
        <span>Weapons {qty(weapons)}</span>
        {EQUIP_SLOTS.map((s) => (
          <span key={s} className={slot(s) === 0 ? "text-muted" : undefined}>
            {s} {slot(s)}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[10px] text-muted">
        You equip one item per slot each game; extras are legal as loadout options.
      </div>
    </div>
  );
}

function Section({
  title,
  entries,
  onChange,
  onHover,
  onLeave,
  fixed = false,
}: {
  title: string;
  entries: DeckCardEntry[];
  onChange: (cardId: string, delta: number) => void;
  onHover: (card: Card, e: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
  /** Fixed rows (e.g. the hero): no quantity steppers, no "need" indicator. */
  fixed?: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </div>
      <div className="flex flex-col">
        {entries.map((e) => (
          <div
            key={e.card.id}
            className="flex items-center gap-2 py-0.5 text-sm"
            onMouseEnter={(ev) => onHover(e.card, ev)}
            onMouseMove={(ev) => onHover(e.card, ev)}
            onMouseLeave={onLeave}
          >
            <span
              className="h-3.5 w-1 shrink-0 rounded-full"
              style={{ background: pitchColor(e.card.color) }}
            />
            <span className={`min-w-0 flex-1 truncate ${e.legal ? "text-gray-200" : "text-red-400"}`}>
              {e.card.name}
            </span>
            {!fixed && e.owned < e.quantity && (
              <span className="shrink-0 text-[10px] text-amber-300" title="More than you own">
                need {e.quantity - e.owned}
              </span>
            )}
            {fixed ? (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">Hero</span>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(e.card.id, -1)}
                  className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs hover:border-accent"
                >
                  −
                </button>
                <span className="w-4 text-center text-xs font-bold text-white">{e.quantity}</span>
                <button
                  type="button"
                  onClick={() => onChange(e.card.id, 1)}
                  className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs hover:border-accent"
                >
                  +
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
