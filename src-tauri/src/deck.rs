//! Deck building: a hero plus a list of cards, with legality, curve, and a
//! missing-vs-collection diff.
//!
//! Legality (v1) is structural: deck size + per-name copy limits for the format,
//! and per-card hero legality (class/talent identity). Ban/suspended/Living
//! Legend lists, slot limits, and specialization cards are deliberate follow-ups.

use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::card::Card;
use crate::collection;

/// Class (excluding Generic) and talent words used to decide hero legality.
/// Unknown new words are treated as "no identity" (lenient — never wrongly
/// blocks); extend this list as the game adds classes/talents.
const IDENTITY: &[&str] = &[
    // Classes
    "Brute", "Guardian", "Ninja", "Warrior", "Mechanologist", "Ranger",
    "Runeblade", "Wizard", "Illusionist", "Assassin", "Bard", "Merchant",
    "Necromancer", "Shapeshifter", "Pirate",
    // Talents
    "Draconic", "Earth", "Elemental", "Ice", "Light", "Lightning", "Royal",
    "Shadow", "Chaos", "Mystic",
];

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn has_type(card: &Card, t: &str) -> bool {
    card.types.iter().any(|x| x == t)
}

fn is_main_deck(card: &Card) -> bool {
    !card.is_hero
        && !has_type(card, "Weapon")
        && !has_type(card, "Equipment")
        && !has_type(card, "Token")
}

fn identity_of(types: &[String]) -> Vec<String> {
    types
        .iter()
        .filter(|t| IDENTITY.contains(&t.as_str()))
        .cloned()
        .collect()
}

/// A card is legal in a hero's deck if it's Generic, or all of its class/talent
/// identity words are shared by the hero.
fn legal_for_hero(card: &Card, hero_identity: &HashSet<String>) -> bool {
    if has_type(card, "Generic") {
        return true;
    }
    let ci = identity_of(&card.types);
    ci.is_empty() || ci.iter().all(|w| hero_identity.contains(w))
}

/// Per-format legality flags for a card (None where unknown / not yet synced).
struct FormatRules {
    legal: Option<bool>,
    banned: Option<bool>,
    living_legend: Option<bool>,
    suspended: Option<bool>,
}

fn format_rules(card: &Card, format: &str) -> FormatRules {
    match format {
        "blitz" => FormatRules {
            legal: card.blitz_legal,
            banned: card.blitz_banned,
            living_legend: card.blitz_living_legend,
            suspended: card.blitz_suspended,
        },
        "silver_age" => FormatRules {
            legal: card.silver_age_legal,
            banned: card.silver_age_banned,
            living_legend: None,
            suspended: None,
        },
        _ => FormatRules {
            legal: card.cc_legal,
            banned: card.cc_banned,
            living_legend: card.cc_living_legend,
            suspended: card.cc_suspended,
        },
    }
}

/// Whether a card is allowed in the format (legal pool, not banned/LL/suspended).
/// Unknown flags (`None`) don't restrict — they degrade to "allowed".
fn format_allowed(card: &Card, format: &str) -> bool {
    let r = format_rules(card, format);
    r.legal != Some(false)
        && r.banned != Some(true)
        && r.living_legend != Some(true)
        && r.suspended != Some(true)
}

// --------------------------------------------------------------------------
// DTOs.
// --------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckSummary {
    pub id: i64,
    pub name: String,
    pub format: String,
    pub hero_id: String,
    pub hero_name: Option<String>,
    pub hero_image: Option<String>,
    pub card_count: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckCardEntry {
    pub card: Card,
    pub quantity: i64,
    pub owned: i64,
    pub legal: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurvePoint {
    /// Cost bucket; 6 means "6 or more".
    pub cost: i64,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchCounts {
    pub one: i64,
    pub two: i64,
    pub three: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Legality {
    pub ok: bool,
    pub main_deck_count: i64,
    pub required: String,
    pub issues: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckDetail {
    pub id: i64,
    pub name: String,
    pub format: String,
    pub hero: Option<Card>,
    pub cards: Vec<DeckCardEntry>,
    /// Total non-hero card quantity.
    pub total_cards: i64,
    pub curve: Vec<CurvePoint>,
    pub pitch_counts: PitchCounts,
    /// Total copies missing relative to the collection.
    pub missing: i64,
    pub legality: Legality,
}

// --------------------------------------------------------------------------
// CRUD.
// --------------------------------------------------------------------------

pub fn create_deck(conn: &Connection, name: &str, format: &str, hero_id: &str) -> Result<i64, String> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO decks (name, format, hero_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![name, format, hero_id, now],
    )
    .map_err(|e| format!("create deck: {e}"))?;
    Ok(conn.last_insert_rowid())
}

pub fn rename_deck(conn: &Connection, id: i64, name: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE decks SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, now_ms(), id],
    )
    .map_err(|e| format!("rename deck: {e}"))?;
    Ok(())
}

pub fn set_deck_format(conn: &Connection, id: i64, format: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE decks SET format = ?1, updated_at = ?2 WHERE id = ?3",
        params![format, now_ms(), id],
    )
    .map_err(|e| format!("set format: {e}"))?;
    Ok(())
}

pub fn delete_deck(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM decks WHERE id = ?1", params![id])
        .map_err(|e| format!("delete deck: {e}"))?;
    Ok(())
}

/// Change a card's quantity in a deck by `delta` (row removed at 0).
pub fn adjust_deck_card(conn: &Connection, deck_id: i64, card_id: &str, delta: i64) -> Result<(), String> {
    let current: i64 = conn
        .query_row(
            "SELECT quantity FROM deck_cards WHERE deck_id = ?1 AND card_id = ?2",
            params![deck_id, card_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("read deck card: {e}"))?
        .unwrap_or(0);
    let next = current + delta;
    if next <= 0 {
        conn.execute(
            "DELETE FROM deck_cards WHERE deck_id = ?1 AND card_id = ?2",
            params![deck_id, card_id],
        )
        .map_err(|e| format!("remove deck card: {e}"))?;
    } else {
        conn.execute(
            "INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES (?1, ?2, ?3)
             ON CONFLICT(deck_id, card_id) DO UPDATE SET quantity = ?3",
            params![deck_id, card_id, next],
        )
        .map_err(|e| format!("upsert deck card: {e}"))?;
    }
    conn.execute("UPDATE decks SET updated_at = ?1 WHERE id = ?2", params![now_ms(), deck_id])
        .map_err(|e| format!("touch deck: {e}"))?;
    Ok(())
}

// --------------------------------------------------------------------------
// Queries.
// --------------------------------------------------------------------------

fn load_card(conn: &Connection, id: &str) -> Result<Option<Card>, String> {
    let data: Option<String> = conn
        .query_row("SELECT data FROM cards WHERE id = ?1", params![id], |r| r.get(0))
        .optional()
        .map_err(|e| format!("load card: {e}"))?;
    match data {
        Some(d) => serde_json::from_str(&d)
            .map(Some)
            .map_err(|e| format!("parse card: {e}")),
        None => Ok(None),
    }
}

pub fn list_decks(conn: &Connection) -> Result<Vec<DeckSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.name, d.format, d.hero_id, c.name,
                    json_extract(c.data, '$.imageUrl'),
                    (SELECT COALESCE(SUM(quantity), 0) FROM deck_cards dc WHERE dc.deck_id = d.id),
                    d.updated_at
             FROM decks d
             LEFT JOIN cards c ON c.id = d.hero_id
             ORDER BY d.updated_at DESC",
        )
        .map_err(|e| format!("prepare list_decks: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            Ok(DeckSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                format: r.get(2)?,
                hero_id: r.get(3)?,
                hero_name: r.get(4)?,
                hero_image: r.get(5)?,
                card_count: r.get(6)?,
                updated_at: r.get(7)?,
            })
        })
        .map_err(|e| format!("query decks: {e}"))?;
    rows.collect::<Result<_, _>>().map_err(|e| format!("read deck: {e}"))
}

pub fn list_heroes(conn: &Connection, owned_only: bool) -> Result<Vec<Card>, String> {
    let sql = if owned_only {
        "SELECT data FROM cards WHERE is_hero = 1
         AND EXISTS (SELECT 1 FROM collection_entries ce WHERE ce.card_id = cards.id)
         ORDER BY name COLLATE NOCASE"
    } else {
        "SELECT data FROM cards WHERE is_hero = 1 ORDER BY name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| format!("prepare list_heroes: {e}"))?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| format!("query heroes: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let data = row.map_err(|e| format!("read row: {e}"))?;
        out.push(serde_json::from_str(&data).map_err(|e| format!("parse hero: {e}"))?);
    }
    Ok(out)
}

pub fn get_deck(conn: &Connection, id: i64) -> Result<DeckDetail, String> {
    let (name, format, hero_id): (String, String, String) = conn
        .query_row(
            "SELECT name, format, hero_id FROM decks WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| format!("load deck: {e}"))?;

    let hero = load_card(conn, &hero_id)?;
    let hero_identity: HashSet<String> = hero
        .as_ref()
        .map(|h| identity_of(&h.types).into_iter().collect())
        .unwrap_or_default();

    let owned = collection::owned_counts(conn)?;

    // Load the deck's cards.
    let mut stmt = conn
        .prepare("SELECT card_id, quantity FROM deck_cards WHERE deck_id = ?1")
        .map_err(|e| format!("prepare deck cards: {e}"))?;
    let rows = stmt
        .query_map(params![id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
        .map_err(|e| format!("query deck cards: {e}"))?;

    let mut cards: Vec<DeckCardEntry> = Vec::new();
    for row in rows {
        let (card_id, quantity) = row.map_err(|e| format!("read row: {e}"))?;
        if let Some(card) = load_card(conn, &card_id)? {
            let legal = legal_for_hero(&card, &hero_identity) && format_allowed(&card, &format);
            cards.push(DeckCardEntry {
                owned: owned.get(&card_id).copied().unwrap_or(0),
                legal,
                quantity,
                card,
            });
        }
    }
    cards.sort_by(|a, b| a.card.name.to_lowercase().cmp(&b.card.name.to_lowercase()));

    // Stats.
    let total_cards: i64 = cards.iter().map(|c| c.quantity).sum();
    let main_deck_count: i64 = cards
        .iter()
        .filter(|c| is_main_deck(&c.card))
        .map(|c| c.quantity)
        .sum();
    let missing: i64 = cards.iter().map(|c| (c.quantity - c.owned).max(0)).sum();

    let mut curve_buckets = [0i64; 7]; // index 0..6, 6 = "6+"
    let mut pitch = PitchCounts { one: 0, two: 0, three: 0 };
    for c in &cards {
        if is_main_deck(&c.card) {
            if let Some(cost) = c.card.cost {
                let b = cost.clamp(0, 6) as usize;
                curve_buckets[b] += c.quantity;
            }
        }
        match c.card.pitch {
            Some(1) => pitch.one += c.quantity,
            Some(2) => pitch.two += c.quantity,
            Some(3) => pitch.three += c.quantity,
            _ => {}
        }
    }
    let curve = curve_buckets
        .iter()
        .enumerate()
        .map(|(cost, &count)| CurvePoint { cost: cost as i64, count })
        .collect();

    let legality = compute_legality(&format, main_deck_count, &cards, hero.as_ref(), &hero_identity);

    Ok(DeckDetail {
        id,
        name,
        format,
        hero,
        cards,
        total_cards,
        curve,
        pitch_counts: pitch,
        missing,
        legality,
    })
}

fn summarize(label: &str, mut names: Vec<&str>) -> String {
    names.sort();
    names.dedup();
    let preview = names.iter().take(3).cloned().collect::<Vec<_>>().join(", ");
    let more = if names.len() > 3 {
        format!(" +{} more", names.len() - 3)
    } else {
        String::new()
    };
    format!("{label}: {preview}{more}")
}

fn compute_legality(
    format: &str,
    main_deck_count: i64,
    cards: &[DeckCardEntry],
    hero: Option<&Card>,
    hero_identity: &HashSet<String>,
) -> Legality {
    // Construction rules per format:
    //   CC          — >=60 main-deck cards, max 3 per name (adult hero).
    //   Blitz       — exactly 40, max 2 per name (young hero).
    //   Silver Age  — exactly 40, max 2 per name+color (young hero, SA pool).
    let (size_ok, required, max_copies, per_color) = match format {
        "blitz" => (main_deck_count == 40, "40".to_string(), 2, false),
        "silver_age" => (main_deck_count == 40, "40".to_string(), 2, true),
        _ => (main_deck_count >= 60, "60+".to_string(), 3, false),
    };

    let mut issues = Vec::new();
    if hero.is_none() {
        issues.push("No hero selected".to_string());
    }
    if !size_ok {
        issues.push(format!("Main deck has {main_deck_count} cards (needs {required})"));
    }

    // Copy limits. Pitch variants share a name (CC/Blitz); Silver Age counts by
    // name + color, so different-pitch copies are limited independently.
    let mut by_key: HashMap<String, (i64, &str)> = HashMap::new();
    for c in cards {
        let key = if per_color {
            format!("{}|{}", c.card.name, c.card.color.as_deref().unwrap_or(""))
        } else {
            c.card.name.clone()
        };
        let entry = by_key.entry(key).or_insert((0, c.card.name.as_str()));
        entry.0 += c.quantity;
    }
    let mut over: Vec<(&str, i64)> = by_key
        .values()
        .filter(|(n, _)| *n > max_copies)
        .map(|(n, name)| (*name, *n))
        .collect();
    over.sort();
    over.dedup();
    for (name, n) in over {
        issues.push(format!("{name}: {n} copies (max {max_copies})"));
    }

    // Hero must be legal in the format too.
    if let Some(h) = hero {
        let r = format_rules(h, format);
        if r.banned == Some(true) {
            issues.push(format!("Hero {} is banned in this format", h.name));
        } else if r.living_legend == Some(true) {
            issues.push(format!("Hero {} is Living Legend in this format", h.name));
        } else if r.legal == Some(false) {
            issues.push(format!("Hero {} is not legal in this format", h.name));
        }
    }

    // Per-card reasons (class/talent + format bans/LL/suspensions).
    let (mut off_class, mut banned, mut ll, mut susp, mut not_legal) =
        (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
    for c in cards {
        let name = c.card.name.as_str();
        if !legal_for_hero(&c.card, hero_identity) {
            off_class.push(name);
        }
        let r = format_rules(&c.card, format);
        if r.banned == Some(true) {
            banned.push(name);
        } else if r.living_legend == Some(true) {
            ll.push(name);
        } else if r.suspended == Some(true) {
            susp.push(name);
        } else if r.legal == Some(false) {
            not_legal.push(name);
        }
    }
    for (label, list) in [
        ("Off-class for hero", off_class),
        ("Banned", banned),
        ("Living Legend", ll),
        ("Suspended", susp),
        ("Not legal in format", not_legal),
    ] {
        if !list.is_empty() {
            issues.push(summarize(label, list));
        }
    }

    Legality {
        ok: issues.is_empty(),
        main_deck_count,
        required,
        issues,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn hero(id: &str, name: &str, types: &[&str]) -> Card {
        mk(id, name, types, None)
    }

    fn mk(id: &str, name: &str, types: &[&str], cost: Option<i32>) -> Card {
        Card {
            id: id.into(),
            name: name.into(),
            color: None,
            pitch: Some(1),
            cost,
            cost_text: None,
            power: None,
            power_text: None,
            defense: None,
            defense_text: None,
            health: None,
            intellect: None,
            arcane: None,
            is_hero: types.contains(&"Hero"),
            types: types.iter().map(|s| s.to_string()).collect(),
            traits: vec![],
            keywords: vec![],
            type_text: types.join(" "),
            functional_text: None,
            rarity: "Common".into(),
            sets: vec![],
            image_url: None,
            printings: vec![],
            ..Default::default()
        }
    }

    fn setup() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        db::run_migrations(&mut conn).unwrap();
        db::replace_cards(
            &mut conn,
            &[
                hero("H", "Katsu", &["Ninja", "Hero"]),
                mk("ninja", "Snatch", &["Ninja", "Action", "Attack"], Some(0)),
                mk("gen", "Sink Below", &["Generic", "Defense Reaction"], Some(0)),
                mk("warr", "Wounding Blow", &["Warrior", "Action", "Attack"], Some(1)),
            ],
        )
        .unwrap();
        conn
    }

    #[test]
    fn legality_and_stats() {
        let conn = setup();
        let id = create_deck(&conn, "Test", "blitz", "H").unwrap();

        // A ninja card (legal), a generic (legal), a warrior card (off-class).
        adjust_deck_card(&conn, id, "ninja", 2).unwrap();
        adjust_deck_card(&conn, id, "gen", 1).unwrap();
        adjust_deck_card(&conn, id, "warr", 1).unwrap();

        let d = get_deck(&conn, id).unwrap();
        assert_eq!(d.hero.as_ref().unwrap().name, "Katsu");
        assert_eq!(d.total_cards, 4);
        assert_eq!(d.main_deck_count_helper(), 4); // helper below

        // Legality: blitz needs 40 (we have 4) and warrior is off-class.
        assert!(!d.legality.ok);
        assert!(d.legality.issues.iter().any(|i| i.contains("needs 40")));
        assert!(d.legality.issues.iter().any(|i| i.contains("Off-class")));

        // Per-card legality flags.
        let legal_of = |name: &str| d.cards.iter().find(|c| c.card.name == name).unwrap().legal;
        assert!(legal_of("Snatch")); // Ninja matches Katsu
        assert!(legal_of("Sink Below")); // Generic
        assert!(!legal_of("Wounding Blow")); // Warrior, off-class

        // Curve buckets cost 0 (Snatch x2 + Sink Below x1) and cost 1 (Wounding x1).
        let at = |cost: i64| d.curve.iter().find(|p| p.cost == cost).unwrap().count;
        assert_eq!(at(0), 3);
        assert_eq!(at(1), 1);
    }

    #[test]
    fn copy_limit_and_delete() {
        let conn = setup();
        let id = create_deck(&conn, "T", "blitz", "H").unwrap();
        adjust_deck_card(&conn, id, "ninja", 3).unwrap(); // blitz max 2
        let d = get_deck(&conn, id).unwrap();
        assert!(d.legality.issues.iter().any(|i| i.contains("max 2")));

        delete_deck(&conn, id).unwrap();
        assert!(list_decks(&conn).unwrap().is_empty());
    }

    #[test]
    fn format_bans_and_silver_age() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        db::run_migrations(&mut conn).unwrap();

        let mut banned = mk("b", "Banned Card", &["Ninja", "Action"], Some(0));
        banned.cc_banned = Some(true);
        let mut not_sa = mk("s", "Modern Card", &["Ninja", "Action"], Some(0));
        not_sa.silver_age_legal = Some(false);
        db::replace_cards(
            &mut conn,
            &[hero("H", "Katsu", &["Ninja", "Hero"]), banned, not_sa],
        )
        .unwrap();

        let id = create_deck(&conn, "T", "cc", "H").unwrap();
        adjust_deck_card(&conn, id, "b", 1).unwrap();
        let d = get_deck(&conn, id).unwrap();
        assert!(d.legality.issues.iter().any(|i| i.starts_with("Banned")));
        assert!(!d.cards.iter().find(|c| c.card.id == "b").unwrap().legal);

        // In Silver Age the CC-banned card is fine, but the non-SA card is not.
        set_deck_format(&conn, id, "silver_age").unwrap();
        adjust_deck_card(&conn, id, "s", 1).unwrap();
        let d = get_deck(&conn, id).unwrap();
        assert!(d.cards.iter().find(|c| c.card.id == "b").unwrap().legal);
        assert!(d.legality.issues.iter().any(|i| i.starts_with("Not legal in format")));
    }
}

// Test-only convenience.
#[cfg(test)]
impl DeckDetail {
    fn main_deck_count_helper(&self) -> i64 {
        self.legality.main_deck_count
    }
}
