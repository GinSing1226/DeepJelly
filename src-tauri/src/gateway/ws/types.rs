//! WebSocket gateway types
//!
//! Types for WebSocket gateway communication.

use serde::{Deserialize, Serialize};

/// Connection request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub client: String,
    pub role: String,
    pub auth: String,
    pub scope: Vec<String>,
}

/// Connection response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResponse {
    pub session_id: String,
    pub status: String,
}

/// Connection info
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    pub session_id: String,
    pub client_name: String,
    pub role: String,
    pub connected_at: u64,
}
