//! Filename decryption (de-obfuscation) for EPUB files.
//!
//! Port of `packages/core/src/crypto/decrypt.ts`.
//!
//! Reverses the encrypted filenames back to human-readable names derived from
//! the manifest item IDs.

use std::collections::{HashMap, HashSet};

use md5::{Digest, Md5};

use crate::epub::parser::ManifestItem;

use super::encrypt::{classify_item, FileCategory};

// ─── Types ────────────────────────────────────────────────────────────────────

/// Result of a decryption operation.
#[derive(Debug)]
pub struct DecryptResult {
    pub success: bool,
    pub files_decrypted: usize,
    /// old bookpath → new bookpath
    pub mapping: HashMap<String, String>,
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/// Characters that are invalid in filenames.
fn has_invalid_chars(s: &str) -> bool {
    s.chars().any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
}

/// Strip various "slim" suffixes from a string.
fn strip_slim_suffix(s: &str) -> &str {
    let lower = s.to_lowercase();
    for suffix in &["~slim", "-slim", "_slim", "slim"] {
        if lower.ends_with(suffix) {
            return &s[..s.len() - suffix.len()];
        }
    }
    s
}

/// Get file extension (with dot) from a path.
fn get_ext(path: &str) -> &str {
    if let Some(dot_idx) = path.rfind('.') {
        &path[dot_idx..]
    } else {
        ""
    }
}

/// Get the basename without extension from a path.
fn basename_without_ext(path: &str) -> &str {
    let basename = path.rsplit('/').next().unwrap_or(path);
    if let Some(dot_idx) = basename.rfind('.') {
        &basename[..dot_idx]
    } else {
        basename
    }
}

/// Reverse an encrypted filename back to a readable name.
///
/// Port of TS `buildDecryptedFilename`.
pub fn build_decrypted_filename(id: &str, href: &str) -> String {
    let href_ext = get_ext(href).to_lowercase();

    let dot_idx = id.find('.');
    if dot_idx.is_none() {
        // ID has no extension — use whole ID as name
        let mut id_name = id;
        let mut slim_suffix = "";
        if id_name.to_lowercase().ends_with("slim") {
            slim_suffix = "~slim";
            id_name = strip_slim_suffix(id_name);
        }
        return format!("{id_name}{slim_suffix}{href_ext}");
    }

    // ID has extension, e.g. "chapter1.xhtml"
    let last_dot = id.rfind('.').unwrap();
    let mut id_name = id[..last_dot].to_string();
    let mut id_ext = id[last_dot..].to_lowercase();

    // If ID ext disagrees with href ext, prefer href ext
    if id_ext != href_ext {
        id_ext = href_ext.to_string();
    }

    // Handle slim suffix
    let mut slim_suffix = "";
    let href_base = basename_without_ext(href);
    if href_base.to_lowercase().ends_with("slim")
        || id_name.to_lowercase().ends_with("slim")
    {
        slim_suffix = "~slim";
        let stripped = strip_slim_suffix(&id_name);
        id_name = stripped.to_string();
    }

    // If name contains invalid filesystem chars, MD5 hash it
    if has_invalid_chars(&id_name) {
        let mut hasher = Md5::new();
        hasher.update(id_name.as_bytes());
        let hash = hasher.finalize();
        id_name = format!("{:x}", hash);
    }

    format!("{id_name}{slim_suffix}{id_ext}")
}

/// Build a decryption path mapping for all manifest items.
///
/// Returns: `(path_map, href_to_new)` where:
/// - `path_map`: old bookpath → (new_basename, category)
/// - `href_to_new`: old OPF-relative href → new decrypted basename
pub fn build_decrypt_path_map(
    manifest: &HashMap<String, ManifestItem>,
    toc_id: &str,
    opf_dir: &str,
) -> (
    HashMap<String, (String, FileCategory)>,
    HashMap<String, String>,
    Option<String>, // toc_book_path
) {
    let mut path_map: HashMap<String, (String, FileCategory)> = HashMap::new();
    let mut href_to_new: HashMap<String, String> = HashMap::new();
    let mut used_names: HashMap<FileCategory, HashSet<String>> = HashMap::new();
    let mut toc_book_path = None;

    for (id, item) in manifest {
        if !toc_id.is_empty() && id == toc_id {
            toc_book_path = Some(if opf_dir.is_empty() {
                item.href.clone()
            } else {
                format!("{}/{}", opf_dir, item.href)
            });
            continue;
        }

        let category = classify_item(item);
        let mut new_name = build_decrypted_filename(id, &item.href);

        // Ensure uniqueness within category
        let name_set = used_names.entry(category).or_default();
        if name_set.contains(&new_name) {
            let ext_idx = new_name.rfind('.').unwrap_or(new_name.len());
            let base = new_name[..ext_idx].to_string();
            let ext = new_name[ext_idx..].to_string();
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

    (path_map, href_to_new, toc_book_path)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_decrypted_filename_with_ext() {
        let name = build_decrypted_filename("chapter1.xhtml", "Text/chapter1.xhtml");
        assert_eq!(name, "chapter1.xhtml");
    }

    #[test]
    fn test_build_decrypted_filename_no_ext() {
        let name = build_decrypted_filename("chapter1", "Text/chapter1.xhtml");
        assert_eq!(name, "chapter1.xhtml");
    }

    #[test]
    fn test_build_decrypted_filename_slim() {
        let name = build_decrypted_filename("cover_slim.jpg", "Images/cover_slim.jpg");
        assert!(name.contains("~slim"));
        assert!(name.ends_with(".jpg"));
    }

    #[test]
    fn test_build_decrypted_filename_invalid_chars() {
        let name = build_decrypted_filename("bad:name*.xhtml", "Text/bad.xhtml");
        // Should fall back to MD5 hash
        assert!(name.ends_with(".xhtml"));
        assert!(!has_invalid_chars(&name));
    }

    #[test]
    fn test_strip_slim_suffix() {
        assert_eq!(strip_slim_suffix("chapter1~slim"), "chapter1");
        assert_eq!(strip_slim_suffix("chapter1-slim"), "chapter1");
        assert_eq!(strip_slim_suffix("chapter1_slim"), "chapter1");
        assert_eq!(strip_slim_suffix("chapter1slim"), "chapter1");
        assert_eq!(strip_slim_suffix("chapter1"), "chapter1");
    }

    #[test]
    fn test_has_invalid_chars() {
        assert!(has_invalid_chars("a:b"));
        assert!(has_invalid_chars("a*b"));
        assert!(!has_invalid_chars("normal_name"));
    }
}
