//! EPUB parser — reads and parses EPUB files using `zip` + `quick-xml`.
//!
//! Port of `packages/core/src/epub/parser.ts`.

use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::Reader;

use crate::utils::error::{EpubError, Result};

// ─── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct EpubMetadata {
    pub title: Option<String>,
    pub creator: Option<String>,
    pub language: Option<String>,
    pub identifier: Option<String>,
    pub publisher: Option<String>,
    pub date: Option<String>,
    pub version: String,
}

#[derive(Debug, Clone)]
pub struct ManifestItem {
    pub id: String,
    pub href: String,
    pub media_type: String,
    pub properties: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SpineItem {
    pub idref: String,
    pub linear: Option<String>,
}

/// A parsed EPUB file, holding the raw zip bytes and parsed metadata/manifest/spine.
pub struct ParsedEpub {
    /// Raw ZIP bytes (kept for re-packing)
    pub zip_data: Vec<u8>,
    pub metadata: EpubMetadata,
    pub manifest: HashMap<String, ManifestItem>,
    pub spine: Vec<SpineItem>,
    pub opf_path: String,
    pub opf_dir: String,
    pub raw_opf: String,
}

impl ParsedEpub {
    /// Convenience: open the zip archive for reading.
    pub fn zip_archive(
        &self,
    ) -> Result<zip::ZipArchive<std::io::Cursor<&[u8]>>> {
        let cursor = std::io::Cursor::new(self.zip_data.as_slice());
        zip::ZipArchive::new(cursor).map_err(EpubError::Zip)
    }

    /// Read a file from the zip by its zip-path.
    pub fn read_zip_file(&self, path: &str) -> Result<Vec<u8>> {
        let mut archive = self.zip_archive()?;
        let mut file = archive
            .by_name(path)
            .map_err(EpubError::Zip)?;
        let mut buf = Vec::with_capacity(file.size() as usize);
        file.read_to_end(&mut buf)?;
        Ok(buf)
    }

    /// Read a text file from the zip.
    pub fn read_zip_text(&self, path: &str) -> Result<String> {
        let bytes = self.read_zip_file(path)?;
        String::from_utf8(bytes)
            .map_err(|e| EpubError::Structure(format!("Invalid UTF-8 in {path}: {e}")))
    }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/// Parse an EPUB file from disk.
pub fn parse_epub_file(path: &Path) -> Result<ParsedEpub> {
    let data = std::fs::read(path)?;
    parse_epub_bytes(data)
}

/// Parse an EPUB from raw bytes.
pub fn parse_epub_bytes(data: Vec<u8>) -> Result<ParsedEpub> {
    let cursor = std::io::Cursor::new(data.as_slice());
    let mut archive = zip::ZipArchive::new(cursor).map_err(EpubError::Zip)?;

    // 1. Read container.xml to find OPF path
    let container_xml = read_zip_text(&mut archive, "META-INF/container.xml")?;
    let opf_path = extract_opf_path(&container_xml)?;
    let opf_dir = if let Some(idx) = opf_path.rfind('/') {
        opf_path[..idx].to_string()
    } else {
        String::new()
    };

    // 2. Read and parse OPF
    let raw_opf = read_zip_text(&mut archive, &opf_path)?;
    let (metadata, manifest, spine) = parse_opf(&raw_opf)?;

    Ok(ParsedEpub {
        zip_data: data,
        metadata,
        manifest,
        spine,
        opf_path,
        opf_dir,
        raw_opf,
    })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

fn read_zip_text(
    archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>,
    name: &str,
) -> Result<String> {
    let mut file = archive
        .by_name(name)
        .map_err(|_| EpubError::Structure(format!("Missing file: {name}")))?;
    let mut buf = String::with_capacity(file.size() as usize);
    file.read_to_string(&mut buf)?;
    Ok(buf)
}

/// Extract the OPF full-path from container.xml.
fn extract_opf_path(container_xml: &str) -> Result<String> {
    let mut reader = Reader::from_str(container_xml);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e))
                if e.name().as_ref() == b"rootfile" =>
            {
                for attr in e.attributes().flatten() {
                    if attr.key.as_ref() == b"full-path" {
                        let val = attr.unescape_value()
                            .map_err(|e| EpubError::Xml(e.to_string()))?;
                        return Ok(val.into_owned());
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(EpubError::Xml(format!("XML parse error: {e}"))),
            _ => {}
        }
        buf.clear();
    }

    Err(EpubError::Structure(
        "Invalid EPUB: cannot locate OPF path in container.xml".into(),
    ))
}

/// Parse the OPF document, extracting metadata, manifest, and spine.
fn parse_opf(
    opf_xml: &str,
) -> Result<(EpubMetadata, HashMap<String, ManifestItem>, Vec<SpineItem>)> {
    let mut reader = Reader::from_str(opf_xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();

    let mut metadata = EpubMetadata::default();
    let mut manifest = HashMap::new();
    let mut spine = Vec::new();

    // Track context for nested text extraction
    enum Context {
        None,
        Title,
        Creator,
        Language,
        Identifier,
        Publisher,
        Date,
    }
    let mut ctx = Context::None;
    let mut in_package = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                let local = local_name(name.as_ref());
                match local {
                    b"package" => {
                        in_package = true;
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"version" {
                                metadata.version = attr.unescape_value()
                                    .unwrap_or_default()
                                    .into_owned();
                            }
                        }
                    }
                    b"title" if in_package => ctx = Context::Title,
                    b"creator" if in_package => ctx = Context::Creator,
                    b"language" if in_package => ctx = Context::Language,
                    b"identifier" if in_package => ctx = Context::Identifier,
                    b"publisher" if in_package => ctx = Context::Publisher,
                    b"date" if in_package => ctx = Context::Date,
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = e.name();
                let local = local_name(name.as_ref());
                if local == b"item" {
                    if let Some(item) = parse_manifest_item(e) {
                        manifest.insert(item.id.clone(), item);
                    }
                } else if local == b"itemref" {
                    if let Some(si) = parse_spine_item(e) {
                        spine.push(si);
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = e.unescape().unwrap_or_default().trim().to_string();
                if !text.is_empty() {
                    match ctx {
                        Context::Title => metadata.title = Some(text),
                        Context::Creator => metadata.creator = Some(text),
                        Context::Language => metadata.language = Some(text),
                        Context::Identifier => metadata.identifier = Some(text),
                        Context::Publisher => metadata.publisher = Some(text),
                        Context::Date => metadata.date = Some(text),
                        Context::None => {}
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name();
                let local = local_name(name.as_ref());
                match local {
                    b"title" | b"creator" | b"language" | b"identifier" | b"publisher"
                    | b"date" => {
                        ctx = Context::None;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(EpubError::Xml(format!("OPF parse error: {e}"))),
            _ => {}
        }
        buf.clear();
    }

    if metadata.version.is_empty() {
        metadata.version = "2.0".to_string();
    }

    Ok((metadata, manifest, spine))
}

fn parse_manifest_item(e: &quick_xml::events::BytesStart<'_>) -> Option<ManifestItem> {
    let mut id = None;
    let mut href = None;
    let mut media_type = None;
    let mut properties = None;

    for attr in e.attributes().flatten() {
        match attr.key.as_ref() {
            b"id" => id = Some(attr.unescape_value().ok()?.into_owned()),
            b"href" => href = Some(attr.unescape_value().ok()?.into_owned()),
            b"media-type" => media_type = Some(attr.unescape_value().ok()?.into_owned()),
            b"properties" => properties = Some(attr.unescape_value().ok()?.into_owned()),
            _ => {}
        }
    }

    Some(ManifestItem {
        id: id?,
        href: href?,
        media_type: media_type?,
        properties,
    })
}

fn parse_spine_item(e: &quick_xml::events::BytesStart<'_>) -> Option<SpineItem> {
    let mut idref = None;
    let mut linear = None;

    for attr in e.attributes().flatten() {
        match attr.key.as_ref() {
            b"idref" => idref = Some(attr.unescape_value().ok()?.into_owned()),
            b"linear" => linear = Some(attr.unescape_value().ok()?.into_owned()),
            _ => {}
        }
    }

    Some(SpineItem {
        idref: idref?,
        linear,
    })
}

/// Strip namespace prefix: `dc:title` → `title`, `opf:package` → `package`.
fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_opf_path() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>"#;
        let path = extract_opf_path(xml).unwrap();
        assert_eq!(path, "OEBPS/content.opf");
    }

    #[test]
    fn test_extract_opf_path_no_dir() {
        let xml = r#"<?xml version="1.0"?>
        <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>"#;
        let path = extract_opf_path(xml).unwrap();
        assert_eq!(path, "content.opf");
    }

    #[test]
    fn test_parse_opf_metadata() {
        let opf = r#"<?xml version="1.0" encoding="UTF-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Test Book</dc:title>
            <dc:creator>Author Name</dc:creator>
            <dc:language>zh</dc:language>
          </metadata>
          <manifest>
            <item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>
            <item id="style" href="Styles/main.css" media-type="text/css"/>
            <item id="cover" href="Images/cover.jpg" media-type="image/jpeg"/>
          </manifest>
          <spine>
            <itemref idref="ch1"/>
          </spine>
        </package>"#;

        let (meta, manifest, spine) = parse_opf(opf).unwrap();
        assert_eq!(meta.title.as_deref(), Some("Test Book"));
        assert_eq!(meta.creator.as_deref(), Some("Author Name"));
        assert_eq!(meta.language.as_deref(), Some("zh"));
        assert_eq!(meta.version, "3.0");
        assert_eq!(manifest.len(), 3);
        assert_eq!(manifest["ch1"].href, "Text/ch1.xhtml");
        assert_eq!(manifest["style"].media_type, "text/css");
        assert_eq!(spine.len(), 1);
        assert_eq!(spine[0].idref, "ch1");
    }

    #[test]
    fn test_local_name() {
        assert_eq!(local_name(b"dc:title"), b"title");
        assert_eq!(local_name(b"package"), b"package");
        assert_eq!(local_name(b"opf:package"), b"package");
    }
}
