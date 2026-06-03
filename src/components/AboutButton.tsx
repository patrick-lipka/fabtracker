import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Flaticon's free license requires crediting the icon author.
const ICON_ATTRIBUTION_URL = "https://www.flaticon.com/free-icons/flash-cards";

type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; pct: number }
  | { kind: "error" };

/** Header "i" button: app version, update check, disclaimer, icon attribution. */
export function AboutButton() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [up, setUp] = useState<UpdateState>({ kind: "idle" });

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  // Quiet check on launch: if an update is waiting, flag it (a dot on the
  // button) without interrupting. Errors (offline / no release) are ignored.
  useEffect(() => {
    check()
      .then((update) => {
        if (update) setUp({ kind: "available", update });
      })
      .catch(() => {});
  }, []);

  async function checkUpdates() {
    setUp({ kind: "checking" });
    try {
      const update = await check();
      setUp(update ? { kind: "available", update } : { kind: "uptodate" });
    } catch {
      setUp({ kind: "error" });
    }
  }

  async function install(update: Update) {
    try {
      let total = 0;
      let got = 0;
      setUp({ kind: "downloading", pct: 0 });
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        else if (e.event === "Progress") {
          got += e.data.chunkLength;
          setUp({ kind: "downloading", pct: total ? Math.round((got / total) * 100) : 0 });
        }
      });
      await relaunch();
    } catch {
      setUp({ kind: "error" });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="About"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm ${
          open ? "border-accent text-accent" : "border-border text-muted hover:border-accent"
        }`}
      >
        ⓘ
      </button>
      {up.kind === "available" && (
        <span
          title={`Update available: v${up.update.version}`}
          className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-canvas"
        />
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50">
            <h3 className="text-sm font-semibold text-white">FaB Tracker</h3>
            <p className="mt-0.5 text-xs text-muted">
              Version <span className="text-gray-300">{version || "—"}</span>
            </p>

            <div className="mt-2 text-[11px]">
              {up.kind === "idle" && (
                <button
                  type="button"
                  onClick={checkUpdates}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1 text-gray-200 hover:border-accent"
                >
                  Check for updates
                </button>
              )}
              {up.kind === "checking" && <span className="text-muted">Checking…</span>}
              {up.kind === "uptodate" && (
                <span className="text-emerald-400">You're on the latest version.</span>
              )}
              {up.kind === "available" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-200">v{up.update.version} available</span>
                  <button
                    type="button"
                    onClick={() => install(up.update)}
                    className="rounded-md bg-accent px-2 py-0.5 font-semibold text-black hover:brightness-110"
                  >
                    Install &amp; restart
                  </button>
                </div>
              )}
              {up.kind === "downloading" && (
                <span className="text-muted">Downloading… {up.pct}%</span>
              )}
              {up.kind === "error" && (
                <span className="text-amber-300">Couldn't check for updates.</span>
              )}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Unofficial fan tool — not affiliated with Legend Story Studios.
              Flesh and Blood card data &amp; images are © LSS.
            </p>

            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
              App icon:{" "}
              <button
                type="button"
                onClick={() => openUrl(ICON_ATTRIBUTION_URL).catch(() => {})}
                className="text-accent hover:underline"
              >
                Flash cards icons created by manshagraphics — Flaticon
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
