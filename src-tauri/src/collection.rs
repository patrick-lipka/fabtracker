//! The user's collection: binders and the cards (with quantities) in them.
//!
//! Model (v1): a binder holds cards keyed by their unique card id with a
//! quantity. A card may appear in several binders; "all collection" aggregates
//! across them, and "moving" a card shifts quantity from one binder to another.
//! Per-printing / foiling granularity is a deliberate future refinement.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::card::Card;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Binder {
    pub id: i64,
    pub name: String,
    pub position: i64,
    /// Number of distinct cards in the binder.
    pub card_count: i64,
    /// Total quantity (sum of card quantities) in the binder.
    pub total_quantity: i64,
}

/// How many copies of a given card are in a particular binder (0 ⇒ none).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinderEntry {
    pub binder_id: i64,
    pub binder_name: String,
    pub quantity: i64,
}

/// A card in the collection together with how many are owned (within scope).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionCard {
    pub card: Card,
    pub quantity: i64,
}

// --------------------------------------------------------------------------
// Binders.
// --------------------------------------------------------------------------

pub fn list_binders(conn: &Connection) -> Result<Vec<Binder>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.name, b.position,
                    COUNT(e.card_id),
                    COALESCE(SUM(e.quantity), 0)
             FROM binders b
             LEFT JOIN collection_entries e ON e.binder_id = b.id
             GROUP BY b.id
             ORDER BY b.position, b.id",
        )
        .map_err(|e| format!("prepare list_binders: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Binder {
                id: r.get(0)?,
                name: r.get(1)?,
                position: r.get(2)?,
                card_count: r.get(3)?,
                total_quantity: r.get(4)?,
            })
        })
        .map_err(|e| format!("query binders: {e}"))?;
    rows.collect::<Result<_, _>>()
        .map_err(|e| format!("read binder: {e}"))
}

pub fn create_binder(conn: &Connection, name: &str) -> Result<(), String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO binders (name, position, created_at)
         VALUES (?1, (SELECT COALESCE(MAX(position), -1) + 1 FROM binders), ?2)",
        params![name, now],
    )
    .map_err(|e| format!("create binder: {e}"))?;
    Ok(())
}

pub fn rename_binder(conn: &Connection, id: i64, name: &str) -> Result<(), String> {
    conn.execute("UPDATE binders SET name = ?1 WHERE id = ?2", params![name, id])
        .map_err(|e| format!("rename binder: {e}"))?;
    Ok(())
}

pub fn delete_binder(conn: &Connection, id: i64) -> Result<(), String> {
    // Entries are removed via ON DELETE CASCADE (foreign_keys pragma is on).
    conn.execute("DELETE FROM binders WHERE id = ?1", params![id])
        .map_err(|e| format!("delete binder: {e}"))?;
    Ok(())
}

// --------------------------------------------------------------------------
// Entries.
// --------------------------------------------------------------------------

/// Change the quantity of `card_id` in `binder_id` by `delta` (may be negative).
/// The row is created as needed and removed when the quantity reaches 0.
pub fn adjust_card(
    conn: &Connection,
    binder_id: i64,
    card_id: &str,
    delta: i64,
) -> Result<(), String> {
    let current: i64 = conn
        .query_row(
            "SELECT quantity FROM collection_entries WHERE binder_id = ?1 AND card_id = ?2",
            params![binder_id, card_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("read quantity: {e}"))?
        .unwrap_or(0);

    let next = current + delta;
    if next <= 0 {
        conn.execute(
            "DELETE FROM collection_entries WHERE binder_id = ?1 AND card_id = ?2",
            params![binder_id, card_id],
        )
        .map_err(|e| format!("remove entry: {e}"))?;
    } else {
        conn.execute(
            "INSERT INTO collection_entries (binder_id, card_id, quantity) VALUES (?1, ?2, ?3)
             ON CONFLICT(binder_id, card_id) DO UPDATE SET quantity = ?3",
            params![binder_id, card_id, next],
        )
        .map_err(|e| format!("upsert entry: {e}"))?;
    }
    Ok(())
}

/// Move `quantity` copies of a card from one binder to another (atomically).
pub fn move_card(
    conn: &mut Connection,
    from_binder: i64,
    to_binder: i64,
    card_id: &str,
    quantity: i64,
) -> Result<(), String> {
    if from_binder == to_binder || quantity <= 0 {
        return Ok(());
    }
    let tx = conn.transaction().map_err(|e| format!("begin tx: {e}"))?;
    adjust_card(&tx, from_binder, card_id, -quantity)?;
    adjust_card(&tx, to_binder, card_id, quantity)?;
    tx.commit().map_err(|e| format!("commit move: {e}"))
}

// --------------------------------------------------------------------------
// Queries for display.
// --------------------------------------------------------------------------

/// Cards in the collection (optionally scoped to one binder), with the owned
/// quantity, alphabetically by name.
pub fn get_collection(
    conn: &Connection,
    binder_id: Option<i64>,
) -> Result<Vec<CollectionCard>, String> {
    let base = "SELECT c.data, SUM(e.quantity)
                FROM collection_entries e
                JOIN cards c ON c.id = e.card_id";
    let sql = match binder_id {
        Some(_) => format!("{base} WHERE e.binder_id = ?1 GROUP BY e.card_id ORDER BY c.name COLLATE NOCASE"),
        None => format!("{base} GROUP BY e.card_id ORDER BY c.name COLLATE NOCASE"),
    };
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("prepare collection: {e}"))?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<(String, i64)> {
        Ok((row.get(0)?, row.get(1)?))
    };
    let rows = match binder_id {
        Some(id) => stmt.query_map(params![id], map_row),
        None => stmt.query_map([], map_row),
    }
    .map_err(|e| format!("query collection: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let (data, quantity) = row.map_err(|e| format!("read row: {e}"))?;
        let card: Card =
            serde_json::from_str(&data).map_err(|e| format!("deserialize card: {e}"))?;
        out.push(CollectionCard { card, quantity });
    }
    Ok(out)
}

/// For one card, its quantity in every binder (0 where absent) — drives the
/// per-binder steppers in the detail pane.
pub fn card_binders(conn: &Connection, card_id: &str) -> Result<Vec<BinderEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.name, COALESCE(e.quantity, 0)
             FROM binders b
             LEFT JOIN collection_entries e ON e.binder_id = b.id AND e.card_id = ?1
             ORDER BY b.position, b.id",
        )
        .map_err(|e| format!("prepare card_binders: {e}"))?;
    let rows = stmt
        .query_map(params![card_id], |r| {
            Ok(BinderEntry {
                binder_id: r.get(0)?,
                binder_name: r.get(1)?,
                quantity: r.get(2)?,
            })
        })
        .map_err(|e| format!("query card_binders: {e}"))?;
    rows.collect::<Result<_, _>>()
        .map_err(|e| format!("read entry: {e}"))
}

/// Total owned quantity per card across all binders (card_id → quantity).
/// Used for the ownership badges in the grid.
pub fn owned_counts(conn: &Connection) -> Result<HashMap<String, i64>, String> {
    let mut stmt = conn
        .prepare("SELECT card_id, SUM(quantity) FROM collection_entries GROUP BY card_id")
        .map_err(|e| format!("prepare owned_counts: {e}"))?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
        .map_err(|e| format!("query owned_counts: {e}"))?;
    let mut map = HashMap::new();
    for row in rows {
        let (id, qty) = row.map_err(|e| format!("read row: {e}"))?;
        map.insert(id, qty);
    }
    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn card(id: &str, name: &str) -> Card {
        Card {
            id: id.into(),
            name: name.into(),
            color: None,
            pitch: None,
            cost: None,
            cost_text: None,
            power: None,
            power_text: None,
            defense: None,
            defense_text: None,
            health: None,
            intellect: None,
            arcane: None,
            is_hero: false,
            types: vec![],
            traits: vec![],
            keywords: vec![],
            type_text: "Action".into(),
            functional_text: None,
            rarity: "Common".into(),
            sets: vec![],
            image_url: None,
            printings: vec![],
        }
    }

    fn setup() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        db::run_migrations(&mut conn).unwrap();
        db::replace_cards(&mut conn, &[card("x", "Snatch"), card("y", "Sink Below")]).unwrap();
        conn
    }

    #[test]
    fn default_binder_exists() {
        let conn = setup();
        let binders = list_binders(&conn).unwrap();
        assert_eq!(binders.len(), 1);
        assert_eq!(binders[0].name, "Main");
        assert_eq!(binders[0].card_count, 0);
    }

    #[test]
    fn add_move_and_aggregate() {
        let mut conn = setup();
        create_binder(&conn, "Trades").unwrap();
        let binders = list_binders(&conn).unwrap();
        let main = binders[0].id;
        let trades = binders[1].id;

        adjust_card(&conn, main, "x", 3).unwrap();
        adjust_card(&conn, main, "y", 1).unwrap();

        // Main now has 2 distinct cards, 4 total.
        let binders = list_binders(&conn).unwrap();
        assert_eq!(binders[0].card_count, 2);
        assert_eq!(binders[0].total_quantity, 4);

        // Move 1 of x to Trades.
        move_card(&mut conn, main, trades, "x", 1).unwrap();
        let entries = card_binders(&conn, "x").unwrap();
        let qty = |name: &str| entries.iter().find(|e| e.binder_name == name).unwrap().quantity;
        assert_eq!(qty("Main"), 2);
        assert_eq!(qty("Trades"), 1);

        // "All collection" aggregates x across both binders.
        let all = get_collection(&conn, None).unwrap();
        let x = all.iter().find(|c| c.card.id == "x").unwrap();
        assert_eq!(x.quantity, 3);

        // Scoped to Trades only.
        let scoped = get_collection(&conn, Some(trades)).unwrap();
        assert_eq!(scoped.len(), 1);
        assert_eq!(scoped[0].quantity, 1);

        // Owned counts across all binders.
        let counts = owned_counts(&conn).unwrap();
        assert_eq!(counts.get("x"), Some(&3));
        assert_eq!(counts.get("y"), Some(&1));

        // Removing to zero drops the entry.
        adjust_card(&conn, trades, "x", -5).unwrap();
        assert_eq!(card_binders(&conn, "x").unwrap().iter().find(|e| e.binder_name == "Trades").unwrap().quantity, 0);
    }

    #[test]
    fn deleting_binder_cascades() {
        let conn = setup();
        create_binder(&conn, "Trades").unwrap();
        let trades = list_binders(&conn).unwrap()[1].id;
        adjust_card(&conn, trades, "x", 2).unwrap();
        delete_binder(&conn, trades).unwrap();
        assert_eq!(list_binders(&conn).unwrap().len(), 1);
        assert!(owned_counts(&conn).unwrap().is_empty());
    }
}
