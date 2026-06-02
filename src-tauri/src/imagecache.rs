//! On-disk cache for card images, served via the `cardimg://` custom protocol.
//!
//! The frontend points `<img>` at `cardimg://localhost/<percent-encoded https
//! url>`; this handler serves the file from the app cache dir, downloading it
//! once on the first miss. That gives offline images, faster reloads, and lets
//! the CSP avoid arbitrary remote image hosts.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::OnceLock;

use tauri::{http, AppHandle, Manager};

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("fabtracker/0.1 (+https://github.com/)")
            .build()
            .expect("build image http client")
    })
}

/// Minimal percent-decoder (the frontend encodes the url with encodeURIComponent).
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(byte) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn ext_of(url: &str) -> &'static str {
    let u = url.to_lowercase();
    if u.ends_with(".jpg") || u.ends_with(".jpeg") {
        "jpg"
    } else if u.ends_with(".webp") {
        "webp"
    } else {
        "png"
    }
}

fn content_type(ext: &str) -> &'static str {
    match ext {
        "jpg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

fn cache_name(url: &str) -> String {
    let mut h = DefaultHasher::new();
    url.hash(&mut h);
    format!("{:016x}.{}", h.finish(), ext_of(url))
}

fn response(status: u16, content_type: &str, body: Vec<u8>) -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Cache-Control", "max-age=31536000")
        .body(body)
        .unwrap_or_else(|_| http::Response::new(Vec::new()))
}

/// Serve `cardimg://localhost/<encoded url>` from cache, downloading on miss.
pub async fn serve(app: &AppHandle, path: &str) -> http::Response<Vec<u8>> {
    match serve_inner(app, path).await {
        Ok((ext, body)) => response(200, content_type(&ext), body),
        Err(_) => response(404, "text/plain", Vec::new()),
    }
}

async fn serve_inner(app: &AppHandle, path: &str) -> Result<(String, Vec<u8>), String> {
    let url = percent_decode(path.trim_start_matches('/'));
    // Only ever fetch https images — never local files or other schemes.
    if !url.starts_with("https://") {
        return Err("unsupported url".into());
    }
    let ext = ext_of(&url).to_string();
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("card-images");
    let file = dir.join(cache_name(&url));

    if let Ok(bytes) = std::fs::read(&file) {
        return Ok((ext, bytes));
    }

    let resp = client().get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("upstream status {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::write(&file, &bytes);
    Ok((ext, bytes))
}
