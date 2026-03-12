//! Character configuration manager
//!
//! Manages loading, saving, and querying character configurations.
//! Uses assistant-grouped design: data stored in `data/characters/{assistant_id}/{character_id}/`.

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
    assistant_id: String,
}

/// 角色管理器
///
/// 助手分组设计：角色数据存储在 `data/characters/{assistant_id}/{character_id}/` 目录
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
    ///
    /// 助手分组架构: {assistant_id}/{character_id}/config.json
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

            // 新的目录结构: {assistant_id}/{character_id}/config.json
            if path.is_dir() {
                // 第一层是 assistant_id 目录
                let assistant_id = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // 递归扫描该助手下的角色目录
                count += self.load_characters_for_assistant(&path, &assistant_id)?;
            }
        }

        println!("[CharacterManager] Final count: {}", count);
        Ok(count)
    }

    /// 加载指定助手下的所有角色
    fn load_characters_for_assistant(&mut self, assistant_dir: &Path, assistant_id: &str) -> Result<usize, DeepJellyError> {
        if !assistant_dir.exists() {
            return Ok(0);
        }

        let mut count = 0;
        let entries = fs::read_dir(assistant_dir)?;

        for entry_result in entries {
            let entry = match entry_result {
                Ok(e) => e,
                Err(e) => {
                    println!("[CharacterManager] Error reading character entry: {}", e);
                    continue;
                }
            };

            let path = entry.path();
            println!("[CharacterManager] Found character entry: {:?}", path);

            // 第二层是 character_id 目录
            if path.is_dir() {
                let config_file = path.join("config.json");
                println!("[CharacterManager] Config file path: {:?}", config_file);
                println!("[CharacterManager] Config file exists: {}", config_file.exists());

                if config_file.exists() {
                    match self.load_config(&config_file) {
                        Ok(config) => {
                            let character_id = config.character_id.clone();
                            println!("[CharacterManager] Successfully loaded config for: {} (assistant_id: {})", character_id, assistant_id);

                            self.character_sources.insert(
                                character_id.clone(),
                                CharacterSource {
                                    base_dir: path.clone(),
                                    assistant_id: assistant_id.to_string(),
                                }
                            );

                            self.characters.insert(character_id, config);
                            count += 1;
                        }
                        Err(e) => {
                            println!("[CharacterManager] Failed to load config: {}", e);
                        }
                    }
                }
            }
        }

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

    /// 重新加载指定角色的配置
    ///
    /// 从文件重新读取角色配置，用于刷新场景
    pub fn reload_character(&mut self, character_id: &str) -> Result<CharacterConfig, DeepJellyError> {
        // 从 character_sources 获取 assistant_id 和 base_dir
        let source = self.character_sources.get(character_id)
            .ok_or_else(|| DeepJellyError::NotFound(format!("角色来源不存在: {}", character_id)))?;

        let config_path = source.base_dir.join("config.json");

        if !config_path.exists() {
            return Err(DeepJellyError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Character config not found: {:?}", config_path)
            )));
        }

        let config = self.load_config(&config_path)?;

        // 更新缓存
        self.characters.insert(character_id.to_string(), config.clone());

        println!("[CharacterManager] Reloaded character: {}", character_id);
        Ok(config)
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
    /// 助手分组架构路径格式: `data/characters/{assistant_id}/{character_id}/{resource_name}`
    /// resource_name 可以包含路径分隔符，如 "{appearance_id}/{action_key}/{frame_name}"
    pub fn get_resource_path(&self, assistant_id: &str, character_id: &str, resource_name: &str) -> Option<PathBuf> {
        // 新结构: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/{frame_name}
        let mut path = self.characters_dir.join(assistant_id).join(character_id);

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

    /// 获取角色所属的 assistant_id
    pub fn get_character_assistant_id(&self, character_id: &str) -> Option<&str> {
        self.character_sources.get(character_id)
            .map(|source| source.assistant_id.as_str())
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
                // Create resource directory: {base_dir}/{appearance_id}/{action_key}
                let resource_dir = base_dir.join(appearance_id).join(&action_key);
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
    pub fn update_action(&mut self, character_id: &str, appearance_id: &str, old_key: &str, new_key: String, fps: Option<Option<u32>>, loop_value: Option<bool>, description: Option<String>) -> Result<(), DeepJellyError> {
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
                if let Some(fps_value) = fps {
                    updated_resource.fps = fps_value;
                }
                if let Some(loop_val) = loop_value {
                    updated_resource.r#loop = Some(loop_val);
                }
                if let Some(desc) = description {
                    updated_resource.description = Some(desc);
                }

                // Insert with new key
                appearance.actions.insert(new_key.clone(), updated_resource);

                // Rename resource directory if key changed
                // 目录格式: {base_dir}/{appearance_id}/{action_key}
                if need_rename {
                    if let Some(base_dir) = base_dir_option {
                        let old_dir = base_dir.join(appearance_id).join(old_key);
                        let new_dir = base_dir.join(appearance_id).join(&new_key);

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
        // 资源目录格式: {base_dir}/{appearance_id}/{action_key}
        let resource_dir = base_dir.join(appearance_id).join(action_key);

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
        // 资源路径格式: {base_dir}/{appearance_id}/{action_key}/{resource_name}
        let resource_path_option = base_dir_option.as_ref().map(|bd| bd.join(appearance_id).join(action_key).join(resource_name));

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

        // 创建测试资源（新结构: characters/{assistant_id}/{character_id}/...）
        let resource_dir = data_dir.join("characters/asst_001/char_001/default/action-key");
        fs::create_dir_all(&resource_dir).unwrap();
        fs::write(resource_dir.join("test.png"), "test").unwrap();

        let manager = CharacterManager::new(data_dir);

        // 资源名称包含完整路径: {appearance_id}/{action_key}/{frame_name}
        let path = manager.get_resource_path("asst_001", "char_001", "default/action-key/test.png");
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

        // 创建角色配置（新结构: characters/{assistant_id}/{character_id}/config.json）
        let config_dir = data_dir.join("characters/asst_001/char_001");
        fs::create_dir_all(&config_dir).unwrap();

        let config = CharacterConfig {
            character_id: "char_001".to_string(),
            name: "测试角色".to_string(),
            description: None,
            assistant_id: Some("asst_001".to_string()),
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
            assistant_id: None,
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
            assistant_id: None,
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
