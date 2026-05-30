//! A small Scryfall/Moxfield-style query language for cards.
//!
//! We parse the query into a SQL `WHERE` clause + bound parameters, which
//! `db::search_cards` runs against the `cards` table. Scalar columns back the
//! numeric/equality filters; SQLite's JSON functions (`json_each` /
//! `json_extract` over the `data` blob) back the array fields (types, keywords,
//! sets, printings).
//!
//! Grammar (implicit AND between terms):
//!   - bare word                → free text over name + type line + rules text
//!   - `field:value`            → field filter (text fields use substring match)
//!   - `numfield OP value`      → numeric compare, OP in : = > < >= <=
//!   - `field:"quoted phrase"`  → value may contain spaces
//!   - unknown `field:value`    → treated as free text (forgiving)

use rusqlite::types::Value;

/// SQL predicate that is true for cards present in the collection (any binder).
/// Used by the `have:` field and by the "owned only" search toggle.
pub const OWNED_CLAUSE: &str =
    "EXISTS (SELECT 1 FROM collection_entries ce WHERE ce.card_id = cards.id)";

/// Matches a `?` (a `%...%` like) against any of the card's printing collector
/// ids. Used by the `cn:` field and folded into free-text search.
const PRINTING_ID_MATCH: &str =
    "EXISTS (SELECT 1 FROM json_each(data,'$.printings') WHERE LOWER(json_extract(value,'$.id')) LIKE ?)";

/// Build a SQL `WHERE` clause and its bound parameters for `query`.
/// An empty / whitespace query yields `"1=1"` (match everything).
pub fn build_where(query: &str) -> (String, Vec<Value>) {
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();

    for token in tokenize(query) {
        // Try to interpret as a `field<op>value` term first.
        if let Some((key, op, raw_value)) = split_term(&token) {
            let value = strip_quotes(raw_value);
            if !value.is_empty() {
                if let Some((sql, mut vals)) = field_fragment(key, op, &value) {
                    clauses.push(sql);
                    params.append(&mut vals);
                    continue;
                }
            }
            // Unknown field or empty value: fall through to free text below.
        }

        let value = strip_quotes(&token);
        if value.is_empty() {
            continue;
        }
        let (sql, mut vals) = free_text(&value);
        clauses.push(sql);
        params.append(&mut vals);
    }

    let where_sql = if clauses.is_empty() {
        "1=1".to_string()
    } else {
        clauses.join(" AND ")
    };
    (where_sql, params)
}

/// Split whitespace-separated tokens, keeping double-quoted spans together.
fn tokenize(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for c in query.chars() {
        match c {
            '"' => {
                in_quotes = !in_quotes;
                current.push(c);
            }
            c if c.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(c),
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

/// Split `field<op>value` at the first operator char. Returns `(field, op, value)`.
fn split_term(token: &str) -> Option<(&str, &str, &str)> {
    let boundary = token.find([':', '=', '<', '>'])?;
    let key = &token[..boundary];
    if key.is_empty() {
        return None; // e.g. a leading quote or ">3" with no field
    }
    let rest = &token[boundary..];
    let op_end = rest
        .find(|c| !matches!(c, ':' | '=' | '<' | '>'))
        .unwrap_or(rest.len());
    Some((key, &rest[..op_end], &rest[op_end..]))
}

fn strip_quotes(s: &str) -> &str {
    s.trim_matches('"')
}

fn like(value: &str) -> Value {
    Value::Text(format!("%{}%", value.to_lowercase()))
}

/// Map a `field<op>value` term to a SQL fragment + params, or `None` if the
/// field is unknown (caller then treats the token as free text).
fn field_fragment(key: &str, op: &str, value: &str) -> Option<(String, Vec<Value>)> {
    let key = key.to_lowercase();
    match key.as_str() {
        "n" | "name" => Some(("LOWER(name) LIKE ?".into(), vec![like(value)])),
        "o" | "oracle" | "text" => Some((
            "LOWER(IFNULL(json_extract(data,'$.functionalText'),'')) LIKE ?".into(),
            vec![like(value)],
        )),
        "t" | "type" => Some((
            "(LOWER(type_text) LIKE ? OR EXISTS(SELECT 1 FROM json_each(data,'$.types') WHERE LOWER(value) LIKE ?))".into(),
            vec![like(value), like(value)],
        )),
        "c" | "class" => Some((
            "EXISTS(SELECT 1 FROM json_each(data,'$.types') WHERE LOWER(value) LIKE ?)".into(),
            vec![like(value)],
        )),
        "kw" | "keyword" => Some((
            "EXISTS(SELECT 1 FROM json_each(data,'$.keywords') WHERE LOWER(value) LIKE ?)".into(),
            vec![like(value)],
        )),
        "trait" => Some((
            "EXISTS(SELECT 1 FROM json_each(data,'$.traits') WHERE LOWER(value) LIKE ?)".into(),
            vec![like(value)],
        )),
        "s" | "e" | "set" => Some((
            "(EXISTS(SELECT 1 FROM json_each(data,'$.sets') WHERE LOWER(value) LIKE ?) \
              OR EXISTS(SELECT 1 FROM json_each(data,'$.printings') WHERE LOWER(json_extract(value,'$.setId')) LIKE ?))".into(),
            vec![like(value), like(value)],
        )),
        "r" | "rarity" => Some(("LOWER(rarity) LIKE ?".into(), vec![like(value)])),
        "color" | "col" => Some(("LOWER(IFNULL(color,'')) LIKE ?".into(), vec![like(value)])),
        // Collector number, e.g. `cn:mst131` — matches any printing's id.
        "cn" | "num" | "collector" | "number" => Some((PRINTING_ID_MATCH.into(), vec![like(value)])),
        // `have:` / `owned:` — restrict to cards in the collection. The value is
        // ignored (presence is the filter), so `have:1`, `have:yes`, etc. work.
        "have" | "owned" | "own" => Some((OWNED_CLAUSE.into(), vec![])),
        _ => numeric_fragment(&key, op, value),
    }
}

fn numeric_fragment(key: &str, op: &str, value: &str) -> Option<(String, Vec<Value>)> {
    let column = match key {
        "pitch" => "pitch",
        "cost" => "cost",
        "power" | "pow" | "p" => "power",
        "defense" | "def" | "d" => "defense",
        "health" | "hp" | "life" => "health",
        "intellect" | "int" => "intellect",
        "arcane" | "arc" => "arcane",
        _ => return None,
    };
    // Non-numeric value (e.g. `pow:x`) → fall back to free text.
    let n: i64 = value.parse().ok()?;
    let sql_op = match op {
        ">=" => ">=",
        "<=" => "<=",
        ">" => ">",
        "<" => "<",
        _ => "=", // `:` and `=` both mean equals
    };
    Some((format!("{column} {sql_op} ?"), vec![Value::Integer(n)]))
}

fn free_text(value: &str) -> (String, Vec<Value>) {
    let v = like(value);
    (
        format!(
            "(LOWER(name) LIKE ? OR LOWER(type_text) LIKE ? \
             OR LOWER(IFNULL(json_extract(data,'$.functionalText'),'')) LIKE ? \
             OR {PRINTING_ID_MATCH})"
        ),
        vec![v.clone(), v.clone(), v.clone(), v],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_query_matches_all() {
        let (sql, params) = build_where("   ");
        assert_eq!(sql, "1=1");
        assert!(params.is_empty());
    }

    #[test]
    fn numeric_operator_parsing() {
        let (sql, params) = build_where("pow>=4");
        assert_eq!(sql, "power >= ?");
        assert_eq!(params, vec![Value::Integer(4)]);
    }

    #[test]
    fn quoted_phrase_stays_together() {
        let (_sql, params) = build_where("name:\"command and conquer\"");
        assert_eq!(params, vec![Value::Text("%command and conquer%".into())]);
    }

    #[test]
    fn unknown_field_falls_back_to_free_text() {
        // `foo` is not a field, so the whole token is a free-text term. Free text
        // matches name + type + rules text + collector number (4 binds).
        let (_sql, params) = build_where("foo:bar");
        assert_eq!(params.len(), 4);
    }

    #[test]
    fn collector_number_field() {
        let (sql, params) = build_where("cn:MST131");
        assert!(sql.contains("printings"));
        assert_eq!(params, vec![Value::Text("%mst131%".into())]);
    }
}
