//! Filename encryption for EPUB files.
//!
//! Port of `packages/core/src/crypto/encrypt.ts`.
//!
//! Algorithm: MD5(id) → 128-bit binary → `1` → `*`, `0` → `:` → encrypted filename.

use std::collections::{HashMap, HashSet};

use md5::{Digest, Md5};

use crate::epub::parser::ManifestItem;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Result of an encryption operation.
#[derive(Debug)]
pub struct EncryptResult {
    pub success: bool,
    pub files_encrypted: usize,
    /// old bookpath → new bookpath
    pub mapping: HashMap<String, String>,
}

// ─── File categories ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FileCategory {
    Text,
    Css,
    Image,
    Font,
    Audio,
    Video,
    Other,
}

impl FileCategory {
    /// OEBPS sub-directory name for this category.
    pub fn dir_name(self) -> &'static str {
        match self {
            Self::Text => "Text",
            Self::Css => "Styles",
            Self::Image => "Images",
            Self::Font => "Fonts",
            Self::Audio => "Audio",
            Self::Video => "Video",
            Self::Other => "Misc",
        }
    }
}

/// Classify a manifest item into a file category.
pub fn classify_item(item: &ManifestItem) -> FileCategory {
    let mt = &item.media_type;
    let href = item.href.to_lowercase();
    if mt == "application/xhtml+xml" {
        FileCategory::Text
    } else if mt == "text/css" {
        FileCategory::Css
    } else if mt.starts_with("image/") {
        FileCategory::Image
    } else if mt.starts_with("font/")
        || href.ends_with(".ttf")
        || href.ends_with(".otf")
        || href.ends_with(".woff")
    {
        FileCategory::Font
    } else if mt.starts_with("audio/") {
        FileCategory::Audio
    } else if mt.starts_with("video/") {
        FileCategory::Video
    } else {
        FileCategory::Other
    }
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/// MD5(id) → binary string → `1` → `*`, `0` → `:`.
///
/// This is the core encryption function matching the TS `generateEncryptedName`.
pub fn generate_encrypted_name(id: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(id.as_bytes());
    let hash = hasher.finalize();

    // Convert 16 bytes → 128-bit binary string, replacing 1 → '*', 0 → ':' in a single pass
    let mut result = String::with_capacity(128);
    for byte in hash.iter() {
        for i in (0..8).rev() {
            if (byte >> i) & 1 == 1 {
                result.push('*');
            } else {
                result.push(':');
            }
        }
    }

    result
}

/// Build the encrypted filename for a manifest item.
///
/// Port of TS `buildEncryptedFilename`.
pub fn build_encrypted_filename(id: &str, href: &str) -> String {
    let id_name = id.split('.').next().unwrap_or(id);
    let ext = href
        .rfind('.')
        .map(|i| &href[i + 1..])
        .unwrap_or("")
        .to_lowercase();

    let filename_without_ext = {
        let basename = href.rsplit('/').next().unwrap_or(href);
        basename
            .rfind('.')
            .map(|i| &basename[..i])
            .unwrap_or(basename)
    };

    let mut slim_suffix = "";
    let mut hash_input = id_name.to_string();
    if filename_without_ext.ends_with("slim") || id_name.ends_with("slim") {
        slim_suffix = "~slim";
        hash_input = hash_input
            .trim_end_matches("~slim")
            .trim_end_matches("-slim")
            .trim_end_matches("_slim")
            .trim_end_matches("slim")
            .to_string();
    }

    let encrypted = generate_encrypted_name(&hash_input);
    format!("_{encrypted}{slim_suffix}.{ext}")
}

/// Resolve a relative href against a base file path.
///
/// e.g. `resolve_book_path("../Images/cover.jpg", "OEBPS/Text/ch1.xhtml")`
///      → `"OEBPS/Images/cover.jpg"`
pub fn resolve_book_path(href: &str, base_path: &str) -> String {
    let parts: Vec<&str> = href.split(&['/', '\\'][..]).collect();
    let base_parts: Vec<&str> = base_path.split(&['/', '\\'][..]).collect();
    // Remove filename from base
    let base_dir = &base_parts[..base_parts.len().saturating_sub(1)];

    let mut back_steps = 0usize;
    let mut start = 0;
    for (i, part) in parts.iter().enumerate() {
        if *part == ".." {
            back_steps += 1;
            start = i + 1;
        } else if *part == "." {
            start = i + 1;
        } else {
            break;
        }
    }

    let remaining = &parts[start..];
    if back_steps >= base_dir.len() {
        return remaining.join("/");
    }

    let base_prefix = &base_dir[..base_dir.len() - back_steps];
    let mut result: Vec<&str> = base_prefix.to_vec();
    result.extend_from_slice(remaining);
    result.join("/")
}

/// Build a path mapping for all manifest items (excluding the TOC NCX).
///
/// Returns: `(path_map, href_to_new)` where:
/// - `path_map`: old bookpath → (new_basename, category)
/// - `href_to_new`: old OPF-relative href → new encrypted basename
pub fn build_path_map(
    manifest: &HashMap<String, ManifestItem>,
    toc_id: &str,
    opf_dir: &str,
) -> (HashMap<String, (String, FileCategory)>, HashMap<String, String>) {
    let mut path_map: HashMap<String, (String, FileCategory)> = HashMap::new();
    let mut href_to_new: HashMap<String, String> = HashMap::new();
    let mut used_names: HashMap<FileCategory, HashSet<String>> = HashMap::new();

    for (id, item) in manifest {
        if !toc_id.is_empty() && id == toc_id {
            continue;
        }

        let category = classify_item(item);
        let mut new_name = build_encrypted_filename(id, &item.href);

        // Ensure uniqueness within category
        let name_set = used_names.entry(category).or_default();
        if name_set.contains(&new_name) {
            let ext_idx = new_name.rfind('.').unwrap_or(new_name.len());
            let base = &new_name[..ext_idx];
            let ext = &new_name[ext_idx..];
            let mut counter = 1;
            loop {
                let candidate = format!("{base}_{counter}{ext}");
                if !name_set.contains(&candidate) {
                    new_name = candidate;
                    break;
                }
                counter += 1;
            }
        }
        name_set.insert(new_name.clone());

        let book_path = if opf_dir.is_empty() {
            item.href.clone()
        } else {
            format!("{}/{}", opf_dir, item.href)
        };
        path_map.insert(book_path, (new_name.clone(), category));
        href_to_new.insert(item.href.clone(), new_name);
    }

    (path_map, href_to_new)
}

// ─── Content rewriting helpers ────────────────────────────────────────────────

/// Rewrite href/src references in XHTML content.
pub fn rewrite_xhtml(
    text: &str,
    xhtml_book_path: &str,
    path_map: &HashMap<String, (String, FileCategory)>,
) -> String {
    let mut result = text.to_string();

    // Rewrite href="...", src="...", xlink:href="...", poster="..."
    for attr in &["href", "src", "xlink:href", "poster"] {
        result = rewrite_attr_references(&result, attr, xhtml_book_path, path_map);
    }

    // Rewrite url() in inline styles
    result = rewrite_url_references(&result, xhtml_book_path, path_map);

    result
}

/// Rewrite url() references in CSS content.
pub fn rewrite_css(
    css: &str,
    css_book_path: &str,
    path_map: &HashMap<String, (String, FileCategory)>,
) -> String {
    let mut result = css.to_string();

    // Rewrite url()
    result = rewrite_url_references(&result, css_book_path, path_map);

    result
}

/// Rewrite attribute references (href, src, etc.) in HTML/XHTML.
fn rewrite_attr_references(
    text: &str,
    attr_name: &str,
    base_path: &str,
    path_map: &HashMap<String, (String, FileCategory)>,
) -> String {
    // Simple regex-like approach: find attr="value" patterns
    let mut result = String::with_capacity(text.len());
    let search_pattern = format!("{attr_name}=\"");
    let mut pos = 0;

    while pos < text.len() {
        if let Some(start) = text[pos..].find(&search_pattern) {
            let abs_start = pos + start;
            let value_start = abs_start + search_pattern.len();

            if let Some(end_quote) = text[value_start..].find('"') {
                let value_end = value_start + end_quote;
                let href = &text[value_start..value_end];

                // Push everything up to the value
                result.push_str(&text[pos..value_start]);

                // Try to rewrite
                if let Some(new_href) = try_rewrite_href(href, base_path, path_map) {
                    result.push_str(&new_href);
                } else {
                    result.push_str(href);
                }

                pos = value_end;
            } else {
                result.push_str(&text[pos..abs_start + search_pattern.len()]);
                pos = abs_start + search_pattern.len();
            }
        } else {
            result.push_str(&text[pos..]);
            break;
        }
    }

    result
}

/// Rewrite `url()` references in CSS/inline styles.
fn rewrite_url_references(
    text: &str,
    base_path: &str,
    path_map: &HashMap<String, (String, FileCategory)>,
) -> String {
    let mut result = String::with_capacity(text.len());
    let mut pos = 0;

    while pos < text.len() {
        if let Some(url_start) = text[pos..].find("url(") {
            let abs_start = pos + url_start;
            let value_start = abs_start + 4;

            // Find closing )
            if let Some(paren_end) = text[value_start..].find(')') {
                let value_end = value_start + paren_end;
                let raw_url = text[value_start..value_end].trim();
                let url = raw_url.trim_matches(|c| c == '"' || c == '\'');

                result.push_str(&text[pos..abs_start]);
                result.push_str("url(");

                if let Some(new_href) = try_rewrite_href(url, base_path, path_map) {
                    result.push_str(&new_href);
                } else {
                    result.push_str(raw_url);
                }

                result.push(')');
                pos = value_end + 1;
            } else {
                result.push_str(&text[pos..abs_start + 4]);
                pos = abs_start + 4;
            }
        } else {
            result.push_str(&text[pos..]);
            break;
        }
    }

    result
}

/// Try to rewrite a single href to the new encrypted path.
fn try_rewrite_href(
    href: &str,
    base_path: &str,
    path_map: &HashMap<String, (String, FileCategory)>,
) -> Option<String> {
    let decoded = urlencoding_decode(href);
    let trimmed = decoded.trim();

    if trimmed.is_empty()
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("data:")
        || trimmed.starts_with("mailto:")
    {
        return None;
    }

    // Split off fragment
    let (href_base, fragment) = if let Some(hash_idx) = trimmed.find('#') {
        (&trimmed[..hash_idx], &trimmed[hash_idx..])
    } else {
        (trimmed, "")
    };

    if href_base.is_empty() {
        return None;
    }

    let book_path = resolve_book_path(href_base, base_path);
    let (new_basename, category) = path_map.get(&book_path)?;

    let dir = category.dir_name();
    Some(format!("../{dir}/{new_basename}{fragment}"))
}

/// Percent-decode a URL-encoded string (RFC 3986).
fn urlencoding_decode(s: &str) -> String {
    let mut result = Vec::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (
                hex_val(bytes[i + 1]),
                hex_val(bytes[i + 2]),
            ) {
                result.push(hi << 4 | lo);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| s.to_string())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_encrypted_name() {
        let name = generate_encrypted_name("chapter1");
        // Should be 128 chars of * and :
        assert_eq!(name.len(), 128);
        assert!(name.chars().all(|c| c == '*' || c == ':'));
    }

    #[test]
    fn test_generate_encrypted_name_deterministic() {
        let a = generate_encrypted_name("test_id");
        let b = generate_encrypted_name("test_id");
        assert_eq!(a, b);
    }

    #[test]
    fn test_generate_encrypted_name_different_inputs() {
        let a = generate_encrypted_name("chapter1");
        let b = generate_encrypted_name("chapter2");
        assert_ne!(a, b);
    }

    #[test]
    fn test_build_encrypted_filename() {
        let name = build_encrypted_filename("chapter1.xhtml", "Text/chapter1.xhtml");
        assert!(name.starts_with('_'));
        assert!(name.ends_with(".xhtml"));
        assert_eq!(name.len(), 1 + 128 + 6); // _ + 128chars + .xhtml
    }

    #[test]
    fn test_build_encrypted_filename_slim() {
        let name = build_encrypted_filename("chapter1slim.css", "Styles/chapter1slim.css");
        assert!(name.contains("~slim"));
        assert!(name.ends_with(".css"));
    }

    #[test]
    fn test_resolve_book_path() {
        assert_eq!(
            resolve_book_path("../Images/cover.jpg", "OEBPS/Text/ch1.xhtml"),
            "OEBPS/Images/cover.jpg"
        );
    }

    #[test]
    fn test_resolve_book_path_same_dir() {
        assert_eq!(
            resolve_book_path("style.css", "OEBPS/Text/ch1.xhtml"),
            "OEBPS/Text/style.css"
        );
    }

    #[test]
    fn test_resolve_book_path_up_two_levels() {
        assert_eq!(
            resolve_book_path("../../Images/img.png", "OEBPS/Text/sub/ch1.xhtml"),
            "OEBPS/Images/img.png"
        );
    }

    #[test]
    fn test_classify_item() {
        let text_item = ManifestItem {
            id: "ch1".into(),
            href: "Text/ch1.xhtml".into(),
            media_type: "application/xhtml+xml".into(),
            properties: None,
        };
        assert_eq!(classify_item(&text_item), FileCategory::Text);

        let css_item = ManifestItem {
            id: "style".into(),
            href: "Styles/main.css".into(),
            media_type: "text/css".into(),
            properties: None,
        };
        assert_eq!(classify_item(&css_item), FileCategory::Css);

        let img_item = ManifestItem {
            id: "cover".into(),
            href: "Images/cover.jpg".into(),
            media_type: "image/jpeg".into(),
            properties: None,
        };
        assert_eq!(classify_item(&img_item), FileCategory::Image);

        let font_item = ManifestItem {
            id: "font1".into(),
            href: "Fonts/myfont.ttf".into(),
            media_type: "font/ttf".into(),
            properties: None,
        };
        assert_eq!(classify_item(&font_item), FileCategory::Font);
    }

    #[test]
    fn test_rewrite_xhtml_href() {
        let mut path_map = HashMap::new();
        path_map.insert(
            "OEBPS/Styles/main.css".to_string(),
            ("_encrypted.css".to_string(), FileCategory::Css),
        );

        let xhtml = r#"<link href="../Styles/main.css" type="text/css"/>"#;
        let result = rewrite_xhtml(xhtml, "OEBPS/Text/ch1.xhtml", &path_map);
        assert!(result.contains("../Styles/_encrypted.css"));
    }

    #[test]
    fn test_rewrite_xhtml_src() {
        let mut path_map = HashMap::new();
        path_map.insert(
            "OEBPS/Images/cover.jpg".to_string(),
            ("_encrypted.jpg".to_string(), FileCategory::Image),
        );

        let xhtml = r#"<img src="../Images/cover.jpg" alt="cover"/>"#;
        let result = rewrite_xhtml(xhtml, "OEBPS/Text/ch1.xhtml", &path_map);
        assert!(result.contains("../Images/_encrypted.jpg"));
    }

    #[test]
    fn test_rewrite_ignores_external_urls() {
        let path_map = HashMap::new();
        let xhtml = r#"<a href="https://example.com">link</a>"#;
        let result = rewrite_xhtml(xhtml, "OEBPS/Text/ch1.xhtml", &path_map);
        assert_eq!(result, xhtml);
    }
}
