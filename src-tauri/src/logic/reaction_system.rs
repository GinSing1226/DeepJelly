//! Reaction system module
//!
//! Handles rule-based event matching and response generation.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::event_engine::Event;

/// 规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub priority: u32,
    pub triggers: Vec<RuleTrigger>,
    pub response: RuleResponse,
}

impl Rule {
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            enabled: true,
            priority: 0,
            triggers: Vec::new(),
            response: RuleResponse::default(),
        }
    }

    pub fn with_priority(mut self, priority: u32) -> Self {
        self.priority = priority;
        self
    }

    pub fn add_trigger(mut self, trigger: RuleTrigger) -> Self {
        self.triggers.push(trigger);
        self
    }

    pub fn with_response(mut self, response: RuleResponse) -> Self {
        self.response = response;
        self
    }
}

/// 规则触发器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleTrigger {
    pub event_matcher: EventMatcher,
    pub conditions: Vec<Condition>,
}

impl RuleTrigger {
    pub fn new(event_matcher: EventMatcher) -> Self {
        Self {
            event_matcher,
            conditions: Vec::new(),
        }
    }

    pub fn add_condition(mut self, condition: Condition) -> Self {
        self.conditions.push(condition);
        self
    }
}

/// 事件匹配器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMatcher {
    pub event_type: String,
    pub action_pattern: Option<String>,
}

impl EventMatcher {
    pub fn new(event_type: impl Into<String>) -> Self {
        Self {
            event_type: event_type.into(),
            action_pattern: None,
        }
    }

    pub fn with_action_pattern(mut self, pattern: impl Into<String>) -> Self {
        self.action_pattern = Some(pattern.into());
        self
    }
}

/// 条件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub field: String,
    pub operator: ConditionOperator,
    pub value: serde_json::Value,
}

impl Condition {
    pub fn new(field: impl Into<String>, operator: ConditionOperator, value: serde_json::Value) -> Self {
        Self {
            field: field.into(),
            operator,
            value,
        }
    }
}

/// 条件操作符
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    Contains,
    GreaterThan,
    LessThan,
}

/// 规则响应
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleResponse {
    pub actions: Vec<ResponseAction>,
    pub presentation: Option<PresentationResponse>,
}

impl RuleResponse {
    pub fn new() -> Self {
        Self {
            actions: Vec::new(),
            presentation: None,
        }
    }

    pub fn add_action(mut self, action: ResponseAction) -> Self {
        self.actions.push(action);
        self
    }

    pub fn with_presentation(mut self, presentation: PresentationResponse) -> Self {
        self.presentation = Some(presentation);
        self
    }
}

/// 响应动作
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseAction {
    pub action_type: String,
    pub params: HashMap<String, serde_json::Value>,
}

impl ResponseAction {
    pub fn new(action_type: impl Into<String>) -> Self {
        Self {
            action_type: action_type.into(),
            params: HashMap::new(),
        }
    }

    pub fn with_param(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.params.insert(key.into(), value);
        self
    }
}

/// 展示响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresentationResponse {
    pub bubble: Option<BubbleCommand>,
    pub animation: Option<String>,
    pub duration_ms: Option<u64>,
}

impl PresentationResponse {
    pub fn new() -> Self {
        Self {
            bubble: None,
            animation: None,
            duration_ms: None,
        }
    }

    pub fn with_bubble(mut self, bubble: BubbleCommand) -> Self {
        self.bubble = Some(bubble);
        self
    }

    pub fn with_animation(mut self, animation: impl Into<String>) -> Self {
        self.animation = Some(animation.into());
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }
}

impl Default for PresentationResponse {
    fn default() -> Self {
        Self::new()
    }
}

/// 气泡命令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BubbleCommand {
    pub text: String,
    pub bubble_type: BubbleType,
    pub position: Option<BubblePosition>,
}

impl BubbleCommand {
    pub fn new(text: impl Into<String>, bubble_type: BubbleType) -> Self {
        Self {
            text: text.into(),
            bubble_type,
            position: None,
        }
    }

    pub fn with_position(mut self, position: BubblePosition) -> Self {
        self.position = Some(position);
        self
    }
}

/// 气泡类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BubbleType {
    Info,
    Warning,
    Error,
    Success,
    Chat,
}

/// 气泡位置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BubblePosition {
    Top,
    Bottom,
    Left,
    Right,
    Center,
}

/// 反应系统
#[derive(Debug, Default)]
pub struct ReactionSystem {
    rules: Vec<Rule>,
}

impl ReactionSystem {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn add_rule(&mut self, rule: Rule) {
        self.rules.push(rule);
        // Sort by priority (higher priority first)
        self.rules.sort_by(|a, b| b.priority.cmp(&a.priority));
    }

    pub fn remove_rule(&mut self, rule_id: &str) -> bool {
        let initial_len = self.rules.len();
        self.rules.retain(|r| r.id != rule_id);
        self.rules.len() != initial_len
    }

    pub fn get_rules(&self) -> &[Rule] {
        &self.rules
    }

    /// 匹配规则
    pub fn match_rule(&self, event: &Event) -> Option<&Rule> {
        for rule in &self.rules {
            if !rule.enabled {
                continue;
            }

            for trigger in &rule.triggers {
                if self.matches_event(&trigger.event_matcher, event) {
                    // Check conditions if any
                    if trigger.conditions.is_empty() || self.check_conditions(&trigger.conditions) {
                        return Some(rule);
                    }
                }
            }
        }
        None
    }

    fn matches_event(&self, matcher: &EventMatcher, event: &Event) -> bool {
        let event_type = match event {
            Event::UserInteraction { .. } => "user_interaction",
            Event::System { .. } => "system",
            Event::Scheduled { .. } => "scheduled",
            Event::External { .. } => "external",
        };

        if matcher.event_type != event_type && matcher.event_type != "*" {
            return false;
        }

        // Check action pattern if specified
        if let Some(pattern) = &matcher.action_pattern {
            let action_name = match event {
                Event::UserInteraction { action, .. } => &action.name,
                Event::System { action, .. } => &action.name,
                _ => return true,
            };

            // Simple pattern matching (supports * wildcard)
            if pattern == "*" {
                return true;
            }
            return action_name == pattern;
        }

        true
    }

    fn check_conditions(&self, _conditions: &[Condition]) -> bool {
        // Placeholder for condition evaluation
        // In a real implementation, this would evaluate conditions against event data
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rule_creation() {
        let rule = Rule::new("rule-1", "Test Rule")
            .with_priority(10);

        assert_eq!(rule.id, "rule-1");
        assert_eq!(rule.name, "Test Rule");
        assert_eq!(rule.priority, 10);
        assert!(rule.enabled);
    }

    #[test]
    fn test_event_matcher_creation() {
        let matcher = EventMatcher::new("user_interaction")
            .with_action_pattern("click");

        assert_eq!(matcher.event_type, "user_interaction");
        assert_eq!(matcher.action_pattern, Some("click".to_string()));
    }

    #[test]
    fn test_rule_trigger_creation() {
        let trigger = RuleTrigger::new(EventMatcher::new("system"))
            .add_condition(Condition::new("scene", ConditionOperator::Equals, serde_json::json!("startup")));

        assert_eq!(trigger.event_matcher.event_type, "system");
        assert_eq!(trigger.conditions.len(), 1);
    }

    #[test]
    fn test_response_action_creation() {
        let action = ResponseAction::new("show_bubble")
            .with_param("text", serde_json::json!("Hello!"));

        assert_eq!(action.action_type, "show_bubble");
        assert_eq!(action.params.get("text").unwrap(), &serde_json::json!("Hello!"));
    }

    #[test]
    fn test_bubble_command_creation() {
        let bubble = BubbleCommand::new("Welcome!", BubbleType::Info)
            .with_position(BubblePosition::Top);

        assert_eq!(bubble.text, "Welcome!");
        assert_eq!(bubble.bubble_type, BubbleType::Info);
        assert_eq!(bubble.position, Some(BubblePosition::Top));
    }

    #[test]
    fn test_presentation_response_creation() {
        let presentation = PresentationResponse::new()
            .with_animation("wave")
            .with_duration(2000);

        assert_eq!(presentation.animation, Some("wave".to_string()));
        assert_eq!(presentation.duration_ms, Some(2000));
    }

    #[test]
    fn test_rule_response_creation() {
        let response = RuleResponse::new()
            .add_action(ResponseAction::new("animate"))
            .with_presentation(PresentationResponse::new());

        assert_eq!(response.actions.len(), 1);
        assert!(response.presentation.is_some());
    }

    #[test]
    fn test_reaction_system_add_rule() {
        let mut system = ReactionSystem::new();
        let rule = Rule::new("rule-1", "Test Rule");
        system.add_rule(rule);

        assert_eq!(system.get_rules().len(), 1);
    }

    #[test]
    fn test_reaction_system_remove_rule() {
        let mut system = ReactionSystem::new();
        system.add_rule(Rule::new("rule-1", "Test Rule"));
        system.add_rule(Rule::new("rule-2", "Another Rule"));

        assert!(system.remove_rule("rule-1"));
        assert_eq!(system.get_rules().len(), 1);
        assert!(!system.remove_rule("nonexistent"));
    }

    #[test]
    fn test_reaction_system_priority_sorting() {
        let mut system = ReactionSystem::new();
        system.add_rule(Rule::new("low", "Low Priority").with_priority(1));
        system.add_rule(Rule::new("high", "High Priority").with_priority(10));
        system.add_rule(Rule::new("medium", "Medium Priority").with_priority(5));

        let rules = system.get_rules();
        assert_eq!(rules[0].priority, 10);
        assert_eq!(rules[1].priority, 5);
        assert_eq!(rules[2].priority, 1);
    }

    #[test]
    fn test_match_rule_user_interaction() {
        let mut system = ReactionSystem::new();
        let rule = Rule::new("click-rule", "Click Handler")
            .add_trigger(RuleTrigger::new(
                EventMatcher::new("user_interaction").with_action_pattern("click")
            ));
        system.add_rule(rule);

        let event = Event::UserInteraction {
            action: super::super::event_engine::EventAction::new("click"),
            target: super::super::event_engine::EventTarget::new("button"),
        };

        let matched = system.match_rule(&event);
        assert!(matched.is_some());
        assert_eq!(matched.unwrap().id, "click-rule");
    }

    #[test]
    fn test_match_rule_system_event() {
        let mut system = ReactionSystem::new();
        let rule = Rule::new("startup-rule", "Startup Handler")
            .add_trigger(RuleTrigger::new(
                EventMatcher::new("system").with_action_pattern("startup")
            ));
        system.add_rule(rule);

        let event = Event::System {
            action: super::super::event_engine::EventAction::new("startup"),
            scene: super::super::event_engine::EventScene::Startup,
        };

        let matched = system.match_rule(&event);
        assert!(matched.is_some());
        assert_eq!(matched.unwrap().id, "startup-rule");
    }

    #[test]
    fn test_match_rule_no_match() {
        let mut system = ReactionSystem::new();
        let rule = Rule::new("click-rule", "Click Handler")
            .add_trigger(RuleTrigger::new(
                EventMatcher::new("user_interaction").with_action_pattern("click")
            ));
        system.add_rule(rule);

        let event = Event::UserInteraction {
            action: super::super::event_engine::EventAction::new("hover"),
            target: super::super::event_engine::EventTarget::new("button"),
        };

        let matched = system.match_rule(&event);
        assert!(matched.is_none());
    }

    #[test]
    fn test_match_rule_disabled_rule() {
        let mut system = ReactionSystem::new();
        let mut rule = Rule::new("disabled-rule", "Disabled Handler")
            .add_trigger(RuleTrigger::new(
                EventMatcher::new("user_interaction").with_action_pattern("click")
            ));
        rule.enabled = false;
        system.add_rule(rule);

        let event = Event::UserInteraction {
            action: super::super::event_engine::EventAction::new("click"),
            target: super::super::event_engine::EventTarget::new("button"),
        };

        let matched = system.match_rule(&event);
        assert!(matched.is_none());
    }

    #[test]
    fn test_match_rule_wildcard() {
        let mut system = ReactionSystem::new();
        let rule = Rule::new("wildcard-rule", "Wildcard Handler")
            .add_trigger(RuleTrigger::new(
                EventMatcher::new("*")
            ));
        system.add_rule(rule);

        let event = Event::UserInteraction {
            action: super::super::event_engine::EventAction::new("click"),
            target: super::super::event_engine::EventTarget::new("button"),
        };

        let matched = system.match_rule(&event);
        assert!(matched.is_some());
    }

    #[test]
    fn test_rule_serialization() {
        let rule = Rule::new("rule-1", "Test Rule")
            .add_trigger(RuleTrigger::new(EventMatcher::new("user_interaction")));

        let json = serde_json::to_string(&rule).unwrap();
        assert!(json.contains("rule-1"));
        assert!(json.contains("Test Rule"));
    }

    #[test]
    fn test_bubble_type_serialization() {
        let bubble = BubbleCommand::new("Test", BubbleType::Success);
        let json = serde_json::to_string(&bubble).unwrap();
        assert!(json.contains("Success"));
    }

    #[test]
    fn test_condition_operator_serialization() {
        let condition = Condition::new("field", ConditionOperator::Equals, serde_json::json!("value"));
        let json = serde_json::to_string(&condition).unwrap();
        assert!(json.contains("Equals"));
    }
}
