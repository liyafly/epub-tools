/// Unified error type for epub-core operations.
#[derive(Debug, thiserror::Error)]
pub enum EpubError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("ZIP error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("XML error: {0}")]
    Xml(String),

    #[error("EPUB structure error: {0}")]
    Structure(String),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, EpubError>;
