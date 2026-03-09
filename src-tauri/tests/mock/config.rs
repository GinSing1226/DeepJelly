//! Mock config objects for testing

use deepjelly::logic::config::{
    AppConfig, GatewayConfig, BrainConfig, CharacterAppConfig, ReactionConfig,
};
use std::path::PathBuf;

/// Mock配置构建器
pub struct MockConfigBuilder {
    config: AppConfig,
}

impl MockConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: AppConfig::default(),
        }
    }

    pub fn gateway(mut self, host: &str, port: u16) -> Self {
        self.config.gateway = GatewayConfig {
            host: host.to_string(),
            port,
        };
        self
    }

    pub fn brain(mut self, api_url: &str, api_key: Option<String>) -> Self {
        self.config.brain = BrainConfig {
            api_url: api_url.to_string(),
            api_key,
            timeout_secs: 30,
        };
        self
    }

    pub fn character(mut self, resources_dir: &str, current_id: Option<String>) -> Self {
        self.config.character = CharacterAppConfig {
            resources_dir: PathBuf::from(resources_dir),
            current_character_id: current_id,
        };
        self
    }

    pub fn reaction(mut self, rules_dir: &str, enabled: bool) -> Self {
        self.config.reaction = ReactionConfig {
            rules_dir: PathBuf::from(rules_dir),
            enabled,
        };
        self
    }

    pub fn version(mut self, version: &str) -> Self {
        self.config.version = version.to_string();
        self
    }

    pub fn build(self) -> AppConfig {
        self.config
    }
}

impl Default for MockConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// 预定义的Mock配置
pub mod presets {
    use super::*;

    /// 默认配置
    pub fn default() -> AppConfig {
        MockConfigBuilder::new().build()
    }

    /// 开发环境配置
    pub fn development() -> AppConfig {
        MockConfigBuilder::new()
            .gateway("127.0.0.1", 12260)
            .brain("ws://localhost:12250", Some("dev-key".to_string()))
            .character("./resources/characters", Some("char_dev".to_string()))
            .reaction("./resources/reactions", true)
            .version("0.1.0-dev")
            .build()
    }

    /// 生产环境配置
    pub fn production() -> AppConfig {
        MockConfigBuilder::new()
            .gateway("0.0.0.0", 12260)
            .brain("wss://api.example.com", None)
            .character("/opt/deepjelly/characters", None)
            .reaction("/opt/deepjelly/reactions", true)
            .version("1.0.0")
            .build()
    }

    /// 测试配置
    pub fn test() -> AppConfig {
        MockConfigBuilder::new()
            .gateway("localhost", 9999)
            .brain("ws://test", Some("test-key".to_string()))
            .character("./test/characters", Some("test_char".to_string()))
            .reaction("./test/reactions", false)
            .version("0.0.0-test")
            .build()
    }
}
