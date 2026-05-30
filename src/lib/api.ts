// Thin typed wrappers around Tauri IPC commands. Every call into the Rust
// backend should go through here so the surface stays in one place.

import { invoke } from "@tauri-apps/api/core";
import type { Card } from "../types/card";

/** Return the locally cached catalog. Empty array ⇒ not synced yet. */
export function getCards(): Promise<Card[]> {
  return invoke<Card[]>("get_cards");
}

/** Download the latest catalog from the data source, cache it, and return it. */
export function syncCards(): Promise<Card[]> {
  return invoke<Card[]>("sync_cards");
}
