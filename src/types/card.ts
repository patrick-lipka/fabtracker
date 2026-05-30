// Mirror of the Rust `Card`/`Printing` model in `src-tauri/src/card.rs`.
// Kept in sync by hand for now; if it churns we can generate it (e.g. ts-rs).

export interface Printing {
  id: string;
  setId: string;
  setName: string;
  rarity: string;
  artists: string[];
  flavorText: string | null;
  imageUrl: string | null;
}

export interface Card {
  id: string;
  name: string;

  /** Pitch strip color: "Red" | "Yellow" | "Blue" | null. */
  color: string | null;
  pitch: number | null;

  // Stats are parsed where possible; *Text holds the raw printed value
  // (which can be "*", "X", "XX", ...). Both null ⇒ the stat is absent.
  cost: number | null;
  costText: string | null;
  power: number | null;
  powerText: string | null;
  defense: number | null;
  defenseText: string | null;
  health: number | null;
  intellect: number | null;
  arcane: number | null;

  isHero: boolean;
  types: string[];
  traits: string[];
  keywords: string[];
  /** Printed type line, e.g. "Ninja Action - Attack". */
  typeText: string;

  functionalText: string | null;

  rarity: string;
  sets: string[];
  imageUrl: string | null;

  printings: Printing[];
}

// --- Collection -------------------------------------------------------------

export interface Binder {
  id: number;
  name: string;
  position: number;
  cardCount: number;
  totalQuantity: number;
}

/** A specific (printing, foiling, condition) stack of a card in a binder. */
export interface CardCollectionEntry {
  binderId: number;
  binderName: string;
  printingId: string;
  setId: string;
  foiling: string;
  condition: string;
  quantity: number;
}

/** Identifies a stack when adding/adjusting/moving. */
export interface EntryKey {
  cardId: string;
  printingId: string;
  setId: string;
  foiling: string;
  condition: string;
}

/** Foiling options (from the dataset's foiling list). */
export const FOILINGS = [
  "Standard",
  "Rainbow Foil",
  "Cold Foil",
  "Gold Cold Foil",
] as const;

/** Card condition grades. */
export const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;

/** A collected card together with how many are owned (within scope). */
export interface CollectionCard {
  card: Card;
  quantity: number;
}

/** Map of card id → total owned quantity across all binders. */
export type OwnedCounts = Record<string, number>;
