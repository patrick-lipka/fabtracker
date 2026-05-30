//! The user's collection: binders and the cards (with quantities) in them.
//!
//! Model (v1): a binder holds cards keyed by their unique card id with a
//! quantity. A card may appear in several binders; "all collection" aggregates
//! across them, and "moving" a card shifts quantity from one binder to another.
//! Per-printing / foiling granularity is a deliberate future refinement.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
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

/// One stack of identical physical copies of a card: a specific printing,
/// foiling, and condition, in a particular binder.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardCollectionEntry {
    pub binder_id: i64,
    pub binder_name: String,
    pub printing_id: String,
    pub set_id: String,
    pub foiling: String,
    pub condition: String,
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
                    COUNT(DISTINCT e.card_id),
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

/// Identifies a specific stack: a printing, foiling, and condition of a card.
pub struct EntryKey<'a> {
    pub card_id: &'a str,
    pub printing_id: &'a str,
    pub set_id: &'a str,
    pub foiling: &'a str,
    pub condition: &'a str,
}

/// Change the quantity of a specific (printing, foiling, condition) of a card in
/// a binder by `delta`. The row is created as needed and removed when it hits 0.
pub fn adjust_entry(
    conn: &Connection,
    binder_id: i64,
    key: &EntryKey,
    delta: i64,
) -> Result<(), String> {
    let current: i64 = conn
        .query_row(
            "SELECT quantity FROM collection_entries
             WHERE binder_id=?1 AND card_id=?2 AND printing_id=?3 AND foiling=?4 AND condition=?5",
            params![binder_id, key.card_id, key.printing_id, key.foiling, key.condition],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("read quantity: {e}"))?
        .unwrap_or(0);

    let next = current + delta;
    if next <= 0 {
        conn.execute(
            "DELETE FROM collection_entries
             WHERE binder_id=?1 AND card_id=?2 AND printing_id=?3 AND foiling=?4 AND condition=?5",
            params![binder_id, key.card_id, key.printing_id, key.foiling, key.condition],
        )
        .map_err(|e| format!("remove entry: {e}"))?;
    } else {
        conn.execute(
            "INSERT INTO collection_entries
                (binder_id, card_id, printing_id, set_id, foiling, condition, quantity)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(binder_id, card_id, printing_id, foiling, condition)
                DO UPDATE SET quantity = ?7",
            params![
                binder_id,
                key.card_id,
                key.printing_id,
                key.set_id,
                key.foiling,
                key.condition,
                next
            ],
        )
        .map_err(|e| format!("upsert entry: {e}"))?;
    }
    Ok(())
}

/// Move `quantity` copies of a specific stack from one binder to another.
pub fn move_entry(
    conn: &mut Connection,
    from_binder: i64,
    to_binder: i64,
    key: &EntryKey,
    quantity: i64,
) -> Result<(), String> {
    if from_binder == to_binder || quantity <= 0 {
        return Ok(());
    }
    let tx = conn.transaction().map_err(|e| format!("begin tx: {e}"))?;
    adjust_entry(&tx, from_binder, key, -quantity)?;
    adjust_entry(&tx, to_binder, key, quantity)?;
    tx.commit().map_err(|e| format!("commit move: {e}"))
}

/// Move *all* stacks of a card from one binder to another, merging quantities
/// into any matching stacks already in the target.
pub fn move_card_all(
    conn: &mut Connection,
    from_binder: i64,
    to_binder: i64,
    card_id: &str,
) -> Result<(), String> {
    if from_binder == to_binder {
        return Ok(());
    }
    let tx = conn.transaction().map_err(|e| format!("begin tx: {e}"))?;
    tx.execute(
        "INSERT INTO collection_entries
            (binder_id, card_id, printing_id, set_id, foiling, condition, quantity)
         SELECT ?1, card_id, printing_id, set_id, foiling, condition, quantity
         FROM collection_entries WHERE binder_id=?2 AND card_id=?3
         ON CONFLICT(binder_id, card_id, printing_id, foiling, condition)
            DO UPDATE SET quantity = quantity + excluded.quantity",
        params![to_binder, from_binder, card_id],
    )
    .map_err(|e| format!("merge into target: {e}"))?;
    tx.execute(
        "DELETE FROM collection_entries WHERE binder_id=?1 AND card_id=?2",
        params![from_binder, card_id],
    )
    .map_err(|e| format!("clear source: {e}"))?;
    tx.commit().map_err(|e| format!("commit move-all: {e}"))
}

/// Remove every stack of a card from a binder.
pub fn remove_card_from_binder(
    conn: &Connection,
    binder_id: i64,
    card_id: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM collection_entries WHERE binder_id=?1 AND card_id=?2",
        params![binder_id, card_id],
    )
    .map_err(|e| format!("remove card from binder: {e}"))?;
    Ok(())
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

/// Like `get_collection`, but additionally filtered by a search query (the same
/// query language as the catalog — see `search.rs`). Powers search within the
/// Collection view, scoped to a binder or across all of them.
pub fn search_collection(
    conn: &Connection,
    query: &str,
    binder_id: Option<i64>,
) -> Result<Vec<CollectionCard>, String> {
    let (where_sql, mut params) = crate::search::build_where(query);
    // The cards table is referenced unaliased so the query fragments' bare
    // column names (and `cards.id` in the owned clause) resolve correctly.
    let scope = if binder_id.is_some() {
        " AND collection_entries.binder_id = ?"
    } else {
        ""
    };
    let sql = format!(
        "SELECT cards.data, SUM(collection_entries.quantity)
         FROM collection_entries
         JOIN cards ON cards.id = collection_entries.card_id
         WHERE ({where_sql}){scope}
         GROUP BY collection_entries.card_id
         ORDER BY cards.name COLLATE NOCASE"
    );
    if let Some(id) = binder_id {
        params.push(Value::Integer(id));
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("prepare search_collection: {e}"))?;
    let rows = stmt
        .query_map(params_from_iter(params.iter()), |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        })
        .map_err(|e| format!("query search_collection: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let (data, quantity) = row.map_err(|e| format!("read row: {e}"))?;
        let card: Card =
            serde_json::from_str(&data).map_err(|e| format!("deserialize card: {e}"))?;
        out.push(CollectionCard { card, quantity });
    }
    Ok(out)
}

/// All collection stacks of a card across every binder — drives the detail
/// pane's copy list.
pub fn card_entries(conn: &Connection, card_id: &str) -> Result<Vec<CardCollectionEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT e.binder_id, b.name, e.printing_id, e.set_id, e.foiling, e.condition, e.quantity
             FROM collection_entries e
             JOIN binders b ON b.id = e.binder_id
             WHERE e.card_id = ?1
             ORDER BY b.position, b.id, e.set_id, e.printing_id, e.foiling, e.condition",
        )
        .map_err(|e| format!("prepare card_entries: {e}"))?;
    let rows = stmt
        .query_map(params![card_id], |r| {
            Ok(CardCollectionEntry {
                binder_id: r.get(0)?,
                binder_name: r.get(1)?,
                printing_id: r.get(2)?,
                set_id: r.get(3)?,
                foiling: r.get(4)?,
                condition: r.get(5)?,
                quantity: r.get(6)?,
            })
        })
        .map_err(|e| format!("query card_entries: {e}"))?;
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

    fn ek<'a>(card: &'a str, printing: &'a str, foil: &'a str, cond: &'a str) -> EntryKey<'a> {
        EntryKey {
            card_id: card,
            printing_id: printing,
            set_id: "TST",
            foiling: foil,
            condition: cond,
        }
    }

    fn coll_names(conn: &Connection, q: &str, binder: Option<i64>) -> Vec<String> {
        let mut n: Vec<String> = search_collection(conn, q, binder)
            .unwrap()
            .into_iter()
            .map(|c| c.card.name)
            .collect();
        n.sort();
        n
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
        let bs = list_binders(&conn).unwrap();
        let main = bs[0].id;
        let trades = bs[1].id;

        // x: 3 Standard + 1 Rainbow Foil; y: 1 Standard — all in Main.
        adjust_entry(&conn, main, &ek("x", "xp", "Standard", "NM"), 3).unwrap();
        adjust_entry(&conn, main, &ek("x", "xp", "Rainbow Foil", "NM"), 1).unwrap();
        adjust_entry(&conn, main, &ek("y", "yp", "Standard", "NM"), 1).unwrap();

        // Distinct cards = 2 (x, y); total quantity = 5.
        let bs = list_binders(&conn).unwrap();
        assert_eq!(bs[0].card_count, 2);
        assert_eq!(bs[0].total_quantity, 5);

        // get_collection aggregates x's two foilings into one tile (qty 4).
        let all = get_collection(&conn, None).unwrap();
        assert_eq!(all.iter().find(|c| c.card.id == "x").unwrap().quantity, 4);
        // card_entries lists x's two distinct stacks.
        assert_eq!(card_entries(&conn, "x").unwrap().len(), 2);

        // Move all of x (both stacks) to Trades.
        move_card_all(&mut conn, main, trades, "x").unwrap();
        let entries = card_entries(&conn, "x").unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().all(|e| e.binder_name == "Trades"));
        assert_eq!(card_entries(&conn, "y").unwrap()[0].binder_name, "Main");

        // owned_counts aggregates across binders + foilings.
        let counts = owned_counts(&conn).unwrap();
        assert_eq!(counts.get("x"), Some(&4));
        assert_eq!(counts.get("y"), Some(&1));

        // Move one Standard copy of x back to Main.
        move_entry(&mut conn, trades, main, &ek("x", "xp", "Standard", "NM"), 1).unwrap();
        let main_scope = get_collection(&conn, Some(main)).unwrap();
        assert_eq!(main_scope.iter().find(|c| c.card.id == "x").unwrap().quantity, 1);

        // Remove all remaining x from Trades.
        remove_card_from_binder(&conn, trades, "x").unwrap();
        assert!(card_entries(&conn, "x")
            .unwrap()
            .iter()
            .all(|e| e.binder_name == "Main"));
    }

    #[test]
    fn search_within_collection_and_binders() {
        let mut conn = setup();
        let main = list_binders(&conn).unwrap()[0].id;
        create_binder(&conn, "Trades").unwrap();
        let trades = list_binders(&conn).unwrap()[1].id;

        adjust_entry(&conn, main, &ek("x", "xp", "Standard", "NM"), 2).unwrap(); // Snatch
        adjust_entry(&conn, main, &ek("y", "yp", "Standard", "NM"), 1).unwrap(); // Sink Below

        // Empty query across all = whole collection.
        assert_eq!(coll_names(&conn, "", None), ["Sink Below", "Snatch"]);
        // Query filters within the collection.
        assert_eq!(coll_names(&conn, "snatch", None), ["Snatch"]);
        // Scoped to a binder.
        assert_eq!(coll_names(&conn, "", Some(main)).len(), 2);
        assert_eq!(coll_names(&conn, "", Some(trades)), [] as [String; 0]);

        // Move Snatch to Trades; binder scoping follows it.
        move_card_all(&mut conn, main, trades, "x").unwrap();
        assert_eq!(coll_names(&conn, "", Some(trades)), ["Snatch"]);
        assert_eq!(coll_names(&conn, "sink", Some(trades)), [] as [String; 0]);
        assert_eq!(coll_names(&conn, "", Some(main)), ["Sink Below"]);
    }

    #[test]
    fn deleting_binder_cascades() {
        let conn = setup();
        create_binder(&conn, "Trades").unwrap();
        let trades = list_binders(&conn).unwrap()[1].id;
        adjust_entry(&conn, trades, &ek("x", "xp", "Standard", "NM"), 2).unwrap();
        delete_binder(&conn, trades).unwrap();
        assert_eq!(list_binders(&conn).unwrap().len(), 1);
        assert!(owned_counts(&conn).unwrap().is_empty());
    }
}
