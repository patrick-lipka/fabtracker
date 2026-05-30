import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Card } from "../types/card";
import { CardTile } from "./CardTile";

interface CardGridProps {
  cards: Card[];
  selectedId: string | null;
  onSelect: (card: Card) => void;
}

const MIN_TILE_WIDTH = 190; // px; columns are derived from container width
const ROW_HEIGHT = 250; // matches CardTile height
const GAP = 14;

/**
 * Responsive, row-virtualized card grid. Only the rows currently in view are
 * mounted, so this stays smooth even with thousands of cards. Columns are
 * recomputed from the container width via a ResizeObserver.
 */
export function CardGrid({ cards, selectedId, onSelect }: CardGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  // Recompute column count whenever the scroll container resizes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const cols = Math.max(1, Math.floor((width + GAP) / (MIN_TILE_WIDTH + GAP)));
      setColumns(cols);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowCount = Math.ceil(cards.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 4,
  });

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
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
