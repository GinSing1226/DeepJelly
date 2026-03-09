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
#[tauri::command]
pub fn get_all_assistants(
    manager: State<'_, AssistantManagerState>,
) -> Result<Vec<Assistant>, String> {
    let manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;
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
/// Creates a new assistant with an auto-generated ID.
#[tauri::command]
pub fn create_assistant(
    name: String,
    description: Option<String>,
    app_type: String,
    agent_label: Option<String>,
    manager: State<'_, AssistantManagerState>,
) -> Result<Assistant, String> {
    let mut manager = manager.lock().map_err(|e| format!("获取锁失败: {}", e))?;

    let id = generate_dj_id();
    let assistant = Assistant {
        id: id.clone(),
        name,
        description,
        app_type,
        agent_label,
        integrations: Vec::new(),
        bound_agent_id: None,
        session_key: None,
        created_at: None,
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

        let assistant = get_assistant("asst_assistant".to_string(), &state).unwrap();
        assert!(assistant.is_some());
        // ID is randomly generated, so we skip this assertion
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

        // Empty agent_id should be stored as None
        assert_eq!(new_assistant.agent_label, None);
    }

    #[test]
    fn test_update_assistant() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let updates = UpdatedAssistant {
            name: Some("更新后的助手".to_string()),
            description: Some("更新后的描述".to_string()),
            app_type: None,
            agent_label: None,
        };

        update_assistant("asst_assistant".to_string(), updates, &state).unwrap();

        let assistant = get_assistant("asst_assistant".to_string(), &state).unwrap().unwrap();
        assert_eq!(assistant.name, "更新后的助手");
        assert_eq!(assistant.description, Some("更新后的描述".to_string()));
    }

    #[test]
    fn test_delete_assistant() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let result = delete_assistant("asst_assistant".to_string(), &state).unwrap();
        assert!(result);

        let assistants = get_all_assistants(&state).unwrap();
        assert_eq!(assistants.len(), 0);
    }

    #[test]
    fn test_get_characters_dir() {
        let manager = create_test_manager();
        let state = Mutex::new(manager);

        let path = get_characters_dir(&state).unwrap();
        assert!(path.contains("characters"));
    }
}
