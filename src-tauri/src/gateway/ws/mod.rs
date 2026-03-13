//! WebSocket gateway module
//!
//! Provides WebSocket server and client for AI application communication.

pub mod types;
pub mod server;
pub mod client;

// Re-exports for convenience
pub use server::WsServer;
pub use client::WsClient;
pub use types::*;
