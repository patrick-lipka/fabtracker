// Thin typed wrappers around Tauri IPC commands. Every call into the Rust
// backend should go through here so the surface stays in one place.

import { invoke } from "@tauri-apps/api/core";
import type {
  Binder,
  BinderEntry,
  Card,
  CollectionCard,
  OwnedCounts,
} from "../types/card";

/** Return the locally cached catalog. Empty array ⇒ not synced yet. */
export function getCards(): Promise<Card[]> {
  return invoke<Card[]>("get_cards");
}

/**
 * Run a query-language search against the catalog (see search syntax help).
 * `ownedOnly` additionally restricts results to cards in the collection.
 */
export function searchCards(query: string, ownedOnly: boolean): Promise<Card[]> {
  return invoke<Card[]>("search_cards", { query, ownedOnly });
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

// --- Collection -------------------------------------------------------------

export function listBinders(): Promise<Binder[]> {
  return invoke<Binder[]>("list_binders");
}

/** Binder mutations return the updated binder list for convenience. */
export function createBinder(name: string): Promise<Binder[]> {
  return invoke<Binder[]>("create_binder", { name });
}

export function renameBinder(id: number, name: string): Promise<Binder[]> {
  return invoke<Binder[]>("rename_binder", { id, name });
}

export function deleteBinder(id: number): Promise<Binder[]> {
  return invoke<Binder[]>("delete_binder", { id });
}

/** Cards in the collection; pass a binder id to scope, or null for all. */
export function getCollection(binderId: number | null): Promise<CollectionCard[]> {
  return invoke<CollectionCard[]>("get_collection", { binderId });
}

/** A card's quantity in every binder (drives the detail-pane steppers). */
export function cardBinders(cardId: string): Promise<BinderEntry[]> {
  return invoke<BinderEntry[]>("card_binders", { cardId });
}

/** Change a card's quantity in a binder by `delta` (row removed at 0). */
export function adjustCard(
  binderId: number,
  cardId: string,
  delta: number,
): Promise<void> {
  return invoke("adjust_card", { binderId, cardId, delta });
}

/** Move `quantity` copies of a card from one binder to another. */
export function moveCard(
  fromBinder: number,
  toBinder: number,
  cardId: string,
  quantity: number,
): Promise<void> {
  return invoke("move_card", { fromBinder, toBinder, cardId, quantity });
}

/** card id → total owned quantity across all binders. */
export function ownedCounts(): Promise<OwnedCounts> {
  return invoke<OwnedCounts>("owned_counts");
}
