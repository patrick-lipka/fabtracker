import { useEffect, useMemo, useState } from "react";
import type { Card, DeckCardEntry, DeckDetail, OwnedCounts } from "../types/card";
import {
  adjustDeckCard,
  deleteDeck,
  getDeck,
  renameDeck,
  searchCards,
  setDeckFormat,
} from "../lib/api";
import { legalForHero, pitchColor } from "../lib/fab";
import { CardGrid } from "./CardGrid";

interface DeckEditorProps {
  deckId: number;
  /** Catalog cards for the pool when there's no active search. */
  cards: Card[];
  owned: OwnedCounts;
  onBack: () => void;
  /** Notify the parent (deck list) that something changed. */
  onChanged: () => void;
}

/** MTG-Arena-style editor: legal card pool on the left, the deck on the right. */
export function DeckEditor({ deckId, cards, onBack, onChanged }: DeckEditorProps) {
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [poolQuery, setPoolQuery] = useState("");
  const [poolResults, setPoolResults] = useState<Card[] | null>(null);
  const [legalOnly, setLegalOnly] = useState(true);
  const [nameDraft, setNameDraft] = useState("");

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
    if (legalOnly && deck?.hero) return base.filter((c) => legalForHero(c, deck.hero));
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
          <span className="whitespace-nowrap text-xs text-muted">{pool.length}</span>
        </div>
        <div className="min-h-0 flex-1">
          <CardGrid
            cards={pool}
            selectedId={null}
            onSelect={(c) => change(c.id, 1)}
            quantities={deckQty}
            size="small"
          />
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
            ← Decks
          </button>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => nameDraft.trim() && nameDraft !== deck.name && renameDeck(deckId, nameDraft.trim()).then(() => { refresh(); onChanged(); })}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-white hover:border-border focus:border-accent focus:outline-none"
          />
          <select
            value={deck.format}
            onChange={(e) => setDeckFormat(deckId, e.target.value).then(refresh)}
            className="rounded-md border border-border bg-surface-2 px-1.5 py-1 text-xs text-gray-200"
          >
            <option value="cc">CC</option>
            <option value="blitz">Blitz</option>
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* Hero */}
          {deck.hero && (
            <div className="mb-3 flex items-center gap-3">
              {deck.hero.imageUrl && (
                <img src={deck.hero.imageUrl} alt={deck.hero.name} className="h-16 rounded-md" />
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{deck.hero.name}</div>
                <div className="truncate text-xs text-muted">{deck.hero.typeText}</div>
              </div>
            </div>
          )}

          {/* Legality */}
          <Legality deck={deck} />

          {/* Curve + pitch */}
          <Curve deck={deck} />

          {/* Card groups */}
          <Section title="Weapons" entries={weapons} onChange={change} />
          <Section title="Equipment" entries={equipment} onChange={change} />
          <Section
            title={`Main deck (${deck.legality.mainDeckCount})`}
            entries={main}
            onChange={change}
          />

          <button
            type="button"
            onClick={() => {
              if (confirmDelete()) deleteDeck(deckId).then(() => { onChanged(); onBack(); });
            }}
            className="mt-4 text-xs text-muted hover:text-red-400"
          >
            Delete deck
          </button>
        </div>
      </aside>
    </div>
  );
}

function confirmDelete() {
  // No window.confirm in the webview; rely on the explicit button placement.
  return true;
}

function Legality({ deck }: { deck: DeckDetail }) {
  const { legality, missing } = deck;
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide text-muted">
          {deck.format === "blitz" ? "Blitz" : "Classic Constructed"}
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

function Curve({ deck }: { deck: DeckDetail }) {
  const max = Math.max(1, ...deck.curve.map((c) => c.count));
  const pitch = deck.pitchCounts;
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2 p-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Cost curve
      </div>
      <div className="flex h-16 items-end gap-1">
        {deck.curve.map((p) => (
          <div key={p.cost} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] text-muted">{p.count || ""}</span>
            <div
              className="w-full rounded-sm bg-accent/70"
              style={{ height: `${(p.count / max) * 100}%`, minHeight: p.count ? 2 : 0 }}
            />
            <span className="text-[9px] text-muted">{p.cost === 6 ? "6+" : p.cost}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Pitch</span>
        {([["1", pitch.one], ["2", pitch.two], ["3", pitch.three]] as const).map(([p, n]) => (
          <span key={p} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: pitchColor(p === "1" ? "Red" : p === "2" ? "Yellow" : "Blue") }} />
            <span className="text-gray-200">{n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: DeckCardEntry[];
  onChange: (cardId: string, delta: number) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </div>
      <div className="flex flex-col">
        {entries.map((e) => (
          <div key={e.card.id} className="flex items-center gap-2 py-0.5 text-sm">
            <span
              className="h-3.5 w-1 shrink-0 rounded-full"
              style={{ background: pitchColor(e.card.color) }}
            />
            <span className={`min-w-0 flex-1 truncate ${e.legal ? "text-gray-200" : "text-red-400"}`}>
              {e.card.name}
            </span>
            {e.owned < e.quantity && (
              <span className="shrink-0 text-[10px] text-amber-300" title="More than you own">
                need {e.quantity - e.owned}
              </span>
            )}
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
          </div>
        ))}
      </div>
    </div>
  );
}
