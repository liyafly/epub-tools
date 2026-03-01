//! Image compression for EPUB files.
//!
//! Uses the `image` crate for JPEG/PNG compression.
//! Feature-gated behind `image-processing`.

// TODO: Sprint 2 — Implement image compression
//
// Compression levels (port from compressor.ts):
// - fast:     JPEG quality 85, PNG compression 6
// - balanced: JPEG quality 80, PNG compression 8
// - max:      JPEG quality 75 + mozjpeg, PNG compression 9
