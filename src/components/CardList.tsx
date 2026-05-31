import { useEffect, useMemo, useRef, useState } from "react";
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

/** Columns compared as numbers (others as strings). */
const NUMERIC: Set<SortKey> = new Set(["pitch", "cost", "pd", "rarity", "qty"]);

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
    const numeric = NUMERIC.has(sort.key);
    const out = [...cards];
    out.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      // Missing values always sort last, regardless of direction.
      if (av == null && bv != null) return 1;
      if (bv == null && av != null) return -1;
      let cmp = 0;
      if (av != null && bv != null) {
        cmp = numeric
          ? (av as number) - (bv as number)
          : String(av).localeCompare(String(bv));
        cmp *= sort.dir;
      }
      // Stable, deterministic tiebreaker: by name (ascending).
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });
    return out;
  }, [cards, sort, quantities]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // Jump back to the top when the sort changes so the new order is visible.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [sort]);

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

  // Shared column widths so the header and rows line up exactly.
  const COLS = {
    dot: "w-1.5 shrink-0",
    name: "min-w-0 flex-1 text-left",
    type: "hidden w-48 shrink-0 text-left sm:block",
    pitch: "w-8 shrink-0 text-center",
    cost: "w-8 shrink-0 text-center",
    pd: "w-12 shrink-0 text-center",
    rarity: "w-16 shrink-0 text-left",
    qty: "w-10 shrink-0 text-right",
    menu: "w-6 shrink-0",
  };

  return (
    // The header lives inside the scroll container (sticky) so it shares the
    // exact same content width as the rows — including any scrollbar gutter.
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-canvas px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <span className={COLS.dot} />
        <button type="button" onClick={() => toggle("name")} className={thClass("name", COLS.name)}>
          Name{arrow("name")}
        </button>
        <button type="button" onClick={() => toggle("type")} className={thClass("type", COLS.type)}>
          Type{arrow("type")}
        </button>
        <button type="button" onClick={() => toggle("pitch")} className={thClass("pitch", COLS.pitch)}>
          Pit{arrow("pitch")}
        </button>
        <button type="button" onClick={() => toggle("cost")} className={thClass("cost", COLS.cost)}>
          Cost{arrow("cost")}
        </button>
        <button type="button" onClick={() => toggle("pd")} className={thClass("pd", COLS.pd)}>
          P/D{arrow("pd")}
        </button>
        <button type="button" onClick={() => toggle("rarity")} className={thClass("rarity", COLS.rarity)}>
          Rarity{arrow("rarity")}
        </button>
        {quantities && (
          <button type="button" onClick={() => toggle("qty")} className={thClass("qty", COLS.qty)}>
            Qty{arrow("qty")}
          </button>
        )}
        {onCardMenu && <span className={COLS.menu} />}
      </div>

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
                className={`h-4 rounded-full ${COLS.dot}`}
                style={{ background: pitchColor(card.color) }}
              />
              <span className={`${COLS.name} truncate font-medium text-white`}>
                {card.name}
              </span>
              <span className={`${COLS.type} truncate text-xs text-muted`}>
                {card.typeText}
              </span>
              <span className={`${COLS.pitch} text-muted`}>{card.pitch ?? "—"}</span>
              <span className={`${COLS.cost} text-muted`}>
                {statDisplay(card.cost, card.costText)}
              </span>
              <span className={`${COLS.pd} text-gray-200`}>
                {card.isHero
                  ? `${statDisplay(card.health, null)}/${statDisplay(card.intellect, null)}`
                  : `${statDisplay(card.power, card.powerText)}/${statDisplay(card.defense, card.defenseText)}`}
              </span>
              <span className={`${COLS.rarity} truncate text-xs`} style={{ color: rarityColor(card.rarity) }}>
                {card.rarity}
              </span>
              {quantities && (
                <span className={`${COLS.qty} text-xs font-bold text-amber-200`}>
                  {qty ? `×${qty}` : ""}
                </span>
              )}
              {onCardMenu && (
                <span className={`${COLS.menu} flex justify-center`}>
                  <span
                    role="button"
                    tabIndex={-1}
                    title="Add / move to binder"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCardMenu(card, e.clientX, e.clientY);
                    }}
                    className="flex h-5 w-6 items-center justify-center rounded bg-surface-2 text-xs text-white opacity-0 ring-1 ring-white/10 transition group-hover:opacity-100 hover:bg-accent hover:text-black"
                  >
                    +
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
