//! Brain adapter configuration
//!
//! Configuration for AI adapter WebSocket connection.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Brain adapter configuration root
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainAdapterConfig {
    pub brain_adapter: BrainAdapterSettings,
}

/// Brain adapter settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainAdapterSettings {
    /// OpenClaw Gateway authentication token
    /// 用户从 OpenClaw 设置中获取并配置到 DeepJelly
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub auth_token: Option<String>,
    /// Adapter type (e.g., "websocket")
    #[serde(rename = "type")]
    pub adapter_type: String,
    /// WebSocket URL to connect to
    pub url: String,
    /// Protocol to use (e.g., "jsonrpc")
    pub protocol: String,
    /// Reconnection interval in milliseconds
    #[serde(default = "default_reconnect_interval")]
    pub reconnect_interval_ms: u64,
    /// Request timeout in milliseconds
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}

fn default_reconnect_interval() -> u64 {
    5000
}

fn default_timeout() -> u64 {
    30000
}

impl Default for BrainAdapterSettings {
    fn default() -> Self {
        Self {
            auth_token: None,
            adapter_type: "websocket".to_string(),
            url: "ws://127.0.0.1:18790".to_string(),
            protocol: "jsonrpc".to_string(),
            reconnect_interval_ms: default_reconnect_interval(),
            timeout_ms: default_timeout(),
        }
    }
}

impl Default for BrainAdapterConfig {
    fn default() -> Self {
        Self {
            brain_adapter: BrainAdapterSettings::default(),
        }
    }
}

impl BrainAdapterConfig {
    /// Load configuration from a JSON file
    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            log::warn!(
                "Config file not found at {:?}, using defaults",
                path
            );
            return Ok(Self::default());
        }

        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        let config: Self = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config JSON: {}", e))?;

        log::info!("Loaded brain adapter config from {:?}", path);
        Ok(config)
    }

    /// Save configuration to a JSON file
    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        log::info!("Saved brain adapter config to {:?}", path);
        Ok(())
    }

    /// Get the settings
    pub fn settings(&self) -> &BrainAdapterSettings {
        &self.brain_adapter
    }
}

impl BrainAdapterSettings {
    /// Get reconnection interval as Duration
    pub fn reconnect_interval(&self) -> std::time::Duration {
        std::time::Duration::from_millis(self.reconnect_interval_ms)
    }

    /// Get timeout as Duration
    pub fn timeout(&self) -> std::time::Duration {
        std::time::Duration::from_millis(self.timeout_ms)
    }

    /// Get WebSocket URL with token parameter
    pub fn ws_url_with_token(&self) -> String {
        if let Some(token) = &self.auth_token {
            format!("{}?token={}", self.url, token)
        } else {
            self.url.clone()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = BrainAdapterConfig::default();
        assert_eq!(config.brain_adapter.adapter_type, "websocket");
        assert_eq!(config.brain_adapter.protocol, "jsonrpc");
        assert_eq!(config.brain_adapter.reconnect_interval_ms, 5000);
        assert_eq!(config.brain_adapter.timeout_ms, 30000);
    }

    #[test]
    fn test_serialize_config() {
        let config = BrainAdapterConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("websocket"));
        assert!(json.contains("jsonrpc"));
    }

    #[test]
    fn test_ws_url_with_token() {
        let settings = BrainAdapterSettings {
            auth_token: Some("test_token_123".to_string()),
            url: "ws://127.0.0.1:18790".to_string(),
            ..Default::default()
        };
        assert_eq!(settings.ws_url_with_token(), "ws://127.0.0.1:18790?token=test_token_123");
    }

    #[test]
    fn test_ws_url_without_token() {
        let settings = BrainAdapterSettings::default();
        assert_eq!(settings.ws_url_with_token(), "ws://127.0.0.1:18790");
    }
}
