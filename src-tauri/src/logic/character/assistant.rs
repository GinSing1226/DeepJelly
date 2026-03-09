//! Assistant management types and persistence
//!
//! Manages assistant configuration with JSON file persistence.

use crate::utils::error::DeepJellyError;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// AI应用集成参数
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

/// Assistant configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assistant {
    /// DeepJelly ID (16 chars, 随机字符串)
    pub id: String,
    /// Assistant name
    pub name: String,
    /// Assistant description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Associated application type
    #[serde(rename = "appType")]
    pub app_type: String,
    /// Agent label from AI application (can be empty)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "agentLabel")]
    pub agent_label: Option<String>,
    /// AI应用集成参数列表
    #[serde(default)]
    pub integrations: Vec<Integration>,
    /// Bound agent ID from AI application
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "boundAgentId")]
    pub bound_agent_id: Option<String>,
    /// Session key for the bound agent
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "sessionKey")]
    pub session_key: Option<String>,
    /// Creation timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}

/// Assistants configuration file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantsConfig {
    pub assistants: Vec<Assistant>,
}

impl Default for AssistantsConfig {
    fn default() -> Self {
        Self {
            assistants: Vec::new(),
        }
    }
}

/// Assistant manager
///
/// Manages assistant configuration with JSON file persistence.
pub struct AssistantManager {
    /// Data directory path
    data_dir: PathBuf,
    /// Assistants configuration file path
    config_path: PathBuf,
    /// Cached assistants
    assistants: Vec<Assistant>,
}

impl AssistantManager {
    /// Create a new assistant manager
    ///
    /// # Arguments
    /// * `data_dir` - Data directory path (e.g., `{app_root}/data`)
    pub fn new(data_dir: PathBuf) -> Result<Self, DeepJellyError> {
        let config_path = data_dir.join("assistants.json");

        // Ensure data directory exists
        fs::create_dir_all(&data_dir).map_err(DeepJellyError::Io)?;

        let mut manager = Self {
            data_dir,
            config_path,
            assistants: Vec::new(),
        };

        // Load existing configuration or create default
        if manager.config_path.exists() {
            manager.load()?;
        } else {
            manager.create_default()?;
        }

        Ok(manager)
    }

    /// Load assistants from JSON file
    pub fn load(&mut self) -> Result<(), DeepJellyError> {
        let content = fs::read_to_string(&self.config_path)
            .map_err(DeepJellyError::Io)?;

        let config: AssistantsConfig = serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to parse assistants.json: {}", e)))?;

        self.assistants = config.assistants;

        Ok(())
    }

    /// Save assistants to JSON file
    pub fn save(&self) -> Result<(), DeepJellyError> {
        println!("[AssistantManager::save] START: path={:?}", self.config_path);
        let config = AssistantsConfig {
            assistants: self.assistants.clone(),
        };

        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to serialize assistants: {}", e)))?;

        println!("[AssistantManager::save] Writing {} bytes to disk", content.len());
        fs::write(&self.config_path, content)
            .map_err(DeepJellyError::Io)?;
        println!("[AssistantManager::save] COMPLETE");
        Ok(())
    }

    /// Create default assistant configuration
    ///
    /// First tries to copy from bundled assistants.default.json.
    /// Falls back to generating a random default if template not found.
    fn create_default(&mut self) -> Result<(), DeepJellyError> {
        // Try to find and load assistants.default.json from resource directory
        if let Ok(default_path) = self.find_default_template() {
            info!("Found bundled assistants.default.json at {:?}", default_path);

            if let Ok(content) = fs::read_to_string(&default_path) {
                // Parse the template
                if let Ok(mut config) = serde_json::from_str::<AssistantsConfig>(&content) {
                    info!("Loaded {} assistant(s) from template", config.assistants.len());

                    // Update creation timestamp for each assistant
                    for assistant in &mut config.assistants {
                        assistant.created_at = Some(chrono::Utc::now().to_rfc3339());
                    }

                    self.assistants = config.assistants;
                    self.save()?;
                    info!("Successfully initialized assistants from template");
                    return Ok(());
                } else {
                    warn!("Failed to parse assistants.default.json, will generate random default");
                }
            }
        }

        // Fallback: generate random default assistant
        info!("No bundled template found, generating default assistant");
        let default_assistant = Assistant {
            id: generate_dj_id(),
            name: "christina".to_string(),
            description: Some("《Steins;Gate》，maksie kurisu".to_string()),
            app_type: "openclaw".to_string(),
            agent_label: None,
            integrations: Vec::new(),
            bound_agent_id: None,
            session_key: None,
            created_at: Some(chrono::Utc::now().to_rfc3339()),
        };

        self.assistants.push(default_assistant);
        self.save()?;

        Ok(())
    }

    /// Find the bundled assistants.default.json template
    ///
    /// Searches in multiple locations:
    /// 1. Development: project/../data/assistants.default.json
    /// 2. Production: {exe_dir}/resources/data/assistants.default.json (Tauri bundles)
    fn find_default_template(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        // Try development path first (for npm run tauri:dev)
        // In development, data_dir is project/../data
        let dev_path = self.data_dir.join("assistants.default.json");
        if dev_path.exists() {
            return Ok(dev_path);
        }

        // Try resource directory (for bundled apps)
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // For Tauri bundles, resources are in resources/ next to executable
                let resource_path = exe_dir.join("resources").join("data").join("assistants.default.json");
                if resource_path.exists() {
                    return Ok(resource_path);
                }
            }
        }

        Err("No default template found".into())
    }

    /// Get all assistants
    pub fn get_all(&self) -> Vec<Assistant> {
        self.assistants.clone()
    }

    /// Get assistant by ID
    pub fn get(&self, id: &str) -> Option<&Assistant> {
        self.assistants.iter().find(|a| a.id == id)
    }

    /// Add a new assistant
    pub fn add(&mut self, mut assistant: Assistant) -> Result<(), DeepJellyError> {
        // Check if ID already exists
        if self.assistants.iter().any(|a| a.id == assistant.id) {
            return Err(DeepJellyError::Validation(format!(
                "Assistant with ID {} already exists",
                assistant.id
            )));
        }

        // Normalize empty agent_label to None
        if assistant.agent_label.as_ref().map_or(false, |s| s.is_empty()) {
            assistant.agent_label = None;
        }

        self.assistants.push(assistant);
        self.save()?;
        Ok(())
    }

    /// Update an existing assistant
    pub fn update(&mut self, id: &str, updates: UpdatedAssistant) -> Result<(), DeepJellyError> {
        println!("[AssistantManager::update] START: id={}, updates={:?}", id, updates);
        let assistant = self.assistants
            .iter_mut()
            .find(|a| a.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Assistant {} not found", id)))?;

        println!("[AssistantManager::update] Found assistant: {:?}", assistant);

        if let Some(name) = updates.name {
            println!("[AssistantManager::update] Updating name to: {}", name);
            assistant.name = name;
        }
        if let Some(description) = updates.description {
            println!("[AssistantManager::update] Updating description to: {}", description);
            assistant.description = Some(description);
        }
        if let Some(app_type) = updates.app_type {
            assistant.app_type = app_type;
        }
        if let Some(agent_label) = updates.agent_label {
            // Normalize empty agent_label to None
            assistant.agent_label = if agent_label.is_empty() {
                None
            } else {
                Some(agent_label)
            };
        }
        if let Some(integrations) = updates.integrations {
            println!("[AssistantManager::update] Updating integrations to: {:?}", integrations);
            assistant.integrations = integrations;
        }

        println!("[AssistantManager::update] Saving to disk...");
        self.save()?;
        println!("[AssistantManager::update] COMPLETE");
        Ok(())
    }

    /// Delete an assistant
    pub fn delete(&mut self, id: &str) -> Result<bool, DeepJellyError> {
        let index = self.assistants
            .iter()
            .position(|a| a.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Assistant {} not found", id)))?;

        self.assistants.remove(index);
        self.save()?;
        Ok(true)
    }

    /// Get data directory path
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /// Get characters directory path
    pub fn characters_dir(&self) -> PathBuf {
        self.data_dir.join("characters")
    }
}

/// Updated assistant fields (for update operation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatedAssistant {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "appType")]
    pub app_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "agentLabel")]
    pub agent_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub integrations: Option<Vec<Integration>>,
}

/// Generate a unique ID (16 random chars)
/// Used for: assistant ID, application ID, etc.
pub fn generate_dj_id() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..16)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Generate an Application ID (16 random chars, same as generate_dj_id)
/// Used for identifying app integrations to AI applications
pub fn generate_application_id() -> String {
    generate_dj_id()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_default_assistant() {
        let temp_dir = TempDir::new().unwrap();
        let manager = AssistantManager::new(temp_dir.path().to_path_buf()).unwrap();

        let assistants = manager.get_all();
        assert_eq!(assistants.len(), 1);
        assert_eq!(assistants[0].id.len(), 16);
        assert_eq!(assistants[0].name, "christina");
        assert_eq!(assistants[0].description, Some("《Steins;Gate》，maksie kurisu".to_string()));
    }

    #[test]
    fn test_add_assistant() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AssistantManager::new(temp_dir.path().to_path_buf()).unwrap();
        let existing_id = manager.get_all()[0].id.clone();

        let new_assistant = Assistant {
            id: "dj_test1234567".to_string(),
            name: "测试助手".to_string(),
            description: Some("测试描述".to_string()),
            app_type: "openclaw".to_string(),
            agent_label: Some("agent_001".to_string()),
            integrations: Vec::new(),
            created_at: None,
        };

        manager.add(new_assistant).unwrap();

        let assistants = manager.get_all();
        assert_eq!(assistants.len(), 2);
        assert!(assistants.iter().any(|a| a.id == "dj_test1234567"));
    }

    #[test]
    fn test_update_assistant() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AssistantManager::new(temp_dir.path().to_path_buf()).unwrap();
        let existing_id = manager.get_all()[0].id.clone();

        let updates = UpdatedAssistant {
            name: Some("更新后的助手".to_string()),
            description: Some("更新后的描述".to_string()),
            app_type: None,
            agent_label: None,
        };

        manager.update(&existing_id, updates).unwrap();

        let assistant = manager.get(&existing_id).unwrap();
        assert_eq!(assistant.name, "更新后的助手");
        assert_eq!(assistant.description, Some("更新后的描述".to_string()));
    }

    #[test]
    fn test_delete_assistant() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AssistantManager::new(temp_dir.path().to_path_buf()).unwrap();
        let existing_id = manager.get_all()[0].id.clone();

        manager.delete(&existing_id).unwrap();

        let assistants = manager.get_all();
        assert_eq!(assistants.len(), 0);
    }

    #[test]
    fn test_empty_agent_label_normalization() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AssistantManager::new(temp_dir.path().to_path_buf()).unwrap();

        let new_assistant = Assistant {
            id: "dj_testnorm123".to_string(),
            name: "测试助手".to_string(),
            description: None,
            app_type: "openclaw".to_string(),
            agent_label: Some("".to_string()),
            integrations: Vec::new(),
            created_at: None,
        };

        manager.add(new_assistant).unwrap();

        manager.load().unwrap();
        let assistant = manager.get("dj_testnorm123").unwrap();
        assert_eq!(assistant.agent_label, None);
    }

    #[test]
    fn test_generate_dj_id() {
        let id1 = generate_dj_id();
        let id2 = generate_dj_id();

        assert_eq!(id1.len(), 16);
        assert_eq!(id2.len(), 16);
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_generate_application_id() {
        let id = generate_application_id();

        assert_eq!(id.len(), 16);
    }
}

