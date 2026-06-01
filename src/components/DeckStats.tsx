import type { Card, DeckCardEntry, DeckDetail } from "../types/card";
import { pitchColor } from "../lib/fab";

const isMain = (c: Card) =>
  !c.isHero &&
  !c.types.includes("Weapon") &&
  !c.types.includes("Equipment") &&
  !c.types.includes("Token");

/** Fabrary-style deck statistics: counts, pitch, curve, type & combat breakdown. */
export function DeckStats({ deck }: { deck: DeckDetail }) {
  const main = deck.cards.filter((e) => isMain(e.card));
  const qty = (es: DeckCardEntry[]) => es.reduce((n, e) => n + e.quantity, 0);
  const where = (pred: (c: Card) => boolean) => main.filter((e) => pred(e.card));

  const total = qty(main);
  const p = deck.pitchCounts;
  const pitchCards = p.one + p.two + p.three;
  const resources = p.one * 1 + p.two * 2 + p.three * 3;

  const withCost = where((c) => c.cost !== null);
  const avgCost = qty(withCost)
    ? withCost.reduce((n, e) => n + (e.card.cost ?? 0) * e.quantity, 0) / qty(withCost)
    : 0;

  const withPitch = where((c) => c.pitch !== null);
  const avgPitch = qty(withPitch)
    ? withPitch.reduce((n, e) => n + (e.card.pitch ?? 0) * e.quantity, 0) / qty(withPitch)
    : 0;
  const blank = total - pitchCards; // main-deck cards with no pitch value

  const attacks = where((c) => c.power !== null);
  const attackCount = qty(attacks);
  const totalPower = attacks.reduce((n, e) => n + (e.card.power ?? 0) * e.quantity, 0);

  const blockers = where((c) => c.defense !== null);
  const blockCount = qty(blockers);
  const totalDef = blockers.reduce((n, e) => n + (e.card.defense ?? 0) * e.quantity, 0);
  const block3 = qty(where((c) => c.defense !== null && c.defense >= 3));

  const types: [string, number][] = [
    ["Attack actions", qty(where((c) => c.types.includes("Action") && c.types.includes("Attack")))],
    ["Attack reactions", qty(where((c) => c.types.includes("Attack Reaction")))],
    ["Defense reactions", qty(where((c) => c.types.includes("Defense Reaction")))],
    ["Instants", qty(where((c) => c.types.includes("Instant")))],
    ["Other actions", qty(where((c) => c.types.includes("Action") && !c.types.includes("Attack")))],
  ];

  const maxCurve = Math.max(1, ...deck.curve.map((c) => c.count));
  const pct = (n: number) => (pitchCards ? `${Math.round((n / pitchCards) * 100)}%` : "0%");

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Cards" value={total} />
        <Stat label="Resources" value={resources} />
        <Stat label="Avg cost" value={avgCost ? avgCost.toFixed(1) : "—"} />
      </div>

      {/* Pitch */}
      <div>
        <Label>
          Pitch · {pitchCards}
          {blank > 0 ? ` · ${blank} blank` : ""} · avg {avgPitch ? avgPitch.toFixed(2) : "—"}
        </Label>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
          {([["Red", p.one], ["Yellow", p.two], ["Blue", p.three]] as const).map(
            ([color, n]) =>
              n > 0 && (
                <div
                  key={color}
                  style={{ width: `${(n / pitchCards) * 100}%`, background: pitchColor(color) }}
                />
              ),
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span style={{ color: pitchColor("Red") }}>Red {p.one} ({pct(p.one)})</span>
          <span style={{ color: pitchColor("Yellow") }}>Yellow {p.two} ({pct(p.two)})</span>
          <span style={{ color: pitchColor("Blue") }}>Blue {p.three} ({pct(p.three)})</span>
        </div>
      </div>

      {/* Cost curve. Pixel heights — percentage heights collapse here because the
          flex-column bar parent has no definite height. */}
      <div>
        <Label>Cost curve</Label>
        <div className="flex items-end gap-1" style={{ height: 72 }}>
          {deck.curve.map((c) => (
            <div key={c.cost} className="flex flex-1 flex-col items-center justify-end gap-0.5">
              <span className="text-[9px] text-muted">{c.count || ""}</span>
              <div
                className="w-full rounded-sm bg-accent/70"
                style={{ height: c.count ? Math.max(2, (c.count / maxCurve) * 58) : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-0.5 flex gap-1">
          {deck.curve.map((c) => (
            <div key={c.cost} className="flex-1 text-center text-[9px] text-muted">
              {c.cost === 6 ? "6+" : c.cost}
            </div>
          ))}
        </div>
      </div>

      {/* Card types */}
      <div>
        <Label>Card types</Label>
        <div className="flex flex-col gap-0.5">
          {types
            .filter(([, n]) => n > 0)
            .map(([name, n]) => (
              <div key={name} className="flex items-center justify-between text-gray-200">
                <span className="text-muted">{name}</span>
                <span>{n}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Combat */}
      <div className="grid grid-cols-2 gap-2">
        <Combat
          label="Attacks"
          count={attackCount}
          total={totalPower}
          avg={attackCount ? totalPower / attackCount : 0}
          totalLabel="power"
        />
        <Combat
          label="Blocks"
          count={blockCount}
          total={totalDef}
          avg={blockCount ? totalDef / blockCount : 0}
          totalLabel="def"
          extra={`block 3+: ${block3}`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-surface p-1.5">
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}

function Combat({
  label,
  count,
  total,
  avg,
  totalLabel,
  extra,
}: {
  label: string;
  count: number;
  total: number;
  avg: number;
  totalLabel: string;
  extra?: string;
}) {
  return (
    <div className="rounded-md bg-surface p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-gray-200">
        {count} cards
        <span className="text-muted"> · </span>
        {total} {totalLabel}
      </div>
      <div className="text-[11px] text-muted">
        avg {avg ? avg.toFixed(1) : "—"}
        {extra ? ` · ${extra}` : ""}
      </div>
    </div>
  );
}
