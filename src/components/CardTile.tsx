import { useState } from "react";
import type { Card } from "../types/card";
import { pitchColor, statDisplay } from "../lib/fab";

interface CardTileProps {
  card: Card;
  selected: boolean;
  onSelect: (card: Card) => void;
  /** Owned quantity badge (omitted/0 ⇒ no badge). */
  quantity?: number;
  /** Open the binder menu at the given screen coordinates. */
  onMenu?: (card: Card, x: number, y: number) => void;
  /** Grey the tile out (e.g. a hero that isn't tournament-legal). */
  dim?: boolean;
  /** A label ribbon across the bottom (e.g. "Living Legend"). */
  badge?: string;
}

/**
 * A single card in the grid. Shows the real card image when available; while it
 * loads (or if it's missing/fails) a styled placeholder frame is shown instead.
 */
export function CardTile({ card, selected, onSelect, quantity, onMenu, dim, badge }: CardTileProps) {
  const [imgOk, setImgOk] = useState(true);
  const showImage = card.imageUrl && imgOk;

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      onContextMenu={
        onMenu
          ? (e) => {
              e.preventDefault();
              onMenu(card, e.clientX, e.clientY);
            }
          : undefined
      }
      title={badge ? `${card.name} — ${badge}` : card.name}
      className={`group relative block h-full w-full overflow-hidden rounded-xl border bg-surface-2 transition
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40
        ${selected ? "border-accent ring-2 ring-accent/60" : "border-border"}
        ${dim ? "opacity-60 grayscale" : ""}`}
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

      {quantity ? (
        <span className="absolute left-1.5 top-1.5 z-10 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-white/10">
          ×{quantity}
        </span>
      ) : null}

      {badge && (
        <span className="absolute inset-x-0 bottom-0 z-10 bg-black/80 px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          {badge}
        </span>
      )}

      {onMenu && (
        <span
          role="button"
          tabIndex={-1}
          title="Add / move to binder"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenu(card, e.clientX, e.clientY);
          }}
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/75 text-sm text-white opacity-0 ring-1 ring-white/10 transition group-hover:opacity-100 hover:bg-accent hover:text-black"
        >
          +
        </span>
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
