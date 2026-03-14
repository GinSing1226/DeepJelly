//! Data Models Module
//!
//! Central data model definitions for DeepJelly, following the three-layer architecture:
//! Assistant (助手) -> Character (角色) -> Appearance (形象) -> Action (动作)
//!
//! This module provides structured types that match the TypeScript definitions in src/types/

pub mod assistant;
pub mod character;
pub mod appearance;
pub mod integration;
pub mod endpoint;

// Re-export all model types for convenience
pub use assistant::{Assistant, AssistantsData, Integration};
pub use character::{Character, CharacterReference};
pub use appearance::{Appearance, Action, ActionType, SpriteSheetConfig};
pub use integration::{DisplaySlot, DisplaySlotsData};
