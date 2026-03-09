//! Brain layer type definitions
//!
//! Core types for AI adapter communication.

use serde::{Deserialize, Serialize};

/// AI应用的助手
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assistant {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub model: Option<String>,
    pub avatar: Option<String>,
}

/// 会话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

/// 会话状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub session_id: String,
    pub status: String,
    pub current_action: Option<String>,
    pub tool_execution: Option<ToolExecution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecution {
    pub tool_name: String,
    pub status: String,
    pub progress: Option<u8>,
}

/// 自动化命令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationCommand {
    pub command_type: String,
    pub payload: serde_json::Value,
}

/// 大脑层事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event")]
pub enum BrainEvent {
    #[serde(rename = "message_received")]
    MessageReceived { data: MessageEventData },
    #[serde(rename = "session_state_changed")]
    SessionStateChanged { data: SessionState },
    #[serde(rename = "automation_command")]
    AutomationCommand { data: AutomationCommand },
    #[serde(rename = "cap_message")]
    CapMessage { data: serde_json::Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageEventData {
    pub session_id: String,
    pub message: Message,
}
