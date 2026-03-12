//! Appearance Model
//!
//! Represents the visual appearance configuration of a character, including action animation resources.
//! Matches TypeScript interface: src/types/character.ts -> Appearance, Action

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Spritesheet format types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SpriteSheetFormat {
    /// PIXI.js JSON format
    PixiJson,
    /// TexturePacker JSON format
    TexturePacker,
    /// Aseprite JSON format
    Aseprite,
    /// Custom grid slicing
    CustomGrid,
}

/// Grid configuration for custom spritesheet slicing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpriteSheetGrid {
    /// Width of each frame in pixels
    pub frame_width: u32,
    /// Height of each frame in pixels
    pub frame_height: u32,
    /// Number of rows in the spritesheet
    pub rows: u32,
    /// Number of columns in the spritesheet
    pub cols: u32,
    /// Spacing between frames in pixels (optional, default 0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spacing: Option<u32>,
    /// Margin around the spritesheet edge in pixels (optional, default 0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin: Option<u32>,
}

/// Spritesheet configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpriteSheetConfig {
    /// Spritesheet format
    pub format: SpriteSheetFormat,
    /// URL or path to the spritesheet metadata file (for pixi-json, aseprite, etc.)
    /// Not needed for custom-grid format
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// Grid configuration (only for custom-grid format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grid: Option<SpriteSheetGrid>,
}

/// Action (动作)
///
/// An animation behavior of an appearance, containing multiple frame resources.
///
/// # Fields
/// * `type` - Resource type (frames, gif, live2d, 3d, digital_human, spritesheet)
/// * `resources` - List of resource file paths
/// * `fps` - Frame rate (1-60, for frames/spritesheet type)
/// * `loop` - Whether to loop playback
/// * `spritesheet` - Spritesheet configuration (only for spritesheet type)
/// * `description` - Optional description (max 200 chars)
///
/// # Example
/// ```json
/// {
///   "type": "frames",
///   "resources": ["0001.png", "0002.png"],
///   "fps": 24,
///   "loop": true,
///   "description": null
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    /// Resource type
    #[serde(rename = "type")]
    pub action_type: ActionType,

    /// List of resource file paths
    pub resources: Vec<String>,

    /// Frame rate (1-60, for frames/spritesheet type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<u32>,

    /// Whether to loop playback
    pub r#loop: bool,

    /// Spritesheet configuration (only for spritesheet type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spritesheet: Option<SpriteSheetConfig>,

    /// Optional description (max 200 characters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Action resource types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ActionType {
    /// Frame sequence animation
    Frames,
    /// GIF animation
    Gif,
    /// Live2D animation
    Live2d,
    /// 3D model animation
    #[serde(rename = "3d")]
    Model3D,
    /// Digital human animation
    DigitalHuman,
    /// Spritesheet animation
    Spritesheet,
}

impl ActionType {
    /// Get all possible action type values
    pub fn all_values() -> Vec<&'static str> {
        vec!["frames", "gif", "live2d", "3d", "digital_human", "spritesheet"]
    }

    /// Check if the type requires fps
    pub fn requires_fps(&self) -> bool {
        matches!(self, ActionType::Frames | ActionType::Spritesheet)
    }
}

impl Action {
    /// Create a new frame sequence action
    pub fn frames(resources: Vec<String>, fps: u32, loop_: bool) -> Self {
        Self {
            action_type: ActionType::Frames,
            resources,
            fps: Some(fps),
            r#loop: loop_,
            spritesheet: None,
            description: None,
        }
    }

    /// Create a new GIF action
    pub fn gif(resource: String, loop_: bool) -> Self {
        Self {
            action_type: ActionType::Gif,
            resources: vec![resource],
            fps: None,
            r#loop: loop_,
            spritesheet: None,
            description: None,
        }
    }

    /// Create a new Live2D action
    pub fn live2d(resource: String, loop_: bool) -> Self {
        Self {
            action_type: ActionType::Live2d,
            resources: vec![resource],
            fps: None,
            r#loop: loop_,
            spritesheet: None,
            description: None,
        }
    }

    /// Create a new 3D model action
    pub fn model_3d(resource: String, loop_: bool) -> Self {
        Self {
            action_type: ActionType::Model3D,
            resources: vec![resource],
            fps: None,
            r#loop: loop_,
            spritesheet: None,
            description: None,
        }
    }

    /// Create a new spritesheet action with custom grid
    pub fn spritesheet_grid(
        resource: String,
        fps: u32,
        loop_: bool,
        frame_width: u32,
        frame_height: u32,
        rows: u32,
        cols: u32,
        spacing: Option<u32>,
        margin: Option<u32>,
    ) -> Self {
        Self {
            action_type: ActionType::Spritesheet,
            resources: vec![resource],
            fps: Some(fps),
            r#loop: loop_,
            spritesheet: Some(SpriteSheetConfig {
                format: SpriteSheetFormat::CustomGrid,
                url: None,
                grid: Some(SpriteSheetGrid {
                    frame_width,
                    frame_height,
                    rows,
                    cols,
                    spacing,
                    margin,
                }),
            }),
            description: None,
        }
    }

    /// Create a new spritesheet action with external metadata file
    pub fn spritesheet_with_metadata(
        resource: String,
        fps: u32,
        loop_: bool,
        format: SpriteSheetFormat,
        metadata_url: String,
    ) -> Self {
        Self {
            action_type: ActionType::Spritesheet,
            resources: vec![resource],
            fps: Some(fps),
            r#loop: loop_,
            spritesheet: Some(SpriteSheetConfig {
                format,
                url: Some(metadata_url),
                grid: None,
            }),
            description: None,
        }
    }

    /// Validate the action configuration
    pub fn validate(&self) -> Result<(), String> {
        // Check if resources list is not empty
        if self.resources.is_empty() {
            return Err("Action must have at least one resource".to_string());
        }

        // Check fps for frames type
        if self.action_type.requires_fps() {
            if let Some(fps) = self.fps {
                if fps < 1 || fps > 60 {
                    return Err(format!("FPS must be between 1 and 60, got {}", fps));
                }
            } else {
                return Err("Frames type requires FPS value".to_string());
            }
        }

        Ok(())
    }
}

/// Appearance (形象)
///
/// The visual appearance configuration of a character, containing action animation resources.
///
/// # Fields
/// * `id` - Appearance ID (3-30 chars, unique within character)
/// * `name` - Appearance name (1-50 chars)
/// * `is_default` - Whether this is the default appearance
/// * `description` - Optional description (max 200 chars)
/// * `actions` - Map of action configurations (key -> Action)
///
/// # Example
/// ```json
/// {
///   "id": "appr_casual",
///   "name": "休闲装",
///   "isDefault": true,
///   "description": "日常休闲装扮",
///   "actions": {
///     "internal-base-idle": {
///       "type": "frames",
///       "resources": ["0001.png", "0002.png"],
///       "fps": 24,
///       "loop": true,
///       "description": null
///     }
///   }
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appearance {
    /// Appearance ID (3-30 characters, unique within character)
    pub id: String,

    /// Appearance name (1-50 characters)
    pub name: String,

    /// Whether this is the default appearance
    #[serde(rename = "isDefault", alias = "is_default")]
    pub is_default: bool,

    /// Optional description (max 200 characters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Map of action configurations (action key -> Action)
    pub actions: HashMap<String, Action>,
}

impl Appearance {
    /// Create a new appearance
    pub fn new(id: String, name: String, is_default: bool) -> Self {
        Self {
            id,
            name,
            is_default,
            description: None,
            actions: HashMap::new(),
        }
    }

    /// Add an action to this appearance
    pub fn add_action(&mut self, key: String, action: Action) {
        self.actions.insert(key, action);
    }

    /// Get an action by key
    pub fn get_action(&self, key: &str) -> Option<&Action> {
        self.actions.get(key)
    }

    /// Remove an action by key
    pub fn remove_action(&mut self, key: &str) -> Option<Action> {
        self.actions.remove(key)
    }

    /// Get all action keys
    pub fn action_keys(&self) -> Vec<String> {
        self.actions.keys().cloned().collect()
    }

    /// Validate all actions in this appearance
    pub fn validate_actions(&self) -> Result<(), String> {
        for (key, action) in &self.actions {
            action.validate()
                .map_err(|e| format!("Action '{}': {}", key, e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_action_type_values() {
        let values = ActionType::all_values();
        assert_eq!(values.len(), 6);
        assert!(values.contains(&"frames"));
        assert!(values.contains(&"gif"));
        assert!(values.contains(&"live2d"));
        assert!(values.contains(&"3d"));
        assert!(values.contains(&"digital_human"));
        assert!(values.contains(&"spritesheet"));
    }

    #[test]
    fn test_action_type_requires_fps() {
        assert!(ActionType::Frames.requires_fps());
        assert!(!ActionType::Gif.requires_fps());
        assert!(!ActionType::Live2d.requires_fps());
    }

    #[test]
    fn test_action_frames() {
        let action = Action::frames(
            vec!["0001.png".to_string(), "0002.png".to_string()],
            24,
            true,
        );

        assert_eq!(action.action_type, ActionType::Frames);
        assert_eq!(action.resources.len(), 2);
        assert_eq!(action.fps, Some(24));
        assert!(action.r#loop);
        assert!(action.validate().is_ok());
    }

    #[test]
    fn test_action_gif() {
        let action = Action::gif("animation.gif".to_string(), true);

        assert_eq!(action.action_type, ActionType::Gif);
        assert_eq!(action.resources.len(), 1);
        assert!(action.r#loop);
        assert!(action.validate().is_ok());
    }

    #[test]
    fn test_action_validation_empty_resources() {
        let action = Action {
            action_type: ActionType::Frames,
            resources: vec![],
            fps: Some(24),
            r#loop: true,
            description: None,
        };

        assert!(action.validate().is_err());
    }

    #[test]
    fn test_action_validation_invalid_fps() {
        let action = Action {
            action_type: ActionType::Frames,
            resources: vec!["0001.png".to_string()],
            fps: Some(100), // Invalid: > 60
            r#loop: true,
            description: None,
        };

        assert!(action.validate().is_err());
    }

    #[test]
    fn test_action_serialization() {
        let action = Action::frames(
            vec!["0001.png".to_string(), "0002.png".to_string()],
            24,
            true,
        );

        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains("frames"));
        assert!(json.contains("0001.png"));
        assert!(json.contains("24"));
    }

    #[test]
    fn test_appearance_new() {
        let appearance = Appearance::new("appr_casual".to_string(), "休闲装".to_string(), true);

        assert_eq!(appearance.id, "appr_casual");
        assert_eq!(appearance.name, "休闲装");
        assert!(appearance.is_default);
        assert!(appearance.actions.is_empty());
    }

    #[test]
    fn test_appearance_add_action() {
        let mut appearance = Appearance::new("appr_casual".to_string(), "休闲装".to_string(), true);
        let action = Action::frames(vec!["0001.png".to_string()], 24, true);

        appearance.add_action("internal-base-idle".to_string(), action.clone());

        assert_eq!(appearance.actions.len(), 1);
        assert!(appearance.get_action("internal-base-idle").is_some());
    }

    #[test]
    fn test_appearance_serialization() {
        let mut appearance = Appearance::new("appr_casual".to_string(), "休闲装".to_string(), true);
        let action = Action::frames(vec!["0001.png".to_string()], 24, true);
        appearance.add_action("internal-base-idle".to_string(), action);

        let json = serde_json::to_string(&appearance).unwrap();
        assert!(json.contains("appr_casual"));
        assert!(json.contains("internal-base-idle"));
    }

    #[test]
    fn test_appearance_deserialization() {
        let json = r#"{
            "id": "appr_casual",
            "name": "休闲装",
            "isDefault": true,
            "description": "日常休闲装扮",
            "actions": {
                "internal-base-idle": {
                    "type": "frames",
                    "resources": ["0001.png", "0002.png"],
                    "fps": 24,
                    "loop": true,
                    "description": null
                }
            }
        }"#;

        let appearance: Appearance = serde_json::from_str(json).unwrap();
        assert_eq!(appearance.id, "appr_casual");
        assert_eq!(appearance.name, "休闲装");
        assert!(appearance.is_default);
        assert_eq!(appearance.actions.len(), 1);
    }

    #[test]
    fn test_appearance_validate_actions() {
        let mut appearance = Appearance::new("appr_casual".to_string(), "休闲装".to_string(), true);

        // Add valid action
        let valid_action = Action::frames(vec!["0001.png".to_string()], 24, true);
        appearance.add_action("valid".to_string(), valid_action);

        // Add invalid action (no FPS for frames type)
        let invalid_action = Action {
            action_type: ActionType::Frames,
            resources: vec!["0001.png".to_string()],
            fps: None,
            r#loop: true,
            description: None,
        };
        appearance.add_action("invalid".to_string(), invalid_action);

        assert!(appearance.validate_actions().is_err());
    }
}
