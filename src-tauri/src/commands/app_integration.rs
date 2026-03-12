//! Tauri commands for app integration management

use crate::logic::character::app_integration::{AppIntegration, AppIntegrationManager};
use crate::logic::character::CharacterIntegrationManager;
use crate::models::integration::CharacterIntegration;
use std::sync::Mutex;
use tauri::State;

/// App Integration Manager State
pub type AppIntegrationManagerState = Mutex<AppIntegrationManager>;

/// Character Integration Manager State
pub type CharacterIntegrationManagerState = Mutex<CharacterIntegrationManager>;

// ========== App Integration Commands ==========

/// Get all app integrations
#[tauri::command]
pub async fn get_app_integrations(
    state: State<'_, AppIntegrationManagerState>,
) -> Result<Vec<AppIntegration>, String> {
    let app_manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(app_manager.get_all())
}

/// Add a new app integration
#[tauri::command]
pub async fn add_app_integration(
    state: State<'_, AppIntegrationManagerState>,
    mut integration: AppIntegration,
) -> Result<AppIntegration, String> {
    let mut app_manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    // Auto-generate IDs if not provided
    if integration.id.is_empty() {
        use crate::logic::character::generate_dj_id;
        integration.id = generate_dj_id();
    }
    if integration.application_id.is_empty() {
        use crate::logic::character::generate_application_id;
        integration.application_id = generate_application_id();
    }

    app_manager.add(integration.clone())
        .map_err(|e| e.to_string())?;

    Ok(integration)
}

/// Update an existing app integration
#[tauri::command]
pub async fn update_app_integration(
    state: State<'_, AppIntegrationManagerState>,
    id: String,
    updates: AppIntegration,
) -> Result<(), String> {
    let mut app_manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    app_manager.update(&id, updates)
        .map_err(|e| e.to_string())
}

/// Delete an app integration
///
/// Also deletes all character integrations that reference this app integration.
#[tauri::command]
pub async fn delete_app_integration(
    state: State<'_, AppIntegrationManagerState>,
    char_integration_state: State<'_, CharacterIntegrationManagerState>,
    id: String,
) -> Result<bool, String> {
    // First, delete all character integrations that reference this app integration
    {
        let mut char_manager = char_integration_state.lock()
            .map_err(|e| format!("Failed to acquire character integration lock: {}", e))?;
        let removed = char_manager.delete_by_app_integration(&id)
            .map_err(|e| format!("Failed to delete character integrations: {}", e))?;
        if removed > 0 {
            println!("[delete_app_integration] Deleted {} character integration(s) for app {}", removed, id);
        }
    }

    // Then delete the app integration itself
    let mut app_manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    app_manager.delete(&id)
        .map_err(|e| e.to_string())
}

/// Get app integration by ID
#[tauri::command]
pub async fn get_app_integration(
    state: State<'_, AppIntegrationManagerState>,
    id: String,
) -> Result<Option<AppIntegration>, String> {
    let app_manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(app_manager.get(&id).cloned())
}

/// Test app connection (simple WebSocket connection test)
#[tauri::command]
pub async fn test_app_connection(
    endpoint: String,
    auth_token: Option<String>,
) -> Result<bool, String> {
    // For now, return a simple validation result
    // In production, this would attempt an actual WebSocket connection
    if endpoint.is_empty() {
        return Err("Endpoint cannot be empty".to_string());
    }

    // Basic URL validation
    if !endpoint.starts_with("ws://") && !endpoint.starts_with("wss://") {
        return Err("Endpoint must be a valid WebSocket URL (ws:// or wss://)".to_string());
    }

    // TODO: Implement actual WebSocket connection test
    // For now, just validate the format
    Ok(true)
}

// ========== Character Integration Commands ==========

/// Get all character integrations
#[tauri::command]
pub async fn get_character_integrations(
    state: State<'_, CharacterIntegrationManagerState>,
) -> Result<Vec<CharacterIntegration>, String> {
    let manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.get_all())
}

/// Add a new character integration
#[tauri::command]
pub async fn add_character_integration(
    state: State<'_, CharacterIntegrationManagerState>,
    mut binding: CharacterIntegration,
) -> Result<CharacterIntegration, String> {
    println!("[add_character_integration] 📥 Received character integration request");
    println!("[add_character_integration] characterId: {}", binding.character_id);
    println!("[add_character_integration] characterName: {}", binding.character_name);
    println!("[add_character_integration] assistantId: {}", binding.assistant_id);
    println!("[add_character_integration] assistantName: {}", binding.assistant_name);
    println!("[add_character_integration] integration.integrationId: {}", binding.integration.integration_id);
    println!("[add_character_integration] integration.provider: {:?}", binding.integration.provider);
    println!("[add_character_integration] integration.applicationId: {}", binding.integration.application_id);
    println!("[add_character_integration] integration.agentId: {}", binding.integration.agent_id);
    println!("[add_character_integration] enabled: {:?}", binding.enabled);

    let mut manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    // Auto-generate ID if not provided
    if binding.id.is_empty() {
        use crate::logic::character::generate_dj_id;
        binding.id = generate_dj_id();
        println!("[add_character_integration] Generated new ID: {}", binding.id);
    }

    println!("[add_character_integration] 📤 Adding binding to manager...");
    manager.add(binding.clone())
        .map_err(|e| {
            println!("[add_character_integration] ❌ Failed to add binding: {}", e);
            e.to_string()
        })?;

    println!("[add_character_integration] ✅ Character integration saved successfully");
    Ok(binding)
}

/// Update an existing character integration
#[tauri::command]
pub async fn update_character_integration(
    state: State<'_, CharacterIntegrationManagerState>,
    id: String,
    updates: CharacterIntegration,
) -> Result<(), String> {
    let mut manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    manager.update(&id, updates)
        .map_err(|e| e.to_string())
}

/// Delete a character integration
#[tauri::command]
pub async fn delete_character_integration(
    state: State<'_, CharacterIntegrationManagerState>,
    id: String,
) -> Result<bool, String> {
    let mut manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    manager.delete(&id)
        .map_err(|e| e.to_string())
}

/// Get character integrations by assistant ID
#[tauri::command]
pub async fn get_character_integrations_by_assistant(
    state: State<'_, CharacterIntegrationManagerState>,
    assistant_id: String,
) -> Result<Vec<CharacterIntegration>, String> {
    let manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.get_by_assistant(&assistant_id))
}

/// Set character integration enabled status
#[tauri::command]
pub async fn set_character_integration_enabled(
    state: State<'_, CharacterIntegrationManagerState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    manager.set_enabled(&id, enabled)
        .map_err(|e| e.to_string())
}
