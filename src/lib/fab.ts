// Presentation helpers for Flesh and Blood card data: colors and small
// formatting utilities. The backend already provides the printed type line
// (`typeText`) and resolved rarity labels, so this stays thin.

import type { Card } from "../types/card";

// Class and talent words — mirror of `deck.rs`. Kept separate so a multi-class
// card is legal for a hero of *any* of its classes (talent must also match).
const CLASSES = new Set([
  "Brute", "Guardian", "Ninja", "Warrior", "Mechanologist", "Ranger",
  "Runeblade", "Wizard", "Illusionist", "Assassin", "Bard", "Merchant",
  "Necromancer", "Shapeshifter", "Pirate",
]);
const TALENTS = new Set([
  "Draconic", "Earth", "Elemental", "Ice", "Light", "Lightning", "Royal",
  "Shadow", "Chaos", "Mystic",
]);

/**
 * Whether a card may be included in a hero's deck: Generic, or the hero shares
 * at least one of the card's classes (multi-class cards work for any of their
 * classes) and at least one of its talents.
 */
export function legalForHero(card: Card, hero: Card | null): boolean {
  if (!hero) return true;
  if (card.types.includes("Generic")) return true;
  const heroWords = new Set(hero.types);
  const classes = card.types.filter((t) => CLASSES.has(t));
  const talents = card.types.filter((t) => TALENTS.has(t));
  const classOk = classes.length === 0 || classes.some((c) => heroWords.has(c));
  const talentOk = talents.length === 0 || talents.some((t) => heroWords.has(t));
  return classOk && talentOk;
}

/** Whether a card is allowed in a format (legal pool, not banned/LL/suspended).
 *  Unknown flags (undefined/null, pre-sync) don't restrict. */
export function formatAllowed(card: Card, format: string): boolean {
  const f =
    format === "blitz"
      ? { legal: card.blitzLegal, banned: card.blitzBanned, ll: card.blitzLivingLegend, susp: card.blitzSuspended }
      : format === "silver_age"
        ? { legal: card.silverAgeLegal, banned: card.silverAgeBanned, ll: null, susp: null }
        : { legal: card.ccLegal, banned: card.ccBanned, ll: card.ccLivingLegend, susp: card.ccSuspended };
  return f.legal !== false && f.banned !== true && f.ll !== true && f.susp !== true;
}

// Silver Age allows only common / rare / basic (ex-token) rarity, counting a
// card if it has *ever* been printed at that rarity. Mirror of `deck.rs`.
const SA_RARITIES = new Set(["Common", "Rare", "Basic", "Token"]);
export function silverAgeRarityOk(card: Card): boolean {
  if (card.printings.length === 0) return SA_RARITIES.has(card.rarity);
  return card.printings.some((p) => SA_RARITIES.has(p.rarity));
}

/** Full deck legality for the pool: hero class/talent AND format legality. */
export function legalForDeck(card: Card, hero: Card | null, format: string): boolean {
  if (!legalForHero(card, hero) || !formatAllowed(card, format)) return false;
  if (format === "silver_age" && !silverAgeRarityOk(card)) return false;
  return true;
}

/** Whether a hero may lead a deck in the format: Blitz/Silver Age use young
 *  heroes, Classic Constructed uses adult heroes (those without the Young tag),
 *  plus format legality (bans, etc.). Silver Age heroes must also be a legal
 *  rarity. */
export function heroLegalForFormat(hero: Card, format: string): boolean {
  const young = hero.types.includes("Young");
  if (format === "blitz" || format === "silver_age") {
    if (!young) return false;
  } else if (young) {
    return false; // CC = adult heroes
  }
  if (format === "silver_age" && !silverAgeRarityOk(hero)) return false;
  return formatAllowed(hero, format);
}

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

/** A Cardmarket (EU) search URL for a card name — opens live EUR listings. */
export function cardmarketUrl(name: string): string {
  return `https://www.cardmarket.com/en/FleshAndBlood/Products/Search?searchString=${encodeURIComponent(
    name,
  )}`;
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
