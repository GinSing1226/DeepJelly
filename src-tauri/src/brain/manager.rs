//! Adapter manager
//!
//! Manages AI adapter client instances.

use crate::brain::AdapterClient;

/// 适配器管理器
pub struct AdapterManager {
    default_client: Option<AdapterClient>,
}

impl AdapterManager {
    pub fn new() -> Self {
        Self { default_client: None }
    }

    pub fn set_default(&mut self, client: AdapterClient) {
        self.default_client = Some(client);
    }

    pub fn get_default(&self) -> Option<&AdapterClient> {
        self.default_client.as_ref()
    }
}

impl Default for AdapterManager {
    fn default() -> Self {
        Self::new()
    }
}
