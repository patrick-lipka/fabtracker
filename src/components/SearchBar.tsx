import { useState } from "react";
import { FilterPanel } from "./FilterPanel";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  searching: boolean;
  placeholder?: string;
}

const EXAMPLES: [string, string][] = [
  ["c:ninja pitch:1", "Ninja cards that pitch for 1"],
  ["pow>=6 t:attack", "Attacks with 6 or more power"],
  ["kw:dominate cost<=2", "Cheap cards with dominate"],
  ["color:blue r:majestic", "Blue majestics"],
  ["cn:wtr043", "A specific collector number"],
  ["binder:trades", "Cards in a binder (by name)"],
];

const FIELDS =
  "name, text/o, type/t, class/c, keyword/kw, trait, set/s, cn/num, rarity/r, color, have, binder · " +
  "numeric (: = > < >= <=): pitch, cost, power/pow, defense/def, health/hp, intellect/int, arcane";

/**
 * Query-language search box. The actual parsing + filtering happens in the
 * Rust/SQLite backend (`search_cards`); this is just the input + a help popover.
 */
export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  searching,
  placeholder = "Search — e.g.  c:ninja pitch:1 pow>=4",
}: SearchBarProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="relative flex items-center gap-3">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          ⌕
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <span className="w-20 whitespace-nowrap text-right text-xs text-muted">
        {searching
          ? "…"
          : resultCount === totalCount
            ? `${totalCount} cards`
            : `${resultCount} / ${totalCount}`}
      </span>

      <button
        type="button"
        onClick={() => {
          setShowFilters((s) => !s);
          setShowHelp(false);
        }}
        title="Build a filter visually"
        className={`flex h-7 items-center rounded-full border px-2.5 text-xs ${
          showFilters
            ? "border-accent text-accent"
            : "border-border text-muted hover:border-accent"
        }`}
      >
        Filters
      </button>

      <button
        type="button"
        onClick={() => {
          setShowHelp((s) => !s);
          setShowFilters(false);
        }}
        title="Search syntax"
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
          showHelp
            ? "border-accent text-accent"
            : "border-border text-muted hover:border-accent"
        }`}
      >
        ?
      </button>

      {showFilters && (
        <FilterPanel
          query={value}
          onApply={(q) => onChange(q)}
          onClose={() => setShowFilters(false)}
        />
      )}

      {showHelp && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[420px] rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Search syntax
          </h3>
          <ul className="flex flex-col gap-1.5">
            {EXAMPLES.map(([q, desc]) => (
              <li key={q} className="flex items-baseline justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange(q);
                    setShowHelp(false);
                  }}
                  className="rounded bg-surface-2 px-1.5 py-0.5 text-left font-mono text-[12px] text-amber-200 hover:bg-border"
                >
                  {q}
                </button>
                <span className="text-right text-[11px] text-muted">{desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-muted">
            Terms combine with AND. Bare words match name, type, rules text, and
            collector number.
            <br />
            <span className="text-gray-300">Fields:</span> {FIELDS}
          </p>
          <p className="mt-2 rounded-md bg-surface-2 px-2 py-1.5 text-[11px] leading-relaxed text-gray-300">
            💡 Tip: search a collector number directly — type{" "}
            <span className="font-mono text-amber-200">MST131</span> or{" "}
            <span className="font-mono text-amber-200">cn:wtr043</span>. Works in
            Browse and Collection.
          </p>
        </div>
      )}
    </div>
  );
}
