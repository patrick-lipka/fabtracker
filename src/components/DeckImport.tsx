import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, DeckFormat } from "../types/card";
import { openUrl } from "@tauri-apps/plugin-opener";
import { importDeck } from "../lib/api";
import { parseDecklist, resolveDecklist } from "../lib/decklist";

const FABRARY = "https://fabrary.net/decks";

const FORMATS: { value: DeckFormat; label: string }[] = [
  { value: "blitz", label: "Blitz" },
  { value: "cc", label: "Classic Constructed" },
  { value: "silver_age", label: "Silver Age" },
];

interface DeckImportProps {
  cards: Card[];
  onCancel: () => void;
  /** Called with the new deck id after a successful import. */
  onImported: (deckId: number) => void;
}

/**
 * Import a decklist pasted from Fabrary into a deck. You choose whether it's an
 * official precon (filed under "Imported precons") or a regular deck. Card
 * names are resolved against the catalog; unmatched lines are surfaced.
 */
export function DeckImport({ cards, onCancel, onImported }: DeckImportProps) {
  const [text, setText] = useState("");
  const [isPrecon, setIsPrecon] = useState(true);
  const [format, setFormat] = useState<DeckFormat>("blitz");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => resolveDecklist(parseDecklist(text), cards), [text, cards]);

  // Prefill name / format / source from the export until the user edits them.
  const touched = useRef({ name: false, format: false, url: false });
  useEffect(() => {
    if (!touched.current.name) setName(result.name ?? result.hero?.name ?? "");
  }, [result.name, result.hero]);
  useEffect(() => {
    if (!touched.current.format && result.format) setFormat(result.format);
  }, [result.format]);
  useEffect(() => {
    if (!touched.current.url && result.sourceUrl) setSourceUrl(result.sourceUrl);
  }, [result.sourceUrl]);

  const canImport = !!result.hero && result.cards.length > 0;

  async function doImport() {
    if (!result.hero) return;
    try {
      const id = await importDeck(
        name.trim() || result.hero.name,
        format,
        result.hero.id,
        sourceUrl.trim(),
        isPrecon,
        result.cards.map((r) => ({ cardId: r.card.id, quantity: r.quantity })),
      );
      onImported(id);
    } catch (e) {
      setError(`Import failed: ${e}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-2 py-1 text-xs text-gray-200 hover:border-accent"
        >
          ← Decks
        </button>
        <h2 className="text-base font-semibold text-white">Import a deck</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <p className="text-sm leading-relaxed text-muted">
            Open a deck on Fabrary in your browser, use its{" "}
            <span className="text-gray-300">Copy card list to clipboard</span> button, then
            paste the list here.
            <button
              type="button"
              onClick={() => openUrl(FABRARY).catch(() => {})}
              className="ml-2 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-gray-200 hover:border-accent hover:text-white"
            >
              Open Fabrary ↗
            </button>
          </p>

          {/* Kind */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wide text-muted">Import as</span>
            <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
              {[
                ["Precon", true],
                ["Deck", false],
              ].map(([label, val]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => setIsPrecon(val as boolean)}
                  className={`rounded-md px-3 py-1.5 ${
                    isPrecon === val ? "bg-accent font-semibold text-black" : "text-gray-300 hover:text-white"
                  }`}
                >
                  {label as string}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">
              {isPrecon ? "Filed under Imported precons" : "A regular deck in My Decks"}
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder={"Paste a decklist export, e.g.\n\nName: Bravo Silver Age Deck\nHero: Bravo, Flattering Showman\nFormat: Silver Age\n\nDeck cards\n2x Boulder Drop (red)\n…"}
            spellCheck={false}
            className="h-52 w-full resize-y rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />

          {/* Parse summary */}
          {text.trim() && (
            <div className="rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
              <div className="text-gray-200">
                {result.hero ? (
                  <>
                    Hero: <span className="font-semibold text-white">{result.hero.name}</span>
                  </>
                ) : (
                  <span className="text-amber-300">No hero found — include the Hero: line.</span>
                )}
              </div>
              <div className="mt-0.5 text-muted">
                {result.cards.length} distinct cards · {result.total} copies
              </div>
              {result.unmatched.length > 0 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-amber-300">
                    {result.unmatched.length} unmatched line(s)
                  </summary>
                  <ul className="mt-1 list-disc pl-4 text-muted">
                    {result.unmatched.map((u, i) => (
                      <li key={i} className="font-mono">{u}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted">Deck name</span>
              <input
                value={name}
                onChange={(e) => {
                  touched.current.name = true;
                  setName(e.target.value);
                }}
                placeholder="Deck name"
                className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted">Format</span>
              <select
                value={format}
                onChange={(e) => {
                  touched.current.format = true;
                  setFormat(e.target.value as DeckFormat);
                }}
                className="rounded-md border border-border bg-surface-2 px-1.5 py-1 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted">Source URL (optional)</span>
              <input
                value={sourceUrl}
                onChange={(e) => {
                  touched.current.url = true;
                  setSourceUrl(e.target.value);
                }}
                placeholder="fabrary.net/decks/…"
                className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={doImport}
            disabled={!canImport}
            className="rounded-lg bg-accent py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40"
          >
            Import {isPrecon ? "precon" : "deck"}
          </button>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
