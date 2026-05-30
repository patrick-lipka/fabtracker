// Mirror of the Rust `Card` model in `src-tauri/src/card.rs`.
// Kept in sync by hand for now; if this grows we can generate it (e.g. ts-rs).

export type CardType =
  | "Hero"
  | "Weapon"
  | "Equipment"
  | "Action"
  | "AttackReaction"
  | "DefenseReaction"
  | "Instant"
  | "Resource"
  | "Token";

export type Rarity =
  | "Token"
  | "Common"
  | "Rare"
  | "SuperRare"
  | "Majestic"
  | "Legendary"
  | "Fabled"
  | "Promo";

/** Pitch value 1/2/3 → red/yellow/blue. */
export type Pitch = 1 | 2 | 3;

export interface Card {
  id: string;
  name: string;

  pitch: Pitch | null;
  cost: number | null;
  power: number | null;
  defense: number | null;
  health: number | null;
  intellect: number | null;

  cardType: CardType;
  subtypes: string[];
  classes: string[];
  talents: string[];

  rarity: Rarity;
  setCode: string;
  setName: string;
  cardNumber: string;

  keywords: string[];
  text: string;
  flavor: string | null;
  artist: string | null;
  imageUrl: string | null;
}
