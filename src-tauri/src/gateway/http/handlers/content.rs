//! Content domain API handlers
//!
//! Handles assistants, characters, appearances, and actions.

use super::types::*;
use super::super::server::HttpServerState;
use crate::logic::character::{
    generate_dj_id,
    Assistant,
    // API response types (simple types for HTTP API)
    Character as ApiCharacter,
    Appearance as ApiAppearance,
};
use crate::models::character::Character as ModelCharacter;
use crate::models::appearance::{Appearance as ModelAppearance, Action, ActionType};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use std::collections::HashMap;

// ============================================================================
// Types for request bodies
// ============================================================================

/// Request body for creating an assistant
#[derive(Debug, Deserialize)]
pub struct CreateAssistantRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub app_type: Option<String>,
    #[serde(default)]
    pub agent_label: Option<String>,
}

/// Request body for updating an assistant
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateAssistantRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// Request body for creating a character
#[derive(Debug, Deserialize)]
pub struct CreateCharacterRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Assistant ID this character belongs to
    pub assistant_id: String,
}

/// Request body for updating a character
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateCharacterRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// Request body for creating an appearance
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct CreateAppearanceRequest {
    pub id: String,
    pub name: String,
    /// Character ID to add appearance to
    pub character_id: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    /// Optional custom actions (if not provided, default actions will be used)
    #[serde(default)]
    pub actions: Option<HashMap<String, serde_json::Value>>,
}

/// Request body for updating an appearance
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateAppearanceRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

/// Request body for adding an action
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AddActionRequest {
    pub character_id: String,
    pub appearance_id: String,
    pub key: String,
    #[serde(rename = "type")]
    pub action_type: String,
    pub resources: Vec<String>,
    #[serde(default)]
    pub fps: Option<u32>,
    #[serde(default)]
    pub r#loop: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
}

/// Response for config paths
#[derive(Debug, serde::Serialize)]
pub struct ConfigPathsResponse {
    pub characters_dir: String,
}

// ============================================================================
// Assistant Handlers
// ============================================================================

/// GET /api/v1/content/assistant - List all assistants
pub async fn list_assistants_handler(
    State(state): State<HttpServerState>,
) -> ApiResponse<Vec<Assistant>> {
    let assistants = state.assistant_manager.lock().unwrap().get_all();
    success_response(assistants)
}

/// GET /api/v1/content/assistant/:id - Get single assistant
pub async fn get_assistant_handler(
    State(state): State<HttpServerState>,
    Path(id): Path<String>,
) -> ApiResponse<Assistant> {
    let manager = state.assistant_manager.lock().unwrap();
    match manager.get(&id) {
        Some(assistant) => success_response(assistant.clone()),
        None => {
            drop(manager);
            let mut details = serde_json::Map::new();
            details.insert("id".to_string(), serde_json::Value::String("not_found".to_string()));
            error_response_details("NOT_FOUND", "Assistant not found", serde_json::Value::Object(details))
        }
    }
}

/// POST /api/v1/content/assistant - Create assistant
pub async fn create_assistant_handler(
    State(state): State<HttpServerState>,
    Json(req): Json<CreateAssistantRequest>,
) -> ApiResponse<Assistant> {
    let id = generate_dj_id();
    let assistant = Assistant {
        id: id.clone(),
        name: req.name.clone(),
        description: req.description,
        created_at: None,
        characters: vec![],
        app_type: req.app_type,
        agent_label: req.agent_label,
        bound_agent_id: None,
        session_key: None,
        integrations: None,
    };

    // Add assistant using AssistantManager
    let mut manager = state.assistant_manager.lock().unwrap();
    match manager.add(assistant.clone()) {
        Ok(()) => {
            // Save to file
            if let Err(e) = manager.save() {
                return error_response("INTERNAL_ERROR", &format!("Failed to save assistant: {}", e));
            }
            success_response(assistant)
        }
        Err(e) => error_response("INTERNAL_ERROR", &format!("Failed to create assistant: {}", e))
    }
}

/// PATCH /api/v1/content/assistant/:id - Update assistant
pub async fn update_assistant_handler(
    State(_state): State<HttpServerState>,
    Path(_id): Path<String>,
    Json(_req): Json<UpdateAssistantRequest>,
) -> ApiResponse<()> {
    // Note: We need mutable access to call update()
    // For now, return not implemented
    error_response("NOT_IMPLEMENTED", "Assistant update via HTTP API not yet implemented")
}

/// DELETE /api/v1/content/assistant/:id - Delete assistant
pub async fn delete_assistant_handler(
    State(_state): State<HttpServerState>,
    Path(_id): Path<String>,
) -> ApiResponse<()> {
    // Note: We need mutable access to call delete()
    // For now, return not implemented
    error_response("NOT_IMPLEMENTED", "Assistant deletion via HTTP API not yet implemented")
}

// ============================================================================
// Character Handlers
// ============================================================================

/// GET /api/v1/content/character - List characters
pub async fn list_characters_handler(
    State(state): State<HttpServerState>,
) -> ApiResponse<Vec<ApiCharacter>> {
    // Get all characters from character manager and convert to API type
    let manager = state.character_manager.lock().unwrap();
    let configs = manager.get_all_characters();
    let characters: Vec<ApiCharacter> = configs.into_iter().map(|config| {
        ApiCharacter {
            id: config.character_id.clone(),
            name: config.name.clone(),
            description: config.description.clone(),
            assistant_id: config.assistant_id.clone().unwrap_or_default(),
        }
    }).collect();
    success_response(characters)
}

/// GET /api/v1/content/character/:id - Get single character
pub async fn get_character_handler(
    State(state): State<HttpServerState>,
    Path(id): Path<String>,
) -> ApiResponse<ApiCharacter> {
    let manager = state.character_manager.lock().unwrap();
    match manager.get_character(&id) {
        Some(config) => {
            let character = ApiCharacter {
                id: config.character_id.clone(),
                name: config.name.clone(),
                description: config.description.clone(),
                assistant_id: config.assistant_id.clone().unwrap_or_default(),
            };
            success_response(character)
        }
        None => {
            drop(manager);
            let mut details = serde_json::Map::new();
            details.insert("id".to_string(), serde_json::Value::String("not_found".to_string()));
            error_response_details("NOT_FOUND", "Character not found", serde_json::Value::Object(details))
        }
    }
}

/// POST /api/v1/content/character - Create character
pub async fn create_character_handler(
    State(state): State<HttpServerState>,
    Json(req): Json<CreateCharacterRequest>,
) -> ApiResponse<ApiCharacter> {
    use std::fs;

    // Create character through AssistantManager
    let mut manager = state.assistant_manager.lock().unwrap();

    // Add character to assistant (using ModelCharacter)
    let character = ModelCharacter::new(
        req.id.clone(),
        req.assistant_id.clone(),
        req.name.clone(),
    );
    // Set description if provided
    let mut character = character;
    character.description = req.description.clone();

    match manager.add_character(&req.assistant_id, character) {
        Ok(()) => {
            // Create character directory structure
            let characters_dir = state.user_data_dir.join("characters");
            let character_dir = characters_dir
                .join(&req.assistant_id)
                .join(&req.id);

            if let Err(e) = fs::create_dir_all(&character_dir) {
                return error_response("INTERNAL_ERROR", &format!("Failed to create character directory: {}", e));
            }

            // Save the updated assistant data
            if let Err(e) = manager.save() {
                return error_response("INTERNAL_ERROR", &format!("Failed to save assistant: {}", e));
            }

            // Return the created character with assistant_id
            let response_char = ApiCharacter {
                id: req.id.clone(),
                name: req.name,
                description: req.description,
                assistant_id: req.assistant_id,
            };
            success_response(response_char)
        }
        Err(e) => error_response("INTERNAL_ERROR", &format!("Failed to create character: {}", e))
    }
}

/// PATCH /api/v1/content/character/:id - Update character
pub async fn update_character_handler(
    State(_state): State<HttpServerState>,
    Path(_id): Path<String>,
    Json(_req): Json<UpdateCharacterRequest>,
) -> ApiResponse<()> {
    error_response("NOT_IMPLEMENTED", "Character update not yet implemented")
}

/// DELETE /api/v1/content/character/:id - Delete character
pub async fn delete_character_handler(
    State(_state): State<HttpServerState>,
    Path(_id): Path<String>,
) -> ApiResponse<()> {
    error_response("NOT_IMPLEMENTED", "Character deletion not yet implemented")
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get default action tree for new appearances
///
/// Returns the standard action keys that all appearances should have:
/// - internal-physics-drag: Physics drag animation
/// - internal-work-speak: Speaking animation
/// - internal-base-idle: Base idle animation
/// - internal-work-execute: Work execution animation
fn get_default_actions() -> HashMap<String, Action> {
    let default_action = Action {
        action_type: ActionType::Frames,
        resources: vec![],
        fps: Some(24),
        r#loop: true,
        spritesheet: None,
        description: None,
    };

    let mut actions = HashMap::new();
    actions.insert("internal-physics-drag".to_string(), default_action.clone());
    actions.insert("internal-work-speak".to_string(), default_action.clone());
    actions.insert("internal-base-idle".to_string(), default_action.clone());
    actions.insert("internal-work-execute".to_string(), default_action);

    actions
}

// ============================================================================
// Appearance Handlers
// ============================================================================

/// GET /api/v1/content/appearance - List appearances
pub async fn list_appearances_handler(
    State(state): State<HttpServerState>,
) -> ApiResponse<Vec<ApiAppearance>> {
    // Get all characters and collect their appearances
    let manager = state.character_manager.lock().unwrap();
    let configs = manager.get_all_characters();
    let mut appearances = vec![];
    for character_config in configs {
        for appearance_config in &character_config.appearances {
            appearances.push(ApiAppearance {
                id: appearance_config.id.clone(),
                name: appearance_config.name.clone(),
                character_id: character_config.character_id.clone(),
                is_default: appearance_config.is_default,
            });
        }
    }
    success_response(appearances)
}

/// POST /api/v1/content/appearance - Create appearance
pub async fn create_appearance_handler(
    State(state): State<HttpServerState>,
    Json(req): Json<CreateAppearanceRequest>,
) -> ApiResponse<ApiAppearance> {
    use std::fs;

    let mut manager = state.assistant_manager.lock().unwrap();

    // Check if it's the first appearance (for default flag)
    let is_first = manager.get_character(&req.character_id)
        .map(|c| c.appearances.is_empty())
        .unwrap_or(false);
    let is_default = req.is_default.unwrap_or(is_first);

    // Create appearance with default action tree
    let mut appearance = ModelAppearance::new(req.id.clone(), req.name.clone(), is_default);
    appearance.description = req.description;
    // Initialize with default action tree (same as frontend)
    appearance.actions = get_default_actions();

    // Add appearance to character
    match manager.add_appearance(&req.character_id, appearance) {
        Ok(()) => {
            // Find the assistant that owns this character
            let assistant_id = match manager.find_assistant_by_character(&req.character_id) {
                Some(id) => id,
                None => {
                    return error_response("NOT_FOUND", "Character not found or has no assistant");
                }
            };

            // Create the appearance directory structure
            let characters_dir = state.user_data_dir.join("characters");
            let appearance_dir = characters_dir
                .join(&assistant_id)
                .join(&req.character_id)
                .join(&req.id);

            if let Err(e) = fs::create_dir_all(&appearance_dir) {
                return error_response("INTERNAL_ERROR", &format!("Failed to create appearance directory: {}", e));
            }

            // Save the updated data
            if let Err(e) = manager.save() {
                return error_response("INTERNAL_ERROR", &format!("Failed to save: {}", e));
            }

            // Return the created appearance (API response type)
            let response_appearance = ApiAppearance {
                id: req.id,
                name: req.name,
                character_id: req.character_id,
                is_default,
            };
            success_response(response_appearance)
        }
        Err(e) => error_response("INTERNAL_ERROR", &format!("Failed to create appearance: {}", e))
    }
}

/// PATCH /api/v1/content/appearance/:id - Update appearance
pub async fn update_appearance_handler(
    State(_state): State<HttpServerState>,
    Path(_id): Path<String>,
    Json(_req): Json<UpdateAppearanceRequest>,
) -> ApiResponse<()> {
    error_response("NOT_IMPLEMENTED", "Appearance update not yet implemented")
}

/// DELETE /api/v1/content/appearance/:id - Delete appearance
pub async fn delete_appearance_handler(
    State(_state): State<HttpServerState>,
    Path(_id): Path<String>,
) -> ApiResponse<()> {
    error_response("NOT_IMPLEMENTED", "Appearance deletion not yet implemented")
}

// ============================================================================
// Action Handlers
// ============================================================================

/// POST /api/v1/content/action - Add action resources
pub async fn add_action_handler(
    State(state): State<HttpServerState>,
    Json(req): Json<AddActionRequest>,
) -> ApiResponse<Vec<String>> {
    use std::fs;
    use std::path::Path;

    let manager = state.assistant_manager.lock().unwrap();

    // Get necessary data with lock held
    let (data_dir, existing_resources, assistant_id) = {
        // Find the assistant that owns this character
        let assistant_id = match manager.find_assistant_by_character(&req.character_id) {
            Some(id) => id,
            None => {
                drop(manager);
                let mut details = serde_json::Map::new();
                details.insert("character_id".to_string(), serde_json::Value::String("not_found".to_string()));
                return error_response_details("NOT_FOUND", "Character not found", serde_json::Value::Object(details));
            }
        };

        let character = match manager.get_character(&req.character_id) {
            Some(c) => c,
            None => {
                drop(manager);
                let mut details = serde_json::Map::new();
                details.insert("character_id".to_string(), serde_json::Value::String("not_found".to_string()));
                return error_response_details("NOT_FOUND", "Character not found", serde_json::Value::Object(details));
            }
        };

        // Find the specific appearance
        let appearance = match character.appearances.iter().find(|a| a.id == req.appearance_id) {
            Some(a) => a,
            None => {
                drop(manager);
                let mut details = serde_json::Map::new();
                details.insert("appearance_id".to_string(), serde_json::Value::String("not_found".to_string()));
                return error_response_details("NOT_FOUND", "Appearance not found", serde_json::Value::Object(details));
            }
        };

        // Get current resources for this action
        let current_resources = appearance.actions.get(&req.key)
            .map(|a| a.resources.clone())
            .unwrap_or_default();

        (manager.data_dir().to_path_buf(), current_resources, assistant_id)
    };

    // Build target directory
    let characters_dir = data_dir.join("characters");
    let target_dir = characters_dir
        .join(&assistant_id)
        .join(&req.character_id)
        .join(&req.appearance_id)
        .join(&req.key);

    // Create target directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(&target_dir) {
        return error_response("INTERNAL_ERROR", &format!("Failed to create directory: {}", e));
    }

    // Get existing files to determine the starting index
    let existing_count = match fs::read_dir(&target_dir) {
        Ok(entries) => entries
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry.path().is_file()
                    && entry.path().extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"))
                        .unwrap_or(false)
            })
            .count(),
        Err(_) => 0,
    };

    let mut new_resources = Vec::new();

    for (index, resource_path) in req.resources.iter().enumerate() {
        let src_path = Path::new(resource_path);

        // Get file extension
        let extension = src_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("png");

        // Generate new filename: 0001.png, 0002.png, etc.
        let new_filename = format!("{:04}.{}", existing_count + index + 1, extension);
        let dest_path = target_dir.join(&new_filename);

        // Copy file
        match fs::copy(&src_path, &dest_path) {
            Ok(_) => new_resources.push(new_filename),
            Err(e) => {
                return error_response("INTERNAL_ERROR", &format!("Failed to copy file {}: {}", resource_path, e));
            }
        }
    }

    // Update the resource list in config
    let mut manager = state.assistant_manager.lock().unwrap();
    let mut updated_resources = existing_resources;
    updated_resources.extend(new_resources.clone());

    match manager.update_action_resources(&req.character_id, &req.appearance_id, &req.key, updated_resources) {
        Ok(()) => success_response(new_resources),
        Err(e) => error_response("INTERNAL_ERROR", &format!("Failed to update action resources: {}", e))
    }
}

/// POST /api/v1/content/action/upload - Upload action files
pub async fn upload_action_files_handler() -> ApiResponse<()> {
    error_response("NOT_IMPLEMENTED", "File upload not yet implemented")
}

// ============================================================================
// Config Handlers
// ============================================================================

/// GET /api/v1/content/config/paths - Get path configuration
pub async fn get_config_paths_handler(
    State(state): State<HttpServerState>,
) -> ApiResponse<ConfigPathsResponse> {
    let characters_dir = state.user_data_dir.join("characters");

    let response = ConfigPathsResponse {
        characters_dir: characters_dir.to_string_lossy().to_string(),
    };

    success_response(response)
}
