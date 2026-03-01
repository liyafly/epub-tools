use std::path::PathBuf;

use clap::Args;
use tracing::info;

use epub_core::crypto::encrypt::generate_encrypted_name;
use epub_core::epub::parser::parse_epub_file;

/// Encrypt (obfuscate) EPUB filenames.
#[derive(Args)]
pub struct EncryptArgs {
    /// Path to the EPUB file
    pub input: PathBuf,

    /// Output path
    #[arg(short, long)]
    pub output: PathBuf,
}

pub fn run(args: EncryptArgs) -> anyhow::Result<()> {
    info!("Encrypting: {}", args.input.display());

    let epub = parse_epub_file(&args.input)?;
    info!(
        "Parsed EPUB: {} (version {})",
        epub.metadata.title.as_deref().unwrap_or("Unknown"),
        epub.metadata.version
    );
    info!("Manifest items: {}", epub.manifest.len());
    info!("Output: {}", args.output.display());

    // TODO: Full encryption pipeline (Sprint 1 continuation)
    // For now, demonstrate the core algorithm works
    for (id, item) in &epub.manifest {
        let encrypted = generate_encrypted_name(id);
        info!("  {} → _{}.{}", item.href, &encrypted[..20], "...");
    }

    info!("⚠️  Full encryption pipeline — implementation in progress");
    Ok(())
}
