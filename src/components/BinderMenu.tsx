import { useEffect } from "react";
import type { Binder, Card } from "../types/card";

export interface BinderMenuState {
  card: Card;
  x: number;
  y: number;
  /** Quantity of this card in the currently-selected binder (collection view). */
  currentQty: number;
  /** The currently-selected binder, if scoped (enables move/remove). */
  currentBinderId: number | null;
}

interface BinderMenuProps {
  state: BinderMenuState;
  binders: Binder[];
  onAdd: (binderId: number) => void;
  onMove: (toBinderId: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * A small fixed-position menu (anchored at the click point) for adding a card
 * to a binder, or — when viewing a specific binder — moving/removing it.
 * Rendered at the document level so it isn't clipped by the grid's scroll area.
 */
export function BinderMenu({
  state,
  binders,
  onAdd,
  onMove,
  onRemove,
  onClose,
}: BinderMenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canMove =
    state.currentBinderId !== null && state.currentQty > 0 && binders.length > 1;

  // Keep the menu on screen.
  const left = Math.min(state.x, window.innerWidth - 230);
  const top = Math.min(state.y, window.innerHeight - 320);

  return (
    <>
      {/* Backdrop: click anywhere to dismiss. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="fixed z-50 max-h-[300px] w-[210px] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-xl shadow-black/50"
        style={{ left, top }}
      >
        <div className="truncate px-2 py-1 text-xs font-semibold text-white">
          {state.card.name}
        </div>

        <MenuLabel>Add to binder</MenuLabel>
        {binders.map((b) => (
          <MenuItem key={`add-${b.id}`} onClick={() => onAdd(b.id)}>
            {b.name}
            <span className="text-muted">+1</span>
          </MenuItem>
        ))}

        {canMove && (
          <>
            <div className="my-1 border-t border-border" />
            <MenuLabel>Move all to</MenuLabel>
            {binders
              .filter((b) => b.id !== state.currentBinderId)
              .map((b) => (
                <MenuItem key={`move-${b.id}`} onClick={() => onMove(b.id)}>
                  {b.name}
                  <span className="text-muted">×{state.currentQty}</span>
                </MenuItem>
              ))}
            <MenuItem onClick={onRemove} danger>
              Remove from this binder
            </MenuItem>
          </>
        )}
      </div>
    </>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${
        danger ? "text-red-400 hover:text-red-300" : "text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
