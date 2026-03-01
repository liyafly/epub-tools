//! Robust XML utilities for handling malformed EPUB XML.
//!
//! Ported from cnwxi/epub_tool commit 52bc964 — handles:
//! - BOM detection + multi-encoding fallback (UTF-8 → GB18030 → Latin-1)
//! - Sanitisation of bare `<` / `>` in XML attribute values
//! - Safe XML parsing with sanitisation retry
//! - DRM encryption detection via `META-INF/encryption.xml`

use regex::Regex;
use std::sync::LazyLock;
use tracing::warn;

use crate::utils::error::{EpubError, Result};

// ─── BOM & encoding ──────────────────────────────────────────────────────────

const BOM_UTF8: &[u8] = &[0xEF, 0xBB, 0xBF];
const BOM_UTF16_LE: &[u8] = &[0xFF, 0xFE];
const BOM_UTF16_BE: &[u8] = &[0xFE, 0xFF];

/// Decode raw bytes to a String, stripping BOM and falling back through
/// multiple encodings: UTF-8(-sig) → UTF-16 → GB18030 → Latin-1.
/// Also strips XML-illegal control characters.
pub fn decode_xml_bytes(data: &[u8]) -> String {
    // Determine the priority order based on BOM
    let result = if data.starts_with(BOM_UTF8) {
        // Strip BOM and decode as UTF-8
        String::from_utf8(data[3..].to_vec()).ok()
    } else if data.starts_with(BOM_UTF16_LE) {
        decode_utf16(data, encoding_rs::UTF_16LE)
    } else if data.starts_with(BOM_UTF16_BE) {
        decode_utf16(data, encoding_rs::UTF_16BE)
    } else {
        None
    };

    if let Some(s) = result {
        return strip_control_chars(&s);
    }

    // Try UTF-8 first
    if let Ok(s) = std::str::from_utf8(data) {
        return strip_control_chars(s);
    }

    // Try GB18030
    let (decoded, _, had_errors) = encoding_rs::GB18030.decode(data);
    if !had_errors {
        return strip_control_chars(&decoded);
    }

    // Ultimate fallback: Latin-1 (never fails)
    let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(data);
    strip_control_chars(&decoded)
}

fn decode_utf16(data: &[u8], encoding: &'static encoding_rs::Encoding) -> Option<String> {
    let (decoded, _, had_errors) = encoding.decode(data);
    if had_errors {
        None
    } else {
        Some(decoded.into_owned())
    }
}

/// Remove XML-illegal control characters (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F).
fn strip_control_chars(s: &str) -> String {
    static RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"[\x00-\x08\x0b\x0c\x0e-\x1f]").unwrap());
    RE.replace_all(s, "").into_owned()
}

// ─── XML attribute sanitisation ──────────────────────────────────────────────

/// Escape bare `<` and `>` inside XML attribute values so that standard XML
/// parsers don't choke on malformed OPF files.
pub fn sanitize_xml_attr_text(xml_text: &str) -> String {
    // Match XML tags with attributes
    static TAG_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(
            r#"(?s)(<[^>]+?)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)+)(\s*/?>)"#,
        )
        .unwrap()
    });
    // Match double-quoted attribute values
    static DQ_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r#"(?s)(=\s*")([^"]*?)(")"#).unwrap());
    // Match single-quoted attribute values
    static SQ_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(?s)(=\s*')([^']*?)(')").unwrap());

    TAG_RE
        .replace_all(xml_text, |caps: &regex::Captures| {
            let prefix = &caps[1];
            let attrs_raw = &caps[2];
            let suffix = &caps[3];

            // Sanitise double-quoted attributes
            let attrs = DQ_RE.replace_all(attrs_raw, |acaps: &regex::Captures| {
                format!(
                    "{}{}{}",
                    &acaps[1],
                    sanitize_attr_value(&acaps[2]),
                    &acaps[3]
                )
            });
            // Sanitise single-quoted attributes
            let attrs = SQ_RE.replace_all(&attrs, |acaps: &regex::Captures| {
                format!(
                    "{}{}{}",
                    &acaps[1],
                    sanitize_attr_value(&acaps[2]),
                    &acaps[3]
                )
            });

            format!("{prefix}{attrs}{suffix}")
        })
        .into_owned()
}

/// Escape bare `<` and `>` inside an attribute value.
fn sanitize_attr_value(value: &str) -> String {
    // Only escape if there are actual bare < or >
    if !value.contains('<') && !value.contains('>') {
        return value.to_string();
    }
    value.replace('<', "&lt;").replace('>', "&gt;")
}

// ─── Safe XML parsing ────────────────────────────────────────────────────────

/// Try to parse XML using quick-xml. If it fails, sanitise attribute values and
/// retry. Returns `Err` only if both attempts fail.
pub fn parse_xml_safe(xml_text: &str) -> Result<String> {
    // First try: parse as-is
    if quick_xml_validates(xml_text) {
        return Ok(xml_text.to_string());
    }

    // Second try: sanitise attributes
    warn!("XML parse failed, attempting attribute sanitisation");
    let sanitized = sanitize_xml_attr_text(xml_text);
    if quick_xml_validates(&sanitized) {
        return Ok(sanitized);
    }

    Err(EpubError::Xml(
        "XML still malformed after attribute sanitisation".into(),
    ))
}

/// Quick validation: try to parse the full document with quick-xml.
fn quick_xml_validates(xml: &str) -> bool {
    let mut reader = quick_xml::Reader::from_str(xml);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Eof) => return true,
            Err(_) => return false,
            _ => {}
        }
        buf.clear();
    }
}

// ─── DRM / encryption detection ──────────────────────────────────────────────

/// Information about EPUB encryption (DRM).
#[derive(Debug, Clone, Default)]
pub struct EncryptionInfo {
    /// Whether encryption.xml exists and lists encrypted resources.
    pub has_encryption: bool,
    /// Whether Text/ or Styles/ (CSS) resources are encrypted (i.e. the EPUB
    /// content itself is DRM-protected and cannot be processed).
    pub encrypted_text_or_css: bool,
    /// Number of encrypted resource URIs found.
    pub encrypted_count: usize,
    /// Sample of encrypted URIs (up to 10).
    pub sample_uris: Vec<String>,
}

/// Check `META-INF/encryption.xml` inside the ZIP for DRM-encrypted resources.
pub fn detect_encryption(
    archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>,
) -> EncryptionInfo {
    let encryption_xml = match read_zip_bytes(archive, "META-INF/encryption.xml") {
        Ok(bytes) => decode_xml_bytes(&bytes),
        Err(_) => return EncryptionInfo::default(), // No encryption.xml → not encrypted
    };

    // Extract CipherReference URIs
    static URI_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?i)<CipherReference\s+URI\s*=\s*["']([^"']+)["']"#).unwrap()
    });

    let uris: Vec<String> = URI_RE
        .captures_iter(&encryption_xml)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect();

    if uris.is_empty() {
        return EncryptionInfo::default();
    }

    let encrypted_text_or_css = uris.iter().any(|u| {
        let lower = u.to_lowercase();
        lower.starts_with("text/") || lower.starts_with("styles/")
            || lower.ends_with(".xhtml") || lower.ends_with(".html")
            || lower.ends_with(".css")
    });

    let sample_uris = uris.iter().take(10).cloned().collect();
    let encrypted_count = uris.len();

    EncryptionInfo {
        has_encryption: true,
        encrypted_text_or_css,
        encrypted_count,
        sample_uris,
    }
}

/// Read raw bytes from a zip entry.
fn read_zip_bytes(
    archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>,
    name: &str,
) -> Result<Vec<u8>> {
    use std::io::Read;
    let mut file = archive
        .by_name(name)
        .map_err(|_| EpubError::Structure(format!("Missing file: {name}")))?;
    let mut buf = Vec::with_capacity(file.size() as usize);
    file.read_to_end(&mut buf)?;
    Ok(buf)
}

// ─── Regex-based fallback OPF parsing ────────────────────────────────────────

use std::collections::HashMap;

use super::parser::{EpubMetadata, ManifestItem, SpineItem};

/// Fallback: extract manifest + spine from OPF text using regex when the XML
/// parser fails on malformed documents.
pub fn fallback_parse_opf(
    opf_text: &str,
) -> Result<(EpubMetadata, HashMap<String, ManifestItem>, Vec<SpineItem>)> {
    warn!("OPF XML parse failed, using regex fallback parser");

    let mut metadata = EpubMetadata::default();

    // Try to extract version
    static VERSION_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?i)<package[^>]*\bversion\s*=\s*["']([^"']+)["']"#).unwrap()
    });
    if let Some(caps) = VERSION_RE.captures(opf_text) {
        metadata.version = caps[1].to_string();
    } else {
        metadata.version = "2.0".to_string();
    }

    // Extract simple metadata fields
    metadata.title = extract_simple_tag(opf_text, "title");
    metadata.creator = extract_simple_tag(opf_text, "creator");
    metadata.language = extract_simple_tag(opf_text, "language");
    metadata.identifier = extract_simple_tag(opf_text, "identifier");
    metadata.publisher = extract_simple_tag(opf_text, "publisher");
    metadata.date = extract_simple_tag(opf_text, "date");

    // Extract manifest items
    let mut manifest = HashMap::new();

    static MANIFEST_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?is)<manifest\b[^>]*>(.*?)</manifest>").unwrap()
    });
    static ITEM_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(?is)<item\b(.*?)/?>").unwrap());

    if let Some(m_caps) = MANIFEST_RE.captures(opf_text) {
        let manifest_body = &m_caps[1];
        for item_caps in ITEM_RE.captures_iter(manifest_body) {
            let attrs = parse_tag_attrs(&item_caps[1]);
            let id = match attrs.get("id") {
                Some(v) => v.clone(),
                None => continue,
            };
            let href = match attrs.get("href") {
                Some(v) => urlencoding_decode(v),
                None => continue,
            };
            let media_type = attrs.get("media-type").cloned().unwrap_or_default();
            let properties = attrs.get("properties").cloned();
            manifest.insert(
                id.clone(),
                ManifestItem {
                    id,
                    href,
                    media_type,
                    properties,
                },
            );
        }
    }

    // Extract spine
    let mut spine = Vec::new();

    static SPINE_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?is)<spine\b[^>]*>(.*?)</spine>").unwrap()
    });
    static ITEMREF_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(?is)<itemref\b(.*?)/?>").unwrap());

    if let Some(s_caps) = SPINE_RE.captures(opf_text) {
        let spine_body = &s_caps[1];
        for iref_caps in ITEMREF_RE.captures_iter(spine_body) {
            let attrs = parse_tag_attrs(&iref_caps[1]);
            let idref = match attrs.get("idref") {
                Some(v) => v.clone(),
                None => continue,
            };
            let linear = attrs.get("linear").cloned();
            spine.push(SpineItem { idref, linear });
        }
    }

    Ok((metadata, manifest, spine))
}

/// Parse HTML/XML-style attributes from a tag body using regex.
fn parse_tag_attrs(text: &str) -> HashMap<String, String> {
    static ATTR_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?s)([:\w.-]+)\s*=\s*(["'])(.*?)\2"#).unwrap()
    });

    let mut attrs = HashMap::new();
    for caps in ATTR_RE.captures_iter(text) {
        attrs.insert(caps[1].to_string(), caps[3].to_string());
    }
    attrs
}

/// Extract text content of a simple dc: tag like `<dc:title>...</dc:title>`.
fn extract_simple_tag(opf_text: &str, local_name: &str) -> Option<String> {
    let pattern = format!(
        r"(?is)<(?:dc:)?{local_name}[^>]*>(.*?)</(?:dc:)?{local_name}>"
    );
    let re = Regex::new(&pattern).ok()?;
    re.captures(opf_text)
        .and_then(|c| {
            let text = c[1].trim().to_string();
            if text.is_empty() { None } else { Some(text) }
        })
}

/// Simple URL-decode for href values.
fn urlencoding_decode(s: &str) -> String {
    percent_encoding_decode(s)
}

fn percent_encoding_decode(input: &str) -> String {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &input[i + 1..i + 3],
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| input.to_string())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_xml_bytes_utf8() {
        let s = "Hello 你好";
        assert_eq!(decode_xml_bytes(s.as_bytes()), "Hello 你好");
    }

    #[test]
    fn test_decode_xml_bytes_with_bom() {
        let mut data = vec![0xEF, 0xBB, 0xBF]; // UTF-8 BOM
        data.extend_from_slice("Hello".as_bytes());
        assert_eq!(decode_xml_bytes(&data), "Hello");
    }

    #[test]
    fn test_decode_xml_bytes_strips_control_chars() {
        let mut data = b"Hello\x01World".to_vec();
        assert_eq!(decode_xml_bytes(&data), "HelloWorld");
    }

    #[test]
    fn test_sanitize_attr_value_bare_angle_brackets() {
        let xml = r#"<item href="file<1>.xhtml" media-type="text/xml"/>"#;
        let sanitized = sanitize_xml_attr_text(xml);
        assert!(sanitized.contains("&lt;"));
        assert!(sanitized.contains("&gt;"));
        assert!(!sanitized.contains("file<1>"));
    }

    #[test]
    fn test_sanitize_attr_value_no_change_needed() {
        let xml = r#"<item href="file.xhtml" media-type="text/xml"/>"#;
        let sanitized = sanitize_xml_attr_text(xml);
        assert_eq!(sanitized, xml);
    }

    #[test]
    fn test_fallback_parse_opf_basic() {
        let opf = r#"<?xml version="1.0" encoding="UTF-8"?>
        <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Test Book</dc:title>
            <dc:creator>Author</dc:creator>
          </metadata>
          <manifest>
            <item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>
            <item id="style" href="Styles/main.css" media-type="text/css"/>
          </manifest>
          <spine>
            <itemref idref="ch1"/>
          </spine>
        </package>"#;

        let (meta, manifest, spine) = fallback_parse_opf(opf).unwrap();
        assert_eq!(meta.title.as_deref(), Some("Test Book"));
        assert_eq!(meta.creator.as_deref(), Some("Author"));
        assert_eq!(meta.version, "3.0");
        assert_eq!(manifest.len(), 2);
        assert!(manifest.contains_key("ch1"));
        assert!(manifest.contains_key("style"));
        assert_eq!(spine.len(), 1);
        assert_eq!(spine[0].idref, "ch1");
    }

    #[test]
    fn test_encryption_detection_no_file() {
        // Create a minimal zip without encryption.xml
        let buf = Vec::new();
        let cursor = std::io::Cursor::new(buf);
        let mut writer = zip::ZipWriter::new(cursor);
        let opts = zip::write::SimpleFileOptions::default();
        writer.start_file("mimetype", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"application/epub+zip").unwrap();
        let cursor = writer.finish().unwrap();
        let data = cursor.into_inner();

        let read_cursor = std::io::Cursor::new(data.as_slice());
        let mut archive = zip::ZipArchive::new(read_cursor).unwrap();
        let info = detect_encryption(&mut archive);
        assert!(!info.has_encryption);
        assert!(!info.encrypted_text_or_css);
    }

    #[test]
    fn test_encryption_detection_with_encrypted_resources() {
        let buf = Vec::new();
        let cursor = std::io::Cursor::new(buf);
        let mut writer = zip::ZipWriter::new(cursor);
        let opts = zip::write::SimpleFileOptions::default();
        writer.start_file("mimetype", opts).unwrap();
        std::io::Write::write_all(&mut writer, b"application/epub+zip").unwrap();
        writer
            .start_file("META-INF/encryption.xml", opts)
            .unwrap();
        std::io::Write::write_all(
            &mut writer,
            br#"<?xml version="1.0" encoding="UTF-8"?>
            <encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
              <EncryptedData>
                <CipherData>
                  <CipherReference URI="Text/chapter1.xhtml"/>
                </CipherData>
              </EncryptedData>
              <EncryptedData>
                <CipherData>
                  <CipherReference URI="Styles/style.css"/>
                </CipherData>
              </EncryptedData>
            </encryption>"#,
        )
        .unwrap();
        let cursor = writer.finish().unwrap();
        let data = cursor.into_inner();

        let read_cursor = std::io::Cursor::new(data.as_slice());
        let mut archive = zip::ZipArchive::new(read_cursor).unwrap();
        let info = detect_encryption(&mut archive);
        assert!(info.has_encryption);
        assert!(info.encrypted_text_or_css);
        assert_eq!(info.encrypted_count, 2);
    }

    #[test]
    fn test_percent_decode() {
        assert_eq!(
            percent_encoding_decode("hello%20world%21"),
            "hello world!"
        );
        assert_eq!(percent_encoding_decode("no_encoding"), "no_encoding");
    }
}
