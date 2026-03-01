//! # epub-core
//!
//! EPUB processing core library — pure Rust, shared across CLI / Desktop GUI / Mobile.
//!
//! ## Modules
//! - `epub` — EPUB parsing, writing, reformatting, version upgrade
//! - `crypto` — filename encryption / decryption
//! - `image` — WebP conversion, image compression (feature-gated)
//! - `utils` — logging, error types

pub mod crypto;
pub mod epub;
pub mod utils;

#[cfg(feature = "image-processing")]
pub mod image;
