//! Brain command handlers
//!
//! Tauri commands for brain adapter operations.

use crate::brain::{AdapterClient, Assistant, BrainAdapterConfig, BrainAdapterSettings, BrainEvent};
use tauri::{AppHandle, Emitter, Manager};
use crate::utils::logging::{LogCategory, format_log, format_log_arg1};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Global brain client instance
static BRAIN_CLIENT: std::sync::OnceLock<Arc<RwLock<Option<AdapterClient>>>> =
    std::sync::OnceLock::new();

fn get_client_storage() -> Arc<RwLock<Option<AdapterClient>>> {
    BRAIN_CLIENT
        .get_or_init(|| Arc::new(RwLock::new(None)))
        .clone()
}

/// Connect to the brain adapter
#[tauri::command]
pub async fn connect_brain(app: AppHandle) -> Result<String, String> {
    // Load configuration
    let config_path = get_config_path();
    log::info!("{}", format_log_arg1(LogCategory::Brain, "Loading config from: ", &format!("{:?}", config_path)));

    let config = BrainAdapterConfig::load(&config_path)?;
    let settings = config.settings().clone();

    log::info!("{}", format_log_arg1(LogCategory::Brain, "Connecting to brain adapter at: ", &settings.url));
    log::info!("{}", format_log_arg1(LogCategory::Brain, "Auth token present: ", &format!("{:?}", settings.auth_token.is_some())));
    if let Some(token) = &settings.auth_token {
        log::info!("{}", format_log_arg1(LogCategory::Brain, "Token (first 8 chars): ", &token[..token.len().min(8)]));
    }

    // Create and store the client
    let client = AdapterClient::with_settings(settings.clone());

    // Register event callback to forward to frontend
    let app_handle = app.clone();
    client.register_event_callback(move |event| {
        match event {
            BrainEvent::CapMessage { data } => {
                log::info!("{}", format_log(LogCategory::Brain, "[Event] ==================== CAP MESSAGE RECEIVED ===================="));
                log::info!("{}", format_log_arg1(LogCategory::Brain, "[Event] CAP data: ", &serde_json::to_string(&data).unwrap_or_else(|_| "无法序列化".to_string())));

                log::info!("{}", format_log(LogCategory::Brain, "[Event] Emitting 'cap:message' to frontend..."));
                let result = app_handle.emit("cap:message", data);
                match result {
                    Ok(_) => log::info!("{}", format_log(LogCategory::Brain, "[Event] ✅ Successfully emitted cap:message")),
                    Err(e) => log::error!("{}", format_log_arg1(LogCategory::Brain, "[Event] ❌ Failed to emit cap:message: ", &e.to_string())),
                }
            }
            BrainEvent::MessageReceived { data } => {
                log::info!("{}", format_log(LogCategory::Brain, "[Event] Forwarding message_received to frontend"));
                let _ = app_handle.emit("brain:message-received", data);
            }
            BrainEvent::SessionStateChanged { data } => {
                log::info!("{}", format_log(LogCategory::Brain, "[Event] Forwarding session_state_changed to frontend"));
                let _ = app_handle.emit("brain:session-state-changed", data);
            }
            BrainEvent::AutomationCommand { data } => {
                log::info!("{}", format_log(LogCategory::Brain, "[Event] Forwarding automation_command to frontend"));
                let _ = app_handle.emit("brain:automation-command", data);
            }
        }
    }).await;

    // Wait for connection
    client.connect().await?;

    // Store the client
    let storage = get_client_storage();
    *storage.write().await = Some(client);

    Ok(format!("Connected to brain adapter at {}", settings.url))
}

/// Disconnect from the brain adapter
#[tauri::command]
pub async fn disconnect_brain() -> Result<(), String> {
    let storage = get_client_storage();
    let mut guard = storage.write().await;

    if let Some(client) = guard.take() {
        client.shutdown().await;
        log::info!("{}", format_log(LogCategory::Brain, "Disconnected from brain adapter"));
    }

    Ok(())
}

/// Check if connected to brain adapter
#[tauri::command]
pub async fn is_brain_connected() -> Result<bool, String> {
    let storage = get_client_storage();
    let guard = storage.read().await;

    if let Some(client) = guard.as_ref() {
        Ok(client.is_connected().await)
    } else {
        Ok(false)
    }
}

/// Get available agents from OpenClaw
#[tauri::command]
pub async fn get_agents() -> Result<Vec<Assistant>, String> {
    let storage = get_client_storage();
    let guard = storage.read().await;

    let client = guard
        .as_ref()
        .ok_or("Not connected to brain adapter. Call connect_brain first.")?;

    client.get_agents().await
}

/// Send a message to a session
#[tauri::command]
pub async fn send_message(session_id: String, content: String) -> Result<serde_json::Value, String> {
    println!("[DeepJelly Backend] =======================================");
    println!("[DeepJelly Backend] send_message called");
    println!("[DeepJelly Backend]   session_id: {}", session_id);
    println!("[DeepJelly Backend]   content: {} chars", content.len());
    println!("[DeepJelly Backend]   content_preview: {}", &content.chars().take(100).collect::<String>());
    log::info!("{}", format_log_arg1(LogCategory::Brain, "[send_message] session_id: ", &session_id));
    log::info!("{}", format_log_arg1(LogCategory::Brain, "[send_message] content length: ", &content.len().to_string()));

    let storage = get_client_storage();
    let guard = storage.read().await;

    println!("[DeepJelly Backend] Acquired client storage lock");

    let client = guard
        .as_ref()
        .ok_or("Not connected to brain adapter. Call connect_brain first.")?;

    println!("[DeepJelly Backend] Got client, calling send_message...");

    let result = client.send_message(&session_id, &content).await;

    match &result {
        Ok(value) => {
            println!("[DeepJelly Backend] ✅ send_message succeeded, result: {}", serde_json::to_string(value).unwrap_or_else(|_| "无法序列化".to_string()));
        }
        Err(e) => {
            println!("[DeepJelly Backend] ❌ send_message failed: {}", e);
        }
    }

    result
}

/// Get session message history
#[tauri::command]
pub async fn get_session_history(session_id: String, limit: Option<u32>, offset: Option<u32>) -> Result<serde_json::Value, String> {
    println!("[DeepJelly Backend] =======================================");
    println!("[DeepJelly Backend] get_session_history called");
    println!("[DeepJelly Backend]   session_id: {}", session_id);
    println!("[DeepJelly Backend]   limit: {:?}", limit);
    log::info!("{}", format_log_arg1(LogCategory::Brain, "[get_session_history] session_id: ", &session_id));

    let storage = get_client_storage();
    let guard = storage.read().await;

    let client = guard
        .as_ref()
        .ok_or("Not connected to brain adapter. Call connect_brain first.")?;

    println!("[DeepJelly Backend] Got client, calling get_session_history...");

    // Use JSON-RPC call to get history from plugin
    let params = serde_json::json!({
        "session_id": session_id,
        "limit": limit.unwrap_or(50),
        "offset": offset.unwrap_or(0)
    });

    let result = client.call("get_session_history", params).await?;

    println!("[DeepJelly Backend] ✅ get_session_history succeeded");
    println!("[DeepJelly Backend]   result: {}", result);

    Ok(result)
}

/// Get all sessions
#[tauri::command]
pub async fn get_all_sessions(
    limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    println!("[DeepJelly Backend] =======================================");
    println!("[DeepJelly Backend] get_all_sessions called");
    println!("[DeepJelly Backend]   limit: {:?}", limit);

    let storage = get_client_storage();
    let guard = storage.read().await;

    let client = guard
        .as_ref()
        .ok_or("Not connected to brain adapter. Call connect_brain first.")?;

    println!("[DeepJelly Backend] Got client, calling get_all_sessions...");

    // Use JSON-RPC call to get all sessions from plugin
    let params = serde_json::json!({
        "limit": limit
    });

    let result = client.call("get_all_sessions", params).await?;

    println!(
        "[DeepJelly Backend] ✅ get_all_sessions succeeded, got {} sessions",
        result.get("sessions").and_then(|v| v.as_array()).map(|v| v.len()).unwrap_or(0)
    );

    Ok(result)
}

/// Make a raw JSON-RPC call
#[tauri::command]
pub async fn brain_call(method: String, params: serde_json::Value) -> Result<serde_json::Value, String> {
    let storage = get_client_storage();
    let guard = storage.read().await;

    let client = guard
        .as_ref()
        .ok_or("Not connected to brain adapter. Call connect_brain first.")?;

    client.call(&method, params).await
}

/// Get the configuration file path
fn get_config_path() -> PathBuf {
    // Determine config directory based on platform
    let config_dir = if cfg!(target_os = "windows") {
        // Windows: %APPDATA%\DeepJelly\config
        if let Ok(appdata) = std::env::var("APPDATA") {
            std::path::PathBuf::from(appdata).join("DeepJelly").join("config")
        } else {
            // Fallback
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("config")
        }
    } else {
        // Non-Windows: use current working directory /config
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("config")
    };

    // Ensure config directory exists
    let _ = std::fs::create_dir_all(&config_dir);

    let config_path = config_dir.join("brain_adapter.json");

    // If file doesn't exist yet, try to find existing configs in legacy locations
    if !config_path.exists() {
        // Try legacy locations for migration
        if let Ok(cwd) = std::env::current_dir() {
            let legacy_path = cwd.join("config").join("brain_adapter.json");
            if legacy_path.exists() {
                log::info!("{}", format_log(LogCategory::Brain, &format!("Found legacy config at: {:?}", legacy_path)));
                // Copy legacy config to new location
                if let Ok(_) = std::fs::copy(&legacy_path, &config_path) {
                    log::info!("{}", format_log(LogCategory::Brain, "Migrated legacy config to new location"));
                }
                return config_path;
            }
        }

        // Try parent directory (when running from src-tauri)
        if let Ok(cwd) = std::env::current_dir() {
            if let Some(parent) = cwd.parent() {
                let legacy_path = parent.join("config").join("brain_adapter.json");
                if legacy_path.exists() {
                    log::info!("{}", format_log(LogCategory::Brain, &format!("Found legacy config at parent: {:?}", legacy_path)));
                    if let Ok(_) = std::fs::copy(&legacy_path, &config_path) {
                        log::info!("{}", format_log(LogCategory::Brain, "Migrated legacy config to new location"));
                    }
                    return config_path;
                }
            }
        }
    }

    log::info!("{}", format_log(LogCategory::Brain, &format!("Using config path: {:?}", config_path)));
    config_path
}

/// Get current brain adapter configuration
#[tauri::command]
pub async fn get_brain_config() -> Result<BrainAdapterSettings, String> {
    let config_path = get_config_path();
    let config = BrainAdapterConfig::load(&config_path)?;
    Ok(config.settings().clone())
}

/// Update brain adapter configuration
#[tauri::command]
pub async fn set_brain_config(settings: BrainAdapterSettings) -> Result<(), String> {
    let config = BrainAdapterConfig {
        brain_adapter: settings,
    };

    let config_path = get_config_path();
    config.save(&config_path)?;

    log::info!("{}", format_log(LogCategory::Brain, "Brain adapter configuration updated"));
    Ok(())
}

/// Test connection to brain adapter
/// Returns detailed diagnostic information
#[tauri::command]
pub async fn test_brain_connection(url: Option<String>) -> Result<serde_json::Value, String> {
    use tokio_tungstenite::connect_async;
    use serde_json::json;

    let test_url = url.unwrap_or_else(|| {
        // 从配置文件读取 URL
        let config_path = get_config_path();
        if let Ok(config) = BrainAdapterConfig::load(&config_path) {
            config.settings().url.clone()
        } else {
            "ws://127.0.0.1:18790".to_string()
        }
    });

    log::info!("{}", format_log_arg1(LogCategory::Brain, "Testing connection to: ", &test_url));

    let start_time = std::time::Instant::now();

    match connect_async(&test_url).await {
        Ok((ws_stream, _)) => {
            let elapsed = start_time.elapsed();

            // 尝试发送一个测试请求
            let (mut write, mut read) = ws_stream.split();
            use futures_util::{SinkExt, StreamExt};
            use tokio_tungstenite::tungstenite::Message;

            let test_request = json!({
                "jsonrpc": "2.0",
                "id": "test_1",
                "method": "get_assistants",
                "params": {}
            });

            // 发送测试请求
            if let Err(e) = write.send(Message::Text(test_request.to_string())).await {
                return Ok(json!({
                    "success": false,
                    "url": test_url,
                    "connected": true,
                    "error": format!("发送测试请求失败: {}", e),
                    "elapsed_ms": elapsed.as_millis()
                }));
            }

            // 等待响应（最多5秒）
            let response = tokio::select! {
                msg = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    read.next()
                ) => {
                    match msg {
                        Ok(Some(Ok(Message::Text(text)))) => {
                            serde_json::from_str::<serde_json::Value>(&text).ok()
                        }
                        _ => None
                    }
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(5)) => None
            };

            Ok(json!({
                "success": true,
                "url": test_url,
                "connected": true,
                "elapsed_ms": elapsed.as_millis(),
                "response": response
            }))
        }
        Err(e) => {
            let elapsed = start_time.elapsed();
            let error_msg = e.to_string();

            // 分析错误类型
            let error_type = if error_msg.contains("Connection refused") || error_msg.contains("ECONNREFUSED") {
                "connection_refused"
            } else if error_msg.contains("timed out") || error_msg.contains("ETIMEDOUT") {
                "timeout"
            } else if error_msg.contains("No such host") || error_msg.contains("ENOTFOUND") {
                "dns_error"
            } else if error_msg.contains("Network is unreachable") {
                "network_unreachable"
            } else {
                "unknown"
            };

            Ok(json!({
                "success": false,
                "url": test_url,
                "connected": false,
                "error": error_msg,
                "error_type": error_type,
                "elapsed_ms": elapsed.as_millis(),
                "suggestions": match error_type {
                    "connection_refused" => vec![
                        "OpenClaw 可能未运行",
                        "DeepJellyChannel 插件未启用",
                        "WebSocket 端口不是 18790",
                    ],
                    "timeout" => vec![
                        "网络连接超时",
                        "检查防火墙设置",
                        "检查 IP 地址是否正确",
                    ],
                    "dns_error" => vec![
                        "无法解析主机名",
                        "检查 IP 地址或域名",
                    ],
                    "network_unreachable" => vec![
                        "网络不可达",
                        "检查网络连接",
                    ],
                    _ => vec![
                        "检查 OpenClaw 是否运行",
                        "检查配置文件 config/brain_adapter.json",
                    ]
                }
            }))
        }
    }
}
