//! Assistant management commands
//!
//! Tauri commands for managing assistant configurations.

use crate::logic::character::{Assistant, AssistantManager, UpdatedAssistant, generate_dj_id};
use std::sync::{Arc, Mutex};
use tauri::State;

/// Assistant manager state type
/// Use Arc<Mutex<>> to allow cloning State for use in spawn_blocking
pub type AssistantManagerState = Arc<Mutex<AssistantManager>>;

/// Get all assistants
///
/// Returns a list of all assistant configurations.
/// Always reloads from disk to ensure fresh data.
#[tauri::command]
pub fn get_all_assistants(
    manager: State<'_, AssistantManagerState>,
) -> Result<Vec<Assistant>, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    // Reload from disk to get latest data
    manager.load().map_err(|e| format!("加载助手数据失败: {}", e))?;
    Ok(manager.get_all())
}

/// Get a specific assistant by ID
///
/// Returns the assistant configuration if found.
#[tauri::command]
pub fn get_assistant(
    id: String,
    manager: State<'_, AssistantManagerState>,
) -> Result<Option<Assistant>, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(manager.get(&id).cloned())
}

/// Create a new assistant
///
/// Creates a new assistant. ID is optional - if not provided, will be auto-generated.
#[tauri::command]
pub fn create_assistant(
    id: Option<String>,
    name: String,
    description: Option<String>,
    app_type: Option<String>,
    agent_label: Option<String>,
    bound_agent_id: Option<String>,
    session_key: Option<String>,
    integrations: Option<Vec<crate::logic::character::assistant::Integration>>,
    manager: State<'_, AssistantManagerState>,
) -> Result<Assistant, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    // Use provided ID or generate one
    let final_id = if let Some(custom_id) = id {
        if !custom_id.trim().is_empty() {
            // Validate custom ID format: 3-50 chars, alphanumeric, underscore, hyphen
            let id_regex = regex::Regex::new(r"^[a-zA-Z0-9_-]{3,50}$")
                .map_err(|e| format!("ID验证正则错误: {}", e))?;
            if !id_regex.is_match(&custom_id) {
                return Err("ID格式不正确，请使用3-50位字母、数字、下划线或连字符".to_string());
            }
            custom_id
        } else {
            generate_dj_id()
        }
    } else {
        generate_dj_id()
    };

    let assistant = Assistant {
        id: final_id.clone(),
        name,
        description,
        created_at: None,
        characters: vec![],
        app_type,
        agent_label,
        bound_agent_id,
        session_key,
        integrations,
    };

    manager.add(assistant.clone())?;
    Ok(assistant)
}

/// Update an existing assistant
///
/// Updates the assistant with the given ID.
#[tauri::command]
pub fn update_assistant(
    id: String,
    updates: UpdatedAssistant,
    manager: State<'_, AssistantManagerState>,
) -> Result<(), String> {
    println!("[update_assistant] CALLED with id={}, updates={:?}", id, updates);
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    println!("[update_assistant] Got lock, calling manager.update...");
    let result = manager.update(&id, updates)
        .map_err(|e| {
            println!("[update_assistant] UPDATE FAILED: {}", e);
            format!("更新助手失败: {}", e)
        });
    println!("[update_assistant] UPDATE SUCCESS");
    result
}

/// Delete an assistant
///
/// Deletes the assistant with the given ID.
#[tauri::command]
pub fn delete_assistant(
    id: String,
    manager: State<'_, AssistantManagerState>,
) -> Result<bool, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    manager.delete(&id)
        .map_err(|e| format!("删除助手失败: {}", e))
}

/// Get characters directory path
///
/// Returns the base directory for character resources.
#[tauri::command]
pub fn get_characters_dir(
    manager: State<'_, AssistantManagerState>,
) -> Result<String, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(manager.characters_dir()
        .to_string_lossy()
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::sync::Arc;

    fn create_test_manager() -> AssistantManager {
        let temp_dir = TempDir::new().unwrap();
        AssistantManager::new(temp_dir.path().to_path_buf()).unwrap()
    }

    fn create_test_state() -> Arc<Mutex<AssistantManager>> {
        Arc::new(Mutex::new(create_test_manager()))
    }

    #[test]
    fn test_get_all_assistants() {
        let state = create_test_state();
        let manager = state.lock().unwrap();
        let assistants = manager.get_all();
        assert_eq!(assistants.len(), 1);
    }

    #[test]
    fn test_get_assistant() {
        let state = create_test_state();
        let first_id = {
            let manager = state.lock().unwrap();
            manager.get_all()[0].id.clone()
        };

        let manager = state.lock().unwrap();
        let assistant = manager.get(&first_id);
        assert!(assistant.is_some());
    }

    #[test]
    fn test_create_assistant() {
        let state = create_test_state();

        let new_assistant = Assistant {
            id: "dj_test1234567".to_string(),
            name: "测试助手".to_string(),
            description: Some("测试描述".to_string()),
            created_at: None,
            characters: vec![],
            app_type: Some("openclaw".to_string()),
            agent_label: Some("agent_001".to_string()),
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        let mut manager = state.lock().unwrap();
        manager.add(new_assistant).unwrap();
        let assistants = manager.get_all();
        assert_eq!(assistants.len(), 2);

        let new_assistant = assistants.iter().find(|a| a.id == "dj_test1234567").unwrap();
        assert!(new_assistant.id.starts_with("dj_"));
        assert_eq!(new_assistant.name, "测试助手");
    }

    #[test]
    fn test_create_assistant_with_empty_agent_label() {
        let state = create_test_state();

        let new_assistant = Assistant {
            id: "dj_test_empty_label".to_string(),
            name: "测试助手".to_string(),
            description: None,
            created_at: None,
            characters: vec![],
            app_type: Some("openclaw".to_string()),
            agent_label: Some("".to_string()), // Empty agent_label
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        let mut manager = state.lock().unwrap();
        manager.add(new_assistant).unwrap();

        let assistants = manager.get_all();
        let new_assistant = assistants.iter().find(|a| a.id == "dj_test_empty_label").unwrap();
        // Empty agent_label should be stored as Some("")
        assert_eq!(new_assistant.agent_label, Some("".to_string()));
    }

    #[test]
    fn test_update_assistant() {
        let state = create_test_state();
        let first_id = {
            let manager = state.lock().unwrap();
            manager.get_all()[0].id.clone()
        };

        let updates = UpdatedAssistant {
            name: Some("更新后的助手".to_string()),
            description: Some("更新后的描述".to_string()),
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        let mut manager = state.lock().unwrap();
        manager.update(&first_id, updates).unwrap();

        let assistant = manager.get(&first_id).unwrap();
        assert_eq!(assistant.name, "更新后的助手");
        assert_eq!(assistant.description, Some("更新后的描述".to_string()));
    }

    #[test]
    fn test_delete_assistant() {
        let state = create_test_state();
        let temp_assistant = Assistant {
            id: "dj_temp_delete".to_string(),
            name: "临时助手".to_string(),
            description: None,
            created_at: None,
            characters: vec![],
            app_type: None,
            agent_label: None,
            bound_agent_id: None,
            session_key: None,
            integrations: None,
        };

        let mut manager = state.lock().unwrap();
        manager.add(temp_assistant).unwrap();
        let result = manager.delete("dj_temp_delete").unwrap();
        assert!(result);

        let assistants = manager.get_all();
        // Should have 1 assistant left (the default one)
        assert_eq!(assistants.len(), 1);
    }

    #[test]
    fn test_get_characters_dir() {
        let state = create_test_state();
        let manager = state.lock().unwrap();
        let path = manager.characters_dir();
        assert!(path.to_string_lossy().contains("characters"));
    }
}
