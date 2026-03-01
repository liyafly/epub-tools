use std::path::PathBuf;

use clap::Args;
use tracing::info;

use epub_core::epub::parser::parse_epub_file;

/// Reformat EPUB to Sigil standard directory structure.
#[derive(Args)]
pub struct ReformatArgs {
    /// Path to the EPUB file
    pub input: PathBuf,

    /// Output path
    #[arg(short, long)]
    pub output: PathBuf,
}

pub fn run(args: ReformatArgs) -> anyhow::Result<()> {
    info!("Reformatting: {}", args.input.display());

    let epub = parse_epub_file(&args.input)?;
    info!(
        "Parsed EPUB: {} (version {})",
        epub.metadata.title.as_deref().unwrap_or("Unknown"),
        epub.metadata.version
    );
    info!("Manifest items: {}", epub.manifest.len());
    info!("Output: {}", args.output.display());

    // TODO: Full reformat pipeline (Sprint 2)
    info!("⚠️  Full reformat pipeline — implementation in progress");
    Ok(())
}
