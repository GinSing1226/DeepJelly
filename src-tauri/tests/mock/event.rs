//! Mock event objects for testing

use deepjelly::logic::event_engine::{Event, EventAction, EventTarget, EventScene, EventTime};
use serde_json::Value;

/// Mock事件构建器
pub struct MockEventBuilder {
    event: Option<Event>,
}

impl MockEventBuilder {
    pub fn new() -> Self {
        Self { event: None }
    }

    /// 创建用户交互事件
    pub fn user_interaction(mut self, action: &str, target: &str) -> Self {
        self.event = Some(Event::UserInteraction {
            action: EventAction::new(action),
            target: EventTarget::new(target),
        });
        self
    }

    /// 创建系统事件
    pub fn system(mut self, action: &str, scene: EventScene) -> Self {
        self.event = Some(Event::System {
            action: EventAction::new(action),
            scene,
        });
        self
    }

    /// 创建定时事件
    pub fn scheduled(mut self, timestamp: u64, payload: Value) -> Self {
        self.event = Some(Event::Scheduled {
            time: EventTime::new(timestamp),
            payload,
        });
        self
    }

    /// 创建外部事件
    pub fn external(mut self, source: &str, data: Value) -> Self {
        self.event = Some(Event::External {
            source: source.to_string(),
            data,
        });
        self
    }

    pub fn build(self) -> Event {
        self.event.expect("Event type not specified")
    }
}

impl Default for MockEventBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// 预定义的Mock事件
pub mod presets {
    use super::*;

    /// 点击按钮事件
    pub fn click_button(button_id: &str) -> Event {
        MockEventBuilder::new()
            .user_interaction("click", button_id)
            .build()
    }

    /// 系统启动事件
    pub fn system_startup() -> Event {
        MockEventBuilder::new()
            .system("startup", EventScene::Startup)
            .build()
    }

    /// 系统关闭事件
    pub fn system_shutdown() -> Event {
        MockEventBuilder::new()
            .system("shutdown", EventScene::Shutdown)
            .build()
    }

    /// 空闲检测事件
    pub fn system_idle() -> Event {
        MockEventBuilder::new()
            .system("idle", EventScene::Idle)
            .build()
    }
}
