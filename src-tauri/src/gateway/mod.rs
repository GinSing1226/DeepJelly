//! Gateway module
//!
//! Provides WebSocket gateway for communication with AI applications.

pub mod common;
pub mod ws;

// Re-exports for backward compatibility
pub use common::{ServerConfig, GatewayError};
pub use ws::{WsServer, WsClient};
pub use ws::types::{ConnectRequest, ConnectResponse, ConnectionInfo};
