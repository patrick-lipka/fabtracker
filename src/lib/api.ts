// Thin typed wrappers around Tauri IPC commands. Every call into the Rust
// backend should go through here so the surface stays in one place.

import { invoke } from "@tauri-apps/api/core";
import type { Card } from "../types/card";

/** Return the locally cached catalog. Empty array ⇒ not synced yet. */
export function getCards(): Promise<Card[]> {
  return invoke<Card[]>("get_cards");
}

/** Run a query-language search against the catalog (see search syntax help). */
export function searchCards(query: string): Promise<Card[]> {
  return invoke<Card[]>("search_cards", { query });
}

/** Download the latest catalog from the data source, cache it, and return it. */
export function syncCards(): Promise<Card[]> {
  return invoke<Card[]>("sync_cards");
}

export interface CatalogInfo {
  count: number;
  /** Unix epoch milliseconds of the last successful sync, or null. */
  lastSynced: number | null;
}

/** Card count + last-synced timestamp from the local database. */
export function getCatalogInfo(): Promise<CatalogInfo> {
  return invoke<CatalogInfo>("get_catalog_info");
}
