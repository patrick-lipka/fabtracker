// Presentation helpers for Flesh and Blood card data: turning the domain model
// into human-readable labels and consistent colors.

import type { Card, CardType, Pitch, Rarity } from "../types/card";

/** Pitch value → hex color (matches the --color-pitch-* theme tokens). */
export const PITCH_COLOR: Record<Pitch, string> = {
  1: "#d8403a",
  2: "#e6b73e",
  3: "#3d7fd6",
};

/** A neutral color for cards with no pitch (heroes, weapons, equipment). */
export const NO_PITCH_COLOR = "#3a4150";

export function pitchColor(pitch: Pitch | null): string {
  return pitch ? PITCH_COLOR[pitch] : NO_PITCH_COLOR;
}

const CARD_TYPE_LABEL: Record<CardType, string> = {
  Hero: "Hero",
  Weapon: "Weapon",
  Equipment: "Equipment",
  Action: "Action",
  AttackReaction: "Attack Reaction",
  DefenseReaction: "Defense Reaction",
  Instant: "Instant",
  Resource: "Resource",
  Token: "Token",
};

export function cardTypeLabel(type: CardType): string {
  return CARD_TYPE_LABEL[type];
}

/**
 * The full type line as printed on a card, e.g.
 * "Ninja Action - Attack" or "Generic Equipment - Chest".
 */
export function typeLine(card: Card): string {
  const left = [...card.talents, ...card.classes, cardTypeLabel(card.cardType)]
    .filter(Boolean)
    .join(" ");
  return card.subtypes.length ? `${left} - ${card.subtypes.join(" ")}` : left;
}

const RARITY_LABEL: Record<Rarity, string> = {
  Token: "Token",
  Common: "Common",
  Rare: "Rare",
  SuperRare: "Super Rare",
  Majestic: "Majestic",
  Legendary: "Legendary",
  Fabled: "Fabled",
  Promo: "Promo",
};

export function rarityLabel(rarity: Rarity): string {
  return RARITY_LABEL[rarity];
}

/** Color used for the rarity chip. */
export const RARITY_COLOR: Record<Rarity, string> = {
  Token: "#8b93a7",
  Common: "#9aa3b5",
  Rare: "#7fb2e6",
  SuperRare: "#67d2c0",
  Majestic: "#e0b341",
  Legendary: "#c47ae0",
  Fabled: "#e07ab0",
  Promo: "#a0a7b8",
};
