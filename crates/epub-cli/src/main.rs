mod commands;

use clap::Parser;
use tracing_subscriber::EnvFilter;

/// EPUB Tools — cross-platform EPUB processing toolkit (Rust core)
#[derive(Parser)]
#[command(name = "epub-tools", version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: commands::Commands,
}

fn main() -> anyhow::Result<()> {
    // Initialize tracing with EPUB_LOG env var or default to info
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_env("EPUB_LOG")
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    commands::execute(cli.command)
}
