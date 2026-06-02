import { useEffect, useState } from "react";
import {
  CONDITIONS,
  FOILINGS,
  type Binder,
  type Card,
  type CardCollectionEntry,
  type EntryKey,
} from "../types/card";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cardmarketUrl, pitchColor, rarityColor, statDisplay } from "../lib/fab";

interface CardDetailProps {
  card: Card | null;
  /** Browse vs Collection — sets the default printing shown. */
  view: "browse" | "collection";
  /** Run a search query (clicking a facet populates the search box). */
  onSearch: (query: string) => void;
  /** All binders (for the add-copy form and per-entry move target). */
  binders: Binder[];
  /** This card's collection stacks (printing/foiling/condition per binder). */
  entries: CardCollectionEntry[];
  /** Add `delta` copies of a specific stack to a binder. */
  onAdjustEntry: (binderId: number, key: EntryKey, delta: number) => void;
  /** Move all `qty` of a stack from one binder to another. */
  onMoveEntry: (fromBinder: number, toBinder: number, key: EntryKey, qty: number) => void;
}

/** Build a `field:value` search term, quoting the value if it has spaces. */
function facet(field: string, value: string): string {
  return /\s/.test(value) ? `${field}:"${value}"` : `${field}:${value}`;
}

/** Right-hand inspector showing the full details of the selected card. */
export function CardDetail({
  card,
  view,
  onSearch,
  binders,
  entries,
  onAdjustEntry,
  onMoveEntry,
}: CardDetailProps) {
  // A printing the user explicitly clicked; reset when the card changes so the
  // per-tab default applies again. (Hooks must run before the early return.)
  const [manualPrintingId, setManualPrintingId] = useState<string | null>(null);
  useEffect(() => setManualPrintingId(null), [card?.id]);

  if (!card) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
        Select a card to inspect its details.
      </div>
    );
  }

  const flavor = card.printings.find((p) => p.flavorText)?.flavorText ?? null;

  // Which printing's image to show. Printings are ordered newest-first.
  // Browse → newest; Collection → newest owned (fall back to newest).
  const ownedIds = new Set(entries.map((e) => e.printingId));
  const newest = card.printings[0]?.id ?? null;
  const newestOwned = card.printings.find((p) => ownedIds.has(p.id))?.id ?? null;
  const defaultPrintingId = view === "collection" ? newestOwned ?? newest : newest;
  const shownPrintingId =
    manualPrintingId && card.printings.some((p) => p.id === manualPrintingId)
      ? manualPrintingId
      : defaultPrintingId;
  const shownPrinting =
    card.printings.find((p) => p.id === shownPrintingId) ?? null;
  const shownImage = shownPrinting?.imageUrl ?? card.imageUrl;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-5">
        <CardImage key={shownImage ?? "none"} imageUrl={shownImage} card={card} />
      </div>

      <div className="flex flex-col gap-4 px-5 pb-8">
        <div>
          <h2 className="text-lg font-bold text-white">{card.name}</h2>
          <p className="text-sm text-muted">{card.typeText}</p>
          <button
            type="button"
            onClick={() => openUrl(cardmarketUrl(card.name)).catch(() => {})}
            title="Look up live EUR prices on Cardmarket"
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-gray-200 hover:border-accent hover:text-white"
          >
            Cardmarket prices ↗
          </button>
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

        {/* Collection — specific printing / foiling / condition copies. */}
        <CollectionSection
          card={card}
          binders={binders}
          entries={entries}
          onAdjustEntry={onAdjustEntry}
          onMoveEntry={onMoveEntry}
        />

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

        {/* Printings — click a row to show its art; click the set to search it. */}
        <div>
          <SectionLabel>
            Printings{card.printings.length > 1 ? ` (${card.printings.length})` : ""}
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {card.printings.map((p, i) => {
              const isShown = p.id === shownPrintingId;
              return (
                <div
                  key={`${p.id}-${i}`}
                  role="button"
                  onClick={() => setManualPrintingId(p.id)}
                  title="Show this printing's art"
                  className={`flex cursor-pointer items-center justify-between rounded-lg border bg-surface-2 px-3 py-1.5 text-xs ${
                    isShown ? "border-accent ring-1 ring-accent/50" : "border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSearch(facet("set", p.setName));
                      }}
                      title={`Search all cards in ${p.setName}`}
                      className="block max-w-full truncate text-left text-gray-200 hover:text-accent"
                    >
                      {p.setName}
                    </button>
                    <div className="text-muted">
                      {p.id}
                      {p.released && ` · ${p.released.slice(0, 10)}`}
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardImage({ imageUrl, card }: { imageUrl: string | null; card: Card }) {
  const [imgOk, setImgOk] = useState(true);
  if (imageUrl && imgOk) {
    return (
      <img
        src={imageUrl}
        alt={card.name}
        onError={() => setImgOk(false)}
        className="mx-auto w-full max-w-[460px] rounded-2xl"
      />
    );
  }
  // Fallback when no image is available.
  const accent = pitchColor(card.color);
  return (
    <div
      className="mx-auto flex aspect-[2.5/3.5] w-full max-w-[460px] flex-col items-center justify-center rounded-2xl border border-border bg-surface-2 p-4 text-center"
      style={{ boxShadow: `inset 0 0 0 3px ${accent}` }}
    >
      <h2 className="text-xl font-bold text-white">{card.name}</h2>
      <p className="mt-2 text-xs text-muted">{card.typeText}</p>
    </div>
  );
}

function CollectionSection({
  card,
  binders,
  entries,
  onAdjustEntry,
  onMoveEntry,
}: {
  card: Card;
  binders: Binder[];
  entries: CardCollectionEntry[];
  onAdjustEntry: (binderId: number, key: EntryKey, delta: number) => void;
  onMoveEntry: (fromBinder: number, toBinder: number, key: EntryKey, qty: number) => void;
}) {
  // The deduped printings to choose from (fallback to the card itself).
  const printings =
    card.printings.length > 0
      ? card.printings.map((p) => ({ id: p.id, setId: p.setId, label: `${p.setName} · ${p.id}` }))
      : [{ id: card.id, setId: "", label: "Unknown printing" }];

  const [binderId, setBinderId] = useState<number>(binders[0]?.id ?? 0);
  const [printIdx, setPrintIdx] = useState(0);
  const [foiling, setFoiling] = useState<string>(FOILINGS[0]);
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);

  if (binders.length === 0) return null;

  // Keep the binder selection valid if binders change.
  const activeBinder = binders.some((b) => b.id === binderId) ? binderId : binders[0].id;
  const printing = printings[Math.min(printIdx, printings.length - 1)];

  const addKey: EntryKey = {
    cardId: card.id,
    printingId: printing.id,
    setId: printing.setId,
    foiling,
    condition,
  };

  return (
    <div>
      <SectionLabel>Collection</SectionLabel>

      {/* Add-copy form */}
      <div className="rounded-lg border border-border bg-surface-2 p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Binder">
            <Select value={String(activeBinder)} onChange={(v) => setBinderId(Number(v))}>
              {binders.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Printing">
            <Select value={String(printIdx)} onChange={(v) => setPrintIdx(Number(v))}>
              {printings.map((p, i) => (
                <option key={`${p.id}-${i}`} value={i}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Foiling">
            <Select value={foiling} onChange={setFoiling}>
              {FOILINGS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condition">
            <Select value={condition} onChange={setCondition}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => onAdjustEntry(activeBinder, addKey, 1)}
          className="mt-2 w-full rounded-md bg-accent py-1.5 text-sm font-semibold text-black hover:brightness-110"
        >
          + Add copy
        </button>
      </div>

      {/* Existing copies */}
      {entries.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {entries.map((e, i) => {
            const key: EntryKey = {
              cardId: card.id,
              printingId: e.printingId,
              setId: e.setId,
              foiling: e.foiling,
              condition: e.condition,
            };
            return (
              <div
                key={`${e.binderId}-${e.printingId}-${e.foiling}-${e.condition}-${i}`}
                className="rounded-lg border border-border bg-surface-2 px-3 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-gray-200">
                    <span className="text-accent">{e.binderName}</span> · {e.printingId} ·{" "}
                    {e.foiling} · {e.condition}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Stepper label="−" onClick={() => onAdjustEntry(e.binderId, key, -1)} />
                    <span className="w-5 text-center text-sm font-bold text-white">
                      {e.quantity}
                    </span>
                    <Stepper label="+" onClick={() => onAdjustEntry(e.binderId, key, 1)} />
                  </div>
                </div>
                {binders.length > 1 && (
                  <Select
                    value=""
                    onChange={(v) => v && onMoveEntry(e.binderId, Number(v), key, e.quantity)}
                    className="mt-1.5 w-full text-[11px] text-muted"
                  >
                    <option value="">Move to…</option>
                    {binders
                      .filter((b) => b.id !== e.binderId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-border bg-surface px-2 py-1 text-xs text-gray-200 focus:border-accent focus:outline-none ${className ?? ""}`}
    >
      {children}
    </select>
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
