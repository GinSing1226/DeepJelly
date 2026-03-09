//! Mock WebSocket objects for testing

use deepjelly::logic::protocol::{CapMessage, CapMessageType, CapActor, CapPayload};
use std::time::{SystemTime, UNIX_EPOCH};

/// Mock WebSocket消息构建器
pub struct MockMessageBuilder {
    sender: String,
    receiver: String,
    msg_type: CapMessageType,
}

impl MockMessageBuilder {
    pub fn new() -> Self {
        Self {
            sender: "test_sender".to_string(),
            receiver: "ui_core".to_string(),
            msg_type: CapMessageType::BehaviorMental,
        }
    }

    pub fn sender(mut self, sender: &str) -> Self {
        self.sender = sender.to_string();
        self
    }

    pub fn receiver(mut self, receiver: &str) -> Self {
        self.receiver = receiver.to_string();
        self
    }

    pub fn r#type(mut self, msg_type: CapMessageType) -> Self {
        self.msg_type = msg_type;
        self
    }

    pub fn build(self) -> CapMessage {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        CapMessage {
            msg_id: format!("mock_msg_{}", timestamp),
            timestamp,
            r#type: self.msg_type,
            sender: CapActor {
                id: self.sender,
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: self.receiver,
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Notification(
                deepjelly::logic::protocol::NotificationPayload {
                    title: "Mock Message".to_string(),
                    body: "Mock content".to_string(),
                    r#type: "info".to_string(),
                }
            ),
        }
    }
}

impl Default for MockMessageBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// 预定义的Mock消息
pub mod presets {
    use super::*;

    /// 行为心理消息
    pub fn behavior_mental() -> CapMessage {
        MockMessageBuilder::new()
            .r#type(CapMessageType::BehaviorMental)
            .build()
    }

    /// 会话消息
    pub fn session_message(content: &str) -> CapMessage {
        let mut builder = MockMessageBuilder::new();
        builder.msg_type = CapMessageType::Session;
        let mut msg = builder.build();
        msg.payload = CapPayload::Session(
            deepjelly::logic::protocol::SessionPayload {
                session_id: "mock_session".to_string(),
                is_streaming: None,
                stream_id: None,
                message: Some(deepjelly::logic::protocol::ChatMessage {
                    id: "mock_chat".to_string(),
                    role: "assistant".to_string(),
                    content: content.to_string(),
                }),
                is_finished: Some(true),
                delta: None,
            }
        );
        msg
    }

    /// 通知消息
    pub fn notification(title: &str, body: &str) -> CapMessage {
        let mut builder = MockMessageBuilder::new();
        builder.msg_type = CapMessageType::Notification;
        let mut msg = builder.build();
        msg.payload = CapPayload::Notification(
            deepjelly::logic::protocol::NotificationPayload {
                title: title.to_string(),
                body: body.to_string(),
                r#type: "info".to_string(),
            }
        );
        msg
    }

    /// 事件消息
    pub fn event(event_type: &str) -> CapMessage {
        let mut builder = MockMessageBuilder::new();
        builder.msg_type = CapMessageType::Event;
        let mut msg = builder.build();
        msg.payload = CapPayload::Event(
            deepjelly::logic::protocol::EventPayload {
                event_type: event_type.to_string(),
                data: serde_json::json!({"test": true}),
            }
        );
        msg
    }
}
