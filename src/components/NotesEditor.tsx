import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/nord-dark.css";

interface NotesEditorProps {
  /** Initial Markdown (read once on mount — key by deck id to reset). */
  initial: string;
  onChange: (markdown: string) => void;
}

/**
 * An Obsidian-style live WYSIWYG Markdown editor (Milkdown "Crepe"). Edits round
 * -trip to Markdown, which we persist. Mount once per deck (caller keys it by
 * deck id); `onChange` is debounced by the caller.
 */
export function NotesEditor({ initial, onChange }: NotesEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const crepe = new Crepe({ root, defaultValue: initial });
    let destroyed = false;

    crepe.create().then(() => {
      if (destroyed) return;
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => onChangeRef.current(markdown));
      });
    });

    return () => {
      destroyed = true;
      // Flush the latest content before tearing the editor down.
      try {
        onChangeRef.current(crepe.getMarkdown());
      } catch {
        /* editor may not have finished creating */
      }
      crepe.destroy();
    };
    // Intentionally mount-once; the caller keys this component by deck id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="deck-notes h-full overflow-y-auto" />;
}
