// Thin typed wrappers around Tauri IPC commands. Every call into the Rust
// backend should go through here so the surface stays in one place.

import { invoke } from "@tauri-apps/api/core";
import type {
  Binder,
  Card,
  CardCollectionEntry,
  CollectionCard,
  EntryKey,
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

/**
 * Search within the collection using the query language, optionally scoped to a
 * binder (null = all binders). Returns matching cards with owned quantities.
 */
export function searchCollection(
  query: string,
  binderId: number | null,
): Promise<CollectionCard[]> {
  return invoke<CollectionCard[]>("search_collection", { query, binderId });
}

/** Every collection stack of a card across binders (drives the detail list). */
export function cardEntries(cardId: string): Promise<CardCollectionEntry[]> {
  return invoke<CardCollectionEntry[]>("card_entries", { cardId });
}

/** Change a specific stack's quantity in a binder by `delta` (removed at 0). */
export function adjustEntry(
  binderId: number,
  entry: EntryKey,
  delta: number,
): Promise<void> {
  return invoke("adjust_entry", { binderId, entry, delta });
}

/** Move `quantity` copies of a specific stack between binders. */
export function moveEntry(
  fromBinder: number,
  toBinder: number,
  entry: EntryKey,
  quantity: number,
): Promise<void> {
  return invoke("move_entry", { fromBinder, toBinder, entry, quantity });
}

/** Move all stacks of a card from one binder to another (merging). */
export function moveCardAll(
  fromBinder: number,
  toBinder: number,
  cardId: string,
): Promise<void> {
  return invoke("move_card_all", { fromBinder, toBinder, cardId });
}

/** Remove every stack of a card from a binder. */
export function removeCardFromBinder(
  binderId: number,
  cardId: string,
): Promise<void> {
  return invoke("remove_card_from_binder", { binderId, cardId });
}

/** card id → total owned quantity across all binders. */
export function ownedCounts(): Promise<OwnedCounts> {
  return invoke<OwnedCounts>("owned_counts");
}
