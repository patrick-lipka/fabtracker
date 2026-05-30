//! Core Flesh and Blood card model.
//!
//! This intentionally models the *domain*, not whatever shape a particular
//! data source happens to have. When we wire up the official card data later
//! (see `docs/PROJECT_LOG.md`), we map that source into these types once, and
//! the rest of the app stays stable.
//!
//! Serialized to the frontend as camelCase JSON (see `#[serde(rename_all)]`),
//! which is mirrored by the TypeScript `Card` type in `src/types/card.ts`.

use serde::{Deserialize, Serialize};

/// The primary type of a card (the bold word in its type box).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CardType {
    Hero,
    Weapon,
    Equipment,
    Action,
    AttackReaction,
    DefenseReaction,
    Instant,
    Resource,
    Token,
}

/// Card rarity, ordered from most to least common in the obvious sense.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Rarity {
    Token,
    Common,
    Rare,
    SuperRare,
    Majestic,
    Legendary,
    Fabled,
    Promo,
}

/// A single Flesh and Blood card.
///
/// Optional fields are genuinely optional in the game: a Hero has `health` and
/// `intellect` but no `pitch`/`cost`; an attack action has `power`/`pitch`/`cost`
/// but no `health`; equipment usually has only `defense`; and so on.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    /// Stable unique id. We use the set code + collector number, e.g. "WTR043".
    pub id: String,
    pub name: String,

    /// Pitch value 1/2/3, rendered as red/yellow/blue. `None` for cards that
    /// can't be pitched for resources (heroes, weapons, equipment, tokens).
    pub pitch: Option<u8>,
    /// Resource cost to play. `None` when the card has no cost.
    pub cost: Option<i32>,
    pub power: Option<i32>,
    pub defense: Option<i32>,
    /// Hero starting life total.
    pub health: Option<i32>,
    /// Hero intellect (cards seen each draw step).
    pub intellect: Option<i32>,

    pub card_type: CardType,
    /// Secondary type words, e.g. ["Attack"], ["Aura"], ["1H", "Sword"].
    pub subtypes: Vec<String>,
    /// Class restrictions, e.g. ["Ninja"], ["Warrior"], ["Generic"].
    pub classes: Vec<String>,
    /// Talents / elements, e.g. ["Lightning"], ["Light"], ["Ice"].
    pub talents: Vec<String>,

    pub rarity: Rarity,
    pub set_code: String,
    pub set_name: String,
    pub card_number: String,

    /// Curated list of keywords present on the card (Go again, Dominate, ...).
    pub keywords: Vec<String>,
    /// Rules text (may contain newlines).
    pub text: String,
    pub flavor: Option<String>,
    pub artist: Option<String>,
    /// Image URL. `None` for now — the UI renders a styled placeholder frame.
    pub image_url: Option<String>,
}
