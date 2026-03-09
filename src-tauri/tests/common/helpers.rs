//! Test helper functions
//!
//! 通用测试辅助函数。

use deepjelly::logic::event_engine::{Event, EventAction, EventTarget, EventScene};
use deepjelly::logic::system1::{Rule, RuleResponse, ResponseAction, PresentationResponse, BubbleCommand, BubbleType, BubblePosition};
use deepjelly::logic::protocol::{CapMessage, CapMessageType, CapActor, CapPayload, NotificationPayload};
use std::time::{SystemTime, UNIX_EPOCH};

/// 创建当前时间戳
pub fn now_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// 创建Mock用户交互事件
pub fn mock_click_event(target: &str) -> Event {
    Event::UserInteraction {
        action: EventAction::new("click").with_param("x", serde_json::json!(100)),
        target: EventTarget::new(target),
    }
}

/// 创建Mock系统启动事件
pub fn mock_startup_event() -> Event {
    Event::System {
        action: EventAction::new("startup"),
        scene: EventScene::Startup,
    }
}

/// 创建Mock规则（点击时显示气泡）
pub fn mock_click_bubble_rule(rule_id: &str) -> Rule {
    Rule::new(rule_id, "Click Bubble Rule")
        .with_priority(10)
        .add_trigger(
            deepjelly::logic::system1::RuleTrigger::new(
                deepjelly::logic::system1::EventMatcher::new("user_interaction")
                    .with_action_pattern("click")
            )
        )
        .with_response(
            RuleResponse::new()
                .add_action(ResponseAction::new("log").with_param("message", serde_json::json!("Click detected")))
                .with_presentation(
                    PresentationResponse::new()
                        .with_bubble(BubbleCommand::new("Clicked!", BubbleType::Info).with_position(BubblePosition::Top))
                        .with_animation("wave")
                        .with_duration(2000)
                )
        )
}

/// 创建Mock CAP消息
pub fn mock_cap_message(msg_type: CapMessageType, sender: &str) -> CapMessage {
    CapMessage {
        msg_id: format!("msg_{}", now_timestamp()),
        timestamp: now_timestamp(),
        r#type: msg_type,
        sender: CapActor {
            id: sender.to_string(),
            r#type: "assistant".to_string(),
            source_app: "openclaw".to_string(),
        },
        receiver: CapActor {
            id: "ui_core".to_string(),
            r#type: "assistant".to_string(),
            source_app: "deepjelly".to_string(),
        },
        payload: CapPayload::Notification(
            NotificationPayload {
                title: "Test Notification".to_string(),
                body: "Test content".to_string(),
                r#type: "info".to_string(),
            }
        ),
    }
}
