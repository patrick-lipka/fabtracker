// Thin typed wrappers around Tauri IPC commands. Every call into the Rust
// backend should go through here so the surface stays in one place.

import { invoke } from "@tauri-apps/api/core";
import type { Card } from "../types/card";

/** Fetch the full card catalog from the Rust backend. */
export function getCards(): Promise<Card[]> {
  return invoke<Card[]>("get_cards");
}
