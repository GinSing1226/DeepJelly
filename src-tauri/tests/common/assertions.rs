//! Test assertion helpers
//!
//! 通用断言辅助函数。

use deepjelly::logic::event_engine::ProcessedEvent;
use deepjelly::logic::system1::BubbleType;

/// 断言事件处理成功并匹配到规则
pub fn assert_matched(processed: &ProcessedEvent, expected_rule_id: &str) {
    assert!(
        processed.matched_rule.is_some(),
        "Expected a matched rule, but got None"
    );
    let rule = processed.matched_rule.as_ref().unwrap();
    assert_eq!(
        rule.rule_id, expected_rule_id,
        "Expected rule_id {}, got {}",
        expected_rule_id, rule.rule_id
    );
}

/// 断言事件处理成功但没有匹配规则
pub fn assert_no_match(processed: &ProcessedEvent) {
    assert!(
        processed.matched_rule.is_none(),
        "Expected no matched rule, but got {:?}",
        processed.matched_rule
    );
}

/// 断言响应包含气泡命令
pub fn assert_has_bubble(processed: &ProcessedEvent, expected_text: &str, expected_type: BubbleType) {
    let rule = processed.matched_rule.as_ref()
        .expect("Expected matched rule");
    let presentation = rule.response.presentation.as_ref()
        .expect("Expected presentation response");
    let bubble = presentation.bubble.as_ref()
        .expect("Expected bubble command");
    assert_eq!(bubble.text, expected_text);
    assert_eq!(bubble.bubble_type, expected_type);
}

/// 断言配置值相等
pub fn assert_config_eq<T: std::fmt::Debug + PartialEq>(actual: &T, expected: &T, field: &str) {
    assert_eq!(
        actual, expected,
        "Config field '{}' mismatch: {:?} != {:?}",
        field, actual, expected
    );
}
