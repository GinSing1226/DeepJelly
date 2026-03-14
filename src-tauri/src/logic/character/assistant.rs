//! Assistant management types and persistence
//!
//! Manages assistant configuration with JSON file persistence.
//! Uses separated storage architecture:
//! - assistants.json: Lightweight character references
//! - characters/{assistant_id}/{character_id}/config.json: Full character data

use crate::models::AssistantsData;
use crate::models::{Character, CharacterReference};
use crate::utils::error::DeepJellyError;
use log::info;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// Re-export the new Assistant type from models
pub use crate::models::Assistant;

// Re-export Integration type from models
pub use crate::models::Integration;

// Re-export Appearance type from models
pub use crate::models::Appearance;

/// Assistant manager
///
/// Manages assistant configuration with JSON file persistence.
/// Uses separated storage: assistants.json for references, character files for full data.
pub struct AssistantManager {
    /// Data directory path
    data_dir: PathBuf,
    /// Assistants configuration file path
    config_path: PathBuf,
    /// Cached assistants data
    data: AssistantsData,
}

impl AssistantManager {
    /// Create a new assistant manager
    ///
    /// # Arguments
    /// * `data_dir` - Data directory path (e.g., `{app_root}/data/user`)
    ///
    /// # Initialization Requirements
    /// The assistants.json file must already exist (copied by initialize_user_data).
    /// This ensures the default template with correct IDs is used, not randomly generated ones.
    pub fn new(data_dir: PathBuf) -> Result<Self, DeepJellyError> {
        let config_path = data_dir.join("assistants.json");

        // Ensure data directory exists
        fs::create_dir_all(&data_dir).map_err(DeepJellyError::Io)?;

        let mut manager = Self {
            data_dir,
            config_path,
            data: AssistantsData::new(),
        };

        // Load existing configuration - file must exist
        if manager.config_path.exists() {
            manager.load()?;
            info!("Loaded assistants configuration from {:?}", manager.config_path);
        } else {
            // File should have been copied by initialize_user_data()
            // If we get here, it's a configuration error
            return Err(DeepJellyError::Config(format!(
                "assistants.json not found at {:?}. initialize_user_data() should have copied this from the default template.",
                manager.config_path
            )));
        }

        Ok(manager)
    }

    /// Load assistants from JSON file
    pub fn load(&mut self) -> Result<(), DeepJellyError> {
        let content = fs::read_to_string(&self.config_path)
            .map_err(DeepJellyError::Io)?;

        self.data = serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to parse assistants.json: {}", e)))?;

        Ok(())
    }

    /// Save assistants to JSON file
    pub fn save(&self) -> Result<(), DeepJellyError> {
        println!("[AssistantManager::save] START: path={:?}", self.config_path);

        let content = serde_json::to_string_pretty(&self.data)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to serialize assistants: {}", e)))?;

        println!("[AssistantManager::save] Writing {} bytes to disk", content.len());
        fs::write(&self.config_path, content)
            .map_err(DeepJellyError::Io)?;
        println!("[AssistantManager::save] COMPLETE");
        Ok(())
    }

    /// Get all assistants
    pub fn get_all(&self) -> Vec<Assistant> {
        self.data.assistants.clone()
    }

    /// Get assistant by ID
    pub fn get(&self, id: &str) -> Option<&Assistant> {
        self.data.find_assistant(id)
    }

    /// Add a new assistant
    pub fn add(&mut self, assistant: Assistant) -> Result<(), DeepJellyError> {
        // Check if ID already exists
        if self.data.contains_assistant(&assistant.id) {
            return Err(DeepJellyError::Validation(format!(
                "Assistant with ID {} already exists",
                assistant.id
            )));
        }

        self.data.add_assistant(assistant);
        self.save()?;
        Ok(())
    }

    /// Update an existing assistant
    pub fn update(&mut self, id: &str, updates: UpdatedAssistant) -> Result<(), DeepJellyError> {
        println!("[AssistantManager::update] START: id={}, updates={:?}", id, updates);

        let assistant = self.data.assistants
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
            assistant.app_type = Some(app_type);
        }
        if let Some(agent_label) = updates.agent_label {
            // Normalize empty agent_label to None
            assistant.agent_label = if agent_label.is_empty() {
                None
            } else {
                Some(agent_label)
            };
        }
        if let Some(bound_agent_id) = updates.bound_agent_id {
            assistant.bound_agent_id = Some(bound_agent_id);
        }
        if let Some(session_key) = updates.session_key {
            assistant.session_key = Some(session_key);
        }
        if let Some(integrations) = updates.integrations {
            println!("[AssistantManager::update] Updating integrations, count={}", integrations.len());
            assistant.integrations = Some(integrations);
        }

        println!("[AssistantManager::update] Saving to disk...");
        self.save()?;
        println!("[AssistantManager::update] COMPLETE");
        Ok(())
    }

    /// Delete an assistant
    pub fn delete(&mut self, id: &str) -> Result<bool, DeepJellyError> {
        // Check if assistant has characters
        let assistant = self.data.find_assistant(id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Assistant {} not found", id)))?;

        if !assistant.characters.is_empty() {
            return Err(DeepJellyError::Validation(format!(
                "Cannot delete assistant with {} characters. Please delete all characters first.",
                assistant.characters.len()
            )));
        }

        let result = self.data.remove_assistant(id);
        if result.is_some() {
            self.save()?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get data directory path
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /// Get characters directory path
    pub fn characters_dir(&self) -> PathBuf {
        self.data_dir.join("characters")
    }

    /// Get character config file path
    /// 新结构: characters/{assistant_id}/{character_id}/config.json
    fn character_config_path(&self, assistant_id: &str, character_id: &str) -> PathBuf {
        self.characters_dir().join(assistant_id).join(character_id).join("config.json")
    }

    /// Load character full data from file
    fn load_character_file(&self, assistant_id: &str, character_id: &str) -> Result<Character, DeepJellyError> {
        let path = self.character_config_path(assistant_id, character_id);
        let content = fs::read_to_string(&path)
            .map_err(|e| DeepJellyError::NotFound(format!("Character file not found: {}", e)))?;
        serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to parse character file: {}", e)))
    }

    /// Save character full data to file
    fn save_character_file(&self, assistant_id: &str, character: &Character) -> Result<(), DeepJellyError> {
        let path = self.character_config_path(assistant_id, &character.id);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(DeepJellyError::Io)?;
        }
        let content = serde_json::to_string_pretty(character)
            .map_err(|e| DeepJellyError::Parse(format!("Failed to serialize character: {}", e)))?;
        fs::write(&path, content)
            .map_err(DeepJellyError::Io)?;
        Ok(())
    }

    /// Delete character file
    fn delete_character_file(&self, assistant_id: &str, character_id: &str) -> Result<(), DeepJellyError> {
        let char_dir = self.characters_dir().join(assistant_id).join(character_id);
        if char_dir.exists() {
            fs::remove_dir_all(&char_dir)
                .map_err(DeepJellyError::Io)?;
        }
        Ok(())
    }

    // ============ Character Operations ============

    /// Get all characters across all assistants (loads from files)
    pub fn get_all_characters(&self) -> Vec<Character> {
        let mut all_characters = Vec::new();
        for assistant in &self.data.assistants {
            for char_ref in &assistant.characters {
                if let Ok(character) = self.load_character_file(&assistant.id, &char_ref.id) {
                    all_characters.push(character);
                }
            }
        }
        all_characters
    }

    /// Get characters by assistant ID (loads from files)
    pub fn get_characters_by_assistant(&self, assistant_id: &str) -> Vec<Character> {
        if let Some(assistant) = self.data.find_assistant(assistant_id) {
            let mut characters = Vec::new();
            for char_ref in &assistant.characters {
                if let Ok(character) = self.load_character_file(&assistant.id, &char_ref.id) {
                    characters.push(character);
                }
            }
            characters
        } else {
            Vec::new()
        }
    }

    /// Get character by ID (loads from file)
    /// 需要查找角色所属的 assistant_id
    pub fn get_character(&self, character_id: &str) -> Option<Character> {
        // 遍历所有助手查找该角色
        for assistant in &self.data.assistants {
            if assistant.characters.iter().any(|c| c.id == character_id) {
                return self.load_character_file(&assistant.id, character_id).ok();
            }
        }
        None
    }

    /// Add a character to an assistant (saves to file + adds reference)
    pub fn add_character(
        &mut self,
        assistant_id: &str,
        character: Character,
    ) -> Result<(), DeepJellyError> {
        // 1. Save character full data to file
        self.save_character_file(assistant_id, &character)?;

        // 2. Add lightweight reference to assistant
        let assistant = self.data.assistants.iter_mut()
            .find(|a| a.id == assistant_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Assistant {} not found", assistant_id)))?;

        // Check if character ID already exists
        if assistant.characters.iter().any(|c| c.id == character.id) {
            return Err(DeepJellyError::Validation(format!(
                "Character with ID {} already exists",
                character.id
            )));
        }

        let char_ref = CharacterReference {
            id: character.id.clone(),
            default_appearance_id: character.default_appearance_id.clone(),
        };

        assistant.characters.push(char_ref);
        self.save()?;
        Ok(())
    }

    /// Update a character (updates file + potentially updates reference)
    pub fn update_character(
        &mut self,
        character_id: &str,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<(), DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found in any assistant", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Update fields
        if let Some(name) = name {
            character.name = name;
        }
        if let Some(description) = description {
            character.description = Some(description);
        }

        // 3. Save back to file
        self.save_character_file(&assistant_id, &character)?;

        // 4. Update reference if default_appearance_id changed
        if let Some(ref default_id) = character.default_appearance_id {
            let mut needs_save = false;
            for assistant in &mut self.data.assistants {
                if let Some(ref mut char_ref) = assistant.characters.iter_mut().find(|c| c.id == character_id) {
                    if char_ref.default_appearance_id.as_ref() != Some(default_id) {
                        char_ref.default_appearance_id = Some(default_id.clone());
                        needs_save = true;
                    }
                }
            }
            if needs_save {
                self.save()?;
            }
        }

        Ok(())
    }

    /// Delete a character (deletes file + removes reference)
    pub fn delete_character(&mut self, character_id: &str) -> Result<bool, DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = match self.find_assistant_by_character(character_id) {
            Some(id) => id,
            None => return Ok(false), // Character not found
        };

        // 1. Delete character file
        self.delete_character_file(&assistant_id, character_id)?;

        // 2. Remove reference from assistants
        for assistant in &mut self.data.assistants {
            let original_len = assistant.characters.len();
            assistant.characters.retain(|c| c.id != character_id);
            if assistant.characters.len() != original_len {
                self.save()?;
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Find the assistant ID that owns a character
    pub fn find_assistant_by_character(&self, character_id: &str) -> Option<String> {
        for assistant in &self.data.assistants {
            if assistant.characters.iter().any(|c| c.id == character_id) {
                return Some(assistant.id.clone());
            }
        }
        None
    }

    // ============ Appearance Operations ============

    /// Add an appearance to a character
    pub fn add_appearance(
        &mut self,
        character_id: &str,
        mut appearance: Appearance,
    ) -> Result<(), DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Check if appearance ID already exists
        if character.appearances.iter().any(|a| a.id == appearance.id) {
            return Err(DeepJellyError::Validation(format!(
                "Appearance with ID {} already exists",
                appearance.id
            )));
        }

        // 3. Handle default appearance
        let is_default = appearance.is_default || character.appearances.is_empty();
        let appearance_id = appearance.id.clone();

        for other in &mut character.appearances {
            other.is_default = false;
        }
        appearance.is_default = is_default;

        if is_default {
            character.default_appearance_id = Some(appearance_id.clone());
        }

        character.appearances.push(appearance);

        // 4. Save character file
        self.save_character_file(&assistant_id, &character)?;

        // 5. Update reference in assistants.json if default changed
        if is_default {
            for assistant in &mut self.data.assistants {
                if let Some(ref mut char_ref) = assistant.characters.iter_mut().find(|c| c.id == character_id) {
                    char_ref.default_appearance_id = Some(appearance_id.clone());
                }
            }
            self.save()?;
        }

        Ok(())
    }

    /// Update an appearance
    pub fn update_appearance(
        &mut self,
        character_id: &str,
        appearance_id: &str,
        name: Option<String>,
        description: Option<String>,
        is_default: Option<bool>,
    ) -> Result<(), DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Find and update the appearance
        let appearance = character.appearances.iter_mut()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Appearance {} not found", appearance_id)))?;

        if let Some(name) = name {
            appearance.name = name;
        }
        if let Some(description) = description {
            appearance.description = Some(description);
        }

        let mut needs_ref_update = false;
        if let Some(is_default) = is_default {
            appearance.is_default = is_default;
            if is_default {
                // Reset other appearances' default flag
                for other in &mut character.appearances {
                    if other.id != appearance_id {
                        other.is_default = false;
                    }
                }
                character.default_appearance_id = Some(appearance_id.to_string());
                needs_ref_update = true;
            }
        }

        // 3. Save character file
        self.save_character_file(&assistant_id, &character)?;

        // 4. Update reference in assistants.json if default changed
        if needs_ref_update {
            for assistant in &mut self.data.assistants {
                if let Some(ref mut char_ref) = assistant.characters.iter_mut().find(|c| c.id == character_id) {
                    char_ref.default_appearance_id = Some(appearance_id.to_string());
                }
            }
            self.save()?;
        }

        Ok(())
    }

    /// Delete an appearance
    pub fn delete_appearance(
        &mut self,
        character_id: &str,
        appearance_id: &str,
    ) -> Result<bool, DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = match self.find_assistant_by_character(character_id) {
            Some(id) => id,
            None => return Ok(false),
        };

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Remove the appearance
        let original_len = character.appearances.len();
        character.appearances.retain(|a| a.id != appearance_id);

        // 3. Update default appearance if needed
        let mut needs_ref_update = false;
        if character.default_appearance_id.as_ref() == Some(&appearance_id.to_string()) {
            character.default_appearance_id = character.appearances.first().map(|a| a.id.clone());
            needs_ref_update = true;
        }

        if character.appearances.len() != original_len {
            // 4. Save character file
            self.save_character_file(&assistant_id, &character)?;

            // 5. Update reference in assistants.json if default changed
            if needs_ref_update {
                for assistant in &mut self.data.assistants {
                    if let Some(ref mut char_ref) = assistant.characters.iter_mut().find(|c| c.id == character_id) {
                        char_ref.default_appearance_id = character.default_appearance_id.clone();
                    }
                }
                self.save()?;
            }

            return Ok(true);
        }

        Ok(false)
    }

    // ============ Action Resource Operations ============

    /// Update action resources
    /// IMPORTANT: Must specify appearance_id to avoid updating wrong appearance when multiple exist
    pub fn update_action_resources(
        &mut self,
        character_id: &str,
        appearance_id: &str,
        action_key: &str,
        resources: Vec<String>,
    ) -> Result<(), DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Find the specific appearance and update the action
        let appearance = character.appearances.iter_mut()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Appearance {} not found", appearance_id)))?;

        let action = appearance.actions.get_mut(action_key)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Action {} not found in appearance {}", action_key, appearance_id)))?;

        action.resources = resources;

        // 3. Save character file
        self.save_character_file(&assistant_id, &character)?;
        Ok(())
    }

    /// Remove action resource
    /// IMPORTANT: Must specify appearance_id to avoid updating wrong appearance when multiple exist
    pub fn remove_action_resource(
        &mut self,
        character_id: &str,
        appearance_id: &str,
        action_key: &str,
        resource_name: &str,
    ) -> Result<(), DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Find the specific appearance and update the action
        let appearance = character.appearances.iter_mut()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Appearance {} not found", appearance_id)))?;

        let action = appearance.actions.get_mut(action_key)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Action {} not found in appearance {}", action_key, appearance_id)))?;

        action.resources.retain(|r| r != resource_name);

        // 3. Save character file
        self.save_character_file(&assistant_id, &character)?;
        Ok(())
    }

    /// Update action properties (fps, loop, description)
    pub fn update_action(
        &mut self,
        character_id: &str,
        appearance_id: &str,
        old_key: &str,
        new_key: String,
        fps: Option<Option<u32>>,
        loop_value: Option<bool>,
        description: Option<String>,
    ) -> Result<(), DeepJellyError> {
        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Find the appearance
        let appearance = character.appearances.iter_mut()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Appearance {} not found", appearance_id)))?;

        // 3. Get the existing action resource
        let resource = appearance.actions.get(old_key)
            .ok_or_else(|| DeepJellyError::NotFound(format!("动作不存在: {}", old_key)))?
            .clone();

        // 4. Remove old key
        appearance.actions.remove(old_key);

        // 5. Update resource properties
        let mut updated_resource = resource;
        if let Some(fps_value) = fps {
            updated_resource.fps = fps_value;
        }
        if let Some(loop_val) = loop_value {
            updated_resource.r#loop = loop_val;
        }
        if let Some(desc) = description {
            updated_resource.description = Some(desc);
        }

        // 6. Insert with new key
        appearance.actions.insert(new_key.clone(), updated_resource);

        // 7. Save character file
        self.save_character_file(&assistant_id, &character)?;
        Ok(())
    }

    /// Update action with type and spritesheet support
    ///
    /// Updates an action's type, fps, loop value, spritesheet config, and description
    pub fn update_action_with_type(
        &mut self,
        character_id: &str,
        appearance_id: &str,
        old_key: &str,
        new_key: String,
        action_type: crate::models::ActionType,
        fps: Option<Option<u32>>,
        loop_value: bool,
        spritesheet: Option<crate::models::SpriteSheetConfig>,
        description: Option<String>,
    ) -> Result<(), DeepJellyError> {
        use crate::models::Action;

        // 0. Find the assistant that owns this character
        let assistant_id = self.find_assistant_by_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Character {} not found", character_id)))?;

        // 1. Load character data from file
        let mut character = self.load_character_file(&assistant_id, character_id)?;

        // 2. Find the appearance
        let appearance = character.appearances.iter_mut()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("Appearance {} not found", appearance_id)))?;

        // 3. Get the existing action resource
        let resource = appearance.actions.get(old_key)
            .ok_or_else(|| DeepJellyError::NotFound(format!("动作不存在: {}", old_key)))?
            .clone();

        // 4. Remove old key
        appearance.actions.remove(old_key);

        // 5. Build updated action with new type and config
        let updated_action = Action {
            action_type,
            resources: resource.resources,
            fps: fps.unwrap_or(resource.fps),
            r#loop: loop_value,
            spritesheet,
            description: description.or(resource.description),
        };

        // 6. Insert with new key
        appearance.actions.insert(new_key, updated_action);

        // 7. Save character file
        self.save_character_file(&assistant_id, &character)?;
        Ok(())
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
    #[serde(rename = "boundAgentId")]
    pub bound_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "sessionKey")]
    pub session_key: Option<String>,
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

        let new_assistant = Assistant {
            id: "dj_test1234567".to_string(),
            name: "测试助手".to_string(),
            description: Some("测试描述".to_string()),
            created_at: None,
            characters: vec![],
            app_type: Some("openclaw".to_string()),
            agent_label: Some("agent_001".to_string()),
            bound_agent_id: None,
            session_key: None,
            integrations: None,
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

        // Add an assistant with no characters
        let new_assistant = Assistant {
            id: "dj_testdelete".to_string(),
            name: "可删除助手".to_string(),
            description: None,
            created_at: None,
            characters: vec![], // Empty, so can be deleted
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        manager.add(new_assistant).unwrap();
        assert!(manager.delete("dj_testdelete").is_ok());

        let assistants = manager.get_all();
        assert!(!assistants.iter().any(|a| a.id == "dj_testdelete"));
    }

    #[test]
    fn test_delete_assistant_with_characters_fails() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = AssistantManager::new(temp_dir.path().to_path_buf()).unwrap();

        // Try to delete the default assistant (should have 0 characters after fresh creation)
        // Actually, let's test with an assistant that has characters
        let mut assistant = Assistant {
            id: "dj_testwithchar".to_string(),
            name: "有角色助手".to_string(),
            description: None,
            created_at: None,
            characters: vec![],
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        // Add a character
        assistant.characters.push(Character {
            id: "char_test".to_string(),
            assistant_id: "dj_testwithchar".to_string(),
            name: "测试角色".to_string(),
            description: None,
            appearances: vec![],
            default_appearance_id: None,
        });

        manager.add(assistant).unwrap();

        // Should fail because assistant has characters
        let result = manager.delete("dj_testwithchar");
        assert!(result.is_err());
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
