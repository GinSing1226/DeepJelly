//! Configuration management
//!
//! Manages application configuration loading and saving.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::utils::error::DeepJellyError;

/// Gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    /// Server host address
    pub host: String,
    /// Server port
    pub port: u16,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 12260,
        }
    }
}

/// Brain (AI adapter) configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainConfig {
    /// API URL for the brain service
    pub api_url: String,
    /// API key for authentication
    pub api_key: Option<String>,
    /// Connection timeout in seconds
    pub timeout_secs: u64,
}

impl Default for BrainConfig {
    fn default() -> Self {
        Self {
            api_url: "ws://localhost:12250".to_string(),
            api_key: None,
            timeout_secs: 30,
        }
    }
}

/// Character application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterAppConfig {
    /// Directory containing character resources
    pub resources_dir: PathBuf,
    /// Current character ID
    pub current_character_id: Option<String>,
}

impl Default for CharacterAppConfig {
    fn default() -> Self {
        Self {
            resources_dir: PathBuf::from("./resources/characters"),
            current_character_id: None,
        }
    }
}

/// Reaction system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactionConfig {
    /// Directory containing reaction rules
    pub rules_dir: PathBuf,
    /// Whether reaction system is enabled
    pub enabled: bool,
}

impl Default for ReactionConfig {
    fn default() -> Self {
        Self {
            rules_dir: PathBuf::from("./resources/reactions"),
            enabled: true,
        }
    }
}

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Gateway configuration
    pub gateway: GatewayConfig,
    /// Brain configuration
    pub brain: BrainConfig,
    /// Character configuration
    pub character: CharacterAppConfig,
    /// Reaction system configuration
    pub reaction: ReactionConfig,
    /// Application version
    pub version: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            gateway: GatewayConfig::default(),
            brain: BrainConfig::default(),
            character: CharacterAppConfig::default(),
            reaction: ReactionConfig::default(),
            version: "0.1.0".to_string(),
        }
    }
}

/// Configuration manager
pub struct ConfigManager {
    config_dir: PathBuf,
}

impl ConfigManager {
    /// Create new config manager
    pub fn new(config_dir: PathBuf) -> Self {
        Self { config_dir }
    }

    /// Create with default config directory
    pub fn default_manager() -> Result<Self, DeepJellyError> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| DeepJellyError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Cannot find config directory",
            )))?
            .join("deepjelly");

        fs::create_dir_all(&config_dir)
            .map_err(|e| DeepJellyError::Io(e))?;

        Ok(Self::new(config_dir))
    }

    /// Get config file path
    pub fn config_file(&self) -> PathBuf {
        self.config_dir.join("config.json")
    }

    /// Get data directory path
    pub fn data_dir(&self) -> PathBuf {
        self.config_dir.join("data")
    }

    /// Check if config exists
    pub fn config_exists(&self) -> bool {
        self.config_file().exists()
    }

    /// Load application configuration
    pub fn load_app_config(&self) -> Result<AppConfig, DeepJellyError> {
        let path = self.config_file();
        if !path.exists() {
            // Return default config if file doesn't exist
            return Ok(AppConfig::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| DeepJellyError::Io(e))?;
        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Protocol(format!("Failed to parse config: {}", e)))?;
        Ok(config)
    }

    /// Save application configuration
    pub fn save_app_config(&self, config: &AppConfig) -> Result<(), DeepJellyError> {
        // Ensure directory exists
        if let Some(parent) = self.config_file().parent() {
            fs::create_dir_all(parent)
                .map_err(|e| DeepJellyError::Io(e))?;
        }

        let content = serde_json::to_string_pretty(config)
            .map_err(|e| DeepJellyError::Protocol(format!("Failed to serialize config: {}", e)))?;
        fs::write(self.config_file(), content)
            .map_err(|e| DeepJellyError::Io(e))?;
        Ok(())
    }

    /// Load configuration (generic)
    pub async fn load<T: serde::de::DeserializeOwned>(&self) -> Result<Option<T>, DeepJellyError> {
        let path = self.config_file();
        if !path.exists() {
            return Ok(None);
        }

        let content = tokio::fs::read_to_string(&path).await
            .map_err(|e| DeepJellyError::Io(e))?;
        let config: T = serde_json::from_str(&content)
            .map_err(|e| DeepJellyError::Protocol(format!("Failed to parse config: {}", e)))?;
        Ok(Some(config))
    }

    /// Save configuration (generic)
    pub async fn save<T: serde::Serialize>(&self, config: &T) -> Result<(), DeepJellyError> {
        // Ensure directory exists
        if let Some(parent) = self.config_file().parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| DeepJellyError::Io(e))?;
        }

        let content = serde_json::to_string_pretty(config)
            .map_err(|e| DeepJellyError::Protocol(format!("Failed to serialize config: {}", e)))?;
        tokio::fs::write(self.config_file(), content).await
            .map_err(|e| DeepJellyError::Io(e))?;
        Ok(())
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new(
            dirs::config_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("deepjelly"),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_gateway_config_default() {
        let config = GatewayConfig::default();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 12260);
    }

    #[test]
    fn test_brain_config_default() {
        let config = BrainConfig::default();
        assert_eq!(config.api_url, "ws://localhost:12250");
        assert!(config.api_key.is_none());
        assert_eq!(config.timeout_secs, 30);
    }

    #[test]
    fn test_character_config_default() {
        let config = CharacterAppConfig::default();
        assert_eq!(config.resources_dir, PathBuf::from("./resources/characters"));
        assert!(config.current_character_id.is_none());
    }

    #[test]
    fn test_reaction_config_default() {
        let config = ReactionConfig::default();
        assert_eq!(config.rules_dir, PathBuf::from("./resources/reactions"));
        assert!(config.enabled);
    }

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.version, "0.1.0");
        assert_eq!(config.gateway.port, 12260);
    }

    #[test]
    fn test_app_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("12260"));
        assert!(json.contains("0.1.0"));
    }

    #[test]
    fn test_app_config_deserialization() {
        let json = r#"{
            "gateway": {
                "host": "0.0.0.0",
                "port": 8080
            },
            "brain": {
                "api_url": "ws://example.com",
                "api_key": "test-key",
                "timeout_secs": 60
            },
            "character": {
                "resources_dir": "/tmp/characters",
                "current_character_id": "char-001"
            },
            "reaction": {
                "rules_dir": "/tmp/rules",
                "enabled": false
            },
            "version": "1.0.0"
        }"#;

        let config: AppConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.gateway.host, "0.0.0.0");
        assert_eq!(config.gateway.port, 8080);
        assert_eq!(config.brain.api_url, "ws://example.com");
        assert_eq!(config.brain.api_key, Some("test-key".to_string()));
        assert_eq!(config.brain.timeout_secs, 60);
        assert_eq!(config.character.resources_dir, PathBuf::from("/tmp/characters"));
        assert_eq!(config.character.current_character_id, Some("char-001".to_string()));
        assert!(!config.reaction.enabled);
        assert_eq!(config.version, "1.0.0");
    }

    #[test]
    fn test_config_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        assert_eq!(manager.config_file(), temp_dir.path().join("config.json"));
        assert_eq!(manager.data_dir(), temp_dir.path().join("data"));
    }

    #[test]
    fn test_config_manager_config_exists() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        // Config doesn't exist initially
        assert!(!manager.config_exists());

        // Create config file
        let config = AppConfig::default();
        manager.save_app_config(&config).unwrap();

        // Now it exists
        assert!(manager.config_exists());
    }

    #[test]
    fn test_config_manager_load_default_when_missing() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = manager.load_app_config().unwrap();
        assert_eq!(config.version, "0.1.0");
        assert_eq!(config.gateway.port, 12260);
    }

    #[test]
    fn test_config_manager_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let mut config = AppConfig::default();
        config.gateway.port = 9999;
        config.version = "2.0.0".to_string();

        manager.save_app_config(&config).unwrap();

        let loaded = manager.load_app_config().unwrap();
        assert_eq!(loaded.gateway.port, 9999);
        assert_eq!(loaded.version, "2.0.0");
    }

    #[tokio::test]
    async fn test_config_manager_async_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let config = AppConfig {
            gateway: GatewayConfig {
                host: "0.0.0.0".to_string(),
                port: 8080,
            },
            ..Default::default()
        };

        manager.save(&config).await.unwrap();

        let loaded: Option<AppConfig> = manager.load().await.unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.gateway.host, "0.0.0.0");
        assert_eq!(loaded.gateway.port, 8080);
    }

    #[tokio::test]
    async fn test_config_manager_async_load_none_when_missing() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ConfigManager::new(temp_dir.path().to_path_buf());

        let loaded: Option<AppConfig> = manager.load().await.unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn test_gateway_config_custom() {
        let config = GatewayConfig {
            host: "0.0.0.0".to_string(),
            port: 8080,
        };

        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 8080);
    }

    #[test]
    fn test_brain_config_with_api_key() {
        let config = BrainConfig {
            api_url: "wss://api.example.com".to_string(),
            api_key: Some("secret-key".to_string()),
            timeout_secs: 120,
        };

        assert_eq!(config.api_url, "wss://api.example.com");
        assert_eq!(config.api_key, Some("secret-key".to_string()));
        assert_eq!(config.timeout_secs, 120);
    }
}
