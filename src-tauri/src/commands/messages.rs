//! Message storage commands
//!
//! Provides local persistence for chat messages.
//! Messages are stored alongside the OpenClaw session files for easy backup.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Local message structure matching frontend SessionMessage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalMessage {
    pub id: String,
    pub content: String,
    pub sender: String, // "user" | "assistant" | "system"
    pub timestamp: i64,
    pub is_streaming: Option<bool>,
}

/// Local message store structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct LocalMessageStore {
    /// sessionKey -> list of messages
    messages: HashMap<String, Vec<LocalMessage>>,
}

impl Default for LocalMessageStore {
    fn default() -> Self {
        Self {
            messages: HashMap::new(),
        }
    }
}

/// Get the messages storage file path
fn get_messages_file_path() -> Result<PathBuf, String> {
    // Use the same directory as OpenClaw sessions for consistency
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let deepjelly_dir = home.join(".openclaw").join("deepjelly");

    // Create directory if it doesn't exist
    fs::create_dir_all(&deepjelly_dir)
        .map_err(|e| format!("Failed to create messages directory: {}", e))?;

    Ok(deepjelly_dir.join("local_messages.json"))
}

/// Load the local message store from disk
fn load_message_store() -> Result<LocalMessageStore, String> {
    let path = get_messages_file_path()?;

    if !path.exists() {
        return Ok(LocalMessageStore::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read messages file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse messages file: {}", e))
}

/// Save the local message store to disk
fn save_message_store(store: &LocalMessageStore) -> Result<(), String> {
    let path = get_messages_file_path()?;

    let content = serde_json::to_string_pretty(store)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write messages file: {}", e))?;

    Ok(())
}

/// Save a message to local storage
#[tauri::command]
pub async fn save_local_message(
    session_key: String,
    message: LocalMessage,
) -> Result<(), String> {
    log::info!("[save_local_message] Saving message for session: {}", session_key);

    let mut store = load_message_store()?;

    store.messages
        .entry(session_key.clone())
        .or_insert_with(Vec::new)
        .push(message);

    save_message_store(&store)?;

    log::info!("[save_local_message] Saved, now have {} messages", store.messages[&session_key].len());

    Ok(())
}

/// Get all locally stored messages for a session
#[tauri::command]
pub async fn get_local_messages(
    session_key: String,
) -> Result<Vec<LocalMessage>, String> {
    log::info!("[get_local_messages] Loading messages for session: {}", session_key);

    let store = load_message_store()?;

    let messages = store.messages.get(&session_key).cloned().unwrap_or_default();

    log::info!("[get_local_messages] Found {} local messages", messages.len());

    Ok(messages)
}

/// Save multiple messages at once (for bulk operations)
#[tauri::command]
pub async fn save_local_messages_bulk(
    session_key: String,
    messages: Vec<LocalMessage>,
) -> Result<(), String> {
    log::info!("[save_local_messages_bulk] Saving {} messages for session: {}", messages.len(), session_key);

    let mut store = load_message_store()?;

    let count = messages.len();
    store.messages
        .entry(session_key.clone())
        .or_insert_with(Vec::new)
        .extend(messages);

    save_message_store(&store)?;

    log::info!("[save_local_messages_bulk] Saved, added {} messages", count);

    Ok(())
}

/// Clear all messages for a session (for testing or reset)
#[tauri::command]
pub async fn clear_local_messages(
    session_key: String,
) -> Result<(), String> {
    log::info!("[clear_local_messages] Clearing messages for session: {}", session_key);

    let mut store = load_message_store()?;

    store.messages.remove(&session_key);

    save_message_store(&store)?;

    Ok(())
}
