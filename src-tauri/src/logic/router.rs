//! Message router
//!
//! Routes CAP protocol messages to appropriate UI components.

use super::protocol::*;
use tokio::sync::broadcast;

/// 路由目标
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouteTarget {
    /// 角色视窗
    CharacterWindow,
    /// 对话框
    ChatDialog,
    /// 聊天气泡
    ChatBubble,
    /// 托盘通知
    TrayNotification,
    /// 事件引擎
    EventEngine,
}

/// 已路由消息
#[derive(Debug, Clone)]
pub struct RoutedMessage {
    pub target: RouteTarget,
    pub message: CapMessage,
}

/// 消息路由器
pub struct MessageRouter {
    sender: broadcast::Sender<RoutedMessage>,
}

impl MessageRouter {
    /// 创建新的消息路由器
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(100);
        Self { sender }
    }

    /// 订阅路由消息
    pub fn subscribe(&self) -> broadcast::Receiver<RoutedMessage> {
        self.sender.subscribe()
    }

    /// 路由北向消息（AI应用 → 表现层）
    pub async fn route_north(&self, message: CapMessage) -> Result<(), String> {
        // 验证消息
        message.validate()?;

        // 确定路由目标
        let targets = self.determine_targets(&message);

        // 分发消息
        for target in targets {
            let routed = RoutedMessage {
                target: target.clone(),
                message: message.clone(),
            };

            // 发送到订阅者
            if let Err(e) = self.sender.send(routed) {
                log::error!("[消息路由] 发送失败: {}", e);
            }
        }

        Ok(())
    }

    /// 根据消息类型确定路由目标
    fn determine_targets(&self, message: &CapMessage) -> Vec<RouteTarget> {
        match &message.payload {
            CapPayload::BehaviorMental(_) => vec![RouteTarget::CharacterWindow],
            CapPayload::Session(_) => vec![RouteTarget::ChatDialog, RouteTarget::ChatBubble],
            CapPayload::Notification(_) => vec![RouteTarget::TrayNotification],
            CapPayload::Event(_) => vec![RouteTarget::EventEngine],
        }
    }

    /// 封装南向消息（表现层 → AI应用）
    pub fn create_south_message(
        &self,
        user_input: String,
        session_id: String,
        agent_id: String,
    ) -> CapMessage {
        use std::time::{SystemTime, UNIX_EPOCH};

        CapMessage {
            msg_id: Self::generate_msg_id(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            r#type: CapMessageType::Session,
            sender: CapActor {
                id: "ui_core".to_string(),
                r#type: "user".to_string(),
                source_app: "deepjelly".to_string(),
            },
            receiver: CapActor {
                id: agent_id,
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            payload: CapPayload::Session(SessionPayload {
                session_id,
                is_streaming: None,
                stream_id: None,
                message: Some(ChatMessage {
                    id: Self::generate_msg_id(),
                    role: "user".to_string(),
                    content: user_input,
                }),
                is_finished: Some(true),
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

impl Default for MessageRouter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_creation() {
        let router = MessageRouter::new();
        let _receiver = router.subscribe();
    }

    #[test]
    fn test_determine_targets_behavior_mental() {
        let router = MessageRouter::new();
        let message = create_test_behavior_message();

        let targets = router.determine_targets(&message);
        assert_eq!(targets, vec![RouteTarget::CharacterWindow]);
    }

    #[test]
    fn test_determine_targets_session() {
        let router = MessageRouter::new();
        let message = create_test_session_message();

        let targets = router.determine_targets(&message);
        assert!(targets.contains(&RouteTarget::ChatDialog));
        assert!(targets.contains(&RouteTarget::ChatBubble));
    }

    #[test]
    fn test_determine_targets_notification() {
        let router = MessageRouter::new();
        let message = create_test_notification_message();

        let targets = router.determine_targets(&message);
        assert_eq!(targets, vec![RouteTarget::TrayNotification]);
    }

    #[test]
    fn test_determine_targets_event() {
        let router = MessageRouter::new();
        let message = create_test_event_message();

        let targets = router.determine_targets(&message);
        assert_eq!(targets, vec![RouteTarget::EventEngine]);
    }

    #[test]
    fn test_create_south_message() {
        let router = MessageRouter::new();
        let message = router.create_south_message(
            "测试消息".to_string(),
            "sess_001".to_string(),
            "agent_001".to_string(),
        );

        assert_eq!(message.r#type, CapMessageType::Session);
        assert_eq!(message.sender.id, "ui_core");
        assert_eq!(message.receiver.id, "agent_001");

        if let CapPayload::Session(payload) = message.payload {
            assert_eq!(payload.session_id, "sess_001");
            assert!(payload.message.is_some());
            let msg = payload.message.unwrap();
            assert_eq!(msg.role, "user");
            assert_eq!(msg.content, "测试消息");
        } else {
            panic!("Expected Session payload");
        }
    }

    fn create_test_behavior_message() -> CapMessage {
        CapMessage {
            msg_id: "msg_001".to_string(),
            timestamp: 1234567890,
            r#type: CapMessageType::BehaviorMental,
            sender: CapActor {
                id: "openclaw".to_string(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::BehaviorMental(BehaviorMentalPayload {
                behavior: BehaviorCommand {
                    domain: "internal".to_string(),
                    category: "work".to_string(),
                    action_id: "think".to_string(),
                    urgency: 5,
                    intensity: 1.0,
                    duration_ms: None,
                },
                bubble: None,
            }),
        }
    }

    fn create_test_session_message() -> CapMessage {
        CapMessage {
            msg_id: "msg_002".to_string(),
            timestamp: 1234567890,
            r#type: CapMessageType::Session,
            sender: CapActor {
                id: "openclaw".to_string(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Session(SessionPayload {
                session_id: "sess_001".to_string(),
                is_streaming: Some(false),
                stream_id: None,
                message: Some(ChatMessage {
                    id: "chat_001".to_string(),
                    role: "assistant".to_string(),
                    content: "你好".to_string(),
                }),
                is_finished: Some(true),
                delta: None,
            }),
        }
    }

    fn create_test_notification_message() -> CapMessage {
        CapMessage {
            msg_id: "msg_003".to_string(),
            timestamp: 1234567890,
            r#type: CapMessageType::Notification,
            sender: CapActor {
                id: "openclaw".to_string(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Notification(NotificationPayload {
                title: "通知".to_string(),
                body: "内容".to_string(),
                r#type: "info".to_string(),
            }),
        }
    }

    fn create_test_event_message() -> CapMessage {
        CapMessage {
            msg_id: "msg_004".to_string(),
            timestamp: 1234567890,
            r#type: CapMessageType::Event,
            sender: CapActor {
                id: "openclaw".to_string(),
                r#type: "assistant".to_string(),
                source_app: "openclaw".to_string(),
            },
            receiver: CapActor {
                id: "ui_core".to_string(),
                r#type: "assistant".to_string(),
                source_app: "deepjelly".to_string(),
            },
            payload: CapPayload::Event(EventPayload {
                event_type: "test".to_string(),
                data: serde_json::json!({}),
            }),
        }
    }

    #[tokio::test]
    async fn test_route_north() {
        let router = MessageRouter::new();
        let mut receiver = router.subscribe();

        let message = create_test_behavior_message();
        let result = router.route_north(message).await;

        assert!(result.is_ok());

        // 等待接收路由消息
        use tokio::time::{timeout, Duration};
        let recv_result = timeout(Duration::from_millis(100), receiver.recv()).await;
        assert!(recv_result.is_ok());
    }
}
