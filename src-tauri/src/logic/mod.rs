//! Logic layer module
//!
//! Handles message routing, state management, event processing, and configuration.

pub mod character;
pub mod config;
pub mod data_init;
pub mod event_engine;
pub mod protocol;
pub mod router;
pub mod session;
pub mod state;
pub mod system1;

pub use character::{
    AnimationActionId, AnimationCategory, AnimationCommand, AnimationDomain,
    AnimationResource, Appearance, AppearanceConfig, Assistant, Character,
    CharacterConfig, ResourceType,
};
pub use config::{
    AppConfig, BrainConfig, CharacterAppConfig, ConfigManager, GatewayConfig, ReactionConfig,
};
pub use event_engine::{
    Event, EventAction, EventScene, EventState, EventTarget, EventTime,
    MatchedRule, ProcessedEvent,
    process_event, validate_event,
};
pub use protocol::{
    BehaviorCommand, BubbleContent, BehaviorMentalPayload, CapActor,
    CapMessage, CapMessageType, CapPayload, ChatDelta, ChatMessage,
    EventPayload, NotificationPayload, SessionPayload,
};
pub use system1::{
    BubbleCommand, BubblePosition, BubbleType, Condition, ConditionOperator,
    EventMatcher, PresentationResponse, ResponseAction, Rule, RuleResponse, RuleTrigger, System1,
};
pub use router::{MessageRouter, RouteTarget, RoutedMessage};
pub use session::{ChatType, Session, SessionManager};
pub use state::{AppState, ConnectionStatus, SharedState};
pub use data_init::{initialize_user_data, get_default_dir, get_user_dir, DEFAULT_DIR, USER_DIR};
