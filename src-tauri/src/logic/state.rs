//! Application state management
//!
//! Manages global application state and persistence.

use crate::utils::error::DeepJellyError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connecting,
    Connected,
    Disconnected,
    Reconnecting,
    Error(String),
}

/// Window position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

impl Default for WindowPosition {
    fn default() -> Self {
        Self { x: 100, y: 100 }
    }
}

/// User settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub auto_start: bool,
    pub launch_at_login: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            language: "zh-CN".to_string(),
            auto_start: false,
            launch_at_login: false,
        }
    }
}

/// Main application state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    /// Current character ID being rendered
    pub current_character_id: Option<String>,
    /// Current appearance ID being displayed
    pub current_appearance_id: Option<String>,
    /// Do Not Disturb mode
    pub do_not_disturb: bool,
    /// Window position
    pub window_position: WindowPosition,
    /// User settings
    pub settings: AppSettings,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_character_id: None,
            current_appearance_id: None,
            do_not_disturb: false,
            window_position: WindowPosition::default(),
            settings: AppSettings::default(),
        }
    }
}

/// Thread-safe shared state
pub struct SharedState {
    inner: Arc<RwLock<AppState>>,
    status: Arc<RwLock<ConnectionStatus>>,
    state_dir: PathBuf,
}

impl SharedState {
    /// Create new shared state
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(AppState::default())),
            status: Arc::new(RwLock::new(ConnectionStatus::Disconnected)),
            state_dir: dirs::data_local_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("deepjelly"),
        }
    }

    /// Load state from file
    pub async fn load_from_file(state_dir: PathBuf) -> Result<Self, DeepJellyError> {
        let state_file = state_dir.join("state.json");

        let state = if state_file.exists() {
            let content = fs::read_to_string(&state_file)?;
            serde_json::from_str(&content)?
        } else {
            AppState::default()
        };

        Ok(Self {
            inner: Arc::new(RwLock::new(state)),
            status: Arc::new(RwLock::new(ConnectionStatus::Disconnected)),
            state_dir,
        })
    }

    /// Save state to file
    pub async fn save_to_file(&self) -> Result<(), DeepJellyError> {
        let state_file = self.state_dir.join("state.json");

        // Ensure directory exists
        if let Some(parent) = state_file.parent() {
            fs::create_dir_all(parent)?;
        }

        let state = self.inner.read().await;
        let content = serde_json::to_string_pretty(&*state)?;
        fs::write(&state_file, content)?;

        Ok(())
    }

    /// Get current character ID
    pub async fn get_current_character_id(&self) -> Option<String> {
        self.inner.read().await.current_character_id.clone()
    }

    /// Set current character ID
    pub async fn set_current_character_id(&self, id: Option<String>) {
        let mut state = self.inner.write().await;
        state.current_character_id = id;
    }

    /// Get current appearance ID
    pub async fn get_current_appearance_id(&self) -> Option<String> {
        self.inner.read().await.current_appearance_id.clone()
    }

    /// Set current appearance ID
    pub async fn set_current_appearance_id(&self, id: Option<String>) {
        let mut state = self.inner.write().await;
        state.current_appearance_id = id;
    }

    /// Get Do Not Disturb mode
    pub async fn get_do_not_disturb(&self) -> bool {
        self.inner.read().await.do_not_disturb
    }

    /// Set Do Not Disturb mode
    pub async fn set_do_not_disturb(&self, enabled: bool) {
        let mut state = self.inner.write().await;
        state.do_not_disturb = enabled;
    }

    /// Toggle Do Not Disturb mode
    pub async fn toggle_do_not_disturb(&self) -> bool {
        let mut state = self.inner.write().await;
        state.do_not_disturb = !state.do_not_disturb;
        state.do_not_disturb
    }

    /// Get window position
    pub async fn get_window_position(&self) -> WindowPosition {
        self.inner.read().await.window_position.clone()
    }

    /// Set window position
    pub async fn set_window_position(&self, x: i32, y: i32) {
        let mut state = self.inner.write().await;
        state.window_position = WindowPosition { x, y };
    }

    /// Get connection status
    pub async fn get_connection_status(&self) -> ConnectionStatus {
        self.status.read().await.clone()
    }

    /// Set connection status
    pub async fn set_connection_status(&self, status: ConnectionStatus) {
        let mut s = self.status.write().await;
        *s = status;
    }

    /// Get settings
    pub async fn get_settings(&self) -> AppSettings {
        self.inner.read().await.settings.clone()
    }

    /// Update settings
    pub async fn update_settings<F>(&self, updater: F)
    where
        F: FnOnce(&mut AppSettings),
    {
        let mut state = self.inner.write().await;
        updater(&mut state.settings);
    }

    /// Get full state snapshot
    pub async fn snapshot(&self) -> (AppState, ConnectionStatus) {
        let state = self.inner.read().await;
        let status = self.status.read().await;
        (state.clone(), status.clone())
    }
}

impl Default for SharedState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shared_state_creation() {
        let state = SharedState::new();

        assert!(state.get_current_character_id().await.is_none());
        assert!(!state.get_do_not_disturb().await);
    }

    #[tokio::test]
    async fn test_set_current_character_id() {
        let state = SharedState::new();
        state.set_current_character_id(Some("char_001".to_string())).await;

        assert_eq!(state.get_current_character_id().await, Some("char_001".to_string()));
    }

    #[tokio::test]
    async fn test_do_not_disturb() {
        let state = SharedState::new();
        assert_eq!(state.get_do_not_disturb().await, false);

        let result = state.toggle_do_not_disturb().await;
        assert!(result);
        assert_eq!(state.get_do_not_disturb().await, true);
    }

    #[tokio::test]
    async fn test_window_position() {
        let state = SharedState::new();
        state.set_window_position(200, 300).await;

        let pos = state.get_window_position().await;
        assert_eq!(pos.x, 200);
        assert_eq!(pos.y, 300);
    }

    #[tokio::test]
    async fn test_connection_status() {
        let state = SharedState::new();
        assert!(matches!(
            state.get_connection_status().await,
            ConnectionStatus::Disconnected
        ));

        state.set_connection_status(ConnectionStatus::Connected).await;
        assert!(matches!(
            state.get_connection_status().await,
            ConnectionStatus::Connected
        ));
    }

    #[tokio::test]
    async fn test_update_settings() {
        let state = SharedState::new();

        state.update_settings(|settings| {
            settings.theme = "dark".to_string();
            settings.language = "en-US".to_string();
        }).await;

        let settings = state.get_settings().await;
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.language, "en-US");
    }

    #[tokio::test]
    async fn test_save_and_load_state() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let state1 = SharedState::new();

        // 设置一些值
        state1.set_current_character_id(Some("char_001".to_string())).await;
        state1.set_do_not_disturb(true).await;
        state1.set_window_position(500, 600).await;

        // 模拟保存和加载
        let state_file = temp_dir.path().join("state.json");
        let state = state1.inner.read().await;
        let content = serde_json::to_string_pretty(&*state).unwrap();
        fs::write(&state_file, content).unwrap();

        let state2 = SharedState::load_from_file(temp_dir.path().to_path_buf()).await.unwrap();
        assert_eq!(state2.get_current_character_id().await, Some("char_001".to_string()));
        assert!(state2.get_do_not_disturb().await);
        assert_eq!(state2.get_window_position().await.x, 500);
    }
}
