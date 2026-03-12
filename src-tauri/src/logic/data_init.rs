//! Data initialization module
//!
//! Handles initialization of user data directory from default templates.

use std::fs;
use std::path::{Path, PathBuf};

use crate::logic::character::assistant::generate_dj_id;
use crate::utils::error::{DeepJellyError, Result as DeepJellyResult};

/// Default data directory name (read-only templates)
pub const DEFAULT_DIR: &str = "default";

/// User data directory name (writable, initialized from default)
pub const USER_DIR: &str = "user";

/// Configuration files to copy from default to user
const CONFIG_FILES: &[&str] = &["assistants.json", "language.json"];

/// Display slots configuration file name
const DISPLAY_SLOTS_FILE: &str = "display_slots.json";

/// Recursively copy a directory and all its contents
fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// Initialize user data directory from default templates
///
/// This function ensures the user data directory exists and is populated
/// with default configuration files and character resources if they don't already exist.
///
/// # Arguments
/// * `data_dir` - Root data directory containing default/ and user/ subdirectories
///
/// # Returns
/// * `Ok(())` if initialization succeeds
/// * `Err(DeepJellyError)` if initialization fails
///
/// # Behavior
/// 1. Creates `data_dir/USER_DIR` if it doesn't exist
/// 2. Copies config files from `default/` to `user/` if they don't exist in user/
/// 3. Copies default characters from `default/characters/` to `user/characters/` if they don't exist
pub fn initialize_user_data(data_dir: &Path) -> DeepJellyResult<()> {
    let default_dir = get_default_dir(data_dir);
    let user_dir = get_user_dir(data_dir);

    // 添加路径日志
    log::info!("[initialize_user_data] data_dir = {:?}", data_dir);
    log::info!("[initialize_user_data] default_dir = {:?}, exists = {}", default_dir, default_dir.exists());
    log::info!("[initialize_user_data] user_dir = {:?}", user_dir);

    // Ensure user directory exists
    fs::create_dir_all(&user_dir)
        .map_err(|e| DeepJellyError::Config(format!("Failed to create user directory: {}", e)))?;

    // Copy configuration files from default to user if they don't exist
    for config_file in CONFIG_FILES {
        let default_path = default_dir.join(config_file);
        let user_path = user_dir.join(config_file);

        log::info!("[initialize_user_data] Checking {}: default exists = {}, user exists = {}",
            config_file, default_path.exists(), user_path.exists());

        // Only copy if user file doesn't exist
        if !user_path.exists() {
            if default_path.exists() {
                log::info!("[initialize_user_data] Copying {} from default to user", config_file);
                fs::copy(&default_path, &user_path)
                    .map_err(|e| {
                        DeepJellyError::Config(format!(
                            "Failed to copy {} from default to user: {}",
                            config_file, e
                        ))
                    })?;
                log::info!("[initialize_user_data] Successfully copied {}", config_file);
            } else {
                log::warn!("[initialize_user_data] Default file {} not found", config_file);
            }
        }
    }

    // Ensure user/characters/ directory exists and copy default characters
    // New structure: characters/{assistant_id}/{character_id}/
    let default_characters_dir = default_dir.join("characters");
    let user_characters_dir = user_dir.join("characters");

    if default_characters_dir.exists() {
        // Copy characters from default to user with new structure
        // Default structure: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/
        // User structure: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/
        for assistant_entry in fs::read_dir(&default_characters_dir)
            .map_err(|e| {
                DeepJellyError::Config(format!("Failed to read default characters directory: {}", e))
            })?
        {
            let assistant_entry = assistant_entry.map_err(|e| {
                DeepJellyError::Config(format!("Failed to read directory entry: {}", e))
            })?;
            let assistant_name = assistant_entry.file_name();
            let default_assistant_path = default_characters_dir.join(&assistant_name);

            // Skip if not a directory
            if !default_assistant_path.is_dir() {
                continue;
            }

            // Iterate through characters in this assistant directory
            for character_entry in fs::read_dir(&default_assistant_path)
                .map_err(|e| {
                    DeepJellyError::Config(format!("Failed to read assistant directory: {}", e))
                })?
            {
                let character_entry = character_entry.map_err(|e| {
                    DeepJellyError::Config(format!("Failed to read character entry: {}", e))
                })?;
                let character_name = character_entry.file_name();
                let default_character_path = default_assistant_path.join(&character_name);

                // Skip if not a directory
                if !default_character_path.is_dir() {
                    continue;
                }

                // Use the assistant_id from the directory structure
                let assistant_id = assistant_name.to_string_lossy().to_string();

                // Build user path: characters/{assistant_id}/{character_id}/
                let user_character_path = user_characters_dir
                    .join(&assistant_id)
                    .join(&character_name);

                // Only copy if character doesn't exist in user directory
                if !user_character_path.exists() {
                    copy_dir_recursive(&default_character_path, &user_character_path)
                        .map_err(|e| {
                            DeepJellyError::Config(format!(
                                "Failed to copy character '{}' from default to user: {}",
                                character_name.to_string_lossy(),
                                e
                            ))
                        })?;
                    log::info!(
                        "Copied default character '{}' to user directory (assistant: {})",
                        character_name.to_string_lossy(),
                        assistant_id
                    );
                }
            }
        }
    } else {
        // If default characters directory doesn't exist, just create empty user/characters/
        fs::create_dir_all(&user_characters_dir)
            .map_err(|e| {
                DeepJellyError::Config(format!("Failed to create characters directory: {}", e))
            })?;
    }

    // ========== Migrate Character References ==========
    // Fix assistants.json if characters field is empty but character files exist
    let assistants_path = user_dir.join("assistants.json");
    if assistants_path.exists() {
        migrate_character_references(&user_dir)?;
    }

    // ========== Initialize Default Display Slot ==========
    // Create default display slot for the first assistant if display_slots.json doesn't exist
    let display_slots_path = user_dir.join(DISPLAY_SLOTS_FILE);
    if !display_slots_path.exists() {
        log::info!("Creating default display slot configuration");
        if let Err(e) = create_default_display_slot(&user_dir) {
            log::warn!("Failed to create default display slot: {}", e);
            // Don't fail initialization if display slot creation fails
        }
    }

    Ok(())
}

/// Migrate character references in assistants.json
///
/// This function fixes cases where assistants.json has empty characters lists
/// but character config files exist in the characters directory.
fn migrate_character_references(user_dir: &Path) -> DeepJellyResult<()> {
    use serde_json::Value;

    let assistants_path = user_dir.join("assistants.json");
    let characters_dir = user_dir.join("characters");

    // Read current assistants.json
    let content = fs::read_to_string(&assistants_path)
        .map_err(|e| DeepJellyError::Config(format!("Failed to read assistants.json: {}", e)))?;

    let mut data: Value = serde_json::from_str(&content)
        .map_err(|e| DeepJellyError::Config(format!("Failed to parse assistants.json: {}", e)))?;

    let assistants = data.get_mut("assistants")
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| DeepJellyError::Config("Invalid assistants.json structure".to_string()))?;

    // Find character config files
    let mut needs_save = false;
    if let Ok(entries) = fs::read_dir(&characters_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let config_file = path.join("config.json");
                if config_file.exists() {
                    // Read character config to get its ID
                    if let Ok(char_content) = fs::read_to_string(&config_file) {
                        if let Ok(char_data) = serde_json::from_str::<Value>(&char_content) {
                            let character_id = char_data.get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let default_appearance_id = char_data.get("defaultAppearanceId")
                                .and_then(|v| v.as_str());

                            if !character_id.is_empty() {
                                // Check if this character is referenced in any assistant
                                let is_referenced = assistants.iter().any(|assist| {
                                    assist.get("characters")
                                        .and_then(|c| c.as_array())
                                        .map(|chars| chars.iter().any(|c| {
                                            c.get("characterId")
                                                .and_then(|id| id.as_str()) == Some(character_id)
                                            ||
                                            c.get("id")
                                                .and_then(|id| id.as_str()) == Some(character_id)
                                        }))
                                        .unwrap_or(false)
                                });

                                if !is_referenced {
                                    // Find the first assistant and add the reference
                                    if let Some(first_assistant) = assistants.first_mut() {
                                        let characters = first_assistant.get_mut("characters")
                                            .and_then(|c| c.as_array_mut())
                                            .unwrap();

                                        let new_ref = serde_json::json!({
                                            "characterId": character_id,
                                            "defaultAppearanceId": default_appearance_id.unwrap_or("default")
                                        });
                                        characters.push(new_ref);
                                        needs_save = true;
                                        log::info!("Added character reference '{}' to assistant", character_id);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Save if modified
    if needs_save {
        let new_content = serde_json::to_string_pretty(&data)
            .map_err(|e| DeepJellyError::Config(format!("Failed to serialize assistants.json: {}", e)))?;
        fs::write(&assistants_path, new_content)
            .map_err(|e| DeepJellyError::Config(format!("Failed to write assistants.json: {}", e)))?;
        log::info!("Successfully migrated character references in assistants.json");
    }

    Ok(())
}

/// Get the default data directory path
///
/// # Arguments
/// * `data_dir` - Root data directory
///
/// # Returns
/// Path to `data_dir/DEFAULT_DIR`
pub fn get_default_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(DEFAULT_DIR)
}

/// Get the user data directory path
///
/// # Arguments
/// * `data_dir` - Root data directory
///
/// # Returns
/// Path to `data_dir/USER_DIR`
pub fn get_user_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(USER_DIR)
}

/// Create a default display slot for the first available assistant
///
/// This function reads assistants.json and creates a default display slot
/// for the first assistant's first character with its default appearance.
///
/// # Arguments
/// * `user_dir` - User data directory path
///
/// # Returns
/// * `Ok(())` if successful
/// * `Err(DeepJellyError)` if failed
fn create_default_display_slot(user_dir: &Path) -> Result<(), DeepJellyError> {
    use crate::models::{DisplaySlot, DisplaySlotsData};

    log::info!("[create_default_display_slot] Creating default display slot...");

    let assistants_path = user_dir.join("assistants.json");
    log::info!("[create_default_display_slot] assistants.json path: {:?}", assistants_path);

    if !assistants_path.exists() {
        return Err(DeepJellyError::Config(
            "assistants.json not found, cannot create default display slot".to_string()
        ));
    }

    // Read assistants configuration
    let content = fs::read_to_string(&assistants_path)
        .map_err(|e| DeepJellyError::Config(format!("Failed to read assistants.json: {}", e)))?;

    let assistants_data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| DeepJellyError::Config(format!("Failed to parse assistants.json: {}", e)))?;

    log::info!("[create_default_display_slot] Parsed assistants.json successfully");

    // Get the first assistant
    let first_assistant = assistants_data
        .get("assistants")
        .and_then(|a| a.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| DeepJellyError::Config("No assistants found".to_string()))?;

    let assistant_id = first_assistant.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| DeepJellyError::Config("Assistant missing id".to_string()))?;

    let assistant_name = first_assistant.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Default Assistant");

    log::info!("[create_default_display_slot] Found assistant: {} ({})", assistant_id, assistant_name);

    // Get the first character reference (轻量引用，只有 characterId 和 defaultAppearanceId)
    let first_character = first_assistant.get("characters")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| DeepJellyError::Config("No characters found".to_string()))?;

    log::info!("[create_default_display_slot] Found character reference: {:?}", first_character);

    // 新数据模型使用 characterId 而不是 id
    let character_id = first_character.get("characterId")
        .or_else(|| first_character.get("id"))  // 兼容旧格式
        .and_then(|v| v.as_str())
        .ok_or_else(|| DeepJellyError::Config("Character missing characterId".to_string()))?;

    // Get default appearance ID (从轻量引用中读取)
    let appearance_id = first_character.get("defaultAppearanceId")
        .or_else(|| first_character.get("defaultAppearanceId"))  // 确保字段正确
        .and_then(|v| v.as_str())
        .ok_or_else(|| DeepJellyError::Config("No default appearance ID found in character reference".to_string()))?;

    log::info!("[create_default_display_slot] Extracted: character_id={}, appearance_id={}", character_id, appearance_id);

    // 读取完整的角色配置文件来获取 character name 和 appearance name
    // 新结构: characters/{character_id}/config.json
    let character_config_path = user_dir.join("characters").join(character_id).join("config.json");

    log::info!("[create_default_display_slot] Reading character config from: {:?}", character_config_path);

    let (character_name, appearance_name) = if character_config_path.exists() {
        let config_content = fs::read_to_string(&character_config_path)
            .map_err(|e| DeepJellyError::Config(format!("Failed to read character config: {}", e)))?;
        if let Ok(config_obj) = serde_json::from_str::<serde_json::Value>(&config_content) {
            // 从完整配置读取角色名称
            let char_name = config_obj.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Default Character")
                .to_string();

            // 从完整配置读取形象名称
            let app_name = config_obj.get("appearances")
                .and_then(|a| a.as_array())
                .and_then(|arr| arr.iter().find(|a| a.get("id").and_then(|v| v.as_str()) == Some(appearance_id)))
                .and_then(|a| a.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("Default")
                .to_string();

            (char_name, app_name)
        } else {
            ("Default Character".to_string(), "Default".to_string())
        }
    } else {
        log::warn!("Character config not found at {:?}, using default names", character_config_path);
        ("Default Character".to_string(), "Default".to_string())
    };

    // Create the display slot
    let slot = DisplaySlot {
        id: format!("slot_{}", generate_dj_id()),
        assistant_id: assistant_id.to_string(),
        assistant_name: assistant_name.to_string(),
        character_id: character_id.to_string(),
        character_name,  // Already a String from tuple destructuring
        appearance_id: appearance_id.to_string(),
        appearance_name,  // Already a String from tuple destructuring
        window_id: None, // Window will be created on startup
        visible: true,
        position: None,
        created_at: Some(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64),
    };

    // Create and save display slots data
    let mut slots_data = DisplaySlotsData::new();
    slots_data.add_slot(slot.clone());

    log::info!("[create_default_display_slot] Created slot: {} - {}/{} ({}/{}/{})",
        slot.id, slot.assistant_name, slot.character_name, slot.assistant_id, slot.character_id, slot.appearance_id);

    let slots_content = serde_json::to_string_pretty(&slots_data)
        .map_err(|e| DeepJellyError::Config(format!("Failed to serialize display slots: {}", e)))?;

    let display_slots_path = user_dir.join(DISPLAY_SLOTS_FILE);
    fs::write(&display_slots_path, slots_content)
        .map_err(|e| DeepJellyError::Config(format!("Failed to write display_slots.json: {}", e)))?;

    log::info!("[create_default_display_slot] Successfully wrote display_slots.json to: {:?}", display_slots_path);
    log::info!("[create_default_display_slot] File exists: {}", display_slots_path.exists());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    /// Helper to create a test file with content
    fn create_test_file(dir: &Path, filename: &str, content: &str) -> std::io::Result<()> {
        let file_path = dir.join(filename);
        let mut file = File::create(&file_path)?;
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    #[test]
    fn test_get_default_dir() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        let default_dir = get_default_dir(data_dir);
        let expected = data_dir.join("default");

        assert_eq!(default_dir, expected);
    }

    #[test]
    fn test_get_user_dir() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        let user_dir = get_user_dir(data_dir);
        let expected = data_dir.join("user");

        assert_eq!(user_dir, expected);
    }

    #[test]
    fn test_initialize_user_data_creates_directories() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        // Before initialization, user directory should not exist
        let user_dir = get_user_dir(data_dir);
        assert!(!user_dir.exists());

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // After initialization, user directory and characters subdirectory should exist
        assert!(user_dir.exists());
        assert!(user_dir.join("characters").exists());
        assert!(user_dir.join("characters").is_dir());
    }

    #[test]
    fn test_initialize_user_data_copies_config_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);

        // Create default directory and config files
        fs::create_dir_all(&default_dir).unwrap();
        create_test_file(&default_dir, "assistants.json", r#"{"test": "data"}"#).unwrap();
        create_test_file(&default_dir, "language.json", r#"{"lang": "en"}"#).unwrap();

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // Verify config files were copied to user directory
        let user_dir = get_user_dir(data_dir);
        assert!(user_dir.join("assistants.json").exists());
        assert!(user_dir.join("language.json").exists());

        // Verify content matches
        let assistants_content = fs::read_to_string(user_dir.join("assistants.json")).unwrap();
        assert_eq!(assistants_content, r#"{"test":"data"}"#);

        let language_content = fs::read_to_string(user_dir.join("language.json")).unwrap();
        assert_eq!(language_content, r#"{"lang":"en"}"#);
    }

    #[test]
    fn test_initialize_user_data_preserves_existing_user_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);
        let user_dir = get_user_dir(data_dir);

        // Create default directory with config files
        fs::create_dir_all(&default_dir).unwrap();
        create_test_file(&default_dir, "assistants.json", r#"{"default": "config"}"#).unwrap();
        create_test_file(&default_dir, "language.json", r#"{"default": "lang"}"#).unwrap();

        // Create user directory with existing config file
        fs::create_dir_all(&user_dir).unwrap();
        create_test_file(&user_dir, "assistants.json", r#"{"user": "config"}"#).unwrap();

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // Verify existing user file was not overwritten
        let assistants_content = fs::read_to_string(user_dir.join("assistants.json")).unwrap();
        assert_eq!(assistants_content, r#"{"user":"config"}"#);

        // Verify missing config file was still copied
        assert!(user_dir.join("language.json").exists());
        let language_content = fs::read_to_string(user_dir.join("language.json")).unwrap();
        assert_eq!(language_content, r#"{"default":"lang"}"#);
    }

    #[test]
    fn test_initialize_user_data_handles_missing_default_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        // Don't create any default files - should not error
        let result = initialize_user_data(data_dir);
        assert!(result.is_ok());

        // User directory should still be created
        let user_dir = get_user_dir(data_dir);
        assert!(user_dir.exists());
        assert!(user_dir.join("characters").exists());
    }

    #[test]
    fn test_initialize_user_data_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        // Run initialization twice
        initialize_user_data(data_dir).unwrap();
        initialize_user_data(data_dir).unwrap();

        // Should not error and directories should exist
        let user_dir = get_user_dir(data_dir);
        assert!(user_dir.exists());
        assert!(user_dir.join("characters").exists());
    }

    #[test]
    fn test_initialize_user_data_copies_default_characters() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);

        // Create default character directory with a test character
        let default_char_dir = default_dir.join("characters").join("test_character");
        fs::create_dir_all(&default_char_dir).unwrap();
        create_test_file(&default_char_dir, "appearance.json", r#"{"name": "Test"}"#).unwrap();
        create_test_file(&default_char_dir, "image.png", "fake_png_data").unwrap();

        // Create subdirectory with resources
        let resources_dir = default_char_dir.join("resources");
        fs::create_dir_all(&resources_dir).unwrap();
        create_test_file(&resources_dir, "anim1.png", "animation1").unwrap();
        create_test_file(&resources_dir, "anim2.png", "animation2").unwrap();

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // Verify character was copied to user directory
        let user_dir = get_user_dir(data_dir);
        let user_char_dir = user_dir.join("characters").join("test_character");
        assert!(user_char_dir.exists());
        assert!(user_char_dir.is_dir());

        // Verify all files were copied
        assert!(user_char_dir.join("appearance.json").exists());
        assert!(user_char_dir.join("image.png").exists());
        assert!(user_char_dir.join("resources").exists());
        assert!(user_char_dir.join("resources/anim1.png").exists());
        assert!(user_char_dir.join("resources/anim2.png").exists());
    }

    #[test]
    fn test_initialize_user_data_preserves_existing_user_characters() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);
        let user_dir = get_user_dir(data_dir);

        // Create default character
        let default_char_dir = default_dir.join("characters").join("default_char");
        fs::create_dir_all(&default_char_dir).unwrap();
        create_test_file(&default_char_dir, "appearance.json", r#"{"from": "default"}"#).unwrap();

        // Create existing user character (simulating user customization)
        let user_char_dir = user_dir.join("characters").join("default_char");
        fs::create_dir_all(&user_char_dir).unwrap();
        create_test_file(&user_char_dir, "appearance.json", r#"{"from": "user"}"#).unwrap();
        create_test_file(&user_char_dir, "custom.png", "user_custom").unwrap();

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // Verify user's character was not overwritten
        let appearance_content = fs::read_to_string(user_char_dir.join("appearance.json")).unwrap();
        assert_eq!(appearance_content, r#"{"from":"user"}"#);
        assert!(user_char_dir.join("custom.png").exists());
    }

    #[test]
    fn test_migrate_character_references() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);
        let user_dir = get_user_dir(data_dir);

        // Create default character
        let default_char_dir = default_dir.join("characters").join("default");
        fs::create_dir_all(&default_char_dir).unwrap();
        let default_config = r#"{
            "id": "default",
            "assistantId": "test_assistant",
            "name": "默认角色",
            "description": null,
            "defaultAppearanceId": "default",
            "appearances": []
        }"#;
        create_test_file(&default_char_dir, "config.json", default_config).unwrap();

        // Create user assistants.json with empty characters list
        fs::create_dir_all(&user_dir).unwrap();
        let assistants_json = r#"{
            "assistants": [{
                "id": "test_assistant",
                "name": "Test",
                "characters": []
            }]
        }"#;
        create_test_file(&user_dir, "assistants.json", assistants_json).unwrap();

        // Run initialization (should trigger migration)
        initialize_user_data(data_dir).unwrap();

        // Verify character file was copied
        assert!(user_dir.join("characters/default/config.json").exists());

        // Verify migration happened - character reference should be added
        let updated_assistants = fs::read_to_string(user_dir.join("assistants.json")).unwrap();
        let data: serde_json::Value = serde_json::from_str(&updated_assistants).unwrap();
        let characters = data["assistants"][0]["characters"].as_array().unwrap();
        assert_eq!(characters.len(), 1);
        assert_eq!(characters[0]["id"], "default");
        assert_eq!(characters[0]["defaultAppearanceId"], "default");
    }

    #[test]
    fn test_migrate_character_references_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);
        let user_dir = get_user_dir(data_dir);

        // Create default character
        let default_char_dir = default_dir.join("characters").join("default");
        fs::create_dir_all(&default_char_dir).unwrap();
        let default_config = r#"{
            "id": "default",
            "assistantId": "test_assistant",
            "name": "默认角色",
            "description": null,
            "defaultAppearanceId": "default",
            "appearances": []
        }"#;
        create_test_file(&default_char_dir, "config.json", default_config).unwrap();

        // Create user assistants.json with character reference already present
        fs::create_dir_all(&user_dir).unwrap();
        let assistants_json = r#"{
            "assistants": [{
                "id": "test_assistant",
                "name": "Test",
                "characters": [{"characterId": "default", "defaultAppearanceId": "default"}]
            }]
        }"#;
        create_test_file(&user_dir, "assistants.json", assistants_json).unwrap();

        // Run initialization twice
        initialize_user_data(data_dir).unwrap();
        initialize_user_data(data_dir).unwrap();

        // Verify character reference is not duplicated
        let updated_assistants = fs::read_to_string(user_dir.join("assistants.json")).unwrap();
        let data: serde_json::Value = serde_json::from_str(&updated_assistants).unwrap();
        let characters = data["assistants"][0]["characters"].as_array().unwrap();
        assert_eq!(characters.len(), 1);
        assert_eq!(characters[0]["characterId"], "default");
        assert_eq!(characters[0]["defaultAppearanceId"], "default");
    }
}
