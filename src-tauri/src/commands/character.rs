//! Character management commands
//!
//! Tauri commands for managing character configurations.

use crate::logic::character::{CharacterConfig, CharacterManager};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use std::sync::Mutex;
use tauri::State;

/// Character manager state type
pub type CharacterManagerState = Mutex<CharacterManager>;

/// Validates a path component to prevent path traversal attacks
///
/// Rejects components containing:
/// - `..` (parent directory traversal)
/// - Absolute paths (starting with `/` or `\`)
/// - Drive letters on Windows (e.g., `C:`)
fn validate_path_component(component: &str) -> Result<(), String> {
    if component.contains("..") {
        return Err(format!("路径组件不能包含 '..': {}", component));
    }
    if component.starts_with('/') || component.starts_with('\\') {
        return Err(format!("路径组件不能是绝对路径: {}", component));
    }
    // Windows drive letter check (e.g., "C:", "D:")
    if component.len() >= 2
        && component.as_bytes()[1..2].eq(b":")
        && component.as_bytes()[0..1].iter().all(|b| b.is_ascii_alphabetic())
    {
        return Err(format!("路径组件不能包含盘符: {}", component));
    }
    Ok(())
}

/// Get all characters
///
/// Returns a list of all character configurations.
#[tauri::command]
pub fn get_all_characters(
    manager: State<'_, CharacterManagerState>,
) -> Result<Vec<CharacterConfig>, String> {
    let characters = {
        let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        // Clone inside lock - this is fast as it's just copying struct data
        manager.get_all_characters()
            .into_iter()
            .cloned()
            .collect::<Vec<_>>()
    };
    Ok(characters)
}

/// Get a specific character by ID
///
/// Returns the character configuration if found.
#[tauri::command]
pub fn get_character(
    character_id: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<Option<CharacterConfig>, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(manager.get_character(&character_id).cloned())
}

/// Set the current appearance
///
/// Updates the currently displayed appearance ID.
#[tauri::command]
pub fn set_current_appearance(
    appearance_id: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.set_current_appearance(appearance_id);
    Ok(())
}

/// Get the current appearance ID
///
/// Returns the ID of the currently displayed appearance.
#[tauri::command]
pub fn get_current_appearance(
    manager: State<'_, CharacterManagerState>,
) -> Result<Option<String>, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(manager.get_current_appearance().cloned())
}


/// Get available animations for the current appearance
///
/// Returns a list of animation action keys that are available in the current appearance.
#[tauri::command]
pub fn get_available_animations(
    manager: State<CharacterManagerState>,
) -> Result<Vec<String>, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    
    // Get current appearance
    let current_appearance_id = manager.get_current_appearance()
        .ok_or_else(|| "当前没有选择外观".to_string())?;
    
    // Find the appearance in all characters
    let characters = manager.get_all_characters();
    let mut animations = Vec::new();
    
    for character in &characters {
        if let Some(appearance) = character.appearances.iter()
            .find(|a| &a.id == current_appearance_id) {
            // Get all animation action keys
            animations = appearance.actions.keys().cloned().collect();
            break;
        }
    }
    
    Ok(animations)
}

/// Load all character configurations from disk
///
/// Reloads character configurations from the data directory.
#[tauri::command]
pub fn reload_characters(
    manager: State<'_, CharacterManagerState>,
) -> Result<usize, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.load_all().map_err(|e| e.to_string())
}

/// Add a character configuration
///
/// Adds a new character configuration to the manager.
#[tauri::command]
pub fn add_character(
    config: CharacterConfig,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.add_character(config);
    Ok(())
}

/// Remove a character configuration
///
/// Removes a character configuration by ID.
#[tauri::command]
pub fn remove_character(
    character_id: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<bool, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(manager.remove_character(&character_id))
}

/// Get character resource path
///
/// Returns the file path for a character resource (image, etc.)
/// Path format: `data/characters/{assistant_id}/{character_id}/{resource_name}`
#[tauri::command]
pub fn get_character_resource_path(
    assistant_id: String,
    character_id: String,
    resource_name: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<String, String> {
    // Validate inputs to prevent path traversal
    validate_path_component(&assistant_id)?;
    validate_path_component(&character_id)?;
    // resource_name can contain slashes for subdirectories (e.g., "action/0001.png")
    // so we validate each component separately
    for component in resource_name.split(['/', '\\']) {
        validate_path_component(component)?;
    }

    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    let path = manager.get_resource_path(&assistant_id, &character_id, &resource_name)
        .ok_or_else(|| format!("资源未找到: {}/{}/{}", assistant_id, character_id, resource_name))?;

    // Normalize the path for Tauri's convertFileSrc:
    // 1. Strip the Windows extended-length path prefix (\\?\)
    // 2. Convert backslashes to forward slashes
    let path_str = path.to_string_lossy().to_string();

    // Remove the \\?\ prefix if present (Windows extended-length path)
    let normalized = if path_str.starts_with("\\\\?\\") {
        &path_str[4..]  // Skip the \\?\ prefix
    } else {
        &path_str
    };

    // Convert backslashes to forward slashes for URL compatibility
    let normalized = normalized.replace('\\', "/");

    Ok(normalized)
}

/// Get multiple character resource paths
///
/// Batch version of get_character_resource_path.
#[tauri::command]
pub fn get_character_resource_paths(
    assistant_id: String,
    character_id: String,
    resource_names: Vec<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<Vec<Option<String>>, String> {
    // Validate inputs to prevent path traversal
    validate_path_component(&assistant_id)?;
    validate_path_component(&character_id)?;
    for resource_name in &resource_names {
        for component in resource_name.split(['/', '\\']) {
            validate_path_component(component)?;
        }
    }

    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    let paths: Vec<Option<String>> = resource_names
        .into_iter()
        .map(|name| {
            manager.get_resource_path(&assistant_id, &character_id, &name)
                .map(|p| p.to_string_lossy().to_string())
        })
        .collect();

    Ok(paths)
}

/// Check if a character exists
///
/// Returns true if the character configuration exists.
#[tauri::command]
pub fn is_character_user_defined(
    character_id: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<bool, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(manager.is_user_defined(&character_id))
}

/// Load character resource as base64 data URL
///
/// Reads a resource file (image, Live2D, 3D model, etc.) and returns it as base64-encoded data URL.
/// This avoids path issues with Tauri's convertFileSrc on Windows.
/// Supports all resource types: frames (images), gif, live2d, model3d.
#[tauri::command]
pub fn load_character_resource(
    assistant_id: String,
    character_id: String,
    resource_name: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<String, String> {
    use std::fs;

    // Validate inputs to prevent path traversal
    validate_path_component(&assistant_id)?;
    validate_path_component(&character_id)?;
    for component in resource_name.split(['/', '\\']) {
        validate_path_component(component)?;
    }

    println!("[load_character_resource] Loading: {}/{}/{}", assistant_id, character_id, resource_name);

    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    let path = manager.get_resource_path(&assistant_id, &character_id, &resource_name)
        .ok_or_else(|| {
            println!("[load_character_resource] Resource not found: {}/{}/{}", assistant_id, character_id, resource_name);
            format!("资源未找到: {}/{}/{}", assistant_id, character_id, resource_name)
        })?;

    println!("[load_character_resource] Path: {:?}", path);
    println!("[load_character_resource] Path exists: {}", path.exists());

    // Read the file
    let image_data = fs::read(&path)
        .map_err(|e| {
            println!("[load_character_resource] Failed to read file: {}", e);
            format!("读取文件失败: {}", e)
        })?;

    println!("[load_character_resource] File size: {} bytes", image_data.len());

    // Detect mime type from extension
    let mime_type = if resource_name.ends_with(".png") {
        "image/png"
    } else if resource_name.ends_with(".jpg") || resource_name.ends_with(".jpeg") {
        "image/jpeg"
    } else if resource_name.ends_with(".gif") {
        "image/gif"
    } else if resource_name.ends_with(".webp") {
        "image/webp"
    } else {
        "image/png"  // Default to PNG
    };

    // Encode to base64
    let base64_data = STANDARD.encode(&image_data);

    println!("[load_character_resource] Successfully encoded, data URL length: {}", base64_data.len());

    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

/// Load multiple character resources as base64 data URLs
///
/// Batch version of load_character_resource. Returns a map of resource names to data URLs.
/// Significantly faster than loading resources one by one due to reduced IPC overhead.
#[tauri::command]
pub fn load_character_resources(
    assistant_id: String,
    character_id: String,
    resource_names: Vec<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    use std::fs;
    use std::collections::HashMap;

    // Validate inputs to prevent path traversal
    validate_path_component(&assistant_id)?;
    validate_path_component(&character_id)?;
    for resource_name in &resource_names {
        for component in resource_name.split(['/', '\\']) {
            validate_path_component(component)?;
        }
    }

    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    let mut result = HashMap::new();

    for (index, resource_name) in resource_names.iter().enumerate() {
        let path = manager.get_resource_path(&assistant_id, &character_id, &resource_name);

        // Debug logging
        // log::info!("Loading resource: {}/{} -> {:?}", assistant_id, resource_name, path);

        match path {
            Some(actual_path) => {
                // Read the file
                match fs::read(&actual_path) {
                    Ok(image_data) => {
                        // Detect mime type from extension
                        let mime_type = if resource_name.ends_with(".png") {
                            "image/png"
                        } else if resource_name.ends_with(".jpg") || resource_name.ends_with(".jpeg") {
                            "image/jpeg"
                        } else if resource_name.ends_with(".gif") {
                            "image/gif"
                        } else if resource_name.ends_with(".webp") {
                            "image/webp"
                        } else {
                            "image/png"  // Default to PNG
                        };

                        // Encode to base64
                        let base64_data = STANDARD.encode(&image_data);

                        // Return as data URL
                        result.insert(resource_name.clone(), format!("data:{};base64,{}", mime_type, base64_data));
                    }
                    Err(_) => {
                        // Silently skip unreadable files
                    }
                }
            }
            None => {
                // Silently skip missing resources
            }
        }
    }

    Ok(result)
}

/// Add character resources
///
/// Copies selected files to the character's resource directory with auto-naming.
/// Files are named sequentially: 0001.png, 0002.png, etc.
/// Returns the list of new resource names (without path prefix).
#[tauri::command]
pub fn add_character_resources(
    assistant_id: String,
    character_id: String,
    file_paths: Vec<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<Vec<String>, String> {
    use std::fs;
    use std::path::Path;

    // Validate inputs to prevent path traversal
    validate_path_component(&assistant_id)?;
    validate_path_component(&character_id)?;
    // Note: file_paths are source paths from user's file system, validated by OS/file dialog
    // The destination paths are auto-generated and safe

    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    // Build target directory: data/characters/{assistant_id}/{character_id}/
    let target_dir = manager.characters_dir()
        .join(&assistant_id)
        .join(&character_id);

    // Create target directory if it doesn't exist
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    // Get existing files to determine the starting index
    let existing_count = fs::read_dir(&target_dir)
        .map_err(|e| format!("读取目录失败: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().is_file()
                && entry.path().extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "mp4" | "webm" | "mov" | "avi"))
                    .unwrap_or(false)
        })
        .count();

    let mut new_resources = Vec::new();

    for (index, file_path) in file_paths.into_iter().enumerate() {
        let src_path = Path::new(&file_path);

        // Get file extension
        let extension = src_path.extension()
            .and_then(|ext| ext.to_str())
            .ok_or_else(|| format!("无效的文件路径: {}", file_path))?;

        // Generate auto-name: 0001.png, 0002.png, etc.
        let seq_num = existing_count + index + 1;
        let new_filename = format!("{:04}.{}", seq_num, extension);
        let dest_path = target_dir.join(&new_filename);

        // Copy file
        fs::copy(&src_path, &dest_path)
            .map_err(|e| format!("复制文件失败 {}: {}", file_path, e))?;

        new_resources.push(new_filename);
    }

    Ok(new_resources)
}

/// Update character name and description
///
/// Updates the character's name and description fields.
#[tauri::command]
pub fn update_character(
    character_id: String,
    name: String,
    description: Option<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.update_character(&character_id, name, description)
        .map_err(|e| e.to_string())
}

/// Update appearance name
///
/// Updates the appearance's name field.
#[tauri::command]
pub fn update_appearance(
    character_id: String,
    appearance_id: String,
    name: String,
    description: Option<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.update_appearance(&character_id, &appearance_id, name, description)
        .map_err(|e| e.to_string())
}

/// Add action to appearance
///
/// Adds a new action to the appearance's actions HashMap.
#[tauri::command]
pub fn add_action(
    character_id: String,
    appearance_id: String,
    action_key: String,
    resource_type: String,
    loop_value: bool,
    description: Option<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    use crate::logic::character::ResourceType;

    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    // Parse resource type
    let rtype = match resource_type.as_str() {
        "frames" => ResourceType::Frames,
        "gif" => ResourceType::Gif,
        "live2d" => ResourceType::Live2D,
        "model3d" => ResourceType::Model3D,
        _ => return Err(format!("无效的资源类型: {}", resource_type)),
    };

    let resource = crate::logic::character::AnimationResource {
        r#type: rtype,
        resources: vec![],
        fps: None,
        r#loop: Some(loop_value),
        description,
    };

    manager.add_action(&character_id, &appearance_id, action_key, resource)
        .map_err(|e| e.to_string())
}

/// Update action properties
///
/// Updates an action's key name, loop value, and description.
#[tauri::command]
pub fn update_action(
    character_id: String,
    appearance_id: String,
    old_key: String,
    new_key: String,
    loop_value: Option<bool>,
    description: Option<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.update_action(&character_id, &appearance_id, &old_key, new_key, loop_value, description)
        .map_err(|e| e.to_string())
}

/// Delete action
///
/// Removes an action from the appearance and deletes its resource directory.
#[tauri::command]
pub fn delete_action(
    character_id: String,
    appearance_id: String,
    action_key: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.delete_action(&character_id, &appearance_id, &action_key)
        .map_err(|e| e.to_string())
}

/// Update action resources
///
/// Updates the resource list for an action.
#[tauri::command]
pub fn update_action_resources(
    character_id: String,
    appearance_id: String,
    action_key: String,
    resources: Vec<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.update_action_resources(&character_id, &appearance_id, &action_key, resources)
        .map_err(|e| e.to_string())
}

/// Remove action resource
///
/// Removes a single resource file from an action's resource list.
#[tauri::command]
pub fn remove_action_resource(
    character_id: String,
    appearance_id: String,
    action_key: String,
    resource_name: String,
    manager: State<'_, CharacterManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.remove_action_resource(&character_id, &appearance_id, &action_key, &resource_name)
        .map_err(|e| e.to_string())
}

/// Add action resources
///
/// Copies selected files to the action's resource directory with auto-naming.
/// Files are named sequentially: 0001.png, 0002.png, etc.
#[tauri::command]
pub fn add_action_resources(
    character_id: String,
    action_key: String,
    file_paths: Vec<String>,
    manager: State<'_, CharacterManagerState>,
) -> Result<Vec<String>, String> {
    use std::fs;
    use std::path::Path;

    // Validate inputs to prevent path traversal
    validate_path_component(&action_key)?;
    // Note: file_paths are source paths from user's file system, validated by OS/file dialog
    // The destination paths are auto-generated and safe

    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    // Get assistant_id for the character
    let assistant_id = manager.get_character_assistant_id(&character_id)
        .ok_or_else(|| format!("角色不存在: {}", character_id))?;

    // Build target directory: data/characters/{assistant_id}/{character_id}/{action_key}/
    let target_dir = manager.characters_dir()
        .join(&assistant_id)
        .join(&character_id)
        .join(&action_key);

    // Create target directory if it doesn't exist
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    // Get existing files to determine the starting index
    let existing_count = fs::read_dir(&target_dir)
        .map_err(|e| format!("读取目录失败: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().is_file()
                && entry.path().extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "mp4" | "webm" | "mov" | "avi"))
                    .unwrap_or(false)
        })
        .count();

    let mut new_resources = Vec::new();

    for (index, file_path) in file_paths.into_iter().enumerate() {
        let src_path = Path::new(&file_path);

        // Get file extension
        let extension = src_path.extension()
            .and_then(|ext| ext.to_str())
            .ok_or_else(|| format!("无效的文件路径: {}", file_path))?;

        // Generate auto-name: 0001.png, 0002.png, etc.
        let seq_num = existing_count + index + 1;
        let new_filename = format!("{:04}.{}", seq_num, extension);
        let dest_path = target_dir.join(&new_filename);

        // Copy file
        fs::copy(&src_path, &dest_path)
            .map_err(|e| format!("复制文件失败 {}: {}", file_path, e))?;

        new_resources.push(new_filename);
    }

    Ok(new_resources)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logic::character::CharacterManager;
    use tempfile::TempDir;

    #[test]
    fn test_character_manager_integration() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterManager::new(temp_dir.path().to_path_buf());

        // Test initial state
        assert_eq!(manager.get_all_characters().len(), 0);
        assert!(manager.get_current_appearance().is_none());

        // Test add character
        let config = CharacterConfig {
            character_id: "char_001".to_string(),
            name: "测试角色".to_string(),
            description: None,
            appearances: vec![],
        };
        manager.add_character(config);
        assert_eq!(manager.get_all_characters().len(), 1);

        // Test get character
        assert!(manager.get_character("char_001").is_some());

        // Test set current appearance
        manager.set_current_appearance("appr_001".to_string());
        assert_eq!(manager.get_current_appearance(), Some(&"appr_001".to_string()));

        // Test remove character
        assert!(manager.remove_character("char_001"));
        assert_eq!(manager.get_all_characters().len(), 0);
    }

    #[test]
    fn test_is_user_defined() {
        let temp_dir = TempDir::new().unwrap();
        let manager = CharacterManager::new(temp_dir.path().to_path_buf());

        // Non-existent character should return false
        assert!(!manager.is_user_defined("non_existent"));
    }
}
