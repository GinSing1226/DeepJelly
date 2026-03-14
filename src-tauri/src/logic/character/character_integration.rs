//! Character Integration Management
//!
//! Manages character-app integration bindings with JSON file persistence.
//! Character integrations are lightweight index tables binding characters to AI app integrations.

use crate::logic::character::assistant::generate_dj_id;
use crate::models::integration::{CharacterIntegration, CharacterIntegrationsData};
use crate::utils::error::DeepJellyError;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Character Integration Manager
pub struct CharacterIntegrationManager {
    /// Integrations configuration file path
    config_path: PathBuf,
    /// Cached bindings
    data: CharacterIntegrationsData,
}

impl CharacterIntegrationManager {
    /// Create a new character integration manager
    pub fn new(data_dir: PathBuf) -> Result<Self, DeepJellyError> {
        let config_path = data_dir.join("character_integrations.json");

        // Ensure data directory exists
        fs::create_dir_all(&data_dir).map_err(DeepJellyError::Io)?;

        let data = if config_path.exists() {
            // Load existing configuration
            let content = fs::read_to_string(&config_path)
                .map_err(DeepJellyError::Io)?;
            serde_json::from_str(&content)
                .map_err(|e| DeepJellyError::Parse(format!(
                    "Failed to parse character_integrations.json: {}", e
                )))?
        } else {
            // Create default configuration
            let data = CharacterIntegrationsData::new();
            let content = serde_json::to_string_pretty(&data)
                .map_err(|e| DeepJellyError::Parse(format!(
                    "Failed to serialize character integrations: {}", e
                )))?;
            fs::write(&config_path, content)
                .map_err(DeepJellyError::Io)?;
            data
        };

        Ok(Self { config_path, data })
    }

    /// Load integrations from JSON file
    pub fn load(&mut self) -> Result<(), DeepJellyError> {
        let content = fs::read_to_string(&self.config_path)
            .map_err(DeepJellyError::Io)?;

        self.data = serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Parse(format!(
                "Failed to parse character_integrations.json: {}", e
            )))?;

        Ok(())
    }

    /// Save integrations to JSON file
    pub fn save(&self) -> Result<(), DeepJellyError> {
        println!("[CharacterIntegrationManager::save] 💾 Saving character integrations to: {:?}", self.config_path);
        println!("[CharacterIntegrationManager::save] Current bindings count: {}", self.data.bindings.len());

        let content = serde_json::to_string_pretty(&self.data)
            .map_err(|e| DeepJellyError::Parse(format!(
                "Failed to serialize character integrations: {}", e
            )))?;

        println!("[CharacterIntegrationManager::save] JSON size: {} bytes", content.len());

        fs::write(&self.config_path, content)
            .map_err(|e| {
                println!("[CharacterIntegrationManager::save] ❌ Failed to write file: {}", e);
                DeepJellyError::Io(e)
            })?;

        println!("[CharacterIntegrationManager::save] ✅ File saved successfully");
        Ok(())
    }

    /// Get all character integrations
    pub fn get_all(&self) -> Vec<CharacterIntegration> {
        self.data.bindings.clone()
    }

    /// Get character integration by ID
    pub fn get(&self, id: &str) -> Option<&CharacterIntegration> {
        self.data.bindings.iter().find(|b| b.id == id)
    }

    /// Get character integrations by assistant ID
    pub fn get_by_assistant(&self, assistant_id: &str) -> Vec<CharacterIntegration> {
        self.data
            .find_by_assistant(assistant_id)
            .into_iter()
            .cloned()
            .collect()
    }

    /// Get character integrations by character ID
    pub fn get_by_character(&self, character_id: &str) -> Vec<CharacterIntegration> {
        self.data
            .find_by_character(character_id)
            .into_iter()
            .cloned()
            .collect()
    }

    /// Get character integrations by integration ID
    pub fn get_by_app_integration(&self, integration_id: &str) -> Vec<CharacterIntegration> {
        self.data
            .bindings
            .iter()
            .filter(|b| b.integration.integration_id == integration_id)
            .cloned()
            .collect()
    }

    /// Add a new character integration (auto-generates id)
    pub fn add(&mut self, mut binding: CharacterIntegration) -> Result<(), DeepJellyError> {
        println!("[CharacterIntegrationManager::add] 📥 Adding character integration");
        println!("[CharacterIntegrationManager::add] characterId: {}", binding.character_id);
        println!("[CharacterIntegrationManager::add] assistantId: {}", binding.assistant_id);

        // Auto-generate ID if not provided
        if binding.id.is_empty() {
            binding.id = generate_dj_id();
            println!("[CharacterIntegrationManager::add] Generated new ID: {}", binding.id);
        }

        // Check if ID already exists
        if self.data.bindings.iter().any(|b| b.id == binding.id) {
            return Err(DeepJellyError::Validation(format!(
                "Character integration with ID {} already exists",
                binding.id
            )));
        }

        // Set creation timestamp if not provided
        if binding.created_at.is_none() {
            binding.created_at = Some(chrono::Utc::now().timestamp_millis());
        }

        println!("[CharacterIntegrationManager::add] Current bindings count: {}", self.data.bindings.len());
        self.data.add_binding(binding.clone());
        println!("[CharacterIntegrationManager::add] After add, bindings count: {}", self.data.bindings.len());

        self.save()?;
        println!("[CharacterIntegrationManager::add] ✅ Character integration saved successfully");
        Ok(())
    }

    /// Update an existing character integration
    pub fn update(&mut self, id: &str, updates: CharacterIntegration) -> Result<(), DeepJellyError> {
        let binding = self.data.bindings
            .iter_mut()
            .find(|b| b.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character integration {} not found", id)))?;

        // Update fields
        binding.character_id = updates.character_id;
        binding.character_name = updates.character_name;
        binding.assistant_id = updates.assistant_id;
        binding.assistant_name = updates.assistant_name;
        binding.integration = updates.integration;
        if let Some(enabled) = updates.enabled {
            binding.enabled = Some(enabled);
        }

        self.save()?;
        Ok(())
    }

    /// Update only the integration part of a character integration
    pub fn update_integration(
        &mut self,
        id: &str,
        integration_id: Option<String>,
        agent_id: Option<String>,
        params: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<(), DeepJellyError> {
        let binding = self.data.bindings
            .iter_mut()
            .find(|b| b.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character integration {} not found", id)))?;

        if let Some(integration_id) = integration_id {
            binding.integration.integration_id = integration_id;
        }
        if let Some(agent_id) = agent_id {
            binding.integration.agent_id = agent_id;
        }
        if let Some(params) = params {
            binding.integration.params = params;
        }

        self.save()?;
        Ok(())
    }

    /// Set enabled status
    pub fn set_enabled(&mut self, id: &str, enabled: bool) -> Result<(), DeepJellyError> {
        let binding = self.data.bindings
            .iter_mut()
            .find(|b| b.id == id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character integration {} not found", id)))?;

        binding.enabled = Some(enabled);
        self.save()?;
        Ok(())
    }

    /// Delete a character integration
    pub fn delete(&mut self, id: &str) -> Result<bool, DeepJellyError> {
        let removed = self.data.remove_binding(id).is_some();
        if removed {
            self.save()?;
        }
        Ok(removed)
    }

    /// Delete all character integrations for a specific character
    pub fn delete_by_character(&mut self, character_id: &str) -> Result<usize, DeepJellyError> {
        let original_len = self.data.bindings.len();
        self.data.bindings.retain(|b| b.character_id != character_id);
        let removed = original_len - self.data.bindings.len();

        if removed > 0 {
            self.save()?;
        }

        Ok(removed)
    }

    /// Delete all character integrations for a specific assistant
    pub fn delete_by_assistant(&mut self, assistant_id: &str) -> Result<usize, DeepJellyError> {
        let original_len = self.data.bindings.len();
        self.data.bindings.retain(|b| b.assistant_id != assistant_id);
        let removed = original_len - self.data.bindings.len();

        if removed > 0 {
            self.save()?;
        }

        Ok(removed)
    }

    /// Delete all character integrations for a specific app integration
    pub fn delete_by_app_integration(&mut self, integration_id: &str) -> Result<usize, DeepJellyError> {
        let original_len = self.data.bindings.len();
        self.data.bindings.retain(|b| b.integration.integration_id != integration_id);
        let removed = original_len - self.data.bindings.len();

        if removed > 0 {
            self.save()?;
        }

        Ok(removed)
    }

    /// Check if any character integrations exist for a specific app integration
    pub fn has_app_integration(&self, integration_id: &str) -> bool {
        self.data.bindings.iter().any(|b| b.integration.integration_id == integration_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::integration::{IntegrationInfo, ProviderType};
    use std::collections::HashMap;
    use tempfile::TempDir;

    fn create_test_integration(
        character_id: &str,
        character_name: &str,
        assistant_id: &str,
        assistant_name: &str,
        integration_id: &str,
        agent_id: &str,
    ) -> CharacterIntegration {
        let mut params = HashMap::new();
        params.insert("sessionKey".to_string(), serde_json::json!("agent:christina:main"));

        CharacterIntegration {
            id: String::new(), // Will be auto-generated
            character_id: character_id.to_string(),
            character_name: character_name.to_string(),
            assistant_id: assistant_id.to_string(),
            assistant_name: assistant_name.to_string(),
            integration: IntegrationInfo {
                integration_id: integration_id.to_string(),
                provider: ProviderType::Openclaw,
                application_id: "app123".to_string(),
                agent_id: agent_id.to_string(),
                params,
            },
            enabled: Some(true),
            created_at: None,
        }
    }

    #[test]
    fn test_create_empty_config() {
        let temp_dir = TempDir::new().unwrap();
        let manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let bindings = manager.get_all();
        assert_eq!(bindings.len(), 0);
    }

    #[test]
    fn test_add_character_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let binding = create_test_integration(
            "char_feishu_private",
            "飞书私聊",
            "work_assistant",
            "工作助手",
            "int_001",
            "christina",
        );

        manager.add(binding).unwrap();

        let bindings = manager.get_all();
        assert_eq!(bindings.len(), 1);
        assert_eq!(bindings[0].id.len(), 16);
        assert_eq!(bindings[0].character_name, "飞书私聊");
    }

    #[test]
    fn test_get_by_assistant() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let binding1 = create_test_integration("char1", "角色1", "assistant1", "助手1", "int1", "agent1");
        let binding2 = create_test_integration("char2", "角色2", "assistant1", "助手1", "int2", "agent2");
        let binding3 = create_test_integration("char3", "角色3", "assistant2", "助手2", "int3", "agent3");

        manager.add(binding1).unwrap();
        manager.add(binding2).unwrap();
        manager.add(binding3).unwrap();

        let assistant1_bindings = manager.get_by_assistant("assistant1");
        assert_eq!(assistant1_bindings.len(), 2);

        let assistant2_bindings = manager.get_by_assistant("assistant2");
        assert_eq!(assistant2_bindings.len(), 1);
    }

    #[test]
    fn test_delete_character_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let binding = create_test_integration(
            "char_feishu_private",
            "飞书私聊",
            "work_assistant",
            "工作助手",
            "int_001",
            "christina",
        );

        manager.add(binding).unwrap();
        let bindings = manager.get_all();
        let id = bindings[0].id.clone();

        manager.delete(&id).unwrap();

        let bindings = manager.get_all();
        assert_eq!(bindings.len(), 0);
    }

    #[test]
    fn test_delete_by_app_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let binding1 = create_test_integration("char1", "角色1", "assistant1", "助手1", "int1", "agent1");
        let binding2 = create_test_integration("char2", "角色2", "assistant1", "助手1", "int1", "agent2");
        let binding3 = create_test_integration("char3", "角色3", "assistant2", "助手2", "int2", "agent3");

        manager.add(binding1).unwrap();
        manager.add(binding2).unwrap();
        manager.add(binding3).unwrap();

        // Delete bindings for app integration "int1"
        let removed = manager.delete_by_app_integration("int1").unwrap();
        assert_eq!(removed, 2);

        let bindings = manager.get_all();
        assert_eq!(bindings.len(), 1);
        assert_eq!(bindings[0].integration.integration_id, "int2");
    }

    #[test]
    fn test_has_app_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let binding = create_test_integration("char1", "角色1", "assistant1", "助手1", "int1", "agent1");
        manager.add(binding).unwrap();

        assert!(manager.has_app_integration("int1"));
        assert!(!manager.has_app_integration("int2"));
    }

    #[test]
    fn test_set_enabled() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterIntegrationManager::new(temp_dir.path().to_path_buf()).unwrap();

        let binding = create_test_integration("char1", "角色1", "assistant1", "助手1", "int1", "agent1");
        manager.add(binding).unwrap();

        let bindings = manager.get_all();
        let id = bindings[0].id.clone();

        manager.set_enabled(&id, false).unwrap();

        let updated = manager.get(&id).unwrap();
        assert_eq!(updated.enabled, Some(false));
    }
}
