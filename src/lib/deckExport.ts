// Render a deck as a text decklist for the popular import targets. Fabrary and
// GEM both ingest a pitch-annotated card list (Fabrary's own export format is
// the de-facto interchange GEM accepts); "text" is a minimal universal list.

import type { DeckCardEntry, DeckDetail } from "../types/card";

export type ExportTarget = "fabrary" | "gem" | "text";

export const EXPORT_TARGETS: { value: ExportTarget; label: string }[] = [
  { value: "fabrary", label: "Fabrary" },
  { value: "gem", label: "GEM" },
  { value: "text", label: "Plain text" },
];

const FORMAT_LABEL: Record<string, string> = {
  cc: "Classic Constructed",
  blitz: "Blitz",
  silver_age: "Silver Age",
};

const isWeapon = (e: DeckCardEntry) => e.card.types.includes("Weapon");
const isEquip = (e: DeckCardEntry) => e.card.types.includes("Equipment") && !isWeapon(e);
const isMain = (e: DeckCardEntry) =>
  !isWeapon(e) && !isEquip(e) && !e.card.types.includes("Token");

const suffix = (color: string | null) => (color ? ` (${color.toLowerCase()})` : "");

/** "2x Card Name (red)" */
const line = (e: DeckCardEntry) => `${e.quantity}x ${e.card.name}${suffix(e.card.color)}`;

function byColorName(a: DeckCardEntry, b: DeckCardEntry) {
  return (a.card.color ?? "").localeCompare(b.card.color ?? "") || a.card.name.localeCompare(b.card.name);
}
const byName = (a: DeckCardEntry, b: DeckCardEntry) => a.card.name.localeCompare(b.card.name);

export function exportDeck(deck: DeckDetail, target: ExportTarget): string {
  const weapons = deck.cards.filter(isWeapon).sort(byName);
  const equipment = deck.cards.filter(isEquip).sort(byName);
  const arena = [...weapons, ...equipment];
  const main = deck.cards.filter(isMain).sort(byColorName);

  if (target === "text") {
    // Minimal universal list: hero, then every card with its pitch.
    const out: string[] = [];
    if (deck.hero) out.push(deck.hero.name);
    [...arena, ...main].forEach((e) => out.push(line(e)));
    return out.join("\n");
  }

  // Fabrary / GEM: header + Arena / Deck sections with pitch.
  const out: string[] = [];
  if (deck.name) out.push(`Name: ${deck.name}`);
  if (deck.hero) out.push(`Hero: ${deck.hero.name}`);
  out.push(`Format: ${FORMAT_LABEL[deck.format] ?? deck.format}`);
  if (arena.length) {
    out.push("", "Arena cards");
    arena.forEach((e) => out.push(line(e)));
  }
  if (main.length) {
    out.push("", "Deck cards");
    main.forEach((e) => out.push(line(e)));
  }
  return out.join("\n");
}
