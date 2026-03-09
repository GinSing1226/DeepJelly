//! Character configuration manager
//!
//! Manages loading, saving, and querying character configurations.
//! Uses single-path design: all data stored in `data/characters/`.

use super::types::*;
use crate::utils::error::DeepJellyError;
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Character source tracking
#[derive(Debug, Clone)]
struct CharacterSource {
    base_dir: PathBuf,
}

/// 角色管理器
///
/// 单路径设计：所有角色数据存储在 `data/characters/` 目录
pub struct CharacterManager {
    /// 数据目录（`data/`）
    data_dir: PathBuf,
    /// 角色资源目录（`data/characters/`）
    characters_dir: PathBuf,
    /// 角色配置缓存
    characters: HashMap<String, CharacterConfig>,
    /// 角色来源追踪
    character_sources: HashMap<String, CharacterSource>,
    /// 当前展示的形象ID
    current_appearance: Option<String>,
}

impl CharacterManager {
    /// 创建新的角色管理器（单路径设计）
    ///
    /// # Arguments
    /// * `data_dir` - 数据目录（`data/`）
    pub fn new(data_dir: PathBuf) -> Self {
        let characters_dir = data_dir.join("characters");

        // 确保目录存在
        fs::create_dir_all(&characters_dir).ok();

        Self {
            data_dir,
            characters_dir,
            characters: HashMap::new(),
            character_sources: HashMap::new(),
            current_appearance: None,
        }
    }

    /// 加载所有角色配置
    pub fn load_all(&mut self) -> Result<usize, DeepJellyError> {
        self.characters.clear();
        self.character_sources.clear();

        let dir = self.characters_dir.clone();
        println!("[CharacterManager] Loading characters from: {:?}", dir);
        println!("[CharacterManager] Directory exists: {}", dir.exists());

        let count = self.load_from_dir(&dir)?;
        println!("[CharacterManager] Loaded {} character(s)", count);

        Ok(count)
    }

    /// 从指定目录加载角色
    fn load_from_dir(&mut self, dir: &Path) -> Result<usize, DeepJellyError> {
        if !dir.exists() {
            println!("[CharacterManager] Directory does not exist: {:?}", dir);
            return Ok(0);
        }

        let mut count = 0;

        println!("[CharacterManager] About to call fs::read_dir on: {:?}", dir);
        let entries = fs::read_dir(dir)?;
        println!("[CharacterManager] fs::read_dir succeeded, iterating entries...");

        // Convert to vec to see total count
        let entry_vec: Vec<_> = entries.collect();
        println!("[CharacterManager] Total entries found: {}", entry_vec.len());

        for entry_result in entry_vec {
            let entry = match entry_result {
                Ok(e) => e,
                Err(e) => {
                    println!("[CharacterManager] Error reading entry: {}", e);
                    continue;
                }
            };

            let path = entry.path();
            println!("[CharacterManager] Found entry: {:?}", path);

            // 角色目录结构: {assistant_id}/{character_id}/config.json
            if path.is_dir() {
                println!("[CharacterManager] Entering directory: {:?}", path);
                // 检查是否是 assistant_id 目录
                match fs::read_dir(&path) {
                    Ok(assistant_entries) => {
                        println!("[CharacterManager] Subdirectory read succeeded");
                        for assistant_entry_result in assistant_entries {
                            let assistant_entry = match assistant_entry_result {
                                Ok(e) => e,
                                Err(e) => {
                                    println!("[CharacterManagement] Error reading sub-entry: {}", e);
                                    continue;
                                }
                            };

                            let character_path = assistant_entry.path();
                            println!("[CharacterManagement] Found character entry: {:?}", character_path);

                            if character_path.is_dir() {
                                let config_file = character_path.join("config.json");
                                println!("[CharacterManagement] Config file path: {:?}", config_file);
                                println!("[CharacterManagement] Config file exists: {}", config_file.exists());

                                if config_file.exists() {
                                    match self.load_config(&config_file) {
                                        Ok(config) => {
                                            let character_id = config.character_id.clone();
                                            let assistant_id = config.assistant_id.as_ref().map(|s| s.as_str()).unwrap_or("None");
                                            println!("[CharacterManagement] Successfully loaded config for: {} (assistant_id: {})", character_id, assistant_id);

                                            self.character_sources.insert(
                                                character_id.clone(),
                                                CharacterSource {
                                                    base_dir: character_path.clone(),
                                                }
                                            );

                                            self.characters.insert(character_id, config);
                                            count += 1;
                                        }
                                        Err(e) => {
                                            println!("[CharacterManagement] Failed to load config: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("[CharacterManagement] Failed to read subdirectory {:?}: {}", path, e);
                    }
                }
            } else {
                println!("[CharacterManagement] Entry is not a directory, skipping");
            }
        }

        println!("[CharacterManagement] Final count: {}", count);
        Ok(count)
    }

    /// 加载单个配置文件
    fn load_config(&self, path: &Path) -> Result<CharacterConfig, DeepJellyError> {
        let content = fs::read_to_string(path)?;
        let config: CharacterConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// 获取角色配置
    pub fn get_character(&self, character_id: &str) -> Option<&CharacterConfig> {
        self.characters.get(character_id)
    }

    /// 获取所有角色
    pub fn get_all_characters(&self) -> Vec<&CharacterConfig> {
        self.characters.values().collect()
    }

    /// 设置当前展示的形象
    pub fn set_current_appearance(&mut self, appearance_id: String) {
        self.current_appearance = Some(appearance_id);
    }

    /// 获取当前形象ID
    pub fn get_current_appearance(&self) -> Option<&String> {
        self.current_appearance.as_ref()
    }

    /// 获取资源文件路径
    ///
    /// 路径格式: `data/characters/{assistant_id}/{character_id}/{resource_name}`
    /// resource_name 可以包含路径分隔符，如 "action-key/0001.png"
    pub fn get_resource_path(&self, assistant_id: &str, character_id: &str, resource_name: &str) -> Option<PathBuf> {
        // 分割 resource_name 以支持多级路径（如 "action-key/0001.png"）
        let mut path = self.characters_dir
            .join(assistant_id)
            .join(character_id);

        // 逐级添加路径组件（处理 Unix 和 Windows 路径分隔符）
        for component in resource_name.split(['/', '\\']) {
            path = path.join(component);
        }

        if path.exists() {
            Some(path)
        } else {
            None
        }
    }

    /// 获取角色的基础目录
    pub fn get_character_base_dir(&self, character_id: &str) -> Option<PathBuf> {
        self.character_sources.get(character_id)
            .map(|source| source.base_dir.clone())
    }

    /// 检查角色是否存在
    pub fn is_user_defined(&self, character_id: &str) -> bool {
        self.character_sources.contains_key(character_id)
    }

    /// 获取数据目录
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /// 获取角色资源目录
    pub fn characters_dir(&self) -> &Path {
        &self.characters_dir
    }

    /// 添加角色配置
    pub fn add_character(&mut self, config: CharacterConfig) {
        let character_id = config.character_id.clone();
        self.characters.insert(character_id, config);
    }

    /// 移除角色配置
    pub fn remove_character(&mut self, character_id: &str) -> bool {
        self.characters.remove(character_id).is_some()
    }

    /// 保存角色配置到文件
    pub fn save_character(&self, character_id: &str) -> Result<(), DeepJellyError> {
        let config = self.get_character(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))?;

        let base_dir = self.get_character_base_dir(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("角色目录不存在: {}", character_id)))?;

        let config_file = base_dir.join("config.json");
        let content = serde_json::to_string_pretty(config)?;

        fs::write(&config_file, content)?;

        Ok(())
    }

    /// 更新角色名称和描述
    pub fn update_character(&mut self, character_id: &str, name: String, description: Option<String>) -> Result<(), DeepJellyError> {
        if let Some(config) = self.characters.get_mut(character_id) {
            config.name = name;
            config.description = description;
            self.save_character(character_id)?;
            Ok(())
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 更新形象名称和描述
    pub fn update_appearance(&mut self, character_id: &str, appearance_id: &str, name: String, description: Option<String>) -> Result<(), DeepJellyError> {
        if let Some(config) = self.characters.get_mut(character_id) {
            if let Some(appearance) = config.appearances.iter_mut().find(|a| a.id == appearance_id) {
                appearance.name = name;
                appearance.description = description;
                self.save_character(character_id)?;
                Ok(())
            } else {
                Err(DeepJellyError::NotFound(format!("形象不存在: {}", appearance_id)))
            }
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 添加动作到形象
    pub fn add_action(&mut self, character_id: &str, appearance_id: &str, action_key: String, resource: AnimationResource) -> Result<(), DeepJellyError> {
        // 先获取 base_dir，避免后续借用冲突
        let base_dir = self.get_character_base_dir(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("角色目录不存在: {}", character_id)))?;

        if let Some(config) = self.characters.get_mut(character_id) {
            if let Some(appearance) = config.appearances.iter_mut().find(|a| a.id == appearance_id) {
                // Create resource directory
                let resource_dir = base_dir.join(&action_key);
                fs::create_dir_all(&resource_dir)?;

                appearance.actions.insert(action_key, resource);
                self.save_character(character_id)?;
                Ok(())
            } else {
                Err(DeepJellyError::NotFound(format!("形象不存在: {}", appearance_id)))
            }
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 更新动作
    pub fn update_action(&mut self, character_id: &str, appearance_id: &str, old_key: &str, new_key: String, loop_value: Option<bool>, description: Option<String>) -> Result<(), DeepJellyError> {
        // 先获取 base_dir，避免后续借用冲突
        let base_dir_option = self.get_character_base_dir(character_id);
        let need_rename = old_key != new_key;

        if let Some(config) = self.characters.get_mut(character_id) {
            if let Some(appearance) = config.appearances.iter_mut().find(|a| a.id == appearance_id) {
                // Get the existing action resource
                let resource = appearance.actions.get(old_key)
                    .ok_or_else(|| DeepJellyError::NotFound(format!("动作不存在: {}", old_key)))?
                    .clone();

                // Remove old key
                appearance.actions.remove(old_key);

                // Update resource properties
                let mut updated_resource = resource;
                updated_resource.r#loop = loop_value;
                updated_resource.description = description;

                // Insert with new key
                appearance.actions.insert(new_key.clone(), updated_resource);

                // Rename resource directory if key changed
                if need_rename {
                    if let Some(base_dir) = base_dir_option {
                        let old_dir = base_dir.join(old_key);
                        let new_dir = base_dir.join(&new_key);

                        if old_dir.exists() {
                            fs::rename(&old_dir, &new_dir)?;
                        }
                    }
                }

                self.save_character(character_id)?;
                Ok(())
            } else {
                Err(DeepJellyError::NotFound(format!("形象不存在: {}", appearance_id)))
            }
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 删除动作
    pub fn delete_action(&mut self, character_id: &str, appearance_id: &str, action_key: &str) -> Result<(), DeepJellyError> {
        // 先获取 base_dir，避免后续借用冲突
        let base_dir = self.get_character_base_dir(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("角色目录不存在: {}", character_id)))?;
        let resource_dir = base_dir.join(action_key);

        if let Some(config) = self.characters.get_mut(character_id) {
            if let Some(appearance) = config.appearances.iter_mut().find(|a| a.id == appearance_id) {
                appearance.actions.remove(action_key);

                // Delete resource directory
                if resource_dir.exists() {
                    fs::remove_dir_all(&resource_dir)?;
                }

                self.save_character(character_id)?;
                Ok(())
            } else {
                Err(DeepJellyError::NotFound(format!("形象不存在: {}", appearance_id)))
            }
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 更新动作资源列表
    pub fn update_action_resources(&mut self, character_id: &str, appearance_id: &str, action_key: &str, resources: Vec<String>) -> Result<(), DeepJellyError> {
        if let Some(config) = self.characters.get_mut(character_id) {
            if let Some(appearance) = config.appearances.iter_mut().find(|a| a.id == appearance_id) {
                if let Some(resource) = appearance.actions.get_mut(action_key) {
                    resource.resources = resources;
                    self.save_character(character_id)?;
                    Ok(())
                } else {
                    Err(DeepJellyError::NotFound(format!("动作不存在: {}", action_key)))
                }
            } else {
                Err(DeepJellyError::NotFound(format!("形象不存在: {}", appearance_id)))
            }
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 删除单个动作资源文件
    pub fn remove_action_resource(&mut self, character_id: &str, appearance_id: &str, action_key: &str, resource_name: &str) -> Result<(), DeepJellyError> {
        // 先获取 base_dir 和 resource_path，避免后续借用冲突
        let base_dir_option = self.get_character_base_dir(character_id);
        let resource_path_option = base_dir_option.as_ref().map(|bd| bd.join(action_key).join(resource_name));

        if let Some(config) = self.characters.get_mut(character_id) {
            if let Some(appearance) = config.appearances.iter_mut().find(|a| a.id == appearance_id) {
                if let Some(resource) = appearance.actions.get_mut(action_key) {
                    // Remove from resource list
                    resource.resources.retain(|r| r != resource_name);

                    // Delete the file
                    if let Some(resource_path) = resource_path_option {
                        if resource_path.exists() {
                            fs::remove_file(&resource_path)?;
                        }
                    }

                    self.save_character(character_id)?;
                    Ok(())
                } else {
                    Err(DeepJellyError::NotFound(format!("动作不存在: {}", action_key)))
                }
            } else {
                Err(DeepJellyError::NotFound(format!("形象不存在: {}", appearance_id)))
            }
        } else {
            Err(DeepJellyError::NotFound(format!("角色不存在: {}", character_id)))
        }
    }

    /// 获取角色所属的 assistant_id
    pub fn get_character_assistant_id(&self, character_id: &str) -> Option<String> {
        self.characters.get(character_id)?.assistant_id.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_character_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = CharacterManager::new(temp_dir.path().to_path_buf());

        assert_eq!(manager.get_all_characters().len(), 0);
        assert!(manager.get_current_appearance().is_none());
    }

    #[test]
    fn test_set_current_appearance() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterManager::new(temp_dir.path().to_path_buf());

        manager.set_current_appearance("appr_001".to_string());
        assert_eq!(manager.get_current_appearance(), Some(&"appr_001".to_string()));
    }

    #[test]
    fn test_get_resource_path() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path().to_path_buf();

        // 创建测试资源
        let resource_dir = data_dir.join("characters/asst_001/char_001");
        fs::create_dir_all(&resource_dir).unwrap();
        fs::write(resource_dir.join("test.png"), "test").unwrap();

        let manager = CharacterManager::new(data_dir);

        let path = manager.get_resource_path("asst_001", "char_001", "test.png");
        assert!(path.is_some());
    }

    #[test]
    fn test_get_resource_path_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let manager = CharacterManager::new(temp_dir.path().to_path_buf());

        let path = manager.get_resource_path("asst_001", "char_001", "not_exist.png");
        assert!(path.is_none());
    }

    #[test]
    fn test_load_all_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterManager::new(temp_dir.path().to_path_buf());

        let count = manager.load_all().unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_load_character() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path().to_path_buf();

        // 创建角色配置
        let config_dir = data_dir.join("characters/asst_001/char_001");
        fs::create_dir_all(&config_dir).unwrap();

        let config = CharacterConfig {
            character_id: "char_001".to_string(),
            name: "测试角色".to_string(),
            description: None,
            appearances: vec![],
        };

        let config_file = config_dir.join("config.json");
        let content = serde_json::to_string_pretty(&config).unwrap();
        fs::write(&config_file, content).unwrap();

        let mut manager = CharacterManager::new(data_dir);
        let count = manager.load_all().unwrap();

        assert_eq!(count, 1);
        assert!(manager.get_character("char_001").is_some());
    }

    #[test]
    fn test_add_and_get_character() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterManager::new(temp_dir.path().to_path_buf());

        let config = CharacterConfig {
            character_id: "char_001".to_string(),
            name: "测试角色".to_string(),
            description: None,
            appearances: vec![],
        };

        manager.add_character(config);
        assert_eq!(manager.get_all_characters().len(), 1);
        assert!(manager.get_character("char_001").is_some());
    }

    #[test]
    fn test_remove_character() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = CharacterManager::new(temp_dir.path().to_path_buf());

        let config = CharacterConfig {
            character_id: "char_001".to_string(),
            name: "测试角色".to_string(),
            description: None,
            appearances: vec![],
        };

        manager.add_character(config);
        assert_eq!(manager.get_all_characters().len(), 1);

        let removed = manager.remove_character("char_001");
        assert!(removed);
        assert_eq!(manager.get_all_characters().len(), 0);

        let removed_again = manager.remove_character("char_001");
        assert!(!removed_again);
    }
}
