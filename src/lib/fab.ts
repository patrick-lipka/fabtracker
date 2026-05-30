// Presentation helpers for Flesh and Blood card data: colors and small
// formatting utilities. The backend already provides the printed type line
// (`typeText`) and resolved rarity labels, so this stays thin.

/** Pitch strip color name → hex (matches the --color-pitch-* theme tokens). */
const PITCH_HEX: Record<string, string> = {
  Red: "#d8403a",
  Yellow: "#e6b73e",
  Blue: "#3d7fd6",
};

/** Neutral accent for cards with no pitch color (heroes, weapons, equipment). */
export const NO_PITCH_COLOR = "#3a4150";

export function pitchColor(color: string | null): string {
  return (color && PITCH_HEX[color]) || NO_PITCH_COLOR;
}

/** Color for a rarity chip, keyed by the resolved rarity label. */
const RARITY_HEX: Record<string, string> = {
  Common: "#9aa3b5",
  Rare: "#7fb2e6",
  "Super Rare": "#67d2c0",
  Majestic: "#e0b341",
  Legendary: "#c47ae0",
  Fabled: "#e07ab0",
  Marvel: "#ff8a5c",
  Promo: "#a0a7b8",
  Token: "#8b93a7",
  Basic: "#8b93a7",
};

export function rarityColor(rarity: string): string {
  return RARITY_HEX[rarity] ?? "#8b93a7";
}

/**
 * Display a stat: the parsed number if present, otherwise the raw text
 * (e.g. "*", "X"), otherwise an em dash.
 */
export function statDisplay(
  value: number | null,
  text: string | null,
): string {
  if (value !== null) return String(value);
  if (text) return text;
  return "—";
}
