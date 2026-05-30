import { useState } from "react";
import type { Card } from "../types/card";
import { pitchColor, statDisplay } from "../lib/fab";

interface CardTileProps {
  card: Card;
  selected: boolean;
  onSelect: (card: Card) => void;
}

/**
 * A single card in the grid. Shows the real card image when available; while it
 * loads (or if it's missing/fails) a styled placeholder frame is shown instead.
 */
export function CardTile({ card, selected, onSelect }: CardTileProps) {
  const [imgOk, setImgOk] = useState(true);
  const showImage = card.imageUrl && imgOk;

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      title={card.name}
      className={`group relative block h-full w-full overflow-hidden rounded-xl border bg-surface-2 transition
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40
        ${selected ? "border-accent ring-2 ring-accent/60" : "border-border"}`}
    >
      {/* Fallback frame (base layer — visible when no image) */}
      <PlaceholderFrame card={card} />

      {showImage && (
        <img
          src={card.imageUrl!}
          alt={card.name}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
    </button>
  );
}

function PlaceholderFrame({ card }: { card: Card }) {
  const accent = pitchColor(card.color);
  return (
    <div className="absolute inset-0 flex flex-col">
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between p-2.5 pl-4">
        {card.cost !== null || card.costText ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-sm font-bold text-amber-200 ring-1 ring-white/10">
            {statDisplay(card.cost, card.costText)}
          </span>
        ) : (
          <span className="h-7 w-7" />
        )}
        {card.pitch !== null && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-black/80"
            style={{ background: accent }}
          >
            {card.pitch}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center px-3 text-center">
        <h3 className="text-[14px] font-semibold leading-tight text-white">
          {card.name}
        </h3>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          {card.typeText}
        </p>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-sm">
        {card.isHero ? (
          <>
            <span className="font-bold text-[#e0584f]">
              {statDisplay(card.health, null)}
            </span>
            <span className="font-bold text-[#6fa8e6]">
              {statDisplay(card.intellect, null)}
            </span>
          </>
        ) : (
          <>
            <span className="font-bold text-[#e0584f]">
              {statDisplay(card.power, card.powerText)}
            </span>
            <span className="font-bold text-[#6fa8e6]">
              {statDisplay(card.defense, card.defenseText)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
