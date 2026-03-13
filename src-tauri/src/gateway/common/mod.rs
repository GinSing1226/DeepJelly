//! Common gateway types
//!
//! Shared configuration and error types for both WebSocket and HTTP gateways.

pub mod config;
pub mod error;

pub use config::ServerConfig;
pub use error::GatewayError;
