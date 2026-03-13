//! Gateway module
//!
//! Provides both WebSocket and HTTP API gateways for communication with AI applications.

pub mod common;
pub mod ws;
pub mod http;

// Re-exports for backward compatibility
pub use common::{ServerConfig, GatewayError};
pub use ws::{WsServer, WsClient};
pub use ws::types::{ConnectRequest, ConnectResponse, ConnectionInfo};
pub use http::HttpServer;
