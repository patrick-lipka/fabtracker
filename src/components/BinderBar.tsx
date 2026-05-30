import { useEffect, useState } from "react";
import type { Binder } from "../types/card";

interface BinderBarProps {
  binders: Binder[];
  selectedBinderId: number | null; // null = All
  totalQuantity: number; // across all binders, for the "All" chip
  onSelect: (id: number | null) => void;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}

/**
 * The binder selector shown in the Collection view: an "All" chip, one chip per
 * binder, and inline create/rename inputs (the Tauri webview has no reliable
 * window prompt/confirm, so create/rename/delete all happen inline).
 */
export function BinderBar({
  binders,
  selectedBinderId,
  totalQuantity,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: BinderBarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const selected = binders.find((b) => b.id === selectedBinderId) ?? null;

  // Reset the per-binder edit state whenever the selection changes.
  useEffect(() => {
    setRenaming(false);
    setConfirmingDelete(false);
  }, [selectedBinderId]);

  function submitCreate() {
    const name = newName.trim();
    if (name) onCreate(name);
    setNewName("");
    setCreating(false);
  }

  function submitRename() {
    const name = renameValue.trim();
    if (selected && name && name !== selected.name) onRename(selected.id, name);
    setRenaming(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
      <Chip
        active={selectedBinderId === null}
        onClick={() => onSelect(null)}
        label="All"
        count={totalQuantity}
      />

      {binders.map((b) => (
        <Chip
          key={b.id}
          active={b.id === selectedBinderId}
          onClick={() => onSelect(b.id)}
          label={b.name}
          count={b.totalQuantity}
        />
      ))}

      {creating ? (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={submitCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitCreate();
            if (e.key === "Escape") {
              setNewName("");
              setCreating(false);
            }
          }}
          placeholder="Binder name…"
          className="w-36 rounded-full border border-accent bg-surface-2 px-3 py-1 text-xs text-white focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-white"
        >
          + New binder
        </button>
      )}

      {/* Edit controls for the selected binder. */}
      {selected && (
        <div className="ml-auto flex items-center gap-3">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-36 rounded-full border border-accent bg-surface-2 px-3 py-1 text-xs text-white focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameValue(selected.name);
                setRenaming(true);
              }}
              className="text-xs text-muted hover:text-white"
            >
              Rename
            </button>
          )}

          {confirmingDelete ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-muted">Delete “{selected.name}”?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(selected.id);
                  setConfirmingDelete(false);
                }}
                className="font-medium text-red-400 hover:text-red-300"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-muted hover:text-white"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={binders.length <= 1}
              onClick={() => setConfirmingDelete(true)}
              title={binders.length <= 1 ? "Can't delete the last binder" : undefined}
              className="text-xs text-muted hover:text-red-400 disabled:opacity-40 disabled:hover:text-muted"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-accent bg-accent/10 text-white"
          : "border-border text-gray-300 hover:border-accent"
      }`}
    >
      {label}
      <span className="rounded-full bg-black/40 px-1.5 text-[10px] text-muted">
        {count}
      </span>
    </button>
  );
}
