import type { Card } from "../types/card";
import { pitchColor, typeLine } from "../lib/fab";

interface CardTileProps {
  card: Card;
  selected: boolean;
  onSelect: (card: Card) => void;
}

/**
 * A single card rendered as a stylized placeholder "frame". Once we have real
 * card images this becomes an <img> with this frame as the loading/fallback
 * state. The left edge is tinted by pitch color (red/yellow/blue) so the grid
 * is scannable at a glance.
 */
export function CardTile({ card, selected, onSelect }: CardTileProps) {
  const accent = pitchColor(card.pitch);
  const isHero = card.cardType === "Hero";

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      title={card.name}
      className={`group relative flex h-[250px] w-full flex-col overflow-hidden rounded-xl border bg-surface-2 text-left transition
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40
        ${selected ? "border-accent ring-2 ring-accent/60" : "border-border"}`}
    >
      {/* Pitch-colored edge */}
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: accent }}
      />

      {/* Header: cost (left) and pitch (right) */}
      <div className="flex items-start justify-between p-2.5 pl-4">
        {card.cost !== null ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-sm font-bold text-amber-200 ring-1 ring-white/10">
            {card.cost}
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

      {/* Name + type */}
      <div className="flex flex-1 flex-col justify-center px-4 text-center">
        <h3 className="text-[15px] font-semibold leading-tight text-white">
          {card.name}
        </h3>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          {typeLine(card)}
        </p>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1 text-sm">
        {isHero ? (
          <>
            <Stat label="Life" value={card.health} color="#e0584f" />
            <Stat label="Int" value={card.intellect} color="#6fa8e6" />
          </>
        ) : (
          <>
            <Stat label="Power" value={card.power} color="#e0584f" />
            <Stat label="Def" value={card.defense} color="#6fa8e6" />
          </>
        )}
      </div>
    </button>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  if (value === null) return <span className="text-muted/40">—</span>;
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-base font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
    </span>
  );
}
