//! AI Application Integration Management
//!
//! Manages AI app integration configurations with JSON file persistence.
//! Each integration represents a connection to an AI application instance (e.g., OpenClaw).

use crate::logic::character::assistant::generate_application_id;
use crate::logic::character::assistant::generate_dj_id;
use crate::utils::error::DeepJellyError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// AI Application integration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppIntegration {
    /// DeepJelly 内部实例 ID (16 chars, 随机字符串)
    pub id: String,
    /// 给 AI 应用的身份标识 (16 chars, 随机字符串)
    #[serde(rename = "applicationId")]
    pub application_id: String,
    /// AI应用提供商标识
    pub provider: String,
    /// 用户自定义名称
    pub name: String,
    /// 应用描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// WebSocket 地址
    pub endpoint: String,
    /// 认证令牌（如需要）
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "authToken")]
    pub auth_token: Option<String>,
    /// 绑定的助手ID列表
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[serde(rename = "assistant")]
    pub assistant_ids: Vec<String>,
    /// 是否启用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    /// 绑定时间戳
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

/// App integrations configuration file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppIntegrationsConfig {
    #[serde(default)]
    pub integrations: Vec<AppIntegration>,
}

impl Default for AppIntegrationsConfig {
    fn default() -> Self {
        Self {
            integrations: Vec::new(),
        }
    }
}

/// App Integration Manager
pub struct AppIntegrationManager {
    /// Data directory path
    data_dir: PathBuf,
    /// Integrations configuration file path
    config_path: PathBuf,
    /// Cached integrations
    integrations: Vec<AppIntegration>,
}

impl AppIntegrationManager {
    /// Create a new app integration manager
    pub fn new(data_dir: PathBuf) -> Result<Self, DeepJellyError> {
        let config_path = data_dir.join("app_integrations.json");

        // Ensure data directory exists
        fs::create_dir_all(&data_dir).map_err(DeepJellyError::Io)?;

        let mut manager = Self {
            data_dir,
            config_path,
            integrations: Vec::new(),
        };

        // Load existing configuration or create default
        if manager.config_path.exists() {
            manager.load()?;
        } else {
            manager.save()?; // Create empty config file
        }

        Ok(manager)
    }

    /// Load integrations from JSON file
    pub fn load(&mut self) -> Result<(), DeepJellyError> {
        let content = fs::read_to_string(&self.config_path)
            .map_err(DeepJellyError::Io)?;

        let config: AppIntegrationsConfig = serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to parse app_integrations.json: {}", e)))?;

        self.integrations = config.integrations;

        Ok(())
    }

    /// Save integrations to JSON file
    pub fn save(&self) -> Result<(), DeepJellyError> {
        let config = AppIntegrationsConfig {
            integrations: self.integrations.clone(),
        };

        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to serialize app integrations: {}", e)))?;

        fs::write(&self.config_path, content)
            .map_err(DeepJellyError::Io)?;

        Ok(())
    }

    /// Get all integrations
    pub fn get_all(&self) -> Vec<AppIntegration> {
        self.integrations.clone()
    }

    /// Get integration by ID
    pub fn get(&self, id: &str) -> Option<&AppIntegration> {
        self.integrations.iter().find(|i| i.id == id)
    }

    /// Get integration by application ID
    pub fn get_by_application_id(&self, application_id: &str) -> Option<&AppIntegration> {
        self.integrations.iter().find(|i| i.application_id == application_id)
    }

    /// Add a new integration (auto-generates id and applicationId)
    pub fn add(&mut self, mut integration: AppIntegration) -> Result<(), DeepJellyError> {
        // Auto-generate IDs if not provided
        if integration.id.is_empty() {
            integration.id = generate_dj_id();
        }
        if integration.application_id.is_empty() {
            integration.application_id = generate_application_id();
        }

        // Check if ID already exists
        if self.integrations.iter().any(|i| i.id == integration.id) {
            return Err(DeepJellyError::Validation(format!(
                "Integration with ID {} already exists",
                integration.id
            )));
        }

        // Set creation timestamp if not provided
        if integration.created_at.is_none() {
            integration.created_at = Some(chrono::Utc::now().timestamp_millis());
        }

        self.integrations.push(integration);
        self.save()?;
        Ok(())
    }

    /// Update an existing integration
    pub fn update(&mut self, id: &str, updates: AppIntegration) -> Result<(), DeepJellyError> {
        let integration = self.integrations
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Integration {} not found", id)))?;

        // Update fields
        integration.name = updates.name;
        integration.description = updates.description;
        integration.endpoint = updates.endpoint;
        integration.auth_token = updates.auth_token;
        integration.enabled = updates.enabled;
        integration.assistant_ids = updates.assistant_ids;

        self.save()?;
        Ok(())
    }

    /// Add an assistant to the integration's bound assistants list
    pub fn add_assistant(&mut self, id: &str, assistant_id: &str) -> Result<(), DeepJellyError> {
        let integration = self.integrations
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Integration {} not found", id)))?;

        // Only add if not already present
        if !integration.assistant_ids.contains(&assistant_id.to_string()) {
            integration.assistant_ids.push(assistant_id.to_string());
            self.save()?;
        }

        Ok(())
    }

    /// Remove an assistant from the integration's bound assistants list
    pub fn remove_assistant(&mut self, id: &str, assistant_id: &str) -> Result<(), DeepJellyError> {
        let integration = self.integrations
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Integration {} not found", id)))?;

        integration.assistant_ids.retain(|x| x != assistant_id);
        self.save()?;
        Ok(())
    }

    /// Remove an assistant from all integrations (called when deleting an assistant)
    pub fn remove_assistant_from_all(&mut self, assistant_id: &str) -> Result<(), DeepJellyError> {
        let mut modified = false;
        for integration in &mut self.integrations {
            let original_len = integration.assistant_ids.len();
            integration.assistant_ids.retain(|x| x != assistant_id);
            if integration.assistant_ids.len() != original_len {
                modified = true;
            }
        }

        if modified {
            self.save()?;
        }

        Ok(())
    }

    /// Delete an integration
    pub fn delete(&mut self, id: &str) -> Result<bool, DeepJellyError> {
        let index = self.integrations
            .iter()
            .position(|i| i.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Integration {} not found", id)))?;

        self.integrations.remove(index);
        self.save()?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_empty_config() {
        let temp_dir = TempDir::new().unwrap();
        let manager = AppIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let integrations = manager.get_all();
        assert_eq!(integrations.len(), 0);
    }

    #[test]
    fn test_add_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AppIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let integration = AppIntegration {
            id: String::new(), // Will be auto-generated
            application_id: String::new(), // Will be auto-generated
            provider: "openclaw".to_string(),
            name: "My OpenClaw".to_string(),
            endpoint: "ws://127.0.0.1:18790".to_string(),
            auth_token: None,
            enabled: Some(true),
            created_at: None,
        };

        manager.add(integration).unwrap();

        let integrations = manager.get_all();
        assert_eq!(integrations.len(), 1);
        assert_eq!(integrations[0].id.len(), 16);
        assert_eq!(integrations[0].application_id.len(), 16);
        assert_eq!(integrations[0].name, "My OpenClaw");
    }

    #[test]
    fn test_delete_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AppIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let integration = AppIntegration {
            id: String::new(),
            application_id: String::new(),
            provider: "openclaw".to_string(),
            name: "Test".to_string(),
            endpoint: "ws://127.0.0.1:18790".to_string(),
            auth_token: None,
            enabled: None,
            created_at: None,
        };

        manager.add(integration).unwrap();
        let integrations = manager.get_all();
        let id = integrations[0].id.clone();

        manager.delete(&id).unwrap();

        let integrations = manager.get_all();
        assert_eq!(integrations.len(), 0);
    }
}
