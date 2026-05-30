import type { Card } from "../types/card";
import {
  pitchColor,
  rarityLabel,
  RARITY_COLOR,
  typeLine,
} from "../lib/fab";

interface CardDetailProps {
  card: Card | null;
}

/** Right-hand inspector showing the full details of the selected card. */
export function CardDetail({ card }: CardDetailProps) {
  if (!card) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
        Select a card to inspect its details.
      </div>
    );
  }

  const accent = pitchColor(card.pitch);
  const isHero = card.cardType === "Hero";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Big placeholder "card" preview */}
      <div className="p-5">
        <div
          className="relative mx-auto flex aspect-[2.5/3.5] w-full max-w-[280px] flex-col overflow-hidden rounded-2xl border border-border bg-surface-2"
          style={{ boxShadow: `inset 0 0 0 3px ${accent}` }}
        >
          <div className="flex items-start justify-between p-4">
            {card.cost !== null ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg font-bold text-amber-200 ring-1 ring-white/10">
                {card.cost}
              </span>
            ) : (
              <span className="h-9 w-9" />
            )}
            {card.pitch !== null && (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-black/80"
                style={{ background: accent }}
              >
                {card.pitch}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <h2 className="text-xl font-bold leading-tight text-white">
              {card.name}
            </h2>
            <p className="mt-2 text-xs text-muted">{typeLine(card)}</p>
          </div>
          <div className="flex items-center justify-between p-4 text-lg font-bold">
            {isHero ? (
              <>
                <span style={{ color: "#e0584f" }}>{card.health ?? "—"}</span>
                <span style={{ color: "#6fa8e6" }}>{card.intellect ?? "—"}</span>
              </>
            ) : (
              <>
                <span style={{ color: "#e0584f" }}>{card.power ?? "—"}</span>
                <span style={{ color: "#6fa8e6" }}>{card.defense ?? "—"}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-4 px-5 pb-8">
        <div>
          <h2 className="text-lg font-bold text-white">{card.name}</h2>
          <p className="text-sm text-muted">{typeLine(card)}</p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Pitch" value={card.pitch} />
          <StatBox label="Cost" value={card.cost} />
          {isHero ? (
            <>
              <StatBox label="Life" value={card.health} />
              <StatBox label="Intellect" value={card.intellect} />
            </>
          ) : (
            <>
              <StatBox label="Power" value={card.power} />
              <StatBox label="Defense" value={card.defense} />
            </>
          )}
        </div>

        {card.keywords.length > 0 && (
          <ChipRow label="Keywords" items={card.keywords} />
        )}
        {card.classes.length > 0 && (
          <ChipRow label="Class" items={card.classes} />
        )}
        {card.talents.length > 0 && (
          <ChipRow label="Talent" items={card.talents} />
        )}

        {card.text && (
          <div>
            <SectionLabel>Card Text</SectionLabel>
            <p className="whitespace-pre-line rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed text-gray-200">
              {card.text}
            </p>
          </div>
        )}

        {card.flavor && (
          <p className="border-l-2 border-border pl-3 text-sm italic text-muted">
            {card.flavor}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span
            className="rounded px-1.5 py-0.5 font-medium"
            style={{
              color: RARITY_COLOR[card.rarity],
              background: `${RARITY_COLOR[card.rarity]}1a`,
            }}
          >
            {rarityLabel(card.rarity)}
          </span>
          <span>
            {card.setName} ({card.setCode}) · #{card.cardNumber}
          </span>
          {card.artist && <span>Art: {card.artist}</span>}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2 text-center">
      <div className="text-lg font-bold text-white">{value ?? "—"}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-gray-200"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
