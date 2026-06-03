import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";

// Flaticon's free license requires crediting the icon author.
const ICON_ATTRIBUTION_URL = "https://www.flaticon.com/free-icons/flash-cards";

/** Header "i" button: app version, disclaimer, and required icon attribution. */
export function AboutButton() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

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

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50">
            <h3 className="text-sm font-semibold text-white">FaB Tracker</h3>
            <p className="mt-0.5 text-xs text-muted">
              Version <span className="text-gray-300">{version || "—"}</span>
            </p>

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
