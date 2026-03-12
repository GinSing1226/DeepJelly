//! Assistant Model
//!
//! Represents an AI Agent logical grouping for archiving session history.
//! Matches TypeScript interface: src/types/character.ts -> Assistant

use serde::{Deserialize, Serialize};

/// AI应用集成参数（用于Assistant.integrations）
///
/// Matches TypeScript: AssistantIntegration in src/types/appConfig.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Integration {
    /// AI应用提供商标识
    pub provider: String,
    /// 集成参数（动态结构）
    pub params: serde_json::Value,
    /// 是否启用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    /// 绑定时间戳
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

/// Assistant (助手)
///
/// Represents an AI Agent's logical grouping, used for archiving session history.
///
/// # Fields
/// * `id` - Assistant ID (3-30 chars, globally unique)
/// * `name` - Assistant name (1-50 chars)
/// * `description` - Optional description (max 200 chars)
/// * `created_at` - Creation timestamp (milliseconds, optional)
/// * `characters` - List of characters belonging to this assistant
/// * `app_type` - Application type (optional, for backward compatibility)
/// * `agent_label` - Agent label (optional)
/// * `bound_agent_id` - Bound AI application Agent ID (optional)
/// * `session_key` - Session key (optional)
///
/// # Example
/// ```json
/// {
///   "id": "work_assistant",
///   "name": "工作助手",
///   "description": "我的工作助手",
///   "createdAt": 1773091032051,
///   "characters": []
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assistant {
    /// Assistant ID (3-30 characters, globally unique)
    pub id: String,

    /// Assistant name (1-50 characters)
    pub name: String,

    /// Optional description (max 200 characters)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Creation timestamp (milliseconds, optional)
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,

    /// Lightweight character references (full data stored in characters/{id}/config.json)
    #[serde(default)]
    pub characters: Vec<super::CharacterReference>,

    // Optional fields for backward compatibility
    /// Application type (optional, for backward compatibility)
    #[serde(rename = "appType", skip_serializing_if = "Option::is_none")]
    pub app_type: Option<String>,

    /// Agent label (optional)
    #[serde(rename = "agentLabel", skip_serializing_if = "Option::is_none")]
    pub agent_label: Option<String>,

    /// Bound AI application Agent ID (optional)
    #[serde(rename = "boundAgentId", skip_serializing_if = "Option::is_none")]
    pub bound_agent_id: Option<String>,

    /// Session key (optional)
    #[serde(rename = "sessionKey", skip_serializing_if = "Option::is_none")]
    pub session_key: Option<String>,

    /// AI应用集成参数列表（支持多应用绑定）
    #[serde(rename = "integrations", skip_serializing_if = "Option::is_none")]
    pub integrations: Option<Vec<super::Integration>>,
}

/// Wrapper structure for assistants JSON file
///
/// Used for reading/writing `data/user/assistants.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantsData {
    /// List of assistants
    pub assistants: Vec<Assistant>,
}

impl AssistantsData {
    /// Create a new empty AssistantsData
    pub fn new() -> Self {
        Self {
            assistants: Vec::new(),
        }
    }

    /// Add an assistant
    pub fn add_assistant(&mut self, assistant: Assistant) {
        self.assistants.push(assistant);
    }

    /// Remove an assistant by ID
    pub fn remove_assistant(&mut self, id: &str) -> Option<Assistant> {
        let pos = self.assistants.iter().position(|a| a.id == id)?;
        Some(self.assistants.remove(pos))
    }

    /// Find an assistant by ID
    pub fn find_assistant(&self, id: &str) -> Option<&Assistant> {
        self.assistants.iter().find(|a| a.id == id)
    }

    /// Check if an assistant ID exists
    pub fn contains_assistant(&self, id: &str) -> bool {
        self.assistants.iter().any(|a| a.id == id)
    }
}

impl Default for AssistantsData {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assistant_serialization() {
        let assistant = Assistant {
            id: "work_assistant".to_string(),
            name: "工作助手".to_string(),
            description: Some("我的工作助手".to_string()),
            created_at: Some(1773091032051),
            characters: vec![],
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        let json = serde_json::to_string(&assistant).unwrap();
        assert!(json.contains("work_assistant"));
        assert!(json.contains("工作助手"));
    }

    #[test]
    fn test_assistant_deserialization() {
        let json = r#"{
            "id": "work_assistant",
            "name": "工作助手",
            "description": "我的工作助手",
            "createdAt": 1773091032051,
            "characters": []
        }"#;

        let assistant: Assistant = serde_json::from_str(json).unwrap();
        assert_eq!(assistant.id, "work_assistant");
        assert_eq!(assistant.name, "工作助手");
        assert_eq!(assistant.created_at, Some(1773091032051));
    }

    #[test]
    fn test_assistants_data() {
        let mut data = AssistantsData::new();

        let assistant = Assistant {
            id: "work_assistant".to_string(),
            name: "工作助手".to_string(),
            description: None,
            created_at: None,
            characters: vec![],
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        data.add_assistant(assistant);

        assert_eq!(data.assistants.len(), 1);
        assert!(data.contains_assistant("work_assistant"));
        assert!(data.find_assistant("work_assistant").is_some());
    }

    #[test]
    fn test_assistants_data_remove() {
        let mut data = AssistantsData::new();

        let assistant = Assistant {
            id: "work_assistant".to_string(),
            name: "工作助手".to_string(),
            description: None,
            created_at: None,
            characters: vec![],
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        data.add_assistant(assistant);
        assert_eq!(data.assistants.len(), 1);

        let removed = data.remove_assistant("work_assistant");
        assert!(removed.is_some());
        assert_eq!(data.assistants.len(), 0);
    }
}
