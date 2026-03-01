//! WebP ↔ JPG/PNG image format conversion.
//!
//! Uses the `image` crate (pure Rust) instead of `sharp` (libvips).
//! Feature-gated behind `image-processing`.

// TODO: Sprint 2 — Implement WebP conversion using `image` crate
//
// Key logic (port from webp-converter.ts):
// 1. Parse EPUB, find all WebP images in manifest
// 2. For each WebP image:
//    - Decode with image::load_from_memory
//    - If has alpha channel → save as PNG
//    - If no alpha → save as JPEG
// 3. Update manifest media-type and href
// 4. Rewrite references in XHTML/CSS
// 5. Repack EPUB
