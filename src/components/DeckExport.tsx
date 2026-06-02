import { useMemo, useState } from "react";
import type { DeckDetail } from "../types/card";
import { EXPORT_TARGETS, exportDeck, type ExportTarget } from "../lib/deckExport";

interface DeckExportProps {
  deck: DeckDetail;
  onClose: () => void;
}

/**
 * A floating popup that renders the deck as a text decklist for the popular
 * import targets (Fabrary, GEM, plain text) with a one-click copy. Fabrary and
 * GEM both accept the pitch-annotated card list.
 */
export function DeckExport({ deck, onClose }: DeckExportProps) {
  const [target, setTarget] = useState<ExportTarget>("fabrary");
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => exportDeck(deck, target), [deck, target]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the textarea is selectable as a fallback */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[80vh] w-[460px] flex-col rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Export deck</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-0.5 text-xs text-gray-200 hover:border-accent"
          >
            Close
          </button>
        </div>

        <div className="mb-3 flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
          {EXPORT_TARGETS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTarget(t.value)}
              className={`flex-1 rounded-md px-2 py-1.5 ${
                target === t.value ? "bg-accent font-semibold text-black" : "text-gray-300 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          Paste this into the site's deck import.{" "}
          {target === "gem"
            ? "GEM accepts the Fabrary-style list (pitch preserved per card)."
            : target === "fabrary"
              ? "Fabrary → Import → paste."
              : "Works with most text imports (e.g. Talishar)."}
        </p>

        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-white focus:border-accent focus:outline-none"
        />

        <button
          type="button"
          onClick={copy}
          className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-black hover:brightness-110"
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
      </div>
    </div>
  );
}
