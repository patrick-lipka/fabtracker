import { useMemo, useRef, useState } from "react";
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

type SortKey = "name" | "type" | "pitch" | "cost" | "pd" | "rarity" | "qty";

const RARITY_RANK: Record<string, number> = {
  Common: 0,
  Rare: 1,
  "Super Rare": 2,
  Majestic: 3,
  Legendary: 4,
  Fabled: 5,
  Marvel: 6,
  Promo: 7,
  Token: 8,
  Basic: 9,
};

/** A dense, image-free, sortable table view of cards — virtualized. */
export function CardList({
  cards,
  selectedId,
  onSelect,
  quantities,
  onCardMenu,
}: CardListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "name",
    dir: 1,
  });

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function sortValue(card: Card, key: SortKey): string | number | null {
    switch (key) {
      case "name":
        return card.name.toLowerCase();
      case "type":
        return card.typeText.toLowerCase();
      case "pitch":
        return card.pitch;
      case "cost":
        return card.cost;
      case "pd":
        return card.isHero ? card.health : card.power; // the left-hand stat
      case "rarity":
        return RARITY_RANK[card.rarity] ?? 99;
      case "qty":
        return quantities?.[card.id] ?? 0;
    }
  }

  const sorted = useMemo(() => {
    const out = [...cards];
    out.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      // Missing values sort last, regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : (av as number) - (bv as number);
      return cmp * sort.dir;
    });
    return out;
  }, [cards, sort, quantities]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
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

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "");
  const thClass = (key: SortKey, extra: string) =>
    `${extra} ${sort.key === key ? "text-gray-200" : "hover:text-gray-300"}`;

  return (
    <div className="flex h-full flex-col">
      {/* Sortable column header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <span className="w-1.5 shrink-0" />
        <button type="button" onClick={() => toggle("name")} className={thClass("name", "min-w-0 flex-1 text-left")}>
          Name{arrow("name")}
        </button>
        <button type="button" onClick={() => toggle("type")} className={thClass("type", "hidden w-48 shrink-0 text-left sm:block")}>
          Type{arrow("type")}
        </button>
        <button type="button" onClick={() => toggle("pitch")} className={thClass("pitch", "w-8 shrink-0 text-center")}>
          Pit{arrow("pitch")}
        </button>
        <button type="button" onClick={() => toggle("cost")} className={thClass("cost", "w-8 shrink-0 text-center")}>
          Cost{arrow("cost")}
        </button>
        <button type="button" onClick={() => toggle("pd")} className={thClass("pd", "w-12 shrink-0 text-center")}>
          P/D{arrow("pd")}
        </button>
        <button type="button" onClick={() => toggle("rarity")} className={thClass("rarity", "w-16 shrink-0 text-left")}>
          Rarity{arrow("rarity")}
        </button>
        {quantities && (
          <button type="button" onClick={() => toggle("qty")} className={thClass("qty", "w-10 shrink-0 text-right")}>
            Qty{arrow("qty")}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const card = sorted[vi.index];
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
