// Parse a pasted Fabrary/Talishar-style text decklist and resolve each line to
// a catalog card. Tolerant of several formats since the user hand-pastes the
// export; unresolved lines are surfaced rather than silently dropped.
//
// Fabrary's plain-text export looks like:
//
//   Name: Bravo Silver Age Deck
//   Hero: Bravo, Flattering Showman
//   Format: Silver Age
//
//   Arena cards
//   1x Basalt Boots
//   …
//   Deck cards
//   2x Boulder Drop (red)
//   …
//   See the full deck @ https://fabrary.net/decks/…

import type { Card, DeckFormat } from "../types/card";

export interface ParsedLine {
  qty: number;
  name: string;
  /** Pitch (1/2/3) if a color/pitch annotation was present, for disambiguation. */
  pitch?: number;
  raw: string;
}

export interface ParsedDeck {
  name?: string;
  heroName?: string;
  format?: DeckFormat;
  sourceUrl?: string;
  lines: ParsedLine[];
}

export interface ResolvedCard {
  card: Card;
  quantity: number;
}

export interface ImportResult {
  hero: Card | null;
  /** Non-hero deck cards, aggregated by card id. */
  cards: ResolvedCard[];
  /** Raw lines we couldn't match to a card. */
  unmatched: string[];
  /** Total non-hero copies. */
  total: number;
  // Metadata suggestions parsed from the export header/footer.
  name?: string;
  format?: DeckFormat;
  sourceUrl?: string;
}

const COLOR_PITCH: Record<string, number> = { red: 1, yellow: 2, blue: 3 };
// Section headers in exports (ignored).
const SECTION_RE =
  /^(hero|heroes|weapons?|equipment|arena\s+cards?|deck\s+cards?|main\s?deck|deck|cards?|inventory|sideboard|class|talent|pitch)\s*:?\s*$/i;
// A collector number like "WTR159" / "BOL010" / "1HP012".
const COLLECTOR_RE = /^[A-Za-z0-9]{2,4}\d{1,3}[a-z]?$/;

function mapFormat(s: string): DeckFormat | undefined {
  const t = s.toLowerCase();
  if (t.includes("silver")) return "silver_age";
  if (t.includes("blitz")) return "blitz";
  if (t.includes("classic") || t.trim() === "cc") return "cc";
  return undefined;
}

/** Pull a trailing `(red)` / `[yellow]` / `(2)` annotation off a card name. */
function extractPitch(name: string): { name: string; pitch?: number } {
  const m = name.match(/[([{]\s*(red|yellow|blue|[1-3])\s*[)\]}]\s*$/i);
  if (!m || m.index === undefined) return { name: name.trim() };
  const tok = m[1].toLowerCase();
  return { name: name.slice(0, m.index).trim(), pitch: COLOR_PITCH[tok] ?? Number(tok) };
}

export function parseDecklist(text: string): ParsedDeck {
  const deck: ParsedDeck = { lines: [] };
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    let t = raw.replace(/^[•\-*]\s+/, "");
    if (!t) continue;

    // Metadata header lines.
    let meta: RegExpMatchArray | null;
    if ((meta = t.match(/^name\s*:\s*(.+)$/i))) {
      deck.name = meta[1].trim();
      continue;
    }
    if ((meta = t.match(/^hero\s*:\s*(.+)$/i))) {
      deck.heroName = meta[1].trim();
      continue;
    }
    if ((meta = t.match(/^format\s*:\s*(.+)$/i))) {
      deck.format = mapFormat(meta[1]);
      continue;
    }
    const url = t.match(/https?:\/\/\S+/);
    if (url) {
      deck.sourceUrl = url[0];
      continue; // "See the full deck @ …" line — not a card.
    }
    if (/made with/i.test(t)) continue; // footer

    if (SECTION_RE.test(t)) continue;

    let qty = 1;
    let name = t;
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(\d+)\s*[xX]?\s+(.+)$/))) {
      qty = +m[1];
      name = m[2];
    } else if ((m = t.match(/^\((\d+)\)\s*(.+)$/))) {
      qty = +m[1];
      name = m[2];
    } else if ((m = t.match(/^(.+?)\s*[xX]\s*(\d+)$/))) {
      name = m[1];
      qty = +m[2];
    }

    const ep = extractPitch(name);
    name = ep.name.replace(/\s+/g, " ").trim();
    if (!name) continue;
    deck.lines.push({ qty: Math.max(1, qty), name, pitch: ep.pitch, raw });
  }
  return deck;
}

export function resolveDecklist(parsed: ParsedDeck, cards: Card[]): ImportResult {
  const byName = new Map<string, Card[]>();
  const byPrinting = new Map<string, Card>();
  for (const c of cards) {
    const key = c.name.toLowerCase();
    (byName.get(key) ?? byName.set(key, []).get(key)!).push(c);
    for (const p of c.printings) byPrinting.set(p.id.toUpperCase(), c);
  }

  const findByName = (name: string, pitch?: number): Card | null => {
    const candidates = byName.get(name.toLowerCase());
    if (!candidates || candidates.length === 0) return null;
    if (pitch) return candidates.find((c) => c.pitch === pitch) ?? candidates[0];
    return candidates[0];
  };

  const resolve = (line: ParsedLine): Card | null => {
    if (COLLECTOR_RE.test(line.name)) {
      const hit = byPrinting.get(line.name.toUpperCase());
      if (hit) return hit;
    }
    return findByName(line.name, line.pitch);
  };

  // Hero comes from the "Hero:" header when present (it's usually not a card
  // line); otherwise fall back to the first hero-typed line.
  let hero: Card | null = null;
  if (parsed.heroName) {
    hero = findByName(parsed.heroName) ?? null;
  }

  const unmatched: string[] = [];
  if (parsed.heroName && !hero) unmatched.push(`Hero: ${parsed.heroName}`);

  const agg = new Map<string, ResolvedCard>();
  for (const line of parsed.lines) {
    const card = resolve(line);
    if (!card) {
      unmatched.push(line.raw);
      continue;
    }
    if (card.isHero) {
      if (!hero) hero = card;
      continue;
    }
    const existing = agg.get(card.id);
    if (existing) existing.quantity += line.qty;
    else agg.set(card.id, { card, quantity: line.qty });
  }

  const resolved = [...agg.values()];
  const total = resolved.reduce((n, r) => n + r.quantity, 0);
  return {
    hero,
    cards: resolved,
    unmatched,
    total,
    name: parsed.name,
    format: parsed.format,
    sourceUrl: parsed.sourceUrl,
  };
}
