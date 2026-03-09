//! Error types for DeepJelly

use thiserror::Error;

/// Main error type for the application
#[derive(Debug, Error)]
pub enum DeepJellyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),
}

impl From<DeepJellyError> for String {
    fn from(e: DeepJellyError) -> String {
        e.to_string()
    }
}

/// Result type alias for DeepJelly operations
pub type Result<T> = std::result::Result<T, DeepJellyError>;
