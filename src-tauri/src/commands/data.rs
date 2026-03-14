//! Data layer commands for the new three-layer architecture
//!
//! Commands for managing Assistant -> Character -> Appearance -> Action
//! These commands delegate to the logic layer (AssistantManager).

use crate::logic::character::AssistantManager;
use crate::models::{Character, Appearance, Action, ActionType, SpriteSheetConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;

/// Assistant manager state type
/// Use Arc<Mutex<>> to allow cloning State for use in spawn_blocking
pub type AssistantManagerState = Arc<Mutex<AssistantManager>>;

// ============ DTOs ============

/// DTO for creating a character
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCharacterDTO {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// DTO for updating a character
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCharacterDTO {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Action DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionDTO {
    #[serde(rename = "type")]
    pub action_type: ActionType,
    pub resources: Vec<String>,
    pub fps: Option<u32>,
    pub r#loop: bool,
    pub description: Option<String>,
    /// Spritesheet configuration (only for spritesheet type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spritesheet: Option<SpriteSheetConfig>,
}

/// DTO for creating an appearance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAppearanceDTO {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub actions: Option<HashMap<String, ActionDTO>>,
}

/// DTO for updating an appearance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAppearanceDTO {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_default: Option<bool>,
}

// ============ Character Commands ============

/// Get all characters across all assistants (NEW DATA MODEL)
#[tauri::command]
pub async fn data_get_all_characters(
    manager: State<'_, AssistantManagerState>,
) -> Result<Vec<Character>, String> {
    println!("[data_get_all_characters] START");
    // Use spawn_blocking to avoid blocking the main thread with file I/O
    // This is critical when running as a packaged exe where file operations are slower
    // Clone the Arc<Mutex<>> to get a value that can be moved into spawn_blocking
    let manager_arc = Arc::clone(&*manager);
    println!("[data_get_all_characters] Entering spawn_blocking...");
    let result = tokio::task::spawn_blocking(move || {
        println!("[data_get_all_characters] spawn_blocking: Acquiring lock...");
        let manager = manager_arc.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
        println!("[data_get_all_characters] spawn_blocking: Lock acquired, calling get_all_characters...");
        let characters = manager.get_all_characters();
        println!("[data_get_all_characters] spawn_blocking: Got {} characters", characters.len());
        Ok::<Vec<Character>, String>(characters)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;
    println!("[data_get_all_characters] END: returning {} characters", result.len());
    Ok(result)
}

/// Get characters by assistant ID (NEW DATA MODEL)
#[tauri::command]
pub async fn data_get_characters_by_assistant(
    assistant_id: String,
    manager: State<'_, AssistantManagerState>,
) -> Result<Vec<Character>, String> {
    // Use spawn_blocking to avoid blocking the main thread with file I/O
    let manager_arc = Arc::clone(&*manager);
    tokio::task::spawn_blocking(move || {
        let manager = manager_arc.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
        Ok(manager.get_characters_by_assistant(&assistant_id))
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

/// Add a character to an assistant (NEW DATA MODEL)
#[tauri::command]
pub async fn data_add_character(
    assistant_id: String,
    dto: CreateCharacterDTO,
    manager: State<'_, AssistantManagerState>,
) -> Result<Character, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;

    let character = Character {
        id: dto.id.clone(),
        assistant_id: Some(assistant_id.clone()),
        name: dto.name,
        description: dto.description,
        appearances: vec![],
        default_appearance_id: None,
    };

    manager.add_character(&assistant_id, character)?;

    // Return the created character
    Ok(manager.get_characters_by_assistant(&assistant_id)
        .into_iter()
        .find(|c| c.id == dto.id)
        .unwrap())
}

/// Update a character (NEW DATA MODEL)
#[tauri::command]
pub async fn data_update_character(
    character_id: String,
    dto: UpdateCharacterDTO,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_character(&character_id, dto.name, dto.description)
        .map_err(|e| format!("更新角色失败: {}", e))
}

/// Delete a character (NEW DATA MODEL)
#[tauri::command]
pub async fn data_delete_character(
    character_id: String,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.delete_character(&character_id)
        .map_err(|e| format!("删除角色失败: {}", e))?;
    Ok(())
}

// ============ Appearance Commands ============

/// Add an appearance to a character (NEW DATA MODEL)
#[tauri::command]
pub async fn data_add_appearance(
    character_id: String,
    dto: CreateAppearanceDTO,
    manager: State<'_, AssistantManagerState>,
) -> Result<Appearance, String> {
    println!("[data_add_appearance] START: character_id={}, dto.name={}", character_id, dto.name);
    use std::fs;

    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    println!("[data_add_appearance] Acquired lock");

    // Get the character to check if it's the first appearance
    let is_first = manager.get_character(&character_id)
        .map(|c| c.appearances.is_empty())
        .unwrap_or(false);
    println!("[data_add_appearance] is_first={}", is_first);

    let is_default = dto.is_default.unwrap_or(is_first);

    // Use provided id or generate random id
    let appearance_id = match dto.id {
        Some(id) if !id.is_empty() => id,
        _ => {
            // Generate 16 character random ID
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
    };

    let appearance = Appearance {
        id: appearance_id.clone(),
        name: dto.name,
        is_default,
        description: dto.description,
        actions: dto.actions.unwrap_or_default().into_iter()
            .map(|(k, v)| (k, Action {
                action_type: v.action_type,
                resources: v.resources,
                fps: v.fps,
                r#loop: v.r#loop,
                spritesheet: v.spritesheet,  // Use spritesheet from DTO
                description: v.description,
            }))
            .collect(),
    };

    println!("[data_add_appearance] Calling add_appearance...");
    manager.add_appearance(&character_id, appearance)
        .map_err(|e| format!("添加形象失败: {}", e))?;
    println!("[data_add_appearance] add_appearance completed");

    // Get the assistant_id for this character
    let assistant_id = manager.find_assistant_by_character(&character_id)
        .ok_or_else(|| format!("找不到角色所属的助手: {}", character_id))?;

    // Create the appearance directory structure
    // characters/{assistant_id}/{character_id}/{appearance_id}/
    let data_dir = manager.data_dir();
    // Note: data_dir is already the user data directory (e.g., data/user/), so characters should be at data_dir/characters
    let characters_dir = data_dir.join("characters");
    let appearance_dir = characters_dir
        .join(&assistant_id)
        .join(&character_id)
        .join(&appearance_id);

    println!("[data_add_appearance] Creating directory: {:?}", appearance_dir);
    fs::create_dir_all(&appearance_dir)
        .map_err(|e| format!("创建形象目录失败: {}", e))?;

    // Return the created appearance
    let character = manager.get_character(&character_id).unwrap();
    let result = character.appearances.iter().find(|a| a.id == appearance_id).unwrap().clone();
    println!("[data_add_appearance] END: success, appearance_id={}", appearance_id);
    Ok(result)
}

/// Update an appearance (NEW DATA MODEL)
#[tauri::command]
pub async fn data_update_appearance(
    character_id: String,
    appearance_id: String,
    dto: UpdateAppearanceDTO,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    println!("[data_update_appearance] START: character_id={}, appearance_id={}", character_id, appearance_id);
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_appearance(&character_id, &appearance_id, dto.name, dto.description, dto.is_default)
        .map_err(|e| format!("更新形象失败: {}", e))?;
    println!("[data_update_appearance] END: success");
    Ok(())
}

/// Delete an appearance (NEW DATA MODEL)
#[tauri::command]
pub async fn data_delete_appearance(
    character_id: String,
    appearance_id: String,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.delete_appearance(&character_id, &appearance_id)
        .map_err(|e| format!("删除形象失败: {}", e))?;
    Ok(())
}

// ============ Action Resource Commands ============

/// Add action resources (NEW DATA MODEL)
///
/// Copies selected files to the action's resource directory and updates assistants.json
#[tauri::command]
pub async fn data_add_action_resources(
    character_id: String,
    appearance_id: String,
    action_key: String,
    file_paths: Vec<String>,
    manager: State<'_, AssistantManagerState>,
) -> Result<Vec<String>, String> {
    use std::fs;
    use std::path::Path;

    // Get necessary data with lock held
    let (data_dir, existing_resources, assistant_id) = {
        let manager_guard = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;

        // Find the assistant that owns this character
        let assistant_id = manager_guard.find_assistant_by_character(&character_id)
            .ok_or_else(|| format!("找不到角色 {} 所属的助手", character_id))?;

        let character = manager_guard.get_character(&character_id)
            .ok_or_else(|| format!("角色 {} 不存在", character_id))?;

        // Find the specific appearance
        let appearance = character.appearances.iter()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| format!("形象 {} 不存在", appearance_id))?;

        // Get current resources for this action
        let current_resources = appearance.actions.get(&action_key)
            .map(|a| a.resources.clone())
            .unwrap_or_default();

        (manager_guard.data_dir().to_path_buf(), current_resources, assistant_id)
    };

    // Build target directory: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/
    // Note: data_dir is already the user data directory (e.g., data/user/), so characters should be at data_dir/characters
    let characters_dir = data_dir.join("characters");
    let target_dir = characters_dir
        .join(&assistant_id)
        .join(&character_id)
        .join(&appearance_id)
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
                    .map(|ext| matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"))
                    .unwrap_or(false)
        })
        .count();

    let mut new_resources = Vec::new();

    for (index, file_path) in file_paths.into_iter().enumerate() {
        let src_path = Path::new(&file_path);

        // Get file extension
        let extension = src_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("png");

        // Generate new filename: 0001.png, 0002.png, etc.
        let new_filename = format!("{:04}.{}", existing_count + index + 1, extension);
        let dest_path = target_dir.join(&new_filename);

        // Copy file
        fs::copy(&src_path, &dest_path)
            .map_err(|e| format!("复制文件失败 {}: {}", file_path, e))?;

        new_resources.push(new_filename);
    }

    // Update the resource list in config.json
    let mut updated_resources = existing_resources;
    updated_resources.extend(new_resources.clone());

    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_action_resources(&character_id, &appearance_id, &action_key, updated_resources)
        .map_err(|e| format!("更新动作资源失败: {}", e))?;

    Ok(new_resources)
}

/// Remove action resource (NEW DATA MODEL)
///
/// Removes a single resource file from an action's resource list and deletes the file
#[tauri::command]
pub async fn data_remove_action_resource(
    character_id: String,
    appearance_id: String,
    action_key: String,
    resource_name: String,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    use std::fs;

    // Get necessary data with lock held
    let (data_dir, updated_resources, assistant_id) = {
        let manager_guard = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;

        // Find the assistant that owns this character
        let assistant_id = manager_guard.find_assistant_by_character(&character_id)
            .ok_or_else(|| format!("找不到角色 {} 所属的助手", character_id))?;

        let character = manager_guard.get_character(&character_id)
            .ok_or_else(|| format!("角色 {} 不存在", character_id))?;

        let data_dir = manager_guard.data_dir().to_path_buf();

        // Find the specific appearance
        let appearance = character.appearances.iter()
            .find(|a| a.id == appearance_id)
            .ok_or_else(|| format!("形象 {} 不存在", appearance_id))?;

        // Get updated resources list (remove the specified resource)
        let updated_resources = appearance.actions.get(&action_key)
            .map(|action| action.resources.iter()
                .filter(|r| *r != &resource_name)
                .cloned()
                .collect())
            .unwrap_or_default();

        (data_dir, updated_resources, assistant_id)
    };

    // Build resource file path: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/{resource_name}
    // Note: data_dir is already the user data directory (e.g., data/user/), so characters should be at data_dir/characters
    let characters_dir = data_dir.join("characters");
    let resource_path = characters_dir
        .join(&assistant_id)
        .join(&character_id)
        .join(&appearance_id)
        .join(&action_key)
        .join(&resource_name);

    // Delete the file
    if resource_path.exists() {
        fs::remove_file(&resource_path)
            .map_err(|e| format!("删除文件失败 {}: {}", resource_path.display(), e))?;
    }

    // Update the resource list in config.json
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_action_resources(&character_id, &appearance_id, &action_key, updated_resources)
        .map_err(|e| format!("更新动作资源失败: {}", e))?;

    Ok(())
}

/// Update action resources (NEW DATA MODEL)
///
/// Updates the resource list for an action
#[tauri::command]
pub async fn data_update_action_resources(
    character_id: String,
    appearance_id: String,
    action_key: String,
    resources: Vec<String>,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_action_resources(&character_id, &appearance_id, &action_key, resources)
        .map_err(|e| format!("更新动作资源失败: {}", e))
}

/// Update action properties (NEW DATA MODEL)
///
/// Updates an action's fps, loop value, and description
#[tauri::command]
pub async fn data_update_action(
    character_id: String,
    appearance_id: String,
    old_key: String,
    new_key: String,
    fps: Option<Option<u32>>,
    loop_value: Option<bool>,
    description: Option<String>,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_action(&character_id, &appearance_id, &old_key, new_key, fps, loop_value, description)
        .map_err(|e| format!("更新动作失败: {}", e))
}

/// Update action with type and spritesheet support (NEW DATA MODEL)
///
/// Updates an action's type, fps, loop value, spritesheet config, and description
#[tauri::command]
pub async fn data_update_action_with_spritesheet(
    character_id: String,
    appearance_id: String,
    old_key: String,
    new_key: String,
    // Use r#type to accept "type" as JSON field name
    r#type: String,
    fps: Option<Option<u32>>,
    loop_value: bool,
    spritesheet: Option<SpriteSheetConfig>,
    description: Option<String>,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    // Parse action_type string to ActionType enum
    let parsed_type = match r#type.as_str() {
        "frames" => ActionType::Frames,
        "gif" => ActionType::Gif,
        "live2d" => ActionType::Live2d,
        "3d" => ActionType::Model3D,
        "digital_human" => ActionType::DigitalHuman,
        "spritesheet" => ActionType::Spritesheet,
        _ => return Err(format!("Invalid action type: {}", r#type)),
    };

    let mut manager = manager.lock().map_err(|e| format!("获取管理器失败: {}", e))?;
    manager.update_action_with_type(
        &character_id,
        &appearance_id,
        &old_key,
        new_key,
        parsed_type,
        fps,
        loop_value,
        spritesheet,
        description,
    ).map_err(|e| format!("更新动作失败: {}", e))
}

// Note: Tests are now in the logic layer (assistant.rs)
// We keep the file for backward compatibility with the command names
