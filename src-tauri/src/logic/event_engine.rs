//! Event engine module
//!
//! Handles event processing and dispatching.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Import RuleResponse for ProcessedEvent
use super::system1::RuleResponse;

/// 事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum Event {
    #[serde(rename = "user_interaction")]
    UserInteraction {
        action: EventAction,
        target: EventTarget,
    },
    #[serde(rename = "system")]
    System {
        action: EventAction,
        scene: EventScene,
    },
    #[serde(rename = "scheduled")]
    Scheduled {
        time: EventTime,
        payload: serde_json::Value,
    },
    #[serde(rename = "external")]
    External {
        source: String,
        data: serde_json::Value,
    },
}

/// 事件动作
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventAction {
    pub name: String,
    pub params: HashMap<String, serde_json::Value>,
}

impl EventAction {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            params: HashMap::new(),
        }
    }

    pub fn with_param(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.params.insert(key.into(), value);
        self
    }
}

/// 事件状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EventState {
    Pending,
    Processing,
    Completed,
    Failed,
}

/// 事件目标
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventTarget {
    pub element_type: String,
    pub element_id: Option<String>,
    pub selector: Option<String>,
}

impl EventTarget {
    pub fn new(element_type: impl Into<String>) -> Self {
        Self {
            element_type: element_type.into(),
            element_id: None,
            selector: None,
        }
    }

    pub fn with_id(mut self, id: impl Into<String>) -> Self {
        self.element_id = Some(id.into());
        self
    }

    pub fn with_selector(mut self, selector: impl Into<String>) -> Self {
        self.selector = Some(selector.into());
        self
    }
}

/// 事件场景
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EventScene {
    Startup,
    Shutdown,
    Idle,
    Active,
    Background,
}

/// 事件时间
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventTime {
    pub timestamp: u64,
    pub timezone: Option<String>,
    pub recurring: bool,
}

impl EventTime {
    pub fn new(timestamp: u64) -> Self {
        Self {
            timestamp,
            timezone: None,
            recurring: false,
        }
    }

    pub fn recurring(mut self) -> Self {
        self.recurring = true;
        self
    }
}

/// 处理后的事件结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedEvent {
    /// 原始事件
    pub event: Event,
    /// 处理状态
    pub state: EventState,
    /// 匹配的规则（如果有）
    pub matched_rule: Option<MatchedRule>,
}

/// 匹配的规则信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchedRule {
    pub rule_id: String,
    pub rule_name: String,
    pub response: RuleResponse,
}

/// 验证事件
pub fn validate_event(event: &Event) -> Result<(), String> {
    match event {
        Event::UserInteraction { action, target } => {
            if action.name.is_empty() {
                return Err("Action name cannot be empty".to_string());
            }
            if target.element_type.is_empty() {
                return Err("Target element_type cannot be empty".to_string());
            }
        }
        Event::System { action, .. } => {
            if action.name.is_empty() {
                return Err("System action name cannot be empty".to_string());
            }
        }
        Event::Scheduled { time, .. } => {
            if time.timestamp == 0 {
                return Err("Scheduled time timestamp cannot be zero".to_string());
            }
        }
        Event::External { source, .. } => {
            if source.is_empty() {
                return Err("External source cannot be empty".to_string());
            }
        }
    }
    Ok(())
}

/// 处理事件
///
/// 使用 system1 匹配事件并返回处理结果
pub async fn process_event(event: Event) -> Result<ProcessedEvent, String> {
    // First validate the event
    validate_event(&event)?;

    // Import System1 for matching
    use super::system1::System1;

    // Create a default system1
    // Note: In production, this should use a shared system instance
    let system1 = System1::new();

    // Try to match against reaction rules
    let matched_rule = system1.match_rule(&event);

    let state = if matched_rule.is_some() {
        EventState::Completed
    } else {
        // No rule matched, but event was still processed
        EventState::Completed
    };

    let matched_rule_info = matched_rule.map(|rule| MatchedRule {
        rule_id: rule.id.clone(),
        rule_name: rule.name.clone(),
        response: rule.response.clone(),
    });

    Ok(ProcessedEvent {
        event,
        state,
        matched_rule: matched_rule_info,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_action_creation() {
        let action = EventAction::new("click")
            .with_param("x", serde_json::json!(100))
            .with_param("y", serde_json::json!(200));

        assert_eq!(action.name, "click");
        assert_eq!(action.params.get("x").unwrap(), &serde_json::json!(100));
    }

    #[test]
    fn test_event_target_creation() {
        let target = EventTarget::new("button")
            .with_id("submit-btn")
            .with_selector("#submit-btn");

        assert_eq!(target.element_type, "button");
        assert_eq!(target.element_id, Some("submit-btn".to_string()));
        assert_eq!(target.selector, Some("#submit-btn".to_string()));
    }

    #[test]
    fn test_event_time_creation() {
        let time = EventTime::new(1234567890).recurring();

        assert_eq!(time.timestamp, 1234567890);
        assert!(time.recurring);
    }

    #[test]
    fn test_validate_user_interaction_event() {
        let event = Event::UserInteraction {
            action: EventAction::new("click"),
            target: EventTarget::new("button"),
        };

        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_validate_event_empty_action_name() {
        let event = Event::UserInteraction {
            action: EventAction::new(""),
            target: EventTarget::new("button"),
        };

        assert!(validate_event(&event).is_err());
    }

    #[test]
    fn test_validate_event_empty_target_type() {
        let event = Event::UserInteraction {
            action: EventAction::new("click"),
            target: EventTarget::new(""),
        };

        assert!(validate_event(&event).is_err());
    }

    #[test]
    fn test_validate_system_event() {
        let event = Event::System {
            action: EventAction::new("startup"),
            scene: EventScene::Startup,
        };

        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_validate_scheduled_event() {
        let event = Event::Scheduled {
            time: EventTime::new(1234567890),
            payload: serde_json::json!({}),
        };

        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_validate_scheduled_event_zero_timestamp() {
        let event = Event::Scheduled {
            time: EventTime::new(0),
            payload: serde_json::json!({}),
        };

        assert!(validate_event(&event).is_err());
    }

    #[test]
    fn test_validate_external_event() {
        let event = Event::External {
            source: "webhook".to_string(),
            data: serde_json::json!({}),
        };

        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_validate_external_event_empty_source() {
        let event = Event::External {
            source: "".to_string(),
            data: serde_json::json!({}),
        };

        assert!(validate_event(&event).is_err());
    }

    #[tokio::test]
    async fn test_process_user_interaction_event() {
        let event = Event::UserInteraction {
            action: EventAction::new("click"),
            target: EventTarget::new("button"),
        };

        let result = process_event(event).await;
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert_eq!(processed.state, EventState::Completed);
        assert!(processed.matched_rule.is_none()); // No rules configured
    }

    #[tokio::test]
    async fn test_process_system_event() {
        let event = Event::System {
            action: EventAction::new("startup"),
            scene: EventScene::Startup,
        };

        let result = process_event(event).await;
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert_eq!(processed.state, EventState::Completed);
    }

    #[tokio::test]
    async fn test_process_scheduled_event() {
        let event = Event::Scheduled {
            time: EventTime::new(1234567890),
            payload: serde_json::json!({"task": "backup"}),
        };

        let result = process_event(event).await;
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert_eq!(processed.state, EventState::Completed);
    }

    #[tokio::test]
    async fn test_process_external_event() {
        let event = Event::External {
            source: "api".to_string(),
            data: serde_json::json!({"command": "refresh"}),
        };

        let result = process_event(event).await;
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert_eq!(processed.state, EventState::Completed);
    }

    #[tokio::test]
    async fn test_processed_event_serialization() {
        let event = Event::UserInteraction {
            action: EventAction::new("click"),
            target: EventTarget::new("button"),
        };

        let result = process_event(event).await.unwrap();
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Completed"));
    }

    #[tokio::test]
    async fn test_process_event_with_invalid_action() {
        let event = Event::UserInteraction {
            action: EventAction::new(""), // Invalid: empty action name
            target: EventTarget::new("button"),
        };

        let result = process_event(event).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_matched_rule_structure() {
        use super::super::system1::{Rule, RuleResponse, ResponseAction, System1};

        // Create a rule
        let rule = Rule::new("test-rule", "Test Rule")
            .add_trigger(
                super::super::system1::RuleTrigger::new(
                    super::super::system1::EventMatcher::new("user_interaction")
                )
            )
            .with_response(
                RuleResponse::new()
                    .add_action(ResponseAction::new("log"))
            );

        let mut system = System1::new();
        system.add_rule(rule);

        let event = Event::UserInteraction {
            action: EventAction::new("click"),
            target: EventTarget::new("button"),
        };

        let matched = system.match_rule(&event);
        assert!(matched.is_some());
        assert_eq!(matched.unwrap().id, "test-rule");
    }

    #[test]
    fn test_event_serialization() {
        let event = Event::UserInteraction {
            action: EventAction::new("click"),
            target: EventTarget::new("button").with_id("btn-1"),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("user_interaction"));
        assert!(json.contains("click"));
        assert!(json.contains("button"));
    }

    #[test]
    fn test_event_deserialization() {
        let json = r#"{
            "type": "user_interaction",
            "action": {
                "name": "click",
                "params": {}
            },
            "target": {
                "element_type": "button",
                "element_id": "btn-1",
                "selector": null
            }
        }"#;

        let event: Event = serde_json::from_str(json).unwrap();
        match event {
            Event::UserInteraction { action, target } => {
                assert_eq!(action.name, "click");
                assert_eq!(target.element_type, "button");
            }
            _ => panic!("Expected UserInteraction event"),
        }
    }
}
