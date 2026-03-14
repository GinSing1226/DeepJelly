//! WebSocket gateway server
//!
//! Accepts and manages WebSocket connections from AI applications.
#![allow(dead_code)]

// Import stays the same - types is still a sibling module
use super::types::{ConnectRequest, ConnectResponse};
use crate::logic::protocol::CapMessage;
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tokio_tungstenite::WebSocketStream;

/// Type alias for WebSocket sink
pub type WsSink = futures_util::stream::SplitSink<WebSocketStream<tokio::net::TcpStream>, Message>;

/// Type alias for client map
pub type ClientMap = HashMap<String, Arc<tokio::sync::Mutex<WsSink>>>;

/// WebSocket gateway server
pub struct WsServer {
    clients: Arc<RwLock<ClientMap>>,
    tx: broadcast::Sender<CapMessage>,
}

impl WsServer {
    /// Create new server
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            tx,
        }
    }

    /// Start server
    pub async fn start(&self, host: &str, port: u16) -> Result<(), String> {
        let addr = format!("{}:{}", host, port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("绑定地址失败: {}", e))?;

        log::info!("[网关层] WebSocket 服务器启动: {}", addr);

        // Start broadcast task
        let tx_clone = self.tx.clone();
        let clients_clone = self.clients.clone();
        tokio::spawn(async move {
            Self::broadcast_task(tx_clone, clients_clone).await;
        });

        // Accept connections
        while let Ok((stream, addr)) = listener.accept().await {
            log::info!("[网关层] 新连接: {}", addr);

            let clients = self.clients.clone();
            let tx = self.tx.clone();

            tokio::spawn(async move {
                if let Err(e) = Self::handle_connection(stream, clients, tx).await {
                    log::error!("[网关层] 处理连接失败: {}", e);
                }
            });
        }

        Ok(())
    }

    /// Handle single connection
    async fn handle_connection(
        stream: TcpStream,
        clients: Arc<RwLock<ClientMap>>,
        tx: broadcast::Sender<CapMessage>,
    ) -> Result<(), String> {
        let ws_stream = accept_async(stream).await
            .map_err(|e| format!("WebSocket 握手失败: {}", e))?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Wait for connect request
        let connect_msg = ws_receiver.next().await
            .ok_or("连接关闭")?
            .map_err(|e| format!("读取消息失败: {}", e))?;

        let request = Self::parse_connect_request(connect_msg)?;

        // Validate auth (MVP: simple check)
        if request.auth.is_empty() {
            Self::send_error(&mut ws_sender, "鉴权失败").await?;
            return Err("鉴权失败".to_string());
        }

        // Create session
        let session_id = Self::generate_session_id();

        // Send success response
        let response = ConnectResponse {
            session_id: session_id.clone(),
            status: "success".to_string(),
        };
        let response_json = serde_json::to_string(&response)
            .map_err(|e| format!("序列化失败: {}", e))?;
        ws_sender.send(Message::Text(response_json)).await
            .map_err(|e| format!("发送响应失败: {}", e))?;

        // Store client
        {
            let mut clients_map = clients.write().await;
            clients_map.insert(session_id.clone(), Arc::new(tokio::sync::Mutex::new(ws_sender)));
        }

        log::info!("[网关层] 客户端已连接: {} ({})", session_id, request.client);

        // Handle messages
        while let Some(msg_result) = ws_receiver.next().await {
            let msg = msg_result.map_err(|e| format!("接收消息失败: {}", e))?;

            if msg.is_close() {
                break;
            }

            if let Ok(cap_msg) = Self::parse_cap_message(msg) {
                // Broadcast to subscribers
                let _ = tx.send(cap_msg);
            }
        }

        // Cleanup
        {
            let mut clients_map = clients.write().await;
            clients_map.remove(&session_id);
        }
        log::info!("[网关层] 客户端断开: {}", session_id);

        Ok(())
    }

    fn parse_connect_request(msg: Message) -> Result<ConnectRequest, String> {
        let text = msg.to_text()
            .map_err(|e| format!("解析文本失败: {}", e))?;

        let req: serde_json::Value = serde_json::from_str(text)
            .map_err(|e| format!("解析JSON失败: {}", e))?;

        Ok(ConnectRequest {
            client: req["params"]["client"].as_str()
                .ok_or("缺少 client 字段")?
                .to_string(),
            role: req["params"]["role"].as_str()
                .ok_or("缺少 role 字段")?
                .to_string(),
            auth: req["params"]["auth"].as_str()
                .ok_or("缺少 auth 字段")?
                .to_string(),
            scope: req["params"]["scope"].as_array()
                .ok_or("缺少 scope 字段")?
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
        })
    }

    async fn send_error(
        sender: &mut WsSink,
        error: &str,
    ) -> Result<(), String> {
        let error_json = serde_json::json!({
            "type": "error",
            "message": error
        });
        sender.send(Message::Text(error_json.to_string())).await
            .map_err(|e| format!("发送失败: {}", e))
    }

    fn parse_cap_message(msg: Message) -> Result<CapMessage, String> {
        let text = msg.to_text()
            .map_err(|e| format!("解析文本失败: {}", e))?;
        serde_json::from_str(text)
            .map_err(|e| format!("解析 CAP 消息失败: {}", e))
    }

    async fn broadcast_task(
        tx: broadcast::Sender<CapMessage>,
        clients: Arc<RwLock<ClientMap>>,
    ) {
        let mut receiver = tx.subscribe();

        while let Ok(msg) = receiver.recv().await {
            let clients_map = clients.read().await;
            for (_id, client) in clients_map.iter() {
                // Try to send message
                let json = match serde_json::to_string(&msg) {
                    Ok(j) => j,
                    Err(_) => continue,
                };

                let mut sender = client.lock().await;
                let _ = sender.send(Message::Text(json)).await;
            }
        }
    }

    /// Broadcast message to all connected clients
    pub async fn broadcast(&self, message: CapMessage) -> Result<(), String> {
        self.tx.send(message)
            .map_err(|e| format!("广播失败: {}", e))?;
        Ok(())
    }

    /// Get connected client count
    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    fn generate_session_id() -> String {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        format!("sess_{}", timestamp)
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

impl Default for WsServer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_session_id() {
        let id = WsServer::generate_session_id();
        assert!(id.starts_with("sess_"));
    }

    #[test]
    fn test_current_timestamp() {
        let ts = WsServer::current_timestamp();
        assert!(ts > 0);
    }
}
