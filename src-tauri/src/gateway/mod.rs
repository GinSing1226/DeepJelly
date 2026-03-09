//! Gateway module
//!
//! WebSocket gateway for communication with AI applications.

pub mod types;
pub mod client;
pub mod server;

pub use server::WsServer;
pub use types::*;
