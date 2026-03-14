//! Common gateway error types
#![allow(dead_code)]

/// Gateway error types
#[derive(Debug, Clone)]
pub enum GatewayError {
    /// Failed to bind to address
    BindFailed { addr: String, error: String },
    /// Failed to start server
    StartFailed { error: String },
    /// Failed to accept connection
    AcceptFailed { error: String },
    /// Handshake failed
    HandshakeFailed { error: String },
}

impl std::fmt::Display for GatewayError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BindFailed { addr, error } => {
                write!(f, "Failed to bind {}: {}", addr, error)
            }
            Self::StartFailed { error } => {
                write!(f, "Failed to start: {}", error)
            }
            Self::AcceptFailed { error } => {
                write!(f, "Failed to accept connection: {}", error)
            }
            Self::HandshakeFailed { error } => {
                write!(f, "Handshake failed: {}", error)
            }
        }
    }
}

impl std::error::Error for GatewayError {}
