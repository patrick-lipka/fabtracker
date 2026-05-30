//! Local SQLite persistence for the card catalog (and, later, the collection
//! and decks).
//!
//! Storage strategy: each card is stored as its full JSON in a `data` column,
//! alongside a handful of indexed scalar columns (name, pitch, cost, …). That
//! gives us cheap full reconstruction now and SQL filtering when the richer
//! search lands, without committing to a rigid relational shape too early.

use rusqlite::{params, Connection};
use rusqlite_migration::{Migrations, M};

use crate::card::Card;

const MIGRATIONS_SLICE: &[M<'static>] = &[M::up(
    "CREATE TABLE cards (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        color       TEXT,
        pitch       INTEGER,
        cost        INTEGER,
        power       INTEGER,
        defense     INTEGER,
        health      INTEGER,
        intellect   INTEGER,
        arcane      INTEGER,
        is_hero     INTEGER NOT NULL,
        type_text   TEXT NOT NULL,
        rarity      TEXT NOT NULL,
        data        TEXT NOT NULL
     );
     CREATE INDEX idx_cards_name ON cards(name);

     CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
     );",
)];

const LAST_SYNCED_KEY: &str = "last_synced_ms";

/// Open (creating if needed) the database at `path` and bring it up to date.
pub fn open(path: &std::path::Path) -> Result<Connection, String> {
    let mut conn = Connection::open(path).map_err(|e| format!("open db: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("set pragmas: {e}"))?;
    run_migrations(&mut conn)?;
    Ok(conn)
}

fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    Migrations::from_slice(MIGRATIONS_SLICE)
        .to_latest(conn)
        .map_err(|e| format!("run migrations: {e}"))
}

/// Replace the entire card catalog in one transaction.
pub fn replace_cards(conn: &mut Connection, cards: &[Card]) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| format!("begin tx: {e}"))?;
    tx.execute("DELETE FROM cards", [])
        .map_err(|e| format!("clear cards: {e}"))?;
    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO cards
                    (id, name, color, pitch, cost, power, defense, health,
                     intellect, arcane, is_hero, type_text, rarity, data)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            )
            .map_err(|e| format!("prepare insert: {e}"))?;
        for card in cards {
            let data = serde_json::to_string(card)
                .map_err(|e| format!("serialize card {}: {e}", card.id))?;
            stmt.execute(params![
                card.id,
                card.name,
                card.color,
                card.pitch,
                card.cost,
                card.power,
                card.defense,
                card.health,
                card.intellect,
                card.arcane,
                card.is_hero,
                card.type_text,
                card.rarity,
                data,
            ])
            .map_err(|e| format!("insert card {}: {e}", card.id))?;
        }
    }
    tx.commit().map_err(|e| format!("commit: {e}"))
}

/// Load the full catalog, alphabetically by name.
pub fn load_cards(conn: &Connection) -> Result<Vec<Card>, String> {
    let mut stmt = conn
        .prepare("SELECT data FROM cards ORDER BY name COLLATE NOCASE")
        .map_err(|e| format!("prepare select: {e}"))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("query cards: {e}"))?;

    let mut cards = Vec::new();
    for row in rows {
        let data = row.map_err(|e| format!("read row: {e}"))?;
        let card: Card =
            serde_json::from_str(&data).map_err(|e| format!("deserialize card: {e}"))?;
        cards.push(card);
    }
    Ok(cards)
}

pub fn card_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM cards", [], |r| r.get(0))
        .map_err(|e| format!("count cards: {e}"))
}

pub fn set_last_synced(conn: &Connection, epoch_ms: i64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![LAST_SYNCED_KEY, epoch_ms.to_string()],
    )
    .map_err(|e| format!("set last_synced: {e}"))?;
    Ok(())
}

pub fn get_last_synced(conn: &Connection) -> Result<Option<i64>, String> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![LAST_SYNCED_KEY],
            |r| r.get(0),
        )
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                "no row".to_string()
            } else {
                format!("get last_synced: {e}")
            }
        })
        .ok();
    Ok(value.and_then(|v| v.parse().ok()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::card::Printing;

    fn sample(id: &str, name: &str) -> Card {
        Card {
            id: id.into(),
            name: name.into(),
            color: Some("Red".into()),
            pitch: Some(1),
            cost: Some(0),
            cost_text: Some("0".into()),
            power: Some(3),
            power_text: Some("3".into()),
            defense: Some(2),
            defense_text: Some("2".into()),
            health: None,
            intellect: None,
            arcane: None,
            is_hero: false,
            types: vec!["Ninja".into(), "Action".into(), "Attack".into()],
            traits: vec![],
            keywords: vec!["Go again".into()],
            type_text: "Ninja Action - Attack".into(),
            functional_text: Some("Go again".into()),
            rarity: "Rare".into(),
            sets: vec!["Welcome to Rathe".into()],
            image_url: None,
            printings: vec![Printing {
                id: "WTR043".into(),
                set_id: "WTR".into(),
                set_name: "Welcome to Rathe".into(),
                rarity: "Rare".into(),
                artists: vec!["Gabriel Cassata".into()],
                flavor_text: None,
                image_url: None,
            }],
        }
    }

    #[test]
    fn round_trips_cards_and_meta() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();

        let cards = vec![sample("b", "Snatch"), sample("a", "Brutal Assault")];
        replace_cards(&mut conn, &cards).unwrap();

        assert_eq!(card_count(&conn).unwrap(), 2);

        // Loaded alphabetically by name.
        let loaded = load_cards(&conn).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].name, "Brutal Assault");
        assert_eq!(loaded[1].name, "Snatch");
        assert_eq!(loaded[1].keywords, vec!["Go again".to_string()]);
        assert_eq!(loaded[1].printings.len(), 1);

        // Replacing again fully clears the previous set.
        replace_cards(&mut conn, &[sample("c", "Sink Below")]).unwrap();
        assert_eq!(card_count(&conn).unwrap(), 1);

        // Meta round-trips.
        assert_eq!(get_last_synced(&conn).unwrap(), None);
        set_last_synced(&conn, 1_700_000_000_000).unwrap();
        assert_eq!(get_last_synced(&conn).unwrap(), Some(1_700_000_000_000));
    }
}
