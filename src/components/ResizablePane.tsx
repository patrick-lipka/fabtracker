import { useEffect, useRef, useState } from "react";

interface ResizablePaneProps {
  children: React.ReactNode;
  /** Extra classes for the <aside> (e.g. "flex flex-col"). */
  className?: string;
  /** Width is shared across panes by default; override for a per-pane width. */
  storageKey?: string;
  defaultWidth?: number;
  min?: number;
  max?: number;
}

/**
 * A right-side panel the user can resize by dragging its left edge. Width is
 * persisted to localStorage and clamped to [min, max].
 */
export function ResizablePane({
  children,
  className = "",
  storageKey = "fabtracker:rightPaneWidth",
  defaultWidth = 360,
  min = 280,
  max = 640,
}: ResizablePaneProps) {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= min && saved <= max ? saved : defaultWidth;
  });
  const asideRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const rightEdge = useRef(0);

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  const clamp = (w: number) => Math.min(max, Math.max(min, w));

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    dragging.current = true;
    rightEdge.current = asideRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setWidth(clamp(rightEdge.current - e.clientX));
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  return (
    <aside
      ref={asideRef}
      style={{ width }}
      className={`relative shrink-0 border-l border-border bg-surface ${className}`}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag to resize"
        className="absolute -left-1 top-0 z-30 h-full w-2 cursor-col-resize hover:bg-accent/30"
      />
      {children}
    </aside>
  );
}
