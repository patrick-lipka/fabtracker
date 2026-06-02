import { useEffect, useState } from "react";
import type { Card, DeckCardEntry, DeckDetail, ViewMode } from "../types/card";
import { getDeck } from "../lib/api";
import { pitchColor } from "../lib/fab";
import { DeckStats } from "./DeckStats";
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

  useEffect(() => {
    getDeck(deckId).then(setDeck).catch(() => {});
  }, [deckId]);

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
            <Group title="Hero" entries={[{ card: deck.hero, quantity: 1, owned: 1, legal: true }]} view={view} />
          ) : (
            <HeroCard card={deck.hero} view={view} />
          ))}
        <Group title="Weapons" entries={weapons} view={view} />
        <Group title="Equipment" entries={equipment} view={view} />
        <Group title={`Main deck · ${deck.legality.mainDeckCount}`} entries={main} view={view} />
      </div>

      {/* Stats */}
      <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface">
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

          <DeckStats deck={deck} />
        </div>
      </aside>
    </div>
  );
}

function HeroCard({ card, view }: { card: Card; view: ImgView }) {
  return (
    <div className="mb-4">
      <SectionLabel>Hero</SectionLabel>
      <div style={{ width: HERO_W[view] }}>
        <CardImage card={card} />
      </div>
    </div>
  );
}

function Group({ title, entries, view }: { title: string; entries: DeckCardEntry[]; view: ViewMode }) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-4">
      <SectionLabel>{title}</SectionLabel>
      {view === "list" ? (
        <div className="flex flex-col gap-1">
          {entries.map((e) => (
            <CardRow key={e.card.id} entry={e} />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${COL_MIN[view]},1fr))` }}
        >
          {entries.map((e) => (
            <div key={e.card.id} className="relative">
              <CardImage card={e.card} />
              {e.quantity > 1 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-white/10">
                  ×{e.quantity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardRow({ entry }: { entry: DeckCardEntry }) {
  const { card, quantity } = entry;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm">
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
    </div>
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
