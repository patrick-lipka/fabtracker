// Thin typed wrappers around Tauri IPC commands. Every call into the Rust
// backend should go through here so the surface stays in one place.

import { invoke } from "@tauri-apps/api/core";
import type {
  Binder,
  Card,
  CardCollectionEntry,
  CollectionCard,
  DeckDetail,
  DeckSummary,
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
  /** Branch the cached catalog was synced from. */
  branch: string | null;
  /** Configured ref mode: "auto" or an explicit branch/tag/sha. */
  mode: string;
}

/** Card count, last-synced timestamp, source branch + mode. */
export function getCatalogInfo(): Promise<CatalogInfo> {
  return invoke<CatalogInfo>("get_catalog_info");
}

export interface UpdateInfo {
  updateAvailable: boolean;
  branch: string;
  sha: string;
  date: string;
  currentSha: string | null;
}

/** Resolve the target ref and report whether it's newer than the last sync. */
export function checkUpdates(): Promise<UpdateInfo> {
  return invoke<UpdateInfo>("check_updates");
}

/** Set the data-source ref mode: "auto" or an explicit branch/tag/sha. */
export function setDataRef(mode: string): Promise<void> {
  return invoke("set_data_ref", { mode });
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

// --- Decks ------------------------------------------------------------------

/** All heroes (optionally only owned ones). */
export function listHeroes(ownedOnly: boolean): Promise<Card[]> {
  return invoke<Card[]>("list_heroes", { ownedOnly });
}

export function listDecks(): Promise<DeckSummary[]> {
  return invoke<DeckSummary[]>("list_decks");
}

/** Create a deck for a hero; returns the new deck id. */
export function createDeck(name: string, format: string, heroId: string): Promise<number> {
  return invoke<number>("create_deck", { name, format, heroId });
}

/** Full deck with resolved cards, stats, curve, legality, and missing count. */
export function getDeck(id: number): Promise<DeckDetail> {
  return invoke<DeckDetail>("get_deck", { id });
}

export function renameDeck(id: number, name: string): Promise<void> {
  return invoke("rename_deck", { id, name });
}

export function setDeckFormat(id: number, format: string): Promise<void> {
  return invoke("set_deck_format", { id, format });
}

export function deleteDeck(id: number): Promise<void> {
  return invoke("delete_deck", { id });
}

/** Save a deck's Markdown build / piloting notes. */
export function setDeckNotes(id: number, notes: string): Promise<void> {
  return invoke("set_deck_notes", { id, notes });
}

/** Change a card's quantity in a deck by `delta` (removed at 0). */
export function adjustDeckCard(deckId: number, cardId: string, delta: number): Promise<void> {
  return invoke("adjust_deck_card", { deckId, cardId, delta });
}
