use std::path::PathBuf;

use clap::Args;
use tracing::{info, warn};

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

    // Check DRM encryption
    if epub.encryption.has_encryption {
        warn!(
            "检测到 encryption.xml 加密资源: {} 项",
            epub.encryption.encrypted_count
        );
        if epub.encryption.encrypted_text_or_css {
            warn!("检测到 Text/CSS 资源被 DRM 加密，跳过处理");
            return Ok(());
        }
    }
    if epub.opf_fallback_used {
        warn!("OPF 存在畸形 XML，已启用正则降级解析");
    }

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
