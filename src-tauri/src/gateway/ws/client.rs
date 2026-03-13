//! WebSocket client connection
//!
//! Manages individual WebSocket connections.

// Import stays the same - types is still a sibling module
use super::types::ConnectionInfo;
use crate::logic::protocol::CapMessage;
use futures_util::SinkExt;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;
use futures_util::stream::SplitSink;

/// Type alias for WebSocket sink
pub type WsSink = SplitSink<WebSocketStream<tokio::net::TcpStream>, Message>;

/// WebSocket client wrapper
pub struct WsClient {
    info: ConnectionInfo,
    #[allow(dead_code)]
    sender: Arc<Mutex<WsSink>>,
}

impl WsClient {
    /// Create new client
    pub fn new(
        info: ConnectionInfo,
        sender: WsSink,
    ) -> Self {
        Self {
            info,
            sender: Arc::new(Mutex::new(sender)),
        }
    }

    /// Get connection info
    pub fn info(&self) -> &ConnectionInfo {
        &self.info
    }

    /// Send CAP message
    pub async fn send_message(&self, message: &CapMessage) -> Result<(), String> {
        let json = serde_json::to_string(message)
            .map_err(|e| format!("序列化失败: {}", e))?;
        let ws_message = Message::Text(json);

        let mut sender = self.sender.lock().await;
        sender.send(ws_message).await
            .map_err(|e| format!("发送失败: {}", e))?;

        Ok(())
    }
}
