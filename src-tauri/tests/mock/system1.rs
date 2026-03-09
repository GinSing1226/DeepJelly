//! Mock System1 objects for testing

use deepjelly::logic::system1::{
    Rule, RuleResponse, ResponseAction, PresentationResponse,
    BubbleCommand, BubbleType, BubblePosition, RuleTrigger, EventMatcher,
    System1, Condition, ConditionOperator,
};

/// Mock规则构建器
pub struct MockRuleBuilder {
    id: String,
    name: String,
    priority: u32,
}

impl MockRuleBuilder {
    pub fn new(id: &str) -> Self {
        Self {
            id: id.to_string(),
            name: format!("Mock Rule {}", id),
            priority: 0,
        }
    }

    pub fn with_name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    pub fn with_priority(mut self, priority: u32) -> Self {
        self.priority = priority;
        self
    }

    /// 创建点击响应规则
    pub fn click_response(self, bubble_text: &str) -> Rule {
        Rule::new(&self.id, &self.name)
            .with_priority(self.priority)
            .add_trigger(
                RuleTrigger::new(
                    EventMatcher::new("user_interaction").with_action_pattern("click")
                )
            )
            .with_response(
                RuleResponse::new()
                    .add_action(ResponseAction::new("log").with_param("message", serde_json::json!(bubble_text)))
                    .with_presentation(
                        PresentationResponse::new()
                            .with_bubble(BubbleCommand::new(bubble_text, BubbleType::Info))
                            .with_animation("wave")
                    )
            )
    }

    /// 创建系统启动响应规则
    pub fn startup_response(self, bubble_text: &str) -> Rule {
        Rule::new(&self.id, &self.name)
            .with_priority(self.priority)
            .add_trigger(
                RuleTrigger::new(
                    EventMatcher::new("system").with_action_pattern("startup")
                )
            )
            .with_response(
                RuleResponse::new()
                    .add_action(ResponseAction::new("init"))
                    .with_presentation(
                        PresentationResponse::new()
                            .with_bubble(BubbleCommand::new(bubble_text, BubbleType::Success))
                    )
            )
    }

    /// 创建通配符规则
    pub fn wildcard(self) -> Rule {
        Rule::new(&self.id, &self.name)
            .with_priority(self.priority)
            .add_trigger(
                RuleTrigger::new(EventMatcher::new("*"))
            )
            .with_response(
                RuleResponse::new()
                    .add_action(ResponseAction::new("handle"))
            )
    }
}

/// 预定义的Mock规则
pub mod presets {
    use super::*;

    /// 点击显示"Hello"气泡
    pub fn click_hello() -> Rule {
        MockRuleBuilder::new("click_hello")
            .click_response("Hello!")
            .build()
    }

    /// 启动显示"Welcome"气泡
    pub fn startup_welcome() -> Rule {
        MockRuleBuilder::new("startup_welcome")
            .startup_response("Welcome!")
            .build()
    }

    /// 高优先级点击规则
    pub fn high_priority_click() -> Rule {
        MockRuleBuilder::new("high_click")
            .with_name("High Priority Click")
            .with_priority(100)
            .click_response("High Priority Response")
            .build()
    }
}

/// 创建包含预设规则的System1
pub fn mock_system1_with_presets() -> System1 {
    let mut system = System1::new();
    system.add_rule(presets::click_hello());
    system.add_rule(presets::startup_welcome());
    system
}

/// 创建空System1
pub fn mock_empty_system1() -> System1 {
    System1::new()
}
