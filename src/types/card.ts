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
  /** Set release date (ISO), if known. Printings are ordered newest-first. */
  released: string | null;
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

  // Format legality flags (null = not synced yet). *_legal excludes bans.
  ccLegal?: boolean | null;
  blitzLegal?: boolean | null;
  silverAgeLegal?: boolean | null;
  ccBanned?: boolean | null;
  blitzBanned?: boolean | null;
  silverAgeBanned?: boolean | null;
  ccLivingLegend?: boolean | null;
  blitzLivingLegend?: boolean | null;
  ccSuspended?: boolean | null;
  blitzSuspended?: boolean | null;
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
  /** Distinct printing ids owned (in scope) — for showing the owned art. */
  ownedPrintingIds: string[];
}

/** Map of card id → total owned quantity across all binders. */
export type OwnedCounts = Record<string, number>;

/** How the card list is displayed. */
export type ViewMode = "small" | "medium" | "large" | "list";

// --- Decks ------------------------------------------------------------------

export type DeckFormat = "cc" | "blitz" | "silver_age";

export interface DeckSummary {
  id: number;
  name: string;
  format: string;
  heroId: string;
  heroName: string | null;
  heroImage: string | null;
  cardCount: number;
  updatedAt: number;
}

export interface DeckCardEntry {
  card: Card;
  quantity: number;
  owned: number;
  legal: boolean;
}

export interface CurvePoint {
  cost: number; // 6 = "6+"
  count: number;
}

export interface PitchCounts {
  one: number;
  two: number;
  three: number;
}

export interface Legality {
  ok: boolean;
  mainDeckCount: number;
  required: string;
  issues: string[];
}

export interface DeckDetail {
  id: number;
  name: string;
  format: string;
  hero: Card | null;
  cards: DeckCardEntry[];
  totalCards: number;
  curve: CurvePoint[];
  pitchCounts: PitchCounts;
  missing: number;
  legality: Legality;
}
