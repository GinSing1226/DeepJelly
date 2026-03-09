//! Character management module
//!
//! Manages assistants, characters, appearances, and animation resources.

pub mod app_integration;
pub mod assistant;
pub mod manager;
pub mod types;

pub use app_integration::AppIntegrationManager;
pub use assistant::{Assistant, AssistantManager, UpdatedAssistant, generate_dj_id, generate_application_id};
pub use manager::CharacterManager;
pub use types::*;
