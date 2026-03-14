//! HTTP API Integration Tests
//!
//! 测试 DeepJelly HTTP API 网关的各个端点。
//!
//! 测试策略：
//! 1. 先写测试用例（Red Phase）
//! 2. 运行测试验证失败
//! 3. 启动 HTTP 服务器
//! 4. 运行测试验证通过（Green Phase）

use std::sync::Arc;
use std::sync::Mutex;
use tempfile::TempDir;
use tokio::time::{timeout, Duration};

use deepjelly::commands::app_integration::{AppIntegrationManager, CharacterIntegrationManager};
use deepjelly::commands::data::AssistantManager;
use deepjelly::gateway::http::{HttpServer, HttpServerConfig};
use deepjelly::models::integration::{AppIntegration, ProviderType};
use reqwest::{Client, StatusCode};

// ============================================================================
// Test Helper Functions
// ============================================================================

/// 创建测试用的临时目录和应用管理器
async fn setup_test_env() -> (TempDir, Arc<AppIntegrationManagerState>) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let data_dir = temp_dir.path().to_path_buf();

    let app_manager = AppIntegrationManager::new(data_dir.clone())
        .expect("Failed to create AppIntegrationManager");
    let app_state = Arc::new(Mutex::new(app_manager));

    (temp_dir, app_state)
}

/// 创建测试用的 HTTP 服务器配置（使用随机端口）
fn create_test_server_config() -> HttpServerConfig {
    HttpServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0, // 使用 0 让系统分配可用端口
        require_auth: false, // 测试环境禁用认证
    }
}

/// 启动测试 HTTP 服务器
async fn start_test_server(
    app_state: Arc<AppIntegrationManagerState>,
    char_state: Arc<deepjelly::commands::app_integration::CharacterIntegrationManagerState>,
    asst_state: Arc<deepjelly::commands::data::AssistantManagerState>,
) -> (tokio::task::JoinHandle<()>, u16) {
    use deepjelly::logic::character::get_user_data_dir;

    let config = create_test_server_config();

    // 先创建一个绑定获取可用端口
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind to find available port");
    let port = listener.local_addr().expect("Failed to get local addr")
        .port();
    drop(listener);

    let server_config = HttpServerConfig {
        host: "127.0.0.1".to_string(),
        port,
        require_auth: false,
    };

    let server = HttpServer::new(server_config, app_state, char_state, asst_state);

    // 在后台启动服务器
    let handle = tokio::spawn(async move {
        let _ = server.start().await;
    });

    // 等待服务器启动
    tokio::time::sleep(Duration::from_millis(100)).await;

    (handle, port)
}

/// 获取测试服务器的基础 URL
fn get_test_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{}", port)
}

// ============================================================================
// Test Suite
// ============================================================================

#[cfg(test)]
mod integration_tests {
    use super::*;

    // ============================================================================
    // Test 1: Health Check
    // ============================================================================

    #[tokio::test]
    async fn test_health_check_endpoint() {
        let (_temp_dir, app_state) = setup_test_env().await;

        // 创建其他必需的状态
        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/health", get_test_base_url(port));

        let response = client.get(&url)
            .send()
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.text().await.unwrap(), "OK");
    }

    // ============================================================================
    // Test 2: List App Integrations (Empty)
    // ============================================================================

    #[tokio::test]
    async fn test_list_app_integrations_empty() {
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/integration/app", get_test_base_url(port));

        let response = client.get(&url)
            .send()
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["success"].as_bool().unwrap());
        assert!(json["data"].as_array().unwrap().is_empty());
    }

    // ============================================================================
    // Test 3: List App Integrations (With Data)
    // ============================================================================

    #[tokio::test]
    async fn test_list_app_integrations_with_data() {
        let (temp_dir, app_state) = setup_test_env().await;

        // 添加测试数据
        let mut manager = app_state.lock().unwrap();
        let test_integration = AppIntegration {
            id: "test123".to_string(),
            application_id: "app456".to_string(),
            provider: ProviderType::Openclaw,
            name: "Test App".to_string(),
            description: Some("Test Description".to_string()),
            endpoint: "ws://localhost:12345".to_string(),
            auth_token: Some("test_token".to_string()),
            deepjelly_token: Some("dj_test_token".to_string()),
            enabled: Some(true),
            created_at: Some(1234567890),
        };
        manager.add(test_integration).expect("Failed to add test integration");
        drop(manager);

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(temp_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/integration/app", get_test_base_url(port));

        let response = client.get(&url)
            .send()
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["success"].as_bool().unwrap());

        let data = json["data"].as_array().unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0]["name"], "Test App");
        assert_eq!(data[0]["deepjellyToken"], "dj_test_token");
    }

    // ============================================================================
    // Test 4: Test Connection Endpoint
    // ============================================================================

    #[tokio::test]
    async fn test_test_connection_valid() {
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/integration/app/test", get_test_base_url(port));

        let payload = serde_json::json!({
            "endpoint": "ws://192.168.1.100:18790",
            "authToken": null
        });

        let response = client.post(&url)
            .json(&payload)
            .send()
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["success"].as_bool().unwrap());
        // 测试连接会简单验证格式，返回 true
        assert!(json["data"].as_bool().unwrap());
    }

    // ============================================================================
    // Test 5: Test Connection Invalid Endpoint
    // ============================================================================

    #[tokio::test]
    async fn test_test_connection_invalid_endpoint() {
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/integration/app/test", get_test_base_url(port));

        let payload = serde_json::json!({
            "endpoint": "invalid://not-a-websocket-url",
            "authToken": null
        });

        let response = client.post(&url)
            .json(&payload)
            .send()
            .await
            .expect("Failed to send request");

        // 应该返回错误
        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(!json["success"].as_bool().unwrap());
        assert!(json["error"].is_object());
    }

    // ============================================================================
    // Test 6: Authentication Required (Protected Endpoint)
    // ============================================================================

    #[tokio::test]
    async fn test_authentication_required() {
        // 这个测试验证认证中间件是否工作
        // 需要创建一个启用认证的服务器
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        // 添加一个带有 deepjellyToken 的集成
        let mut manager = app_state.lock().unwrap();
        let test_integration = AppIntegration {
            id: "auth_test".to_string(),
            application_id: "app_auth".to_string(),
            provider: ProviderType::Openclaw,
            name: "Auth Test".to_string(),
            description: None,
            endpoint: "ws://localhost:9999".to_string(),
            auth_token: None,
            deepjelly_token: Some("dj_valid_test_token_12345".to_string()),
            enabled: Some(true),
            created_at: None,
        };
        manager.add(test_integration).expect("Failed to add test integration");
        drop(manager);

        // 启用认证的服务器
        let config = HttpServerConfig {
            host: "127.0.0.1".to_string(),
            port: 0,
            require_auth: true, // 启用认证
        };

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind");
        let port = listener.local_addr().expect("Failed to get local addr").port();
        drop(listener);

        let server_config = HttpServerConfig {
            host: "127.0.0.1".to_string(),
            port,
            require_auth: true,
        };

        let server = HttpServer::new(server_config, app_state, char_state, asst_state);
        let handle = tokio::spawn(async move {
            let _ = server.start().await;
        });

        tokio::time::sleep(Duration::from_millis(100)).await;

        let client = Client::new();
        let url = format!("{}/api/v1/integration/character", get_test_base_url(port));

        // 测试1: 没有token，应该返回401
        let response_no_auth = client.get(&url)
            .send()
            .await
            .expect("Failed to send request");
        assert_eq!(response_no_auth.status(), StatusCode::UNAUTHORIZED);

        // 测试2: 无效token，应该返回401
        let response_invalid_token = client.get(&url)
            .header("Authorization", "Bearer invalid_token")
            .send()
            .await
            .expect("Failed to send request");
        assert_eq!(response_invalid_token.status(), StatusCode::UNAUTHORIZED);

        // 测试3: 有效token，应该返回200
        let response_valid_token = client.get(&url)
            .header("Authorization", "Bearer dj_valid_test_token_12345")
            .send()
            .await
            .expect("Failed to send request");
        // 可能是200（有数据）或404（没有数据），但不应该是401
        assert_ne!(response_valid_token.status(), StatusCode::UNAUTHORIZED);

        handle.abort();
    }

    // ============================================================================
    // Test 7: Config Paths Endpoint
    // ============================================================================

    #[tokio::test]
    async fn test_get_config_paths() {
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/content/config/paths", get_test_base_url(port));

        let response = client.get(&url)
            .send()
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["success"].as_bool().unwrap());
        assert!(json["data"]["characters_dir"].is_string());
    }

    // ============================================================================
    // Test 8: 404 Not Found
    // ============================================================================

    #[tokio::test]
    async fn test_not_found_endpoint() {
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/nonexistent", get_test_base_url(port));

        let response = client.get(&url)
            .send()
            .await
            .expect("Failed to send request");

        // axum 默认返回 404
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    // ============================================================================
    // Test 9: CORS Headers
    // ============================================================================

    #[tokio::test]
    async fn test_cors_headers() {
        let (_temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        let (_handle, port) = start_test_server(app_state, char_state, asst_state).await;
        let client = Client::new();
        let url = format!("{}/api/v1/health", get_test_base_url(port));

        // 发送 OPTIONS 请求
        let response = client
            .request(reqwest::Method::OPTIONS, &url)
            .header("Origin", "http://example.com")
            .header("Access-Control-Request-Method", "GET")
            .send()
            .await
            .expect("Failed to send request");

        // CORS preflight 应该返回 200 或 204
        assert!(response.status().is_success());

        // 检查 CORS 头
        let headers = response.headers();
        // 注意: reqwest 可能会规范化某些头名称
        let cors_headers: Vec<_> = headers
            .iter()
            .filter(|(k, _)| k.as_str().contains("access-control"))
            .collect();

        // 应该有 CORS 头
        assert!(!cors_headers.is_empty());
    }

    // ============================================================================
    // Test 10: Character Integration (Protected)
    // ============================================================================

    #[tokio::test]
    async fn test_character_integration_with_auth() {
        let (temp_dir, app_state) = setup_test_env().await;

        let data_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let char_manager = CharacterIntegrationManager::new(data_dir.path().to_path_buf())
            .expect("Failed to create CharacterIntegrationManager");
        let char_state = Arc::new(Mutex::new(char_manager));

        let asst_manager = AssistantManager::new(temp_dir.path().to_path_buf())
            .expect("Failed to create AssistantManager");
        let asst_state = Arc::new(Mutex::new(asst_manager));

        // 添加认证token
        let mut manager = app_state.lock().unwrap();
        let test_integration = AppIntegration {
            id: "char_auth_test".to_string(),
            application_id: "app_char_auth".to_string(),
            provider: ProviderType::Openclaw,
            name: "Char Auth Test".to_string(),
            description: None,
            endpoint: "ws://localhost:9999".to_string(),
            auth_token: None,
            deepjelly_token: Some("dj_char_test_token_67890".to_string()),
            enabled: Some(true),
            created_at: None,
        };
        manager.add(test_integration).expect("Failed to add test integration");
        drop(manager);

        // 启用认证的服务器
        let config = HttpServerConfig {
            host: "127.0.0.1".to_string(),
            port: 0,
            require_auth: true,
        };

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind");
        let port = listener.local_addr().expect("Failed to get local addr").port();
        drop(listener);

        let server_config = HttpServerConfig {
            host: "127.0.0.1".to_string(),
            port,
            require_auth: true,
        };

        let server = HttpServer::new(server_config, app_state, char_state, asst_state);
        let handle = tokio::spawn(async move {
            let _ = server.start().await;
        });

        tokio::time::sleep(Duration::from_millis(100)).await;

        let client = Client::new();
        let url = format!("{}/api/v1/integration/character", get_test_base_url(port));

        // 测试: 使用有效token获取角色集成列表（可能为空）
        let response = client.get(&url)
            .header("Authorization", "Bearer dj_char_test_token_67890")
            .send()
            .await
            .expect("Failed to send request");

        // 应该返回200（认证成功），数据可能为空
        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["success"].as_bool().unwrap());

        handle.abort();
    }
}
