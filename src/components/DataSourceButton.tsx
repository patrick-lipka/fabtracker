import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { CatalogInfo } from "../lib/api";

const REPO_URL = "https://github.com/the-fab-cube/flesh-and-blood-cards";

interface DataSourceButtonProps {
  info: CatalogInfo | null;
  syncing: boolean;
  /** Persist the chosen ref mode, then re-sync. */
  onApply: (mode: string) => void;
  /** Re-pull the catalog from the current source. */
  onSync: () => void;
}

/** Compact "last synced" label (same idea as the old header one). */
function syncedLabel(ms: number): string {
  const date = new Date(ms);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
}

/**
 * Shows the current data source (branch + last synced) and lets the user choose
 * how the catalog ref is resolved: "auto" (newest commit across all branches)
 * or a specific branch/tag. The maintainer rotates spoiler-season branches, so
 * "auto" tracks whichever is currently active.
 */
export function DataSourceButton({ info, syncing, onApply, onSync }: DataSourceButtonProps) {
  const [open, setOpen] = useState(false);
  const isManual = info ? info.mode !== "auto" : false;
  const [manual, setManual] = useState(isManual);
  const [refText, setRefText] = useState(isManual ? (info?.mode ?? "") : "");

  function apply() {
    onApply(manual ? refText.trim() || "auto" : "auto");
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Data source"
        className={`rounded-lg border px-2.5 py-2 text-xs ${
          open ? "border-accent text-accent" : "border-border text-muted hover:border-accent"
        }`}
      >
        ⚙
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Card data source
            </h3>
            <p className="mb-2 text-[11px] leading-relaxed text-muted">
              From the community{" "}
              <button
                type="button"
                onClick={() => openUrl(REPO_URL).catch(() => {})}
                className="text-accent hover:underline"
              >
                the-fab-cube dataset
              </button>
              .
              {info?.branch && (
                <>
                  {" "}
                  Currently on <span className="text-gray-300">{info.branch}</span>.
                </>
              )}
            </p>
            {info?.lastSynced != null && (
              <p className="mb-3 text-[11px] text-muted">
                Last synced <span className="text-gray-300">{syncedLabel(info.lastSynced)}</span>.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input
                type="radio"
                checked={!manual}
                onChange={() => setManual(false)}
              />
              Auto — newest across all branches
            </label>
            <label className="mt-1.5 flex items-center gap-2 text-sm text-gray-200">
              <input
                type="radio"
                checked={manual}
                onChange={() => setManual(true)}
              />
              Specific branch / tag
            </label>
            {manual && (
              <input
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
                placeholder="e.g. develop"
                className="mt-2 w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
              />
            )}

            <button
              type="button"
              onClick={apply}
              disabled={syncing}
              className="mt-3 w-full rounded-lg bg-accent py-1.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60"
            >
              {syncing ? "Syncing…" : "Save & sync"}
            </button>
            <button
              type="button"
              onClick={() => {
                onSync();
                setOpen(false);
              }}
              disabled={syncing}
              className="mt-2 w-full rounded-lg border border-border bg-surface-2 py-1.5 text-sm text-gray-200 hover:border-accent disabled:opacity-60"
            >
              Re-sync now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
