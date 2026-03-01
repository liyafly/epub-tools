use std::path::PathBuf;

use clap::Args;
use tracing::info;

use epub_core::epub::parser::parse_epub_file;

/// Decrypt (de-obfuscate) EPUB filenames.
#[derive(Args)]
pub struct DecryptArgs {
    /// Path to the EPUB file
    pub input: PathBuf,

    /// Output path
    #[arg(short, long)]
    pub output: PathBuf,
}

pub fn run(args: DecryptArgs) -> anyhow::Result<()> {
    info!("Decrypting: {}", args.input.display());

    let epub = parse_epub_file(&args.input)?;
    info!(
        "Parsed EPUB: {} (version {})",
        epub.metadata.title.as_deref().unwrap_or("Unknown"),
        epub.metadata.version
    );
    info!("Manifest items: {}", epub.manifest.len());
    info!("Output: {}", args.output.display());

    // TODO: Full decryption pipeline (Sprint 1 continuation)
    info!("⚠️  Full decryption pipeline — implementation in progress");
    Ok(())
}
