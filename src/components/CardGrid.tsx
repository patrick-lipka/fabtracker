import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Card } from "../types/card";
import { CardTile } from "./CardTile";

type TileSize = "small" | "medium" | "large";

interface CardGridProps {
  cards: Card[];
  selectedId: string | null;
  onSelect: (card: Card) => void;
  /** card id → owned quantity, for the badge. */
  quantities?: Record<string, number>;
  /** Open the binder menu for a card at screen coordinates. */
  onCardMenu?: (card: Card, x: number, y: number) => void;
  size: TileSize;
}

const GAP = 14;
const PADDING_X = 16; // matches the container's px-4
/** FaB cards are 2.5" × 3.5" → height = width × 1.4. */
const CARD_ASPECT = 3.5 / 2.5;

// Minimum tile width per size, and an optional cap on columns. "large" is
// capped at 2 columns at any window width.
const SIZES: Record<TileSize, { minWidth: number; maxColumns: number }> = {
  small: { minWidth: 120, maxColumns: Infinity },
  medium: { minWidth: 188, maxColumns: Infinity },
  large: { minWidth: 300, maxColumns: 2 },
};

interface Layout {
  columns: number;
  rowHeight: number; // derived from actual tile width to keep card aspect
}

/**
 * Responsive, row-virtualized card grid. Columns AND row height are recomputed
 * from the container width (via a ResizeObserver) so tiles always keep the FaB
 * card aspect ratio as the window resizes. Only on-screen rows are mounted, so
 * this stays smooth across thousands of cards.
 */
export function CardGrid({
  cards,
  selectedId,
  onSelect,
  quantities,
  onCardMenu,
  size,
}: CardGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({
    columns: 1,
    rowHeight: Math.round(SIZES[size].minWidth * CARD_ASPECT),
  });

  // Recompute layout whenever the scroll container resizes or the size changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { minWidth, maxColumns } = SIZES[size];
    const update = () => {
      const content = el.clientWidth - PADDING_X * 2;
      if (content <= 0) return;
      const columns = Math.max(
        1,
        Math.min(maxColumns, Math.floor((content + GAP) / (minWidth + GAP))),
      );
      const tileWidth = (content - (columns - 1) * GAP) / columns;
      const rowHeight = Math.round(tileWidth * CARD_ASPECT);
      setLayout((prev) =>
        prev.columns === columns && prev.rowHeight === rowHeight
          ? prev
          : { columns, rowHeight },
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const { columns, rowHeight } = layout;
  const rowCount = Math.ceil(cards.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight + GAP,
    overscan: 4,
  });

  // Row height changes with the window width — re-measure so positions update.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        No cards match your search.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4">
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns;
          const rowCards = cards.slice(start, start + columns);
          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: rowHeight,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: GAP,
              }}
            >
              {rowCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  selected={card.id === selectedId}
                  onSelect={onSelect}
                  quantity={quantities?.[card.id]}
                  onMenu={onCardMenu}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
