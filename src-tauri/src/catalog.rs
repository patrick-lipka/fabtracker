//! Fetching and parsing the official-ish card catalog.
//!
//! Source: the community-maintained the-fab-cube/flesh-and-blood-cards dataset
//! (English). We download it at runtime rather than vendoring it, since the card
//! data and images are Legend Story Studios IP. Persistence is handled by
//! `db.rs`; this module only knows how to *fetch and parse*.
//!
//! This module owns the *source* schema (the `Raw*` structs) and maps it into
//! our domain `Card`/`Printing` model. Nothing outside here needs to know how
//! the source is shaped.

use std::collections::HashMap;

use serde::Deserialize;

use crate::card::{Card, Printing};

/// Branch/ref of the dataset to pull. `develop` carries the freshest cards;
/// pin to a release tag here if we ever want reproducibility over freshness.
const DATA_REF: &str = "develop";

fn card_url() -> String {
    format!("https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/{DATA_REF}/json/english/card.json")
}
fn set_url() -> String {
    format!("https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/{DATA_REF}/json/english/set.json")
}

// --------------------------------------------------------------------------
// Source schema (only the fields we consume).
// --------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct RawCard {
    unique_id: String,
    name: String,
    #[serde(default)]
    color: String,
    #[serde(default)]
    pitch: String,
    #[serde(default)]
    cost: String,
    #[serde(default)]
    power: String,
    #[serde(default)]
    defense: String,
    #[serde(default)]
    health: String,
    #[serde(default)]
    intelligence: String,
    #[serde(default)]
    arcane: String,
    #[serde(default)]
    types: Vec<String>,
    #[serde(default)]
    traits: Vec<String>,
    #[serde(default)]
    card_keywords: Vec<String>,
    #[serde(default)]
    functional_text_plain: String,
    #[serde(default)]
    type_text: String,
    #[serde(default)]
    printings: Vec<RawPrinting>,
}

#[derive(Debug, Deserialize)]
struct RawPrinting {
    id: String,
    #[serde(default)]
    set_id: String,
    #[serde(default)]
    rarity: String,
    #[serde(default)]
    artists: Vec<String>,
    #[serde(default)]
    flavor_text_plain: String,
    #[serde(default)]
    image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawSet {
    id: String,
    name: String,
}

// --------------------------------------------------------------------------
// Public API.
// --------------------------------------------------------------------------

/// Download the latest catalog from the data source and parse it into cards.
pub async fn fetch_catalog() -> Result<Vec<Card>, String> {
    let client = reqwest::Client::builder()
        .user_agent("fabtracker/0.1 (+https://github.com/)")
        .build()
        .map_err(|e| format!("failed to build HTTP client: {e}"))?;

    let card_json = fetch(&client, &card_url()).await?;
    let set_json = fetch(&client, &set_url()).await?;
    parse_catalog(&card_json, &set_json)
}

// --------------------------------------------------------------------------
// Internals.
// --------------------------------------------------------------------------

async fn fetch(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("request to {url} failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("request to {url} returned {}", resp.status()));
    }
    resp.text()
        .await
        .map_err(|e| format!("reading response from {url} failed: {e}"))
}

fn parse_catalog(card_json: &str, set_json: &str) -> Result<Vec<Card>, String> {
    let raw_sets: Vec<RawSet> = serde_json::from_str(set_json)
        .map_err(|e| format!("failed to parse set.json: {e}"))?;
    let set_names: HashMap<String, String> =
        raw_sets.into_iter().map(|s| (s.id, s.name)).collect();

    let raw_cards: Vec<RawCard> = serde_json::from_str(card_json)
        .map_err(|e| format!("failed to parse card.json: {e}"))?;

    Ok(raw_cards
        .into_iter()
        .map(|c| map_card(c, &set_names))
        .collect())
}

fn map_card(c: RawCard, set_names: &HashMap<String, String>) -> Card {
    let printings: Vec<Printing> = c
        .printings
        .into_iter()
        .map(|p| Printing {
            set_name: set_names.get(&p.set_id).cloned().unwrap_or_else(|| p.set_id.clone()),
            rarity: rarity_label(&p.rarity).to_string(),
            artists: p.artists,
            flavor_text: non_empty(p.flavor_text_plain),
            image_url: p.image_url.filter(|s| !s.is_empty()),
            set_id: p.set_id,
            id: p.id,
        })
        .collect();

    let rarity = printings.first().map(|p| p.rarity.clone()).unwrap_or_default();
    let image_url = printings.iter().find_map(|p| p.image_url.clone());

    // Distinct set names, preserving first-seen order.
    let mut sets: Vec<String> = Vec::new();
    for p in &printings {
        if !sets.contains(&p.set_name) {
            sets.push(p.set_name.clone());
        }
    }

    let is_hero = c.types.iter().any(|t| t == "Hero");

    Card {
        id: c.unique_id,
        name: c.name,
        color: non_empty(c.color),
        pitch: parse_num(&c.pitch),
        cost: parse_num(&c.cost),
        cost_text: non_empty(c.cost),
        power: parse_num(&c.power),
        power_text: non_empty(c.power),
        defense: parse_num(&c.defense),
        defense_text: non_empty(c.defense),
        health: parse_num(&c.health),
        intellect: parse_num(&c.intelligence),
        arcane: parse_num(&c.arcane),
        is_hero,
        types: c.types,
        traits: c.traits,
        keywords: c.card_keywords,
        type_text: c.type_text,
        functional_text: non_empty(c.functional_text_plain),
        rarity,
        sets,
        image_url,
        printings,
    }
}

/// Parse a FaB stat string into a number, or `None` for "", "*", "X", "XX", ...
fn parse_num(s: &str) -> Option<i32> {
    s.trim().parse().ok()
}

fn non_empty(s: String) -> Option<String> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

fn rarity_label(code: &str) -> &'static str {
    match code {
        "C" => "Common",
        "R" => "Rare",
        "S" => "Super Rare",
        "M" => "Majestic",
        "L" => "Legendary",
        "F" => "Fabled",
        "T" => "Token",
        "B" => "Basic",
        "V" => "Marvel",
        "P" => "Promo",
        _ => "Unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Hits the network. Run explicitly: `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn fetch_parses_real_catalog() {
        let cards = fetch_catalog().await.expect("fetch should succeed");
        assert!(cards.len() > 1000, "expected a large catalog, got {}", cards.len());

        let katsu = cards
            .iter()
            .find(|c| c.name == "Katsu, the Wanderer")
            .expect("Katsu should be present");
        assert!(katsu.is_hero);
        assert!(!katsu.printings.is_empty());
    }
}
