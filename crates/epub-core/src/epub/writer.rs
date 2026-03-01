//! EPUB writer — packs files into a valid EPUB ZIP archive.
//!
//! Port of `packages/core/src/epub/writer.ts`.
//!
//! Key requirement: the `mimetype` entry must be the first file in the ZIP
//! and stored uncompressed (STORE method) per the EPUB specification.

use std::io::{Cursor, Write};
use std::path::Path;

use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

use crate::utils::error::Result;

/// Options for writing an EPUB file.
pub struct WriteOptions {
    /// Compression level for DEFLATE (0-9, default 6).
    pub compression_level: Option<i64>,
}

impl Default for WriteOptions {
    fn default() -> Self {
        Self {
            compression_level: Some(6),
        }
    }
}

/// Represents a file to be added to the EPUB archive.
pub struct EpubEntry {
    /// ZIP path (e.g. `OEBPS/Text/ch1.xhtml`).
    pub path: String,
    /// File content.
    pub data: Vec<u8>,
}

/// Build an EPUB archive from a list of entries and write it to disk.
///
/// The `mimetype` file is automatically prepended if not already present.
pub fn write_epub(entries: &[EpubEntry], output_path: &Path, opts: &WriteOptions) -> Result<()> {
    let buf = build_epub_bytes(entries, opts)?;
    std::fs::write(output_path, buf)?;
    Ok(())
}

/// Build an EPUB archive in memory and return the raw bytes.
pub fn build_epub_bytes(entries: &[EpubEntry], _opts: &WriteOptions) -> Result<Vec<u8>> {
    let buf = Vec::new();
    let cursor = Cursor::new(buf);
    let mut writer = zip::ZipWriter::new(cursor);

    let deflate_opts = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated);

    // 1. Write mimetype first, uncompressed (EPUB spec requirement)
    let store_opts = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Stored);
    writer.start_file("mimetype", store_opts)?;
    writer.write_all(b"application/epub+zip")?;

    // 2. Write all other entries
    for entry in entries {
        if entry.path == "mimetype" {
            continue; // Already written
        }
        writer.start_file(&entry.path, deflate_opts)?;
        writer.write_all(&entry.data)?;
    }

    let cursor = writer.finish()?;
    Ok(cursor.into_inner())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_epub_bytes_mimetype_first() {
        let entries = vec![
            EpubEntry {
                path: "META-INF/container.xml".into(),
                data: b"<container/>".to_vec(),
            },
            EpubEntry {
                path: "OEBPS/content.opf".into(),
                data: b"<package/>".to_vec(),
            },
        ];

        let bytes = build_epub_bytes(&entries, &WriteOptions::default()).unwrap();

        // Verify it's a valid zip and mimetype is first entry
        let cursor = std::io::Cursor::new(bytes.as_slice());
        let mut archive = zip::ZipArchive::new(cursor).unwrap();
        assert_eq!(archive.by_index(0).unwrap().name(), "mimetype");

        // Verify mimetype content
        {
            let mut mimetype = archive.by_name("mimetype").unwrap();
            let mut content = String::new();
            std::io::Read::read_to_string(&mut mimetype, &mut content).unwrap();
            assert_eq!(content, "application/epub+zip");
        }

        // Verify other files exist
        assert!(archive.by_name("META-INF/container.xml").is_ok());
        assert!(archive.by_name("OEBPS/content.opf").is_ok());
    }

    #[test]
    fn test_mimetype_not_duplicated() {
        let entries = vec![
            EpubEntry {
                path: "mimetype".into(),
                data: b"application/epub+zip".to_vec(),
            },
            EpubEntry {
                path: "OEBPS/content.opf".into(),
                data: b"<package/>".to_vec(),
            },
        ];

        let bytes = build_epub_bytes(&entries, &WriteOptions::default()).unwrap();
        let cursor = std::io::Cursor::new(bytes.as_slice());
        let archive = zip::ZipArchive::new(cursor).unwrap();
        // Should have 2 entries: mimetype + content.opf (mimetype not duplicated)
        assert_eq!(archive.len(), 2);
    }
}
