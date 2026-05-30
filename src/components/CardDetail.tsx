import { useState } from "react";
import type { Card } from "../types/card";
import { pitchColor, rarityColor, statDisplay } from "../lib/fab";

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

  const flavor = card.printings.find((p) => p.flavorText)?.flavorText ?? null;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-5">
        <CardImage card={card} />
      </div>

      <div className="flex flex-col gap-4 px-5 pb-8">
        <div>
          <h2 className="text-lg font-bold text-white">{card.name}</h2>
          <p className="text-sm text-muted">{card.typeText}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Pitch" value={card.pitch !== null ? String(card.pitch) : "—"} />
          <StatBox label="Cost" value={statDisplay(card.cost, card.costText)} />
          {card.isHero ? (
            <>
              <StatBox label="Life" value={statDisplay(card.health, null)} />
              <StatBox label="Intellect" value={statDisplay(card.intellect, null)} />
            </>
          ) : (
            <>
              <StatBox label="Power" value={statDisplay(card.power, card.powerText)} />
              <StatBox label="Defense" value={statDisplay(card.defense, card.defenseText)} />
            </>
          )}
          {card.arcane !== null && (
            <StatBox label="Arcane" value={String(card.arcane)} />
          )}
        </div>

        {card.keywords.length > 0 && (
          <ChipRow label="Keywords" items={card.keywords} />
        )}
        {card.traits.length > 0 && <ChipRow label="Traits" items={card.traits} />}
        {card.types.length > 0 && <ChipRow label="Types" items={card.types} />}

        {card.functionalText && (
          <div>
            <SectionLabel>Card Text</SectionLabel>
            <p className="whitespace-pre-line rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed text-gray-200">
              {card.functionalText}
            </p>
          </div>
        )}

        {flavor && (
          <p className="border-l-2 border-border pl-3 text-sm italic text-muted">
            {flavor}
          </p>
        )}

        {/* Printings */}
        <div>
          <SectionLabel>
            Printings{card.printings.length > 1 ? ` (${card.printings.length})` : ""}
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {card.printings.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate text-gray-200">{p.setName}</div>
                  <div className="text-muted">
                    {p.id}
                    {p.artists.length > 0 && ` · ${p.artists.join(", ")}`}
                  </div>
                </div>
                <span
                  className="ml-2 shrink-0 rounded px-1.5 py-0.5 font-medium"
                  style={{ color: rarityColor(p.rarity), background: `${rarityColor(p.rarity)}1a` }}
                >
                  {p.rarity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardImage({ card }: { card: Card }) {
  const [imgOk, setImgOk] = useState(true);
  if (card.imageUrl && imgOk) {
    return (
      <img
        src={card.imageUrl}
        alt={card.name}
        onError={() => setImgOk(false)}
        className="mx-auto w-full max-w-[280px] rounded-2xl"
      />
    );
  }
  // Fallback when no image is available.
  const accent = pitchColor(card.color);
  return (
    <div
      className="mx-auto flex aspect-[2.5/3.5] w-full max-w-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-surface-2 p-4 text-center"
      style={{ boxShadow: `inset 0 0 0 3px ${accent}` }}
    >
      <h2 className="text-xl font-bold text-white">{card.name}</h2>
      <p className="mt-2 text-xs text-muted">{card.typeText}</p>
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
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
