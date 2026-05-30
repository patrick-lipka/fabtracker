interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

/**
 * Simple substring search for now. This is the seed for the richer query
 * syntax later (e.g. `c:ninja pitch:1 pow>=4`) — see docs/PROJECT_LOG.md.
 */
export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
}: SearchBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          ⌕
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search cards by name, text, type, class…"
          className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>
      <span className="whitespace-nowrap text-xs text-muted">
        {resultCount === totalCount
          ? `${totalCount} cards`
          : `${resultCount} / ${totalCount}`}
      </span>
    </div>
  );
}
