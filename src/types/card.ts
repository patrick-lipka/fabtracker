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
