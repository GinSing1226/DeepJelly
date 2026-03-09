//! Tauri commands for app integration management

use crate::logic::character::app_integration::{AppIntegration, AppIntegrationManager};
use std::sync::Mutex;
use tauri::State;

/// App Integration Manager State
pub type AppIntegrationManagerState = Mutex<AppIntegrationManager>;

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
#[tauri::command]
pub async fn delete_app_integration(
    state: State<'_, AppIntegrationManagerState>,
    id: String,
) -> Result<bool, String> {
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
