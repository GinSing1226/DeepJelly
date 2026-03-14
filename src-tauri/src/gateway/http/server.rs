//! HTTP API Server
//!
//! HTTP server for the DeepJelly API gateway.

use axum::{
    Router,
    routing::get,
    http::{header, Method},
};
use std::sync::{Arc, Mutex};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use log::info;

use crate::logic::character::{
    AppIntegrationManager, CharacterIntegrationManager, AssistantManager, CharacterManager,
};
use super::router::create_api_router;

/// Configuration for the HTTP API server
#[derive(Debug, Clone)]
pub struct HttpServerConfig {
    /// Host to bind to
    pub host: String,
    /// Port to listen on
    pub port: u16,
    /// Whether authentication is required
    pub require_auth: bool,
}

impl Default for HttpServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 12261,
            require_auth: true,
        }
    }
}

/// Holds all the state for the HTTP API server
#[derive(Clone)]
pub struct HttpServerState {
    pub app_integration_manager: Arc<Mutex<AppIntegrationManager>>,
    pub character_integration_manager: Arc<Mutex<CharacterIntegrationManager>>,
    pub assistant_manager: Arc<Mutex<AssistantManager>>,
    pub character_manager: Arc<Mutex<CharacterManager>>,
    pub user_data_dir: std::path::PathBuf,
}

/// HTTP API Server
pub struct HttpServer {
    config: HttpServerConfig,
    state: HttpServerState,
}

impl HttpServer {
    /// Create a new HTTP server instance
    pub fn new(
        config: HttpServerConfig,
        app_integration_manager: Arc<Mutex<AppIntegrationManager>>,
        character_integration_manager: Arc<Mutex<CharacterIntegrationManager>>,
        assistant_manager: Arc<Mutex<AssistantManager>>,
        character_manager: Arc<Mutex<CharacterManager>>,
        user_data_dir: std::path::PathBuf,
    ) -> Self {
        let state = HttpServerState {
            app_integration_manager,
            character_integration_manager,
            assistant_manager,
            character_manager,
            user_data_dir,
        };

        Self {
            config,
            state,
        }
    }

    /// Build the Axum application with all routes and middleware
    fn build_app(&self) -> Router<HttpServerState> {
        // Create CORS layer
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers(Any)
            .allow_credentials(false)
            .expose_headers([header::CONTENT_TYPE]);

        // Note: Authentication middleware can be added here when needed
        // For now, we'll use optional auth in the handlers themselves

        // Create API router with state
        let api_router = create_api_router()
            .route("/health", get(handle_health));

        // Combine with CORS and tracing, then set state
        Router::new()
            .nest("/api/v1", api_router)
            .layer(cors)
            .layer(TraceLayer::new_for_http())
    }

    /// Start the HTTP server
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let addr = format!("{}:{}", self.config.host, self.config.port);
        let socket_addr: SocketAddr = addr.parse()?;

        // Build application with state
        let app = self.build_app()
            .with_state(self.state.clone());

        // Create TCP listener
        let listener = TcpListener::bind(&socket_addr).await?;

        info!("DeepJelly HTTP API server listening on http://{}", addr);

        // Start server
        axum::serve(listener, app).await?;

        Ok(())
    }

    /// Start the server in a background task
    pub async fn spawn(self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            if let Err(e) = self.start().await {
                eprintln!("HTTP server error: {}", e);
            }
        })
    }
}

/// Health check handler
async fn handle_health() -> &'static str {
    "OK"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = HttpServerConfig::default();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 12261);
        assert!(config.require_auth);
    }

    #[test]
    fn test_custom_config() {
        let config = HttpServerConfig {
            host: "0.0.0.0".to_string(),
            port: 8080,
            require_auth: false,
        };
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 8080);
        assert!(!config.require_auth);
    }
}
