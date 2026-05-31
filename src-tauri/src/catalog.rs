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

use serde::de::DeserializeOwned;
use serde::Deserialize;

use crate::card::{Card, Printing};

const REPO: &str = "the-fab-cube/flesh-and-blood-cards";

fn raw_url(git_ref: &str, file: &str) -> String {
    format!("https://raw.githubusercontent.com/{REPO}/{git_ref}/json/english/{file}")
}

/// A resolved point in the dataset's history to sync from.
#[derive(Debug, Clone)]
pub struct RefInfo {
    pub branch: String,
    pub sha: String,
    pub date: String,
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
    // Format legality flags (legal flags exclude bans/suspensions).
    #[serde(default)]
    cc_legal: bool,
    #[serde(default)]
    blitz_legal: bool,
    #[serde(default)]
    silver_age_legal: bool,
    #[serde(default)]
    cc_banned: bool,
    #[serde(default)]
    blitz_banned: bool,
    #[serde(default)]
    silver_age_banned: bool,
    #[serde(default)]
    cc_living_legend: bool,
    #[serde(default)]
    blitz_living_legend: bool,
    #[serde(default)]
    cc_suspended: bool,
    #[serde(default)]
    blitz_suspended: bool,
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
    #[serde(default)]
    printings: Vec<RawSetPrinting>,
}

#[derive(Debug, Deserialize)]
struct RawSetPrinting {
    #[serde(default)]
    initial_release_date: Option<String>,
}

// --------------------------------------------------------------------------
// Public API.
// --------------------------------------------------------------------------

/// Resolve which ref to sync from. `mode` is either "auto" (pick the branch with
/// the most recent commit across the whole repo — this follows the maintainer's
/// active spoiler-season branch) or an explicit branch/tag/sha.
pub async fn resolve_ref(mode: &str) -> Result<RefInfo, String> {
    let client = build_client()?;
    if mode.is_empty() || mode == "auto" {
        let branches: Vec<GhBranch> =
            gh_json(&client, &format!("https://api.github.com/repos/{REPO}/branches?per_page=100"))
                .await?;
        let mut best: Option<RefInfo> = None;
        for b in branches {
            let commit: GhCommit = gh_json(
                &client,
                &format!("https://api.github.com/repos/{REPO}/commits/{}", b.name),
            )
            .await?;
            let info = RefInfo {
                branch: b.name,
                sha: commit.sha,
                date: commit.commit.committer.date,
            };
            if best.as_ref().is_none_or(|cur| info.date > cur.date) {
                best = Some(info);
            }
        }
        best.ok_or_else(|| "no branches found in repo".to_string())
    } else {
        let commit: GhCommit = gh_json(
            &client,
            &format!("https://api.github.com/repos/{REPO}/commits/{mode}"),
        )
        .await?;
        Ok(RefInfo {
            branch: mode.to_string(),
            sha: commit.sha,
            date: commit.commit.committer.date,
        })
    }
}

/// Download and parse the catalog at a specific ref (branch/tag/sha).
pub async fn fetch_catalog_at(git_ref: &str) -> Result<Vec<Card>, String> {
    let client = build_client()?;
    let card_json = fetch(&client, &raw_url(git_ref, "card.json")).await?;
    let set_json = fetch(&client, &raw_url(git_ref, "set.json")).await?;
    parse_catalog(&card_json, &set_json)
}

// --------------------------------------------------------------------------
// Internals.
// --------------------------------------------------------------------------

#[derive(Deserialize)]
struct GhBranch {
    name: String,
}
#[derive(Deserialize)]
struct GhCommit {
    sha: String,
    commit: GhCommitDetail,
}
#[derive(Deserialize)]
struct GhCommitDetail {
    committer: GhCommitter,
}
#[derive(Deserialize)]
struct GhCommitter {
    date: String,
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("fabtracker/0.1 (+https://github.com/)")
        .build()
        .map_err(|e| format!("failed to build HTTP client: {e}"))
}

async fn gh_json<T: DeserializeOwned>(client: &reqwest::Client, url: &str) -> Result<T, String> {
    let resp = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("request to {url} failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned {} for {url}", resp.status()));
    }
    let body = resp
        .text()
        .await
        .map_err(|e| format!("reading GitHub response from {url} failed: {e}"))?;
    serde_json::from_str(&body)
        .map_err(|e| format!("parsing GitHub response from {url} failed: {e}"))
}

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
    let mut set_names: HashMap<String, String> = HashMap::new();
    let mut set_dates: HashMap<String, String> = HashMap::new();
    for s in raw_sets {
        // Most recent release date among the set's editions.
        if let Some(date) = s
            .printings
            .iter()
            .filter_map(|p| p.initial_release_date.clone())
            .max()
        {
            set_dates.insert(s.id.clone(), date);
        }
        set_names.insert(s.id, s.name);
    }

    let raw_cards: Vec<RawCard> = serde_json::from_str(card_json)
        .map_err(|e| format!("failed to parse card.json: {e}"))?;

    Ok(raw_cards
        .into_iter()
        .map(|c| map_card(c, &set_names, &set_dates))
        .collect())
}

fn map_card(
    c: RawCard,
    set_names: &HashMap<String, String>,
    set_dates: &HashMap<String, String>,
) -> Card {
    let mut printings: Vec<Printing> = c
        .printings
        .into_iter()
        .map(|p| Printing {
            set_name: set_names.get(&p.set_id).cloned().unwrap_or_else(|| p.set_id.clone()),
            rarity: rarity_label(&p.rarity).to_string(),
            artists: p.artists,
            flavor_text: non_empty(p.flavor_text_plain),
            image_url: p.image_url.filter(|s| !s.is_empty()),
            released: set_dates.get(&p.set_id).cloned(),
            set_id: p.set_id,
            id: p.id,
        })
        .collect();
    // The source lists one entry per foiling; we track foiling on the collection
    // side instead, so collapse printings to one per collector id.
    let mut seen = std::collections::HashSet::new();
    printings.retain(|p| seen.insert(p.id.clone()));
    // Newest first (printings without a known date sort last). ISO date strings
    // compare chronologically, so a plain string compare is correct.
    printings.sort_by(|a, b| b.released.cmp(&a.released));

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
        cc_legal: Some(c.cc_legal),
        blitz_legal: Some(c.blitz_legal),
        silver_age_legal: Some(c.silver_age_legal),
        cc_banned: Some(c.cc_banned),
        blitz_banned: Some(c.blitz_banned),
        silver_age_banned: Some(c.silver_age_banned),
        cc_living_legend: Some(c.cc_living_legend),
        blitz_living_legend: Some(c.blitz_living_legend),
        cc_suspended: Some(c.cc_suspended),
        blitz_suspended: Some(c.blitz_suspended),
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
        let cards = fetch_catalog_at("develop").await.expect("fetch should succeed");
        assert!(cards.len() > 1000, "expected a large catalog, got {}", cards.len());

        let katsu = cards
            .iter()
            .find(|c| c.name == "Katsu, the Wanderer")
            .expect("Katsu should be present");
        assert!(katsu.is_hero);
        assert!(!katsu.printings.is_empty());
        // Legality flags are populated.
        assert!(katsu.cc_legal.is_some());
        assert!(cards.iter().any(|c| c.cc_legal == Some(true)));

        // Release dates are populated and printings are ordered newest-first.
        assert!(cards
            .iter()
            .any(|c| c.printings.iter().any(|p| p.released.is_some())));
        for c in &cards {
            let dates: Vec<&Option<String>> = c.printings.iter().map(|p| &p.released).collect();
            let mut sorted = dates.clone();
            sorted.sort_by(|a, b| b.cmp(a)); // newest first, None last
            assert_eq!(dates, sorted, "printings not newest-first for {}", c.name);
        }
    }
}
