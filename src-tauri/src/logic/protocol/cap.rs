//! CAP (Character Application Protocol) message types
//!
//! Defines the wire protocol for communication between AI applications and the desktop assistant.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// CAP协议消息信封
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapMessage {
    pub msg_id: String,
    pub timestamp: u64,
    pub r#type: CapMessageType,
    pub sender: CapActor,
    pub receiver: CapActor,
    pub payload: CapPayload,
}

/// 消息类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapMessageType {
    /// 行为/心理表现
    BehaviorMental,
    /// 会话消息
    Session,
    /// 通知推送
    Notification,
    /// 事件上报
    Event,
}

/// 参与者类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum CapParticipantType {
    User,
    Assistant,
    Visitor,
}

/// 来源应用
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum CapSourceApp {
    Openclaw,
    Deepjelly,
}

/// 消息发送者/接收者
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapActor {
    pub id: String,
    pub r#type: String,
    pub source_app: String,
}

/// 消息负载
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "payload_type")]
pub enum CapPayload {
    #[serde(rename = "behavior_mental")]
    BehaviorMental(BehaviorMentalPayload),
    #[serde(rename = "session")]
    Session(SessionPayload),
    #[serde(rename = "notification")]
    Notification(NotificationPayload),
    #[serde(rename = "event")]
    Event(EventPayload),
}

/// 行为/心理表现负载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorMentalPayload {
    pub behavior: BehaviorCommand,
    pub bubble: Option<BubbleContent>,
}

/// 行为指令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorCommand {
    pub domain: String,
    pub category: String,
    pub action_id: String,
    pub urgency: u8,
    pub intensity: f32,
    pub duration_ms: Option<u64>,
}

/// 气泡内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BubbleContent {
    pub text: String,
    pub r#type: String,
    pub duration_ms: u64,
}

/// 会话负载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionPayload {
    pub session_id: String,
    pub is_streaming: Option<bool>,
    pub stream_id: Option<String>,
    pub message: Option<ChatMessage>,
    pub is_finished: Option<bool>,
    pub delta: Option<ChatDelta>,
}

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
}

/// 增量内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatDelta {
    pub content: String,
}

/// 通知负载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
    pub r#type: String,
}

/// 事件负载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    pub event_type: String,
    pub data: Value,
}

impl CapMessage {
    /// 验证消息格式
    pub fn validate(&self) -> Result<(), String> {
        if self.msg_id.is_empty() {
            return Err("msg_id 不能为空".to_string());
        }
        if self.timestamp == 0 {
            return Err("timestamp 不能为零".to_string());
        }
        if self.sender.id.is_empty() {
            return Err("sender.id 不能为空".to_string());
        }
        if self.receiver.id.is_empty() {
            return Err("receiver.id 不能为空".to_string());
        }

        // 验证 type 值
        let valid_types = ["user", "assistant", "visitor"];
        if !valid_types.contains(&self.sender.r#type.as_str()) {
            return Err(format!("无效的 sender.type: {}", self.sender.r#type));
        }
        if !valid_types.contains(&self.receiver.r#type.as_str()) {
            return Err(format!("无效的 receiver.type: {}", self.receiver.r#type));
        }

        // 验证 source_app 值
        let valid_apps = ["openclaw", "deepjelly"];
        if !valid_apps.contains(&self.sender.source_app.as_str()) {
            return Err(format!("无效的 sender.source_app: {}", self.sender.source_app));
        }
        if !valid_apps.contains(&self.receiver.source_app.as_str()) {
            return Err(format!("无效的 receiver.source_app: {}", self.receiver.source_app));
        }

        Ok(())
    }

    /// 创建新消息
    pub fn new(
        msg_id: String,
        timestamp: u64,
        r#type: CapMessageType,
        sender: CapActor,
        receiver: CapActor,
        payload: CapPayload,
    ) -> Self {
        Self {
            msg_id,
            timestamp,
            r#type,
            sender,
            receiver,
            payload,
        }
    }

    /// 创建通知消息
    pub fn notification(
        title: impl Into<String>,
        body: impl Into<String>,
        notification_type: impl Into<String>,
        sender_id: impl Into<String>,
    ) -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};

        Self {
            msg_id: Self::generate_msg_id(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            r#type: CapMessageType::Notification,
            sender: CapActor {
                id: sender_id.into(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Notification(NotificationPayload {
                title: title.into(),
                body: body.into(),
                r#type: notification_type.into(),
            }),
        }
    }

    /// 创建会话消息
    pub fn session(
        session_id: impl Into<String>,
        message: ChatMessage,
        is_finished: bool,
        sender_id: impl Into<String>,
    ) -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};

        Self {
            msg_id: Self::generate_msg_id(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            r#type: CapMessageType::Session,
            sender: CapActor {
                id: sender_id.into(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Session(SessionPayload {
                session_id: session_id.into(),
                is_streaming: Some(false),
                stream_id: None,
                message: Some(message),
                is_finished: Some(is_finished),
                delta: None,
            }),
        }
    }

    fn generate_msg_id() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        format!("msg_{}", timestamp)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cap_message_validation() {
        let message = CapMessage {
            msg_id: "msg_001".to_string(),
            timestamp: 1234567890,
            r#type: CapMessageType::Notification,
            sender: CapActor {
                id: "app_001".to_string(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Notification(NotificationPayload {
                title: "测试".to_string(),
                body: "内容".to_string(),
                r#type: "info".to_string(),
            }),
        };

        assert!(message.validate().is_ok());
    }

    #[test]
    fn test_cap_message_empty_msg_id() {
        let mut message = create_test_message();
        message.msg_id = "".to_string();
        assert!(message.validate().is_err());
    }

    #[test]
    fn test_cap_message_zero_timestamp() {
        let mut message = create_test_message();
        message.timestamp = 0;
        assert!(message.validate().is_err());
    }

    #[test]
    fn test_cap_message_empty_sender_id() {
        let mut message = create_test_message();
        message.sender.id = "".to_string();
        assert!(message.validate().is_err());
    }

    #[test]
    fn test_cap_message_invalid_sender_type() {
        let mut message = create_test_message();
        message.sender.r#type = "invalid".to_string();
        assert!(message.validate().is_err());
    }

    #[test]
    fn test_cap_message_invalid_source_app() {
        let mut message = create_test_message();
        message.sender.source_app = "invalid".to_string();
        assert!(message.validate().is_err());
    }

    #[test]
    fn test_create_notification() {
        let msg = CapMessage::notification("标题", "内容", "info", "app_001");
        assert_eq!(msg.r#type, CapMessageType::Notification);
        assert_eq!(msg.sender.id, "app_001");
        assert_eq!(msg.sender.r#type, "assistant");
        assert_eq!(msg.sender.source_app, "openclaw");
        assert_eq!(msg.receiver.source_app, "deepjelly");
        assert!(msg.validate().is_ok());
    }

    #[test]
    fn test_create_session() {
        let chat_msg = ChatMessage {
            id: "chat_001".to_string(),
            role: "assistant".to_string(),
            content: "你好".to_string(),
        };

        let msg = CapMessage::session("sess_001", chat_msg, true, "app_001");
        assert_eq!(msg.r#type, CapMessageType::Session);
        assert_eq!(msg.sender.id, "app_001");
        assert_eq!(msg.sender.source_app, "openclaw");
        assert!(msg.validate().is_ok());
    }

    #[test]
    fn test_serialize_deserialize() {
        let message = create_test_message();
        let json = serde_json::to_string(&message).unwrap();
        let deserialized: CapMessage = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.msg_id, message.msg_id);
        assert_eq!(deserialized.r#type, message.r#type);
        assert_eq!(deserialized.sender.source_app, message.sender.source_app);
        assert_eq!(deserialized.receiver.source_app, message.receiver.source_app);
    }

    fn create_test_message() -> CapMessage {
        CapMessage {
            msg_id: "msg_001".to_string(),
            timestamp: 1234567890,
            r#type: CapMessageType::Notification,
            sender: CapActor {
                id: "app_001".to_string(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Notification(NotificationPayload {
                title: "测试".to_string(),
                body: "内容".to_string(),
                r#type: "info".to_string(),
            }),
        }
    }
}
