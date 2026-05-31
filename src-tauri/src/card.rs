//! Core Flesh and Blood card model — the shape the frontend consumes.
//!
//! This is the *domain* model. The official data source (the-fab-cube dataset)
//! is mapped into this in `catalog.rs`, so the rest of the app never sees the
//! source's quirks (stats-as-strings, denormalized printings, shortcodes).
//!
//! Serialized to the frontend as camelCase JSON; mirrored by the TypeScript
//! `Card` type in `src/types/card.ts`.

use serde::{Deserialize, Serialize};

/// One physical printing of a card (a given set / edition / foiling / art).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Printing {
    /// Collector id, e.g. "MST131".
    pub id: String,
    pub set_id: String,
    /// Human set name resolved from the set list, e.g. "Part the Mistveil".
    pub set_name: String,
    pub rarity: String,
    pub artists: Vec<String>,
    pub flavor_text: Option<String>,
    pub image_url: Option<String>,
    /// Set release date (ISO), if known. Printings are sorted newest-first.
    pub released: Option<String>,
}

/// A unique Flesh and Blood card (independent of how many times it was printed).
///
/// Numeric stats are stored both parsed (`cost`/`power`/...) and as the raw
/// printed text (`costText`/...), because FaB stats can be `*`, `X`, `XX`, etc.
/// `None` parsed value + `Some` text means "non-numeric"; both `None` means the
/// stat is absent for this card.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    /// Stable unique id from the data source (a UUID-like string).
    pub id: String,
    pub name: String,

    /// Pitch strip color: "Red" | "Yellow" | "Blue" | None.
    pub color: Option<String>,
    pub pitch: Option<i32>,

    pub cost: Option<i32>,
    pub cost_text: Option<String>,
    pub power: Option<i32>,
    pub power_text: Option<String>,
    pub defense: Option<i32>,
    pub defense_text: Option<String>,
    pub health: Option<i32>,
    pub intellect: Option<i32>,
    pub arcane: Option<i32>,

    /// True when "Hero" is among the card's types (drives stat layout).
    pub is_hero: bool,
    /// Full type list: class + talent + supertype + subtypes, unsplit.
    pub types: Vec<String>,
    pub traits: Vec<String>,
    pub keywords: Vec<String>,
    /// The printed type line, e.g. "Ninja Action - Attack".
    pub type_text: String,

    /// Rules text (plain), may contain newlines and `{symbol}` tokens.
    pub functional_text: Option<String>,

    /// Representative rarity label (from the first printing).
    pub rarity: String,
    /// Distinct set names this card appears in.
    pub sets: Vec<String>,
    /// Representative image (first printing that has one).
    pub image_url: Option<String>,

    pub printings: Vec<Printing>,

    // Format legality flags from the data source. `None` means "not synced yet"
    // (older cached cards) — legality checks skip unknown flags. A re-sync
    // populates them. `*_legal` excludes bans/suspensions (those are separate).
    pub cc_legal: Option<bool>,
    pub blitz_legal: Option<bool>,
    pub silver_age_legal: Option<bool>,
    pub cc_banned: Option<bool>,
    pub blitz_banned: Option<bool>,
    pub silver_age_banned: Option<bool>,
    pub cc_living_legend: Option<bool>,
    pub blitz_living_legend: Option<bool>,
    pub cc_suspended: Option<bool>,
    pub blitz_suspended: Option<bool>,
}
