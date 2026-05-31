import type { ViewMode } from "../types/card";

/** Segmented control for card display mode: small / medium / large / list. */
export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const options: [ViewMode, string, string][] = [
    ["small", "S", "Small images"],
    ["medium", "M", "Medium images"],
    ["large", "L", "Large images (max 2 per row)"],
    ["list", "☰", "List (no images)"],
  ];
  return (
    <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
      {options.map(([m, label, title]) => (
        <button
          key={m}
          type="button"
          title={title}
          onClick={() => onChange(m)}
          className={`rounded-md px-2 py-1.5 ${
            mode === m ? "bg-accent font-semibold text-black" : "text-gray-300 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
