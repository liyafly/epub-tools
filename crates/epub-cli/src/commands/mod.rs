pub mod doctor;
pub mod encrypt;
pub mod decrypt;
pub mod reformat;

use clap::Subcommand;

#[derive(Subcommand)]
pub enum Commands {
    /// Check development environment and dependencies
    Doctor,

    /// Encrypt (obfuscate) EPUB filenames
    Encrypt(encrypt::EncryptArgs),

    /// Decrypt (de-obfuscate) EPUB filenames
    Decrypt(decrypt::DecryptArgs),

    /// Reformat EPUB to Sigil standard directory structure
    Reformat(reformat::ReformatArgs),
}

pub fn execute(cmd: Commands) -> anyhow::Result<()> {
    match cmd {
        Commands::Doctor => doctor::run(),
        Commands::Encrypt(args) => encrypt::run(args),
        Commands::Decrypt(args) => decrypt::run(args),
        Commands::Reformat(args) => reformat::run(args),
    }
}
