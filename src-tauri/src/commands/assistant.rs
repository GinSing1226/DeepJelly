//! Assistant management commands
//!
//! Tauri commands for managing assistant configurations.

use crate::logic::character::{Assistant, AssistantManager, UpdatedAssistant, generate_dj_id};
use std::sync::Mutex;
use tauri::State;

/// Assistant manager state type
pub type AssistantManagerState = Mutex<AssistantManager>;

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

    fn create_test_manager() -> AssistantManager {
        let temp_dir = TempDir::new().unwrap();
        AssistantManager::new(temp_dir.path().to_path_buf()).unwrap()
    }

    #[test]
    fn test_get_all_assistants() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let assistants = get_all_assistants(&state).unwrap();
        assert_eq!(assistants.len(), 1);
    }

    #[test]
    fn test_get_assistant() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let first_id = {
            let manager_inner = state.lock().unwrap();
            manager_inner.get_all()[0].id.clone()
        };

        let assistant = get_assistant(first_id, &state).unwrap();
        assert!(assistant.is_some());
    }

    #[test]
    fn test_create_assistant() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let new_assistant = create_assistant(
            "测试助手".to_string(),
            Some("测试描述".to_string()),
            "openclaw".to_string(),
            Some("agent_001".to_string()),
            &state,
        ).unwrap();

        assert!(new_assistant.id.starts_with("dj_"));
        assert_eq!(new_assistant.name, "测试助手");

        // Verify it was added
        let assistants = get_all_assistants(&state).unwrap();
        assert_eq!(assistants.len(), 2);
    }

    #[test]
    fn test_create_assistant_with_empty_agent_label() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let new_assistant = create_assistant(
            "测试助手".to_string(),
            None,
            "openclaw".to_string(),
            Some("".to_string()), // Empty agent_label
            &state,
        ).unwrap();

        // Empty agent_label should be stored as Some("") in the new model
        // The normalization happens in the old logic, but let's verify
        assert_eq!(new_assistant.agent_label, Some("".to_string()));
    }

    #[test]
    fn test_update_assistant() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let first_id = {
            let manager_inner = state.lock().unwrap();
            manager_inner.get_all()[0].id.clone()
        };

        let updates = UpdatedAssistant {
            name: Some("更新后的助手".to_string()),
            description: Some("更新后的描述".to_string()),
            app_type: None,
            agent_label: None,
        };

        update_assistant(first_id.clone(), updates, &state).unwrap();

        let assistant = get_assistant(first_id, &state).unwrap().unwrap();
        assert_eq!(assistant.name, "更新后的助手");
        assert_eq!(assistant.description, Some("更新后的描述".to_string()));
    }

    #[test]
    fn test_delete_assistant() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        // First add an empty assistant to test deletion
        let new_assistant = create_assistant(
            "临时助手".to_string(),
            None,
            "openclaw".to_string(),
            None,
            &state,
        ).unwrap();

        let result = delete_assistant(new_assistant.id.clone(), &state).unwrap();
        assert!(result);

        let assistants = get_all_assistants(&state).unwrap();
        // Should have 1 assistant left (the default one)
        assert_eq!(assistants.len(), 1);
    }

    #[test]
    fn test_get_characters_dir() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let path = get_characters_dir(&state).unwrap();
        assert!(path.contains("characters"));
    }
}
