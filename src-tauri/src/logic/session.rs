//! Session management
//!
//! Manages chat sessions with AI applications.

use crate::utils::error::DeepJellyError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// 会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub session_id: String,
    pub app_id: String,
    pub agent_id: String,
    pub chat_type: ChatType,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub unread_count: u32,
}

/// 聊天类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChatType {
    Private,
    Group,
}

/// 会话管理器
pub struct SessionManager {
    data_dir: PathBuf,
    sessions: HashMap<String, Session>,
}

impl SessionManager {
    /// 创建新的会话管理器
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            sessions: HashMap::new(),
        }
    }

    /// 加载会话列表
    pub fn load_sessions(&mut self) -> Result<usize, DeepJellyError> {
        let sessions_file = self.data_dir.join("sessions.json");

        if !sessions_file.exists() {
            return Ok(0);
        }

        let content = fs::read_to_string(&sessions_file)?;
        let sessions: Vec<Session> = serde_json::from_str(&content)?;

        self.sessions.clear();
        for session in sessions {
            self.sessions.insert(session.session_id.clone(), session);
        }

        Ok(self.sessions.len())
    }

    /// 保存会话列表
    pub fn save_sessions(&self) -> Result<(), DeepJellyError> {
        let sessions_file = self.data_dir.join("sessions.json");

        // 确保目录存在
        if let Some(parent) = sessions_file.parent() {
            fs::create_dir_all(parent)?;
        }

        let sessions: Vec<&Session> = self.sessions.values().collect();
        let content = serde_json::to_string_pretty(&sessions)?;

        fs::write(&sessions_file, content)?;
        Ok(())
    }

    /// 创建会话
    pub fn create_session(
        &mut self,
        app_id: String,
        agent_id: String,
        chat_type: ChatType,
        title: String,
    ) -> Result<Session, DeepJellyError> {
        let session_id = Self::generate_session_id();
        let now = Self::current_timestamp();

        let session = Session {
            session_id: session_id.clone(),
            app_id,
            agent_id,
            chat_type,
            title,
            created_at: now,
            updated_at: now,
            unread_count: 0,
        };

        self.sessions.insert(session_id.clone(), session.clone());
        self.save_sessions()?;

        Ok(session)
    }

    /// 获取会话
    pub fn get_session(&self, session_id: &str) -> Option<&Session> {
        self.sessions.get(session_id)
    }

    /// 获取所有会话
    pub fn get_all_sessions(&self) -> Vec<&Session> {
        let mut sessions: Vec<&Session> = self.sessions.values().collect();
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        sessions
    }

    /// 按应用分组获取会话
    pub fn get_sessions_by_app(&self, app_id: &str) -> Vec<&Session> {
        self.sessions
            .values()
            .filter(|s| s.app_id == app_id)
            .collect()
    }

    /// 更新会话标题
    pub fn update_title(&mut self, session_id: &str, title: String) -> Result<(), DeepJellyError> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.title = title;
            session.updated_at = Self::current_timestamp();
            self.save_sessions()?;
            Ok(())
        } else {
            Err(DeepJellyError::Protocol(format!("会话不存在: {}", session_id)))
        }
    }

    /// 删除会话
    pub fn delete_session(&mut self, session_id: &str) -> Result<(), DeepJellyError> {
        if self.sessions.remove(session_id).is_some() {
            self.save_sessions()?;
            Ok(())
        } else {
            Err(DeepJellyError::Protocol(format!("会话不存在: {}", session_id)))
        }
    }

    /// 增加未读数
    pub fn increment_unread(&mut self, session_id: &str) -> Result<(), DeepJellyError> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.unread_count += 1;
            session.updated_at = Self::current_timestamp();
            self.save_sessions()?;
            Ok(())
        } else {
            Err(DeepJellyError::Protocol(format!("会话不存在: {}", session_id)))
        }
    }

    /// 清除未读数
    pub fn clear_unread(&mut self, session_id: &str) -> Result<(), DeepJellyError> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.unread_count = 0;
            session.updated_at = Self::current_timestamp();
            self.save_sessions()?;
            Ok(())
        } else {
            Err(DeepJellyError::Protocol(format!("会话不存在: {}", session_id)))
        }
    }

    /// 获取会话数量
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }

    /// 获取总未读数
    pub fn total_unread(&self) -> u32 {
        self.sessions.values().map(|s| s.unread_count).sum()
    }

    fn generate_session_id() -> String {
        let uuid = uuid::Uuid::new_v4();
        format!("sess_{}", uuid)
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_session_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = SessionManager::new(temp_dir.path().to_path_buf());

        assert_eq!(manager.get_all_sessions().len(), 0);
        assert_eq!(manager.session_count(), 0);
    }

    #[test]
    fn test_create_session() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let session = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "测试会话".to_string(),
            )
            .unwrap();

        assert_eq!(session.app_id, "openclaw");
        assert_eq!(session.chat_type, ChatType::Private);
        assert_eq!(session.unread_count, 0);
    }

    #[test]
    fn test_get_session() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let session = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "测试会话".to_string(),
            )
            .unwrap();

        let found = manager.get_session(&session.session_id);
        assert!(found.is_some());
        assert_eq!(found.unwrap().title, "测试会话");
    }

    #[test]
    fn test_increment_unread() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let session = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "测试会话".to_string(),
            )
            .unwrap();

        manager.increment_unread(&session.session_id).unwrap();

        let updated = manager.get_session(&session.session_id).unwrap();
        assert_eq!(updated.unread_count, 1);
    }

    #[test]
    fn test_clear_unread() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let session = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "测试会话".to_string(),
            )
            .unwrap();

        manager.increment_unread(&session.session_id).unwrap();
        manager.clear_unread(&session.session_id).unwrap();

        let updated = manager.get_session(&session.session_id).unwrap();
        assert_eq!(updated.unread_count, 0);
    }

    #[test]
    fn test_delete_session() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let session = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "测试会话".to_string(),
            )
            .unwrap();

        manager.delete_session(&session.session_id).unwrap();

        let found = manager.get_session(&session.session_id);
        assert!(found.is_none());
    }

    #[test]
    fn test_save_and_load_sessions() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "会话1".to_string(),
            )
            .unwrap();

        manager
            .create_session(
                "openclaw".to_string(),
                "agent_002".to_string(),
                ChatType::Private,
                "会话2".to_string(),
            )
            .unwrap();

        // 创建新管理器并加载
        let mut manager2 = SessionManager::new(temp_dir.path().to_path_buf());
        let count = manager2.load_sessions().unwrap();

        assert_eq!(count, 2);
        assert_eq!(manager2.get_all_sessions().len(), 2);
    }

    #[test]
    fn test_update_title() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let session = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "原标题".to_string(),
            )
            .unwrap();

        manager
            .update_title(&session.session_id, "新标题".to_string())
            .unwrap();

        let updated = manager.get_session(&session.session_id).unwrap();
        assert_eq!(updated.title, "新标题");
    }

    #[test]
    fn test_total_unread() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = SessionManager::new(temp_dir.path().to_path_buf());

        let s1 = manager
            .create_session(
                "openclaw".to_string(),
                "agent_001".to_string(),
                ChatType::Private,
                "会话1".to_string(),
            )
            .unwrap();

        let s2 = manager
            .create_session(
                "openclaw".to_string(),
                "agent_002".to_string(),
                ChatType::Private,
                "会话2".to_string(),
            )
            .unwrap();

        manager.increment_unread(&s1.session_id).unwrap();
        manager.increment_unread(&s1.session_id).unwrap();
        manager.increment_unread(&s2.session_id).unwrap();

        assert_eq!(manager.total_unread(), 3);
    }
}
