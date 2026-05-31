import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Card } from "../types/card";
import { pitchColor, rarityColor, statDisplay } from "../lib/fab";

interface CardListProps {
  cards: Card[];
  selectedId: string | null;
  onSelect: (card: Card) => void;
  quantities?: Record<string, number>;
  onCardMenu?: (card: Card, x: number, y: number) => void;
}

const ROW_HEIGHT = 36;

/** A dense, image-free table view of cards — virtualized like the grid. */
export function CardList({
  cards,
  selectedId,
  onSelect,
  quantities,
  onCardMenu,
}: CardListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        No cards match your search.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <span className="w-1.5 shrink-0" />
        <span className="min-w-0 flex-1">Name</span>
        <span className="hidden w-48 shrink-0 truncate sm:block">Type</span>
        <span className="w-8 shrink-0 text-center">Pit</span>
        <span className="w-8 shrink-0 text-center">Cost</span>
        <span className="w-12 shrink-0 text-center">P / D</span>
        <span className="w-16 shrink-0">Rarity</span>
        {quantities && <span className="w-10 shrink-0 text-right">Qty</span>}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const card = cards[vi.index];
            const qty = quantities?.[card.id];
            const selected = card.id === selectedId;
            return (
              <div
                key={card.id}
                role="button"
                onClick={() => onSelect(card)}
                onContextMenu={
                  onCardMenu
                    ? (e) => {
                        e.preventDefault();
                        onCardMenu(card, e.clientX, e.clientY);
                      }
                    : undefined
                }
                className={`group absolute left-0 right-0 flex items-center gap-2 px-4 text-sm ${
                  selected ? "bg-accent/15" : "hover:bg-surface-2"
                }`}
                style={{ height: ROW_HEIGHT, transform: `translateY(${vi.start}px)` }}
              >
                <span
                  className="h-4 w-1.5 shrink-0 rounded-full"
                  style={{ background: pitchColor(card.color) }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-white">
                  {card.name}
                </span>
                <span className="hidden w-48 shrink-0 truncate text-xs text-muted sm:block">
                  {card.typeText}
                </span>
                <span className="w-8 shrink-0 text-center text-muted">
                  {card.pitch ?? "—"}
                </span>
                <span className="w-8 shrink-0 text-center text-muted">
                  {statDisplay(card.cost, card.costText)}
                </span>
                <span className="w-12 shrink-0 text-center text-gray-200">
                  {card.isHero
                    ? `${statDisplay(card.health, null)}/${statDisplay(card.intellect, null)}`
                    : `${statDisplay(card.power, card.powerText)}/${statDisplay(card.defense, card.defenseText)}`}
                </span>
                <span
                  className="w-16 shrink-0 truncate text-xs"
                  style={{ color: rarityColor(card.rarity) }}
                >
                  {card.rarity}
                </span>
                {quantities && (
                  <span className="w-10 shrink-0 text-right text-xs font-bold text-amber-200">
                    {qty ? `×${qty}` : ""}
                  </span>
                )}
                {onCardMenu && (
                  <span
                    role="button"
                    tabIndex={-1}
                    title="Add / move to binder"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCardMenu(card, e.clientX, e.clientY);
                    }}
                    className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-2 text-xs text-white opacity-0 ring-1 ring-white/10 transition group-hover:opacity-100 hover:bg-accent hover:text-black"
                  >
                    +
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
