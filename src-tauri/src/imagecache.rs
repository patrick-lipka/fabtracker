//! On-disk cache for card images, served via the `cardimg://` custom protocol.
//!
//! The frontend points `<img>` at `cardimg://localhost/<percent-encoded https
//! url>`; this handler serves the file from the app cache dir, downloading it
//! once on the first miss. That gives offline images, faster reloads, and lets
//! the CSP avoid arbitrary remote image hosts.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::OnceLock;

use serde::Serialize;
use tauri::{http, AppHandle, Emitter, Manager};

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

/// The on-disk card-image cache directory.
pub fn dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("card-images"))
}

/// (file count, total bytes) of the cache.
pub fn stats(app: &AppHandle) -> Result<(u64, u64), String> {
    let d = dir(app)?;
    let mut count = 0u64;
    let mut bytes = 0u64;
    if let Ok(rd) = std::fs::read_dir(&d) {
        for entry in rd.flatten() {
            if let Ok(m) = entry.metadata() {
                if m.is_file() {
                    count += 1;
                    bytes += m.len();
                }
            }
        }
    }
    Ok((count, bytes))
}

/// Delete every cached image.
pub fn clear(app: &AppHandle) -> Result<(), String> {
    let d = dir(app)?;
    if d.exists() {
        std::fs::remove_dir_all(&d).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrewarmProgress {
    pub done: u64,
    pub total: u64,
}

/// Download every given image that isn't already cached, emitting
/// `image-prewarm-progress` events. Returns how many were (attempted to be)
/// downloaded. Concurrency-limited to stay polite to the CDNs.
pub async fn prewarm(app: &AppHandle, urls: Vec<String>) -> Result<u64, String> {
    const CONCURRENCY: usize = 8;
    let cache_dir = dir(app)?;
    let _ = std::fs::create_dir_all(&cache_dir);

    let missing: Vec<String> = urls
        .into_iter()
        .filter(|u| u.starts_with("https://"))
        .filter(|u| !cache_dir.join(cache_name(u)).exists())
        .collect();
    let total = missing.len() as u64;
    let _ = app.emit("image-prewarm-progress", PrewarmProgress { done: 0, total });

    let mut done = 0u64;
    for chunk in missing.chunks(CONCURRENCY) {
        let handles: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|url| {
                let file = cache_dir.join(cache_name(&url));
                tauri::async_runtime::spawn(async move {
                    if let Ok(resp) = client().get(&url).send().await {
                        if resp.status().is_success() {
                            if let Ok(bytes) = resp.bytes().await {
                                let _ = std::fs::write(&file, &bytes);
                            }
                        }
                    }
                })
            })
            .collect();
        for h in handles {
            let _ = h.await;
        }
        done += chunk.len() as u64;
        let _ = app.emit("image-prewarm-progress", PrewarmProgress { done, total });
    }
    Ok(total)
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
    let cache_dir = dir(app)?;
    let file = cache_dir.join(cache_name(&url));

    if let Ok(bytes) = std::fs::read(&file) {
        return Ok((ext, bytes));
    }

    let resp = client().get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("upstream status {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let _ = std::fs::create_dir_all(&cache_dir);
    let _ = std::fs::write(&file, &bytes);
    Ok((ext, bytes))
}
