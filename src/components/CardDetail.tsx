import { useState } from "react";
import type { BinderEntry, Card } from "../types/card";
import { pitchColor, rarityColor, statDisplay } from "../lib/fab";

interface CardDetailProps {
  card: Card | null;
  /** Run a search query (clicking a facet populates the search box). */
  onSearch: (query: string) => void;
  /** This card's quantity in every binder (drives the collection steppers). */
  cardBinders: BinderEntry[];
  /** Change this card's quantity in a binder by delta. */
  onAdjustCard: (binderId: number, delta: number) => void;
}

/** Build a `field:value` search term, quoting the value if it has spaces. */
function facet(field: string, value: string): string {
  return /\s/.test(value) ? `${field}:"${value}"` : `${field}:${value}`;
}

/** Right-hand inspector showing the full details of the selected card. */
export function CardDetail({
  card,
  onSearch,
  cardBinders,
  onAdjustCard,
}: CardDetailProps) {
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

        {/* Stat strip — each box with a numeric value searches for it. */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox
            label="Pitch"
            value={card.pitch !== null ? String(card.pitch) : "—"}
            query={card.pitch !== null ? `pitch:${card.pitch}` : undefined}
            onSearch={onSearch}
          />
          <StatBox
            label="Cost"
            value={statDisplay(card.cost, card.costText)}
            query={card.cost !== null ? `cost:${card.cost}` : undefined}
            onSearch={onSearch}
          />
          {card.isHero ? (
            <>
              <StatBox
                label="Life"
                value={statDisplay(card.health, null)}
                query={card.health !== null ? `health:${card.health}` : undefined}
                onSearch={onSearch}
              />
              <StatBox
                label="Intellect"
                value={statDisplay(card.intellect, null)}
                query={card.intellect !== null ? `intellect:${card.intellect}` : undefined}
                onSearch={onSearch}
              />
            </>
          ) : (
            <>
              <StatBox
                label="Power"
                value={statDisplay(card.power, card.powerText)}
                query={card.power !== null ? `power:${card.power}` : undefined}
                onSearch={onSearch}
              />
              <StatBox
                label="Defense"
                value={statDisplay(card.defense, card.defenseText)}
                query={card.defense !== null ? `defense:${card.defense}` : undefined}
                onSearch={onSearch}
              />
            </>
          )}
          {card.arcane !== null && (
            <StatBox
              label="Arcane"
              value={String(card.arcane)}
              query={`arcane:${card.arcane}`}
              onSearch={onSearch}
            />
          )}
        </div>

        {card.keywords.length > 0 && (
          <ChipRow label="Keywords" items={card.keywords} field="kw" onSearch={onSearch} />
        )}
        {card.traits.length > 0 && (
          <ChipRow label="Traits" items={card.traits} field="trait" onSearch={onSearch} />
        )}
        {card.types.length > 0 && (
          <ChipRow label="Types" items={card.types} field="t" onSearch={onSearch} />
        )}

        {/* Collection — quantity of this card in each binder. */}
        {cardBinders.length > 0 && (
          <div>
            <SectionLabel>Collection</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {cardBinders.map((entry) => (
                <div
                  key={entry.binderId}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-1.5"
                >
                  <span className="min-w-0 truncate text-sm text-gray-200">
                    {entry.binderName}
                  </span>
                  <div className="flex items-center gap-2">
                    <Stepper
                      label="−"
                      disabled={entry.quantity === 0}
                      onClick={() => onAdjustCard(entry.binderId, -1)}
                    />
                    <span
                      className={`w-6 text-center text-sm font-bold ${
                        entry.quantity > 0 ? "text-white" : "text-muted"
                      }`}
                    >
                      {entry.quantity}
                    </span>
                    <Stepper
                      label="+"
                      onClick={() => onAdjustCard(entry.binderId, 1)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Printings — click a set to see all its cards. */}
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
                  <button
                    type="button"
                    onClick={() => onSearch(facet("set", p.setName))}
                    title={`Search all cards in ${p.setName}`}
                    className="block max-w-full truncate text-left text-gray-200 hover:text-accent"
                  >
                    {p.setName}
                  </button>
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

function Stepper({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-sm text-gray-200 hover:border-accent hover:text-white disabled:opacity-30 disabled:hover:border-border disabled:hover:text-gray-200"
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

function StatBox({
  label,
  value,
  query,
  onSearch,
}: {
  label: string;
  value: string;
  query?: string;
  onSearch: (query: string) => void;
}) {
  const body = (
    <>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </>
  );
  const base = "rounded-lg border border-border bg-surface-2 p-2 text-center";
  if (!query) {
    return <div className={base}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onSearch(query)}
      title={`Search ${query}`}
      className={`${base} hover:border-accent`}
    >
      {body}
    </button>
  );
}

function ChipRow({
  label,
  items,
  field,
  onSearch,
}: {
  label: string;
  items: string[];
  field: string;
  onSearch: (query: string) => void;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSearch(facet(field, item))}
            title={`Search ${facet(field, item)}`}
            className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-gray-200 hover:border-accent hover:text-white"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
