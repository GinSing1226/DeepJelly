//! Integration domain API handlers
//!
//! Handles character integrations (application integrations are managed manually by users).

use super::types::*;
use super::super::server::HttpServerState;
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;

// ============================================================================
// Types for request bodies
// ============================================================================

/// Request body for testing connection
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TestConnectionRequest {
    pub endpoint: String,
    #[serde(default)]
    pub auth_token: Option<String>,
}

/// Request body for adding character integration
#[derive(Debug, Deserialize)]
pub struct CharacterIntegrationRequest {
    pub character_id: String,
    pub integration_id: String,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub session_key: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

/// Request body for updating character integration
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct CharacterIntegrationUpdateRequest {
    #[serde(default)]
    pub character_id: Option<String>,
    #[serde(default)]
    pub session_key: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

// ============================================================================
// App Integration Handlers (Read-only)
// ============================================================================
// Note: Application integrations are managed manually by users through the UI.
// Only read operations are exposed via API.

/// GET /api/v1/integration/app - List all app integrations
pub async fn list_app_integrations(
    State(state): State<HttpServerState>,
) -> ApiResponse<Vec<crate::logic::character::app_integration::AppIntegration>> {
    let integrations = state.app_integration_manager.lock().unwrap().get_all();
    success_response(integrations)
}

/// POST /api/v1/integration/app/test - Test connection
pub async fn test_connection_handler(
    Json(_req): Json<TestConnectionRequest>,
) -> ApiResponse<bool> {
    // For now, just return true - the actual connection test would need to be implemented
    // based on the WebSocket connection testing logic
    success_response(true)
}

// ============================================================================
// Character Integration Handlers
// ============================================================================

/// GET /api/v1/integration/character - List all character integrations
pub async fn list_character_integrations(
    State(state): State<HttpServerState>,
) -> ApiResponse<Vec<crate::models::integration::CharacterIntegration>> {
    let integrations = state.character_integration_manager.lock().unwrap().get_all();
    success_response(integrations)
}

/// GET /api/v1/integration/character/:id - Get single character integration
pub async fn get_character_integration_handler(
    State(state): State<HttpServerState>,
    Path(id): Path<String>,
) -> ApiResponse<crate::models::integration::CharacterIntegration> {
    let manager = state.character_integration_manager.lock().unwrap();
    if let Some(found) = manager.get(&id) {
        success_response(found.clone())
    } else {
        drop(manager);
        let mut details = serde_json::Map::new();
        details.insert("id".to_string(), serde_json::Value::String("not_found".to_string()));
        error_response_details("NOT_FOUND", "Character integration not found", serde_json::Value::Object(details))
    }
}

/// POST /api/v1/integration/character - Add character integration
pub async fn add_character_integration_handler(
    State(state): State<HttpServerState>,
    Json(req): Json<CharacterIntegrationRequest>,
) -> ApiResponse<crate::models::integration::CharacterIntegration> {
    use crate::models::integration::{IntegrationInfo, ProviderType};
    use std::collections::HashMap;

    // Get character and assistant info
    let character_name = "Unknown Character".to_string(); // TODO: Query from character manager
    let assistant_name = "Unknown Assistant".to_string(); // TODO: Query from assistant manager

    // Get app integration info
    let app_integration = state.app_integration_manager.lock().unwrap();
    let app_integrations = app_integration.get_all();
    let app_integration = app_integrations.iter().find(|ai| ai.id == req.integration_id);

    if app_integration.is_none() {
        return error_response("NOT_FOUND", &format!("App integration {} not found", req.integration_id));
    }
    let app_integration = app_integration.unwrap();

    // Build integration info
    let mut params = HashMap::new();
    if let Some(session_key) = &req.session_key {
        params.insert("sessionKey".to_string(), serde_json::json!(session_key));
    }

    let integration_info = IntegrationInfo {
        integration_id: req.integration_id.clone(),
        provider: ProviderType::Openclaw, // TODO: Get from app_integration
        application_id: app_integration.application_id.clone(),
        agent_id: req.agent_id.unwrap_or_default(),
        params,
    };

    // Create character integration
    let character_integration = crate::models::integration::CharacterIntegration {
        id: String::new(), // Will be auto-generated
        character_id: req.character_id.clone(),
        character_name,
        assistant_id: "default".to_string(), // TODO: Get from request or character
        assistant_name,
        integration: integration_info,
        enabled: req.enabled.or(Some(true)),
        created_at: Some(chrono::Utc::now().timestamp_millis()),
    };

    // Add to manager
    let mut manager = state.character_integration_manager.lock().unwrap();
    match manager.add(character_integration) {
        Ok(()) => {
            // Get the created integration with auto-generated ID
            let integrations = manager.get_all();
            let created = integrations.last().cloned();
            match created {
                Some(integration) => success_response(integration),
                None => error_response("INTERNAL_ERROR", "Failed to retrieve created integration"),
            }
        }
        Err(e) => {
            error_response("INTERNAL_ERROR", &format!("Failed to add integration: {}", e))
        }
    }
}

/// PATCH /api/v1/integration/character/:id - Update character integration
pub async fn update_character_integration_handler(
    State(state): State<HttpServerState>,
    Path(id): Path<String>,
    Json(req): Json<CharacterIntegrationUpdateRequest>,
) -> ApiResponse<()> {
    // Check if exists
    let manager = state.character_integration_manager.lock().unwrap();
    let exists = manager.get(&id).is_some();
    drop(manager);

    if !exists {
        let mut details = serde_json::Map::new();
        details.insert("id".to_string(), serde_json::Value::String("not_found".to_string()));
        return error_response_details("NOT_FOUND", "Character integration not found", serde_json::Value::Object(details));
    }

    // Update enabled status if provided
    if let Some(enabled) = req.enabled {
        let mut manager = state.character_integration_manager.lock().unwrap();
        if let Err(e) = manager.set_enabled(&id, enabled) {
            return error_response("INTERNAL_ERROR", &format!("Failed to update integration: {}", e));
        }
    }

    // For other fields, we need more complex update logic
    // For now, just return success for enabled updates
    if req.enabled.is_some() {
        success_response(())
    } else {
        error_response("NOT_IMPLEMENTED", "Character integration field update not yet implemented")
    }
}

/// DELETE /api/v1/integration/character/:id - Delete character integration
pub async fn delete_character_integration_handler(
    State(state): State<HttpServerState>,
    Path(id): Path<String>,
) -> ApiResponse<()> {
    let mut manager = state.character_integration_manager.lock().unwrap();
    match manager.delete(&id) {
        Ok(true) => success_response(()),
        Ok(false) => {
            let mut details = serde_json::Map::new();
            details.insert("id".to_string(), serde_json::Value::String("not_found".to_string()));
            error_response_details("NOT_FOUND", "Character integration not found", serde_json::Value::Object(details))
        }
        Err(e) => error_response("INTERNAL_ERROR", &format!("Failed to delete integration: {}", e)),
    }
}
