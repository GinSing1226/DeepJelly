//! HTTP API Router
//!
//! Defines all API routes and their handlers.

use super::handlers::{integration, content};
use super::server::HttpServerState;
use axum::{
    routing::{get, post, patch, delete},
    Router,
};

/// Create the complete HTTP API router
pub fn create_api_router() -> Router<HttpServerState> {
    // Integration domain routes
    // Note: Application integrations (add/update/delete) are managed manually by users through UI
    let integration_routes = Router::new()
        // App integrations (read-only + test)
        .route("/app", get(integration::list_app_integrations))
        .route("/app/test", post(integration::test_connection_handler))
        .route("/check", post(integration::test_connection_handler)) // Alias for test
        // Character integrations (full CRUD)
        .route("/character", get(integration::list_character_integrations))
        .route("/character", post(integration::add_character_integration_handler))
        .route("/character/:id", get(integration::get_character_integration_handler))
        .route("/character/:id", patch(integration::update_character_integration_handler))
        .route("/character/:id", delete(integration::delete_character_integration_handler));

    // Content domain routes
    let content_routes = Router::new()
        // Assistants
        .route("/assistant", get(content::list_assistants_handler))
        .route("/assistant", post(content::create_assistant_handler))
        .route("/assistant/:id", get(content::get_assistant_handler))
        .route("/assistant/:id", patch(content::update_assistant_handler))
        .route("/assistant/:id", delete(content::delete_assistant_handler))
        // Characters
        .route("/character", get(content::list_characters_handler))
        .route("/character", post(content::create_character_handler))
        .route("/character/:id", get(content::get_character_handler))
        .route("/character/:id", patch(content::update_character_handler))
        .route("/character/:id", delete(content::delete_character_handler))
        // Appearances
        .route("/appearance", get(content::list_appearances_handler))
        .route("/appearance", post(content::create_appearance_handler))
        .route("/appearance/:id", patch(content::update_appearance_handler))
        .route("/appearance/:id", delete(content::delete_appearance_handler))
        // Actions
        .route("/action", post(content::add_action_handler))
        .route("/action/upload", post(content::upload_action_files_handler))
        // Config
        .route("/config/paths", get(content::get_config_paths_handler));

    // Combine all routes under /api/v1
    Router::new()
        .nest("/integration", integration_routes)
        .nest("/content", content_routes)
}
