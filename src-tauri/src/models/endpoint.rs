//! Endpoint Configuration Model
//!
//! DeepJelly HTTP API endpoint configuration
//! Stored in data/user/endpoint.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// DeepJelly HTTP API endpoint configuration
///
/// # Fields
/// * `host` - DeepJelly server host address (IP or domain name)
/// * `port` - DeepJelly HTTP server port (default: 12260)
///
/// # Example
/// ```json
/// {
///   "host": "192.168.1.100",
///   "port": 12260
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointConfig {
    /// DeepJelly server host address
    /// Auto-detected LAN IP on first launch for network AI calls
    /// Can be manually changed to 127.0.0.1 for local-only access
    pub host: String,

    /// DeepJelly HTTP server port
    #[serde(default = "default_port")]
    pub port: u16,
}

impl Default for EndpointConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 12260,
        }
    }
}

impl EndpointConfig {
    /// Create a new endpoint config with detected LAN IP
    ///
    /// This function attempts to detect the local machine's LAN IP address
    /// using UDP socket technique. Falls back to 127.0.0.1 if detection fails.
    pub fn with_detected_ip() -> Self {
        let host = Self::detect_local_ip();
        Self {
            host,
            port: 12260,
        }
    }

    /// Detect local IP address using UDP socket technique
    ///
    /// This method creates a UDP socket and attempts to connect to a public DNS server.
    /// The local address of the socket will be the IP address of the interface
    /// that would route to the internet, which is typically the desired LAN IP.
    fn detect_local_ip() -> String {
        use std::net::UdpSocket;

        // Try to connect to a public DNS server (doesn't actually send data)
        // This will give us the local IP address of the interface that would route to internet
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    let ip = local_addr.ip();
                    // Filter out loopback and link-local addresses
                    if !ip.is_loopback() && !ip.is_unspecified() && ip.is_ipv4() {
                        return ip.to_string();
                    }
                }
            }
        }

        // Fallback to localhost
        "127.0.0.1".to_string()
    }

    /// Get the full HTTP URL
    pub fn url(&self) -> String {
        format!("http://{}:{}", self.host, self.port)
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.host.is_empty() {
            return Err("Host address cannot be empty".to_string());
        }
        if self.port == 0 {
            return Err("Port cannot be 0".to_string());
        }
        // Note: port is u16, so max value 65535 is guaranteed by type
        Ok(())
    }
}

fn default_port() -> u16 {
    12260
}

/// Endpoint configuration manager
///
/// Handles loading and saving endpoint configuration to/from endpoint.json
pub struct EndpointManager {
    config_path: PathBuf,
    config: EndpointConfig,
}

impl EndpointManager {
    /// Create a new endpoint manager
    ///
    /// # Arguments
    /// * `user_data_dir` - Path to the user data directory (data/user/)
    ///
    /// # Returns
    /// * `Result<Self>` - The manager or an error
    pub fn new(user_data_dir: PathBuf) -> Result<Self, String> {
        let config_path = user_data_dir.join("endpoint.json");

        // Load or create default config
        let config = if config_path.exists() {
            // Load existing config
            let content = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read endpoint.json: {}", e))?;

            serde_json::from_str::<EndpointConfig>(&content)
                .map_err(|e| format!("Failed to parse endpoint.json: {}", e))?
        } else {
            // Create default config with detected LAN IP
            let default_config = EndpointConfig::with_detected_ip();

            // Save default config
            let content = serde_json::to_string_pretty(&default_config)
                .map_err(|e| format!("Failed to serialize default config: {}", e))?;

            fs::write(&config_path, content)
                .map_err(|e| format!("Failed to write endpoint.json: {}", e))?;

            default_config
        };

        Ok(Self {
            config_path,
            config,
        })
    }

    /// Get the current endpoint configuration
    pub fn get(&self) -> EndpointConfig {
        self.config.clone()
    }

    /// Update the endpoint configuration
    ///
    /// # Arguments
    /// * `config` - New configuration to save
    ///
    /// # Returns
    /// * `Result<()>` - Success or error
    pub fn update(&mut self, config: EndpointConfig) -> Result<(), String> {
        // Validate the config
        config.validate()?;

        // Save to file
        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize endpoint config: {}", e))?;

        fs::write(&self.config_path, content)
            .map_err(|e| format!("Failed to write endpoint.json: {}", e))?;

        // Update in-memory config
        self.config = config;

        Ok(())
    }

    /// Get the configuration file path
    pub fn config_path(&self) -> &PathBuf {
        &self.config_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_endpoint_config_default() {
        let config = EndpointConfig::default();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 12260);
        assert_eq!(config.url(), "http://127.0.0.1:12260");
    }

    #[test]
    fn test_endpoint_config_validation() {
        let config = EndpointConfig {
            host: "192.168.1.100".to_string(),
            port: 8080,
        };
        assert!(config.validate().is_ok());

        // Invalid port
        let invalid_config = EndpointConfig {
            host: "".to_string(),
            port: 8080,
        };
        assert!(invalid_config.validate().is_err());
    }

    #[test]
    fn test_endpoint_manager() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let user_data_dir = temp_dir.path().to_path_buf();

        // Create manager - should create default config
        let mut manager = EndpointManager::new(user_data_dir.clone())
            .expect("Failed to create manager");

        let config = manager.get();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 12260);

        // Check file was created
        assert!(user_data_dir.join("endpoint.json").exists());

        // Update config
        let new_config = EndpointConfig {
            host: "192.168.1.100".to_string(),
            port: 9999,
        };
        manager.update(new_config.clone())
            .expect("Failed to update config");

        // Verify update
        let updated = manager.get();
        assert_eq!(updated.host, "192.168.1.100");
        assert_eq!(updated.port, 9999);
    }
}
