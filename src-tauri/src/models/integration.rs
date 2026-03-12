//! Integration Models
//!
//! Models for application integrations, character integrations, and display slots.
//! Matches TypeScript interfaces in src/types/character.ts and src/types/appConfig.ts

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Provider types for AI applications
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    /// OpenClaw provider
    Openclaw,
    /// Claude provider
    Claude,
    /// ChatGPT provider
    Chatgpt,
}

impl ProviderType {
    /// Get all provider type values
    pub fn all_values() -> Vec<&'static str> {
        vec!["openclaw", "claude", "chatgpt"]
    }

    /// Convert to string
    pub fn as_str(&self) -> &str {
        match self {
            ProviderType::Openclaw => "openclaw",
            ProviderType::Claude => "claude",
            ProviderType::Chatgpt => "chatgpt",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "openclaw" => Some(ProviderType::Openclaw),
            "claude" => Some(ProviderType::Claude),
            "chatgpt" => Some(ProviderType::Chatgpt),
            _ => None,
        }
    }
}

/// AppIntegration (应用集成)
///
/// Represents the connection configuration for an AI application (e.g., an OpenClaw instance).
///
/// # Fields
/// * `id` - DeepJelly internal ID (16 chars, letters + numbers, randomly generated)
/// * `application_id` - DeepJelly-assigned application instance ID (16 chars, system generated)
/// * `provider` - Application type (openclaw, claude, chatgpt)
/// * `name` - User-defined name (1-50 chars)
/// * `description` - Optional description (max 200 chars)
/// * `endpoint` - WebSocket address
/// * `auth_token` - Optional authentication token (max 500 chars)
/// * `enabled` - Whether enabled (optional)
/// * `created_at` - Creation timestamp (milliseconds, optional)
///
/// # Example
/// ```json
/// {
///   "id": "w6gyoy52o7lgk5ik",
///   "applicationId": "a7b3x9k2m4n6p8",
///   "provider": "openclaw",
///   "name": "OpenClaw (192.168.10.128)",
///   "description": "公司内网OpenClaw实例",
///   "endpoint": "ws://192.168.10.128:18790",
///   "authToken": "a8a1b5791c6791adc4c6363ce9d6466da0aa4ae4c54d295e",
///   "enabled": false,
///   "createdAt": 1773091032051
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppIntegration {
    /// DeepJelly internal ID (16 characters, letters + numbers, randomly generated)
    pub id: String,

    /// DeepJelly-assigned application instance ID (16 characters, system generated)
    #[serde(rename = "applicationId")]
    pub application_id: String,

    /// Application type
    pub provider: ProviderType,

    /// User-defined name (1-50 characters)
    pub name: String,

    /// Optional description (max 200 characters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// WebSocket address
    pub endpoint: String,

    /// Optional authentication token (max 500 characters)
    #[serde(rename = "authToken", skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,

    /// Whether enabled (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    /// Creation timestamp (milliseconds, optional)
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

/// Wrapper structure for app integrations JSON file
///
/// Used for reading/writing `data/user/app_integrations.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppIntegrationsData {
    /// List of app integrations
    #[serde(rename = "integrations")]
    pub integrations: Vec<AppIntegration>,
}

impl AppIntegrationsData {
    /// Create a new empty AppIntegrationsData
    pub fn new() -> Self {
        Self {
            integrations: Vec::new(),
        }
    }

    /// Add an integration
    pub fn add_integration(&mut self, integration: AppIntegration) {
        self.integrations.push(integration);
    }

    /// Remove an integration by ID
    pub fn remove_integration(&mut self, id: &str) -> Option<AppIntegration> {
        let pos = self.integrations.iter().position(|i| i.id == id)?;
        Some(self.integrations.remove(pos))
    }

    /// Find an integration by ID
    pub fn find_integration(&self, id: &str) -> Option<&AppIntegration> {
        self.integrations.iter().find(|i| i.id == id)
    }

    /// Check if an integration ID exists
    pub fn contains_integration(&self, id: &str) -> bool {
        self.integrations.iter().any(|i| i.id == id)
    }
}

impl Default for AppIntegrationsData {
    fn default() -> Self {
        Self::new()
    }
}

/// CharacterIntegration (角色集成)
///
/// The binding relationship between a character and an app integration, serving as a lightweight index.
///
/// # Fields
/// * `id` - Binding record ID (16 chars, letters + numbers, randomly generated)
/// * `character_id` - Character ID (3-30 chars, globally unique)
/// * `character_name` - Character name (1-50 chars, redundant for display)
/// * `assistant_id` - Assistant ID (3-30 chars, globally unique)
/// * `assistant_name` - Assistant name (1-50 chars, redundant for display)
/// * `integration` - Integration information (nested object)
/// * `enabled` - Whether enabled (optional)
/// * `created_at` - Binding timestamp (milliseconds, optional)
///
/// # Example
/// ```json
/// {
///   "id": "w6gyoy52o7lgk5ik",
///   "characterId": "char_feishu_private",
///   "characterName": "飞书私聊",
///   "assistantId": "work_assistant",
///   "assistantName": "工作助手",
///   "integration": {
///     "integrationId": "a7b3x9k2m4n6p8",
///     "provider": "openclaw",
///     "applicationId": "x9k2m4n6p8q1r3",
///     "agentId": "christina",
///     "params": {
///       "sessionKey": "agent:christina:main"
///     }
///   },
///   "enabled": true,
///   "createdAt": 1773091035830
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterIntegration {
    /// Binding record ID (16 characters, letters + numbers, randomly generated)
    pub id: String,

    /// Character ID (3-30 characters, globally unique)
    #[serde(rename = "characterId")]
    pub character_id: String,

    /// Character name (1-50 characters, redundant for display)
    #[serde(rename = "characterName")]
    pub character_name: String,

    /// Assistant ID (3-30 characters, globally unique)
    #[serde(rename = "assistantId")]
    pub assistant_id: String,

    /// Assistant name (1-50 characters, redundant for display)
    #[serde(rename = "assistantName")]
    pub assistant_name: String,

    /// Integration information (nested object)
    pub integration: IntegrationInfo,

    /// Whether enabled (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    /// Binding timestamp (milliseconds, optional)
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

/// Integration information for character integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationInfo {
    /// Reference to app_integrations.id (16 characters)
    #[serde(rename = "integrationId")]
    pub integration_id: String,

    /// Application type
    pub provider: ProviderType,

    /// Application instance ID (16 characters, references app_integrations.applicationId)
    #[serde(rename = "applicationId")]
    pub application_id: String,

    /// Agent ID (3-30 characters)
    #[serde(rename = "agentId")]
    pub agent_id: String,

    /// Dynamic parameters (e.g., sessionKey)
    pub params: HashMap<String, serde_json::Value>,
}

/// Wrapper structure for character integrations JSON file
///
/// Used for reading/writing `data/user/character_integrations.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterIntegrationsData {
    /// List of character integrations
    #[serde(rename = "bindings")]
    pub bindings: Vec<CharacterIntegration>,
}

impl CharacterIntegrationsData {
    /// Create a new empty CharacterIntegrationsData
    pub fn new() -> Self {
        Self {
            bindings: Vec::new(),
        }
    }

    /// Add a binding
    pub fn add_binding(&mut self, binding: CharacterIntegration) {
        println!("[CharacterIntegrationsData::add_binding] 📥 Adding binding, current count: {}", self.bindings.len());
        println!("[CharacterIntegrationsData::add_binding] characterId: {}", binding.character_id);
        println!("[CharacterIntegrationsData::add_binding] assistantId: {}", binding.assistant_id);
        self.bindings.push(binding);
        println!("[CharacterIntegrationsData::add_binding] ✅ Binding added, new count: {}", self.bindings.len());
    }

    /// Remove a binding by ID
    pub fn remove_binding(&mut self, id: &str) -> Option<CharacterIntegration> {
        let pos = self.bindings.iter().position(|b| b.id == id)?;
        Some(self.bindings.remove(pos))
    }

    /// Find bindings by character ID
    pub fn find_by_character(&self, character_id: &str) -> Vec<&CharacterIntegration> {
        self.bindings
            .iter()
            .filter(|b| b.character_id == character_id)
            .collect()
    }

    /// Find bindings by assistant ID
    pub fn find_by_assistant(&self, assistant_id: &str) -> Vec<&CharacterIntegration> {
        self.bindings
            .iter()
            .filter(|b| b.assistant_id == assistant_id)
            .collect()
    }
}

impl Default for CharacterIntegrationsData {
    fn default() -> Self {
        Self::new()
    }
}

/// DisplaySlot (展示槽位)
///
/// Represents a character window configuration displayed on the desktop.
///
/// # Fields
/// * `id` - Slot ID (16 chars, globally unique, randomly generated)
/// * `assistant_id` - Assistant ID (3-30 chars, globally unique)
/// * `assistant_name` - Assistant name (1-50 chars, redundant)
/// * `character_id` - Character ID (3-30 chars, globally unique)
/// * `character_name` - Character name (1-50 chars, redundant)
/// * `appearance_id` - Appearance ID (3-30 chars)
/// * `appearance_name` - Appearance name (1-50 chars, redundant)
/// * `window_id` - Associated window ID (Tauri window identifier, optional)
/// * `visible` - Whether visible
/// * `position` - Window position {x, y} (optional)
/// * `created_at` - Creation timestamp (milliseconds, optional)
///
/// # Constraints
/// - Same assistant can only appear once (assistantId is globally unique)
/// - Same slot ID cannot be modified
/// - When deleting a slot, the corresponding window should be closed
///
/// # Example
/// ```json
/// {
///   "id": "slot_001",
///   "assistantId": "work_assistant",
///   "assistantName": "工作助手",
///   "characterId": "char_feishu_private",
///   "characterName": "飞书私聊",
///   "appearanceId": "appr_casual",
///   "appearanceName": "休闲装",
///   "windowId": "char_window_001",
///   "visible": true,
///   "position": {"x": 100, "y": 100},
///   "createdAt": 1773091035830
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplaySlot {
    /// Slot ID (16 characters, globally unique, randomly generated)
    pub id: String,

    /// Assistant ID (3-30 characters, globally unique)
    #[serde(rename = "assistantId")]
    pub assistant_id: String,

    /// Assistant name (1-50 characters, redundant)
    #[serde(rename = "assistantName")]
    pub assistant_name: String,

    /// Character ID (3-30 characters, globally unique)
    #[serde(rename = "characterId")]
    pub character_id: String,

    /// Character name (1-50 characters, redundant)
    #[serde(rename = "characterName")]
    pub character_name: String,

    /// Appearance ID (3-30 characters)
    #[serde(rename = "appearanceId")]
    pub appearance_id: String,

    /// Appearance name (1-50 characters, redundant)
    #[serde(rename = "appearanceName")]
    pub appearance_name: String,

    /// Associated window ID (Tauri window identifier, optional)
    #[serde(rename = "windowId", skip_serializing_if = "Option::is_none")]
    pub window_id: Option<String>,

    /// Whether visible
    pub visible: bool,

    /// Window position (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,

    /// Creation timestamp (milliseconds, optional)
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

/// Window position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    /// X coordinate
    pub x: i32,

    /// Y coordinate
    pub y: i32,
}

impl DisplaySlot {
    /// Create a new display slot
    pub fn new(
        id: String,
        assistant_id: String,
        assistant_name: String,
        character_id: String,
        character_name: String,
        appearance_id: String,
        appearance_name: String,
    ) -> Self {
        Self {
            id,
            assistant_id,
            assistant_name,
            character_id,
            character_name,
            appearance_id,
            appearance_name,
            window_id: None,
            visible: true,
            position: None,
            created_at: None,
        }
    }

    /// Set window position
    pub fn with_position(mut self, x: i32, y: i32) -> Self {
        self.position = Some(Position { x, y });
        self
    }

    /// Set window ID
    pub fn with_window_id(mut self, window_id: String) -> Self {
        self.window_id = Some(window_id);
        self
    }
}

/// Wrapper structure for display slots JSON file
///
/// Used for reading/writing `data/user/display_slots.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplaySlotsData {
    /// List of display slots
    #[serde(rename = "slots")]
    pub slots: Vec<DisplaySlot>,
}

impl DisplaySlotsData {
    /// Create a new empty DisplaySlotsData
    pub fn new() -> Self {
        Self {
            slots: Vec::new(),
        }
    }

    /// Add a slot
    pub fn add_slot(&mut self, slot: DisplaySlot) {
        self.slots.push(slot);
    }

    /// Remove a slot by ID
    pub fn remove_slot(&mut self, id: &str) -> Option<DisplaySlot> {
        let pos = self.slots.iter().position(|s| s.id == id)?;
        Some(self.slots.remove(pos))
    }

    /// Find a slot by ID
    pub fn find_slot(&self, id: &str) -> Option<&DisplaySlot> {
        self.slots.iter().find(|s| s.id == id)
    }

    /// Find a slot by assistant ID (ensuring uniqueness)
    pub fn find_by_assistant(&self, assistant_id: &str) -> Option<&DisplaySlot> {
        self.slots.iter().find(|s| s.assistant_id == assistant_id)
    }

    /// Check if an assistant already has a slot (for uniqueness constraint)
    pub fn has_assistant(&self, assistant_id: &str) -> bool {
        self.slots.iter().any(|s| s.assistant_id == assistant_id)
    }

    /// Get all visible slots
    pub fn visible_slots(&self) -> Vec<&DisplaySlot> {
        self.slots.iter().filter(|s| s.visible).collect()
    }
}

impl Default for DisplaySlotsData {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_type() {
        assert_eq!(ProviderType::Openclaw.as_str(), "openclaw");
        assert_eq!(ProviderType::Claude.as_str(), "claude");
        assert_eq!(ProviderType::Chatgpt.as_str(), "chatgpt");

        assert_eq!(ProviderType::from_str("openclaw"), Some(ProviderType::Openclaw));
        assert_eq!(ProviderType::from_str("unknown"), None);
    }

    #[test]
    fn test_app_integration_serialization() {
        let integration = AppIntegration {
            id: "w6gyoy52o7lgk5ik".to_string(),
            application_id: "a7b3x9k2m4n6p8".to_string(),
            provider: ProviderType::Openclaw,
            name: "OpenClaw Test".to_string(),
            description: Some("Test instance".to_string()),
            endpoint: "ws://192.168.10.128:18790".to_string(),
            auth_token: Some("token123".to_string()),
            enabled: Some(true),
            created_at: Some(1773091032051),
        };

        let json = serde_json::to_string(&integration).unwrap();
        assert!(json.contains("openclaw"));
        assert!(json.contains("w6gyoy52o7lgk5ik"));
    }

    #[test]
    fn test_character_integration() {
        let mut params = HashMap::new();
        params.insert("sessionKey".to_string(), serde_json::json!("agent:christina:main"));

        let integration = CharacterIntegration {
            id: "w6gyoy52o7lgk5ik".to_string(),
            character_id: "char_feishu_private".to_string(),
            character_name: "飞书私聊".to_string(),
            assistant_id: "work_assistant".to_string(),
            assistant_name: "工作助手".to_string(),
            integration: IntegrationInfo {
                integration_id: "a7b3x9k2m4n6p8".to_string(),
                provider: ProviderType::Openclaw,
                application_id: "x9k2m4n6p8q1r3".to_string(),
                agent_id: "christina".to_string(),
                params,
            },
            enabled: Some(true),
            created_at: Some(1773091035830),
        };

        let json = serde_json::to_string(&integration).unwrap();
        assert!(json.contains("飞书私聊"));
        assert!(json.contains("work_assistant"));
    }

    #[test]
    fn test_display_slot() {
        let slot = DisplaySlot::new(
            "slot_001".to_string(),
            "work_assistant".to_string(),
            "工作助手".to_string(),
            "char_feishu_private".to_string(),
            "飞书私聊".to_string(),
            "appr_casual".to_string(),
            "休闲装".to_string(),
        )
        .with_position(100, 200);

        assert_eq!(slot.assistant_id, "work_assistant");
        assert_eq!(slot.position.unwrap().x, 100);
        assert!(slot.visible);
    }

    #[test]
    fn test_display_slots_data() {
        let mut data = DisplaySlotsData::new();
        let slot = DisplaySlot::new(
            "slot_001".to_string(),
            "work_assistant".to_string(),
            "工作助手".to_string(),
            "char_feishu_private".to_string(),
            "飞书私聊".to_string(),
            "appr_casual".to_string(),
            "休闲装".to_string(),
        );

        data.add_slot(slot);

        assert_eq!(data.slots.len(), 1);
        assert!(data.has_assistant("work_assistant"));
        assert!(data.find_by_assistant("work_assistant").is_some());
    }

    #[test]
    fn test_app_integrations_data() {
        let mut data = AppIntegrationsData::new();

        let integration = AppIntegration {
            id: "test_id".to_string(),
            application_id: "app_id".to_string(),
            provider: ProviderType::Claude,
            name: "Claude Test".to_string(),
            description: None,
            endpoint: "ws://localhost:8080".to_string(),
            auth_token: None,
            enabled: None,
            created_at: None,
        };

        data.add_integration(integration);
        assert_eq!(data.integrations.len(), 1);
        assert!(data.contains_integration("test_id"));
    }

    #[test]
    fn test_character_integrations_data() {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!("value"));

        let mut data = CharacterIntegrationsData::new();

        let binding = CharacterIntegration {
            id: "binding_id".to_string(),
            character_id: "char_id".to_string(),
            character_name: "Test Char".to_string(),
            assistant_id: "assistant_id".to_string(),
            assistant_name: "Test Assistant".to_string(),
            integration: IntegrationInfo {
                integration_id: "int_id".to_string(),
                provider: ProviderType::Openclaw,
                application_id: "app_id".to_string(),
                agent_id: "agent_id".to_string(),
                params,
            },
            enabled: None,
            created_at: None,
        };

        data.add_binding(binding);
        assert_eq!(data.bindings.len(), 1);
        assert_eq!(data.find_by_character("char_id").len(), 1);
    }
}
