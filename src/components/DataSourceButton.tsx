import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { ask, open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  backupDatabase,
  clearImageCache,
  dbLocation,
  imageCacheInfo,
  prewarmImageCache,
  resetDbLocation,
  restoreDatabase,
  setDbLocation,
  type CatalogInfo,
  type DbLocationInfo,
  type ImageCacheInfo,
} from "../lib/api";

const REPO_URL = "https://github.com/the-fab-cube/flesh-and-blood-cards";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

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
  const [cache, setCache] = useState<ImageCacheInfo | null>(null);
  const [clearing, setClearing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [db, setDb] = useState<DbLocationInfo | null>(null);
  const [dbMsg, setDbMsg] = useState<string | null>(null);

  // Load image-cache size + DB location whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    imageCacheInfo().then(setCache).catch(() => setCache(null));
    dbLocation().then(setDb).catch(() => setDb(null));
  }, [open]);

  async function changeDbFolder() {
    const dir = await openDialog({ directory: true, title: "Choose a folder for the database" });
    if (typeof dir !== "string") return;
    setDbMsg("Moving database…");
    try {
      await setDbLocation(dir);
      window.location.reload();
    } catch (e) {
      setDbMsg(`Failed: ${e}`);
    }
  }

  async function resetDb() {
    if (!(await ask("Move the database back to the default location and restart?", {
      title: "Reset database location",
      kind: "warning",
    }))) return;
    try {
      await resetDbLocation();
      window.location.reload();
    } catch (e) {
      setDbMsg(`Failed: ${e}`);
    }
  }

  async function backupDb() {
    const dest = await saveDialog({
      defaultPath: "fabtracker-backup.db",
      filters: [{ name: "SQLite database", extensions: ["db"] }],
    });
    if (!dest) return;
    try {
      await backupDatabase(dest);
      setDbMsg("Backup saved.");
    } catch (e) {
      setDbMsg(`Failed: ${e}`);
    }
  }

  async function restoreDb() {
    const src = await openDialog({
      multiple: false,
      filters: [{ name: "SQLite database", extensions: ["db", "sqlite"] }],
      title: "Choose a backup to restore",
    });
    if (typeof src !== "string") return;
    if (!(await ask("Replace ALL current data with this backup? Your current collection and decks will be overwritten.", {
      title: "Restore database",
      kind: "warning",
    }))) return;
    try {
      await restoreDatabase(src);
      window.location.reload();
    } catch (e) {
      setDbMsg(`Failed: ${e}`);
    }
  }

  function apply() {
    onApply(manual ? refText.trim() || "auto" : "auto");
    setOpen(false);
  }

  async function clearCache() {
    setClearing(true);
    try {
      await clearImageCache();
      setCache(await imageCacheInfo());
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  }

  async function downloadAll() {
    setProgress({ done: 0, total: 0 });
    const unlisten = await listen<{ done: number; total: number }>(
      "image-prewarm-progress",
      (e) => setProgress(e.payload),
    );
    try {
      await prewarmImageCache();
      setCache(await imageCacheInfo());
    } catch {
      /* ignore */
    } finally {
      unlisten();
      setProgress(null);
    }
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
          <div className="absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-[300px] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50">
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

            <div className="mt-3 border-t border-border pt-3 text-[11px] text-muted">
              <div className="flex items-center justify-between">
                <span>
                  Image cache:{" "}
                  <span className="text-gray-300">
                    {cache ? `${cache.count} files · ${formatBytes(cache.bytes)}` : "…"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={clearCache}
                  disabled={clearing || progress !== null || (cache?.count ?? 0) === 0}
                  className="rounded-md border border-border px-2 py-0.5 text-gray-200 hover:border-accent disabled:opacity-50"
                >
                  {clearing ? "Clearing…" : "Clear"}
                </button>
              </div>
              <button
                type="button"
                onClick={downloadAll}
                disabled={progress !== null || clearing}
                className="mt-2 w-full rounded-md border border-border bg-surface-2 py-1 text-gray-200 hover:border-accent disabled:opacity-60"
              >
                {progress
                  ? `Downloading ${progress.done}/${progress.total || "…"}…`
                  : "Download all images"}
              </button>
            </div>

            {/* Database file: location + backup/restore. */}
            <div className="mt-3 border-t border-border pt-3 text-[11px]">
              <div className="font-semibold uppercase tracking-wide text-muted">
                Database (collection &amp; decks)
              </div>
              <p
                className="mt-1 truncate text-[10px] text-gray-300"
                title={db?.path ?? ""}
              >
                {db ? db.path : "…"}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={backupDb}
                  className="rounded-md border border-border bg-surface-2 py-1 text-gray-200 hover:border-accent"
                >
                  Back up…
                </button>
                <button
                  type="button"
                  onClick={restoreDb}
                  className="rounded-md border border-border bg-surface-2 py-1 text-gray-200 hover:border-accent"
                >
                  Restore…
                </button>
                <button
                  type="button"
                  onClick={changeDbFolder}
                  className="rounded-md border border-border bg-surface-2 py-1 text-gray-200 hover:border-accent"
                >
                  Change folder…
                </button>
                {db?.isCustom && (
                  <button
                    type="button"
                    onClick={resetDb}
                    className="rounded-md border border-border bg-surface-2 py-1 text-gray-200 hover:border-accent"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              {dbMsg && <p className="mt-1.5 text-[10px] text-muted">{dbMsg}</p>}
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                Tip: pointing this at a cloud-synced folder (Drive/iCloud/…) can sync across
                devices — but only use one device at a time and let sync settle, or use
                Back up / Restore to move data safely.
              </p>
            </div>

            <p className="mt-3 border-t border-border pt-3 text-[10px] leading-relaxed text-muted">
              Unofficial fan tool — not affiliated with Legend Story Studios.
              Flesh and Blood card data &amp; images are © LSS.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
