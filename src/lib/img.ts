// Route remote card images through the local-cache custom protocol so each
// image is downloaded once to disk and served offline thereafter (handled by
// `src-tauri/src/imagecache.rs`). Pass any non-http value through unchanged.

const PREFIX = navigator.userAgent.includes("Windows")
  ? "http://cardimg.localhost/"
  : "cardimg://localhost/";

export function cachedImg(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return url;
  return PREFIX + encodeURIComponent(url);
}
