//! AI adapter WebSocket client
//!
//! Handles communication with AI application adapters via WebSocket using JSON-RPC 2.0.

use crate::brain::types::*;
use crate::brain::config::BrainAdapterSettings;
use crate::utils::logging::{LogCategory, format_log, format_log_arg1};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Maximum allowed WebSocket message size (10 MB)
const MAX_MESSAGE_SIZE: usize = 10 * 1024 * 1024;

/// JSON-RPC 2.0 Request
#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
    id: String,
}

/// JSON-RPC 2.0 Response
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
    id: String,
}

/// JSON-RPC 2.0 Error
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

/// JSON-RPC 2.0 Notification (event from server)
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct JsonRpcNotification {
    jsonrpc: String,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

/// Pending request for tracking JSON-RPC calls
type PendingRequest = oneshot::Sender<Result<Value, String>>;

/// Event callback type
pub type EventCallback = Box<dyn Fn(BrainEvent) + Send + Sync>;

/// Internal message for the WebSocket task
enum ClientMessage {
    /// Send a JSON-RPC request
    Request {
        method: String,
        params: Option<Value>,
        response_tx: oneshot::Sender<Result<Value, String>>,
    },
    /// Register an event callback
    RegisterCallback(EventCallback),
    /// Shutdown the client
    Shutdown,
}

/// AI application adapter client
pub struct AdapterClient {
    url: String,
    settings: BrainAdapterSettings,
    connected: Arc<RwLock<bool>>,
    message_tx: mpsc::Sender<ClientMessage>,
    #[allow(dead_code)]
    pending_requests: Arc<RwLock<HashMap<String, PendingRequest>>>,
}

impl AdapterClient {
    /// Create a new adapter client with settings
    pub fn new(url: &str) -> Self {
        Self::with_settings(BrainAdapterSettings {
            url: url.to_string(),
            ..Default::default()
        })
    }

    /// Create a new adapter client with full settings
    pub fn with_settings(settings: BrainAdapterSettings) -> Self {
        let url = settings.url.clone();
        let connected = Arc::new(RwLock::new(false));
        let pending_requests = Arc::new(RwLock::new(HashMap::new()));

        // Create channel for client messages
        let (message_tx, message_rx) = mpsc::channel(100);

        // Spawn the WebSocket task
        let connected_clone = connected.clone();
        let pending_clone = pending_requests.clone();
        let settings_clone = settings.clone();
        let task_url = url.clone();

        tokio::spawn(async move {
            Self::websocket_task(
                task_url,
                settings_clone,
                connected_clone,
                pending_clone,
                message_rx,
            )
            .await;
        });

        Self {
            url,
            settings,
            connected,
            message_tx,
            pending_requests,
        }
    }

    /// Get the WebSocket URL
    pub fn url(&self) -> &str {
        &self.url
    }

    /// Check if connected to the adapter
    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    /// Connect to the adapter (wait for connection)
    pub async fn connect(&self) -> Result<(), String> {
        // Wait for connection with timeout
        let timeout = self.settings.timeout();
        let start = std::time::Instant::now();

        while !self.is_connected().await {
            if start.elapsed() > timeout {
                return Err("Connection timeout".to_string());
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        Ok(())
    }

    /// Make a JSON-RPC call
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        log::info!("{}", format_log_arg1(LogCategory::Brain, "[call] Sending JSON-RPC call: ", method));

        let (response_tx, response_rx) = oneshot::channel();

        let params = if params.is_null() {
            None
        } else {
            Some(params)
        };

        self.message_tx
            .send(ClientMessage::Request {
                method: method.to_string(),
                params,
                response_tx,
            })
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        let result = response_rx
            .await
            .map_err(|e| format!("Failed to receive response: {}", e))?;

        log::info!("{}", format_log_arg1(LogCategory::Brain, "[call] Received response for ", method));

        result
    }

    /// Get available agents from OpenClaw
    pub async fn get_agents(&self) -> Result<Vec<Assistant>, String> {
        log::info!("{}", format_log(LogCategory::Brain, "[get_agents] Calling OpenClaw get_assistants..."));

        let result = self.call("get_assistants", json!({})).await?;

        log::info!("{}", format_log_arg1(LogCategory::Brain, "[get_agents] Raw result from OpenClaw: ", &serde_json::to_string(&result).unwrap_or_else(|_| "无法序列化".to_string())));

        let agents: Vec<Assistant> = serde_json::from_value(result.clone())
            .map_err(|e| {
                log::error!("{}", format_log_arg1(LogCategory::Brain, "[get_agents] Failed to parse: ", &e.to_string()));
                format!("Failed to parse agents: {}", e)
            })?;

        log::info!("{}", format_log_arg1(LogCategory::Brain, "[get_agents] Parsed agents count: ", &agents.len().to_string()));

        for (i, agent) in agents.iter().enumerate() {
            log::info!("{}", format_log(LogCategory::Brain, &format!("[get_agents] Agent {}: id={}, name={}, model={:?}", i, agent.id, agent.name, agent.model)));
        }

        Ok(agents)
    }

    /// Send a message to a session
    pub async fn send_message(&self, session_id: &str, content: &str) -> Result<Value, String> {
        println!("[DeepJelly Client] =======================================");
        println!("[DeepJelly Client] send_message called");
        println!("[DeepJelly Client]   session_id: {}", session_id);
        println!("[DeepJelly Client]   content: {} chars", content.len());
        println!("[DeepJelly Client]   content_preview: {}", &content.chars().take(100).collect::<String>());
        log::info!("{}", format_log_arg1(LogCategory::Brain, "[send_message] Preparing JSON-RPC call for session: ", session_id));

        // Note: OpenClaw expects camelCase parameter names
        let params = json!({
            "sessionId": session_id,
            "content": content
        });

        println!("[DeepJelly Client] Calling JSON-RPC method 'send_message' with params:");
        println!("[DeepJelly Client]   {}", serde_json::to_string(&params).unwrap_or_else(|_| "无法序列化".to_string()));

        let result = self.call("send_message", params).await;

        match &result {
            Ok(value) => {
                println!("[DeepJelly Client] ✅ JSON-RPC call succeeded, result: {}", serde_json::to_string(value).unwrap_or_else(|_| "无法序列化".to_string()));
            }
            Err(e) => {
                println!("[DeepJelly Client] ❌ JSON-RPC call failed: {}", e);
            }
        }

        result
    }

    /// Get session state
    pub async fn get_session_state(&self, session_id: &str) -> Result<SessionState, String> {
        // Note: OpenClaw expects camelCase parameter names
        let result = self
            .call(
                "get_session_state",
                json!({
                    "sessionId": session_id
                }),
            )
            .await?;

        let state: SessionState = serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse session state: {}", e))?;

        Ok(state)
    }

    /// Register a callback for events
    pub async fn register_event_callback<F>(&self, callback: F)
    where
        F: Fn(BrainEvent) + Send + Sync + 'static,
    {
        let _ = self
            .message_tx
            .send(ClientMessage::RegisterCallback(Box::new(callback)))
            .await;
    }


    /// Shutdown the client
    pub async fn shutdown(&self) {
        let _ = self.message_tx.send(ClientMessage::Shutdown).await;
    }

    /// Background WebSocket task
    async fn websocket_task(
        url: String,
        settings: BrainAdapterSettings,
        connected: Arc<RwLock<bool>>,
        pending_requests: Arc<RwLock<HashMap<String, PendingRequest>>>,
        mut message_rx: mpsc::Receiver<ClientMessage>,
    ) {
        let mut event_callback: Option<EventCallback> = None;
        let mut request_id = 0u64;

        loop {
            // Ensure URL ends with /ws (OpenClaw standard path)
            let base_url = if url.contains("/ws") {
                url.clone()
            } else {
                format!("{}/ws", url.trim_end_matches('/'))
            };

            // Add token, role, and scopes as URL query parameters (OpenClaw's recommended method)
            let connect_url = if let Some(token) = &settings.auth_token {
                // Append token, role, and scopes as query parameters
                let url_with_token = if base_url.contains('?') {
                    format!("{}&token={}", base_url, token)
                } else {
                    format!("{}?token={}", base_url, token)
                };
                // Add role and scopes for operator permissions
                format!("{}&role=operator&scopes=operator.read,operator.write", url_with_token)
            } else {
                base_url.clone()
            };

            println!("[DeepJelly Client] =======================================");
            println!("[DeepJelly Client] Attempting to connect to: {}", connect_url);
            println!("[DeepJelly Client] Auth token present: {:?}", settings.auth_token.is_some());
            println!("[DeepJelly Client] =======================================");
            log::info!("{}", format_log_arg1(LogCategory::Brain, "Attempting to connect to: ", &connect_url));
            log::info!("{}", format_log_arg1(LogCategory::Brain, "Auth token present: ", &format!("{:?}", settings.auth_token.is_some())));

            // Connect using the URL with token parameter
            let connection_result = connect_async(&connect_url).await.map_err(|e| e.to_string());

            match connection_result {
                Ok((ws_stream, _)) => {
                    println!("[DeepJelly Client] ✅ Connected to brain adapter at: {}", url);
                    log::info!("{}", format_log_arg1(LogCategory::Brain, "Connected to brain adapter at: ", &url));
                    *connected.write().await = true;

                    let (mut write, mut read) = ws_stream.split();

                    // Main loop for this connection
                    loop {
                        tokio::select! {
                            // Handle outgoing messages from the client
                            msg = message_rx.recv() => {
                                match msg {
                                    Some(ClientMessage::Request { method, params, response_tx }) => {
                                        request_id += 1;
                                        let id = format!("req_{}", request_id);

                                        // Store the response channel
                                        pending_requests.write().await.insert(id.clone(), response_tx);

                                        // Create and send the request
                                        let request = JsonRpcRequest {
                                            jsonrpc: "2.0",
                                            method: method.clone(),
                                            params,
                                            id: id.clone(),
                                        };

                                        let request_json = match serde_json::to_string(&request) {
                                            Ok(j) => j,
                                            Err(e) => {
                                                log::error!("{}", format_log_arg1(LogCategory::Brain, "Failed to serialize request: ", &e.to_string()));
                                                pending_requests.write().await.remove(&id);
                                                continue;
                                            }
                                        };

                                        log::info!("{}", format_log_arg1(LogCategory::Brain, "[WS] Sending JSON-RPC request: ", &request_json));

                                        if let Err(e) = write.send(Message::Text(request_json)).await {
                                            log::error!("{}", format_log_arg1(LogCategory::Brain, "Failed to send WebSocket message: ", &e.to_string()));
                                            pending_requests.write().await.remove(&id);
                                            break;
                                        }
                                        log::info!("{}", format_log(LogCategory::Brain, "[WS] Request sent successfully"));
                                    }
                                    Some(ClientMessage::RegisterCallback(callback)) => {
                                        event_callback = Some(callback);
                                    }
                                    Some(ClientMessage::Shutdown) => {
                                        log::info!("{}", format_log(LogCategory::Brain, "Shutting down WebSocket client"));
                                        *connected.write().await = false;
                                        return;
                                    }
                                    None => {
                                        log::info!("{}", format_log(LogCategory::Brain, "Message channel closed"));
                                        *connected.write().await = false;
                                        return;
                                    }
                                }
                            }

                            // Handle incoming WebSocket messages
                            msg = read.next() => {
                                match msg {
                                    Some(Ok(Message::Text(text))) => {
                                        // Check message size before processing
                                        if text.len() > MAX_MESSAGE_SIZE {
                                            log::error!("{}", format_log_arg1(LogCategory::Brain, "[WS] Message too large, size: ", &text.len().to_string()));
                                            log::error!("{}", format_log_arg1(LogCategory::Brain, "[WS] Max allowed size: ", &MAX_MESSAGE_SIZE.to_string()));
                                            continue;
                                        }

                                        log::info!("{}", format_log_arg1(LogCategory::Brain, "[WS] Received message: ", &text));

                                        // Try to parse as response first
                                        if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&text) {
                                            log::info!("{}", format_log_arg1(LogCategory::Brain, "[WS] Parsed as JSON-RPC response, id: ", &response.id));
                                            if let Some(response_tx) = pending_requests.write().await.remove(&response.id) {
                                                log::info!("{}", format_log(LogCategory::Brain, "[WS] Response matched to pending request, sending back to caller"));
                                                let result = if let Some(error) = response.error {
                                                    Err(format!("JSON-RPC error {}: {}", error.code, error.message))
                                                } else {
                                                    Ok(response.result.unwrap_or(Value::Null))
                                                };
                                                let _ = response_tx.send(result);
                                            } else {
                                                log::warn!("{}", format_log_arg1(LogCategory::Brain, "[WS] Response id not found in pending requests: ", &response.id));
                                            }
                                        }
                                        // Try to parse as notification
                                        else if let Ok(notification) = serde_json::from_str::<JsonRpcNotification>(&text) {
                                            log::info!("{}", format_log_arg1(LogCategory::Brain, "[WS] Parsed as JSON-RPC notification, method: ", &notification.method));

                                            // Parse and emit events
                                            if let Some(params) = notification.params {
                                                match Self::parse_event(&notification.method, params.clone()) {
                                                    Ok(event) => {
                                                        log::info!("{}", format_log(LogCategory::Brain, "[WS] Successfully parsed event, calling callback"));
                                                        if let Some(ref callback) = event_callback {
                                                            callback(event);
                                                        }
                                                    }
                                                    Err(e) => {
                                                        log::error!("{}", format_log_arg1(LogCategory::Brain, "[WS] Failed to parse event: ", &e));
                                                    }
                                                }
                                            }
                                        }
                                        // Check if this is an OpenClaw server event (JSON-RPC with id: null)
                                        else if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                                            if value.get("jsonrpc").is_some() {
                                                // This is a JSON-RPC message
                                                if let Some(result) = value.get("result") {
                                                    // Check if it's an event notification
                                                    if let Some(_event_type) = result.get("event").and_then(|e| e.as_str()) {
                                                        // OpenClaw server event - could be translated to CAP
                                                        // For now, log and ignore (connection events are internal)
                                                        log::debug!("{}", format_log(LogCategory::Brain, "[WS] Received OpenClaw server event, not forwarding to frontend"));
                                                    } else if result.is_object() || result.is_string() {
                                                        // Result might be a message response - treat as CAP message
                                                        log::info!("{}", format_log(LogCategory::Brain, "[WS] Received JSON-RPC result that might be a message, treating as CAP"));
                                                        log::info!("{}", format_log_arg1(LogCategory::Brain, "[WS] Result data: ", &serde_json::to_string(&result).unwrap_or_else(|_| "无法序列化".to_string())));
                                                        if let Some(ref callback) = event_callback {
                                                            callback(BrainEvent::CapMessage { data: result.clone() });
                                                        }
                                                    } else {
                                                        // Response without matching request - ignore
                                                        log::debug!("{}", format_log(LogCategory::Brain, "[WS] Received JSON-RPC response without matching request"));
                                                    }
                                                }
                                            } else if value.is_object() {
                                                // Pure CAP message (no jsonrpc field)
                                                log::info!("{}", format_log(LogCategory::Brain, "[WS] Parsed as direct CAP message"));
                                                if let Some(ref callback) = event_callback {
                                                    callback(BrainEvent::CapMessage { data: value });
                                                }
                                            }
                                        }
                                    }
                                    Some(Ok(Message::Ping(data))) => {
                                        let _ = write.send(Message::Pong(data)).await;
                                    }
                                    Some(Ok(Message::Close(_))) => {
                                        log::info!("{}", format_log(LogCategory::Brain, "WebSocket connection closed"));
                                        break;
                                    }
                                    Some(Ok(_)) => {
                                        // Ignore other message types
                                    }
                                    Some(Err(e)) => {
                                        log::error!("{}", format_log_arg1(LogCategory::Brain, "WebSocket error: ", &e.to_string()));
                                        break;
                                    }
                                    None => {
                                        log::info!("{}", format_log(LogCategory::Brain, "WebSocket stream ended"));
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // Connection lost
                    *connected.write().await = false;
                    log::warn!("{}", format_log(LogCategory::Brain, "Disconnected from brain adapter"));
                }
                Err(e) => {
                    println!("[DeepJelly Client] ❌ Failed to connect: {}: {}", url, e);
                    println!("[DeepJelly Client] Will retry in {}ms...", settings.reconnect_interval_ms);
                    log::error!("{}", format_log_arg1(LogCategory::Brain, "Failed to connect: ", &format!("{}: {}", url, e)));
                }
            }

            // Wait before reconnecting
            log::info!(
                "Waiting {}ms before reconnecting...",
                settings.reconnect_interval_ms
            );
            tokio::time::sleep(settings.reconnect_interval()).await;
        }
    }

    /// Parse a notification into a BrainEvent
    fn parse_event(method: &str, params: Value) -> Result<BrainEvent, String> {
        match method {
            "message_received" => {
                let data: MessageEventData = serde_json::from_value(params)
                    .map_err(|e| format!("Failed to parse MessageEventData: {}", e))?;
                Ok(BrainEvent::MessageReceived { data })
            }
            "session_state_changed" => {
                let data: SessionState = serde_json::from_value(params)
                    .map_err(|e| format!("Failed to parse SessionState: {}", e))?;
                Ok(BrainEvent::SessionStateChanged { data })
            }
            "automation_command" => {
                let data: AutomationCommand = serde_json::from_value(params)
                    .map_err(|e| format!("Failed to parse AutomationCommand: {}", e))?;
                Ok(BrainEvent::AutomationCommand { data })
            }
            _ => {
                // Unknown method - treat as CAP message
                log::warn!("{}", format_log_arg1(LogCategory::Brain, "Unknown event method, treating as CAP message: ", &method.to_string()));
                Ok(BrainEvent::CapMessage { data: params })
            }
        }
    }
}

impl Drop for AdapterClient {
    fn drop(&mut self) {
        // Attempt to shutdown gracefully
        let tx = self.message_tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(ClientMessage::Shutdown).await;
        });
    }
}
