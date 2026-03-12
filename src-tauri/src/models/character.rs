//! Character Model
//!
//! Represents a character as an identity of an assistant in different channels.
//! Each character can be bound to different AI application agents.
//! Matches TypeScript interface: src/types/character.ts -> Character

use serde::{Deserialize, Serialize};

/// Character (角色)
///
/// A character is the identity of an assistant in different channels.
/// Each character can be bound to different AI application agents.
///
/// # Fields
/// * `id` - Character ID (3-30 chars, globally unique)
/// * `assistant_id` - Parent assistant ID (3-30 chars, globally unique)
/// * `name` - Character name (1-50 chars)
/// * `description` - Optional description (max 200 chars)
/// * `appearances` - List of appearances
/// * `default_appearance_id` - Default appearance ID (optional)
///
/// # Example
/// ```json
/// {
///   "id": "char_feishu_private",
///   "assistantId": "work_assistant",
///   "name": "飞书私聊",
///   "description": "飞书私聊渠道",
///   "appearances": [],
///   "defaultAppearanceId": "appr_casual"
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    /// Character ID (3-30 characters, globally unique)
    pub id: String,

    /// Parent assistant ID (3-30 characters, globally unique)
    #[serde(rename = "assistantId", alias = "assistant_id", skip_serializing_if = "Option::is_none")]
    pub assistant_id: Option<String>,

    /// Character name (1-50 characters)
    pub name: String,

    /// Optional description (max 200 characters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// List of appearances
    pub appearances: Vec<super::Appearance>,

    /// Default appearance ID (optional)
    #[serde(rename = "defaultAppearanceId", alias = "default_appearance_id", skip_serializing_if = "Option::is_none")]
    pub default_appearance_id: Option<String>,
}

impl Character {
    /// Create a new character
    pub fn new(
        id: String,
        assistant_id: String,
        name: String,
    ) -> Self {
        Self {
            id,
            assistant_id: Some(assistant_id),
            name,
            description: None,
            appearances: Vec::new(),
            default_appearance_id: None,
        }
    }

    /// Add an appearance
    pub fn add_appearance(&mut self, appearance: super::Appearance) {
        self.appearances.push(appearance);
    }

    /// Get the default appearance
    pub fn get_default_appearance(&self) -> Option<&super::Appearance> {
        if let Some(ref default_id) = self.default_appearance_id {
            self.appearances.iter().find(|a| &a.id == default_id)
        } else {
            self.appearances.first()
        }
    }

    /// Check if this character has a specific appearance
    pub fn has_appearance(&self, appearance_id: &str) -> bool {
        self.appearances.iter().any(|a| a.id == appearance_id)
    }
}

/// Character Reference (轻量角色引用)
///
/// Lightweight reference stored in assistants.json for indexing.
/// Full character data is stored in characters/{id}/config.json.
///
/// # Fields
/// * `id` - Character ID (3-30 chars, globally unique)
/// * `default_appearance_id` - Default appearance ID (optional)
///
/// # Example
/// ```json
/// {
///   "characterId": "char_feishu_private",
///   "defaultAppearanceId": "appr_casual"
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterReference {
    /// Character ID (3-30 characters, globally unique)
    #[serde(rename = "characterId")]
    pub id: String,

    /// Default appearance ID (optional)
    #[serde(rename = "defaultAppearanceId", alias = "default_appearance_id", skip_serializing_if = "Option::is_none")]
    pub default_appearance_id: Option<String>,
}

impl CharacterReference {
    /// Create a new character reference
    pub fn new(id: String, default_appearance_id: Option<String>) -> Self {
        Self {
            id,
            default_appearance_id,
        }
    }

    /// Create a character reference from a character ID only
    pub fn from_id(id: String) -> Self {
        Self {
            id,
            default_appearance_id: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_character_serialization() {
        let character = Character::new(
            "char_feishu_private".to_string(),
            "work_assistant".to_string(),
            "飞书私聊".to_string(),
        );

        let json = serde_json::to_string(&character).unwrap();
        assert!(json.contains("char_feishu_private"));
        assert!(json.contains("飞书私聊"));
        assert!(json.contains("assistantId"));
    }

    #[test]
    fn test_character_deserialization() {
        let json = r#"{
            "id": "char_feishu_private",
            "assistantId": "work_assistant",
            "name": "飞书私聊",
            "description": "飞书私聊渠道",
            "appearances": [],
            "defaultAppearanceId": "appr_casual"
        }"#;

        let character: Character = serde_json::from_str(json).unwrap();
        assert_eq!(character.id, "char_feishu_private");
        assert_eq!(character.assistant_id, "work_assistant");
        assert_eq!(character.default_appearance_id, Some("appr_casual".to_string()));
    }

    #[test]
    fn test_character_new() {
        let character = Character::new(
            "char_test".to_string(),
            "assistant_test".to_string(),
            "测试角色".to_string(),
        );

        assert_eq!(character.id, "char_test");
        assert_eq!(character.assistant_id, "assistant_test");
        assert_eq!(character.name, "测试角色");
        assert!(character.description.is_none());
        assert!(character.appearances.is_empty());
        assert!(character.default_appearance_id.is_none());
    }
}
