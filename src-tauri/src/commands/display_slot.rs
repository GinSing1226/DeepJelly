//! Display slot management commands
//!
//! Tauri commands for managing display slots (展示槽位) - character window configurations.

use crate::models::{DisplaySlot, DisplaySlotsData, Assistant, Character, CharacterReference};
use crate::logic::character::AssistantManager;
use crate::input_state::InputState;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, Theme};

/// Data directory state for display slot operations
pub type DataDirState = Mutex<PathBuf>;

/// Display slots configuration file name
const DISPLAY_SLOTS_FILE: &str = "display_slots.json";

/// Assistants configuration file name
const ASSISTANTS_FILE: &str = "assistants.json";

/// Window label prefix for character windows
const CHAR_WINDOW_PREFIX: &str = "char-window-";

// ============ Helper Functions ============

/// Load display slots data from file
fn load_display_slots_data(data_dir: &PathBuf) -> Result<DisplaySlotsData, String> {
    let config_path = data_dir.join(DISPLAY_SLOTS_FILE);

    // If file doesn't exist, return empty data
    if !config_path.exists() {
        return Ok(DisplaySlotsData::new());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))
}

/// Save display slots data to file
fn save_display_slots_data(data_dir: &PathBuf, data: &DisplaySlotsData) -> Result<(), String> {
    let config_path = data_dir.join(DISPLAY_SLOTS_FILE);
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    Ok(())
}

/// Load assistants data from file
fn load_assistants_data(data_dir: &PathBuf) -> Result<crate::models::AssistantsData, String> {
    let config_path = data_dir.join(ASSISTANTS_FILE);
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取助手配置失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析助手配置失败: {}", e))
}

/// Find an assistant by ID
fn find_assistant(data_dir: &PathBuf, assistant_id: &str) -> Result<Assistant, String> {
    let data = load_assistants_data(data_dir)?;
    data.find_assistant(assistant_id)
        .cloned()
        .ok_or_else(|| format!("助手 {} 不存在", assistant_id))
}

/// Find a character reference in an assistant
fn find_character_reference<'a>(assistant: &'a Assistant, character_id: &str) -> Result<&'a CharacterReference, String> {
    assistant.characters.iter()
        .find(|c| c.id == character_id)
        .ok_or_else(|| format!("角色 {} 不存在", character_id))
}

/// Get appearance name from character
fn get_appearance_name(character: &Character, appearance_id: &str) -> Result<String, String> {
    character.appearances.iter()
        .find(|a| a.id == appearance_id)
        .map(|a| a.name.clone())
        .ok_or_else(|| format!("形象 {} 不存在", appearance_id))
}

/// Check if an appearance exists in a character
fn has_appearance(character: &Character, appearance_id: &str) -> bool {
    character.appearances.iter().any(|a| a.id == appearance_id)
}

// ============ Commands ============

/// Get all display slots
///
/// Returns a list of all display slot configurations.
/// If include_primary is true, also returns a special slot for the main window.
#[tauri::command(rename_all = "camelCase")]
pub async fn get_display_slots(
    data_dir: State<'_, DataDirState>,
    assistant_manager: State<'_, crate::AssistantManagerState>,
    character_manager: State<'_, crate::CharacterManagerState>,
    include_primary: Option<bool>,
) -> Result<Vec<DisplaySlot>, String> {
    let dir = data_dir.lock()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let data = load_display_slots_data(&dir)?;

    let mut slots = data.slots;

    // Include primary slot (main window) if requested
    if include_primary.unwrap_or(false) {
        if let Some(primary_slot) = get_primary_slot(&dir, &assistant_manager, &character_manager)? {
            // Insert primary slot at the beginning
            slots.insert(0, primary_slot);
        }
    }

    Ok(slots)
}

/// Get the primary display slot (main window)
fn get_primary_slot(
    data_dir: &std::path::PathBuf,
    assistant_manager: &crate::AssistantManagerState,
    character_manager: &crate::CharacterManagerState,
) -> Result<Option<DisplaySlot>, String> {
    let asm_manager = assistant_manager.lock()
        .map_err(|e| format!("获取角色管理器失败: {}", e))?;
    let char_manager = character_manager.lock()
        .map_err(|e| format!("获取角色管理器失败: {}", e))?;

    // Try to get current appearance ID from old CharacterManager first
    let current_appearance_id = char_manager.get_current_appearance();

    let assistants_data = load_assistants_data(data_dir)?;

    // If current_appearance is set, use it to find the matching character/appearance
    if let Some(appearance_id) = current_appearance_id {
        println!("[get_primary_slot] Using current_appearance: {}", appearance_id);

        for assistant in &assistants_data.assistants {
            for char_ref in &assistant.characters {
                if let Some(character) = asm_manager.get_character(&char_ref.id) {
                    if let Some(appearance) = character.appearances.iter().find(|a| a.id.as_str() == appearance_id) {
                        return Ok(Some(DisplaySlot {
                            id: "__primary".to_string(),
                            assistant_id: assistant.id.clone(),
                            assistant_name: assistant.name.clone(),
                            character_id: character.id.clone(),
                            character_name: character.name.clone(),
                            appearance_id: appearance.id.clone(),
                            appearance_name: appearance.name.clone(),
                            window_id: Some("main".to_string()),
                            visible: true,
                            position: None,
                            created_at: None,
                        }));
                    }
                }
            }
        }
    }

    // Fallback: Use the first available assistant/character/appearance
    println!("[get_primary_slot] No current_appearance set, using fallback to first available character");

    for assistant in &assistants_data.assistants {
        if assistant.characters.is_empty() {
            continue;
        }

        for char_ref in &assistant.characters {
            if let Some(character) = asm_manager.get_character(&char_ref.id) {
                // Find default appearance or first appearance
                let appearance = character.appearances.iter()
                    .find(|a| a.is_default)
                    .or_else(|| character.appearances.first());

                if let Some(app) = appearance {
                    println!("[get_primary_slot] Using fallback: {}/{}/{}/{}",
                        assistant.id, character.id, app.id, app.name);

                    return Ok(Some(DisplaySlot {
                        id: "__primary".to_string(),
                        assistant_id: assistant.id.clone(),
                        assistant_name: assistant.name.clone(),
                        character_id: character.id.clone(),
                        character_name: character.name.clone(),
                        appearance_id: app.id.clone(),
                        appearance_name: app.name.clone(),
                        window_id: Some("main".to_string()),
                        visible: true,
                        position: None,
                        created_at: None,
                    }));
                }
            }
        }
    }

    println!("[get_primary_slot] No suitable character found for primary slot");
    Ok(None)
}

/// Add a new display slot
///
/// Creates a new display slot and opens a character window.
/// The same assistant can only be added once.
#[tauri::command(rename_all = "camelCase")]
pub async fn add_display_slot(
    assistant_id: String,
    character_id: String,
    appearance_id: String,
    app: AppHandle,
    data_dir: State<'_, DataDirState>,
    assistant_manager: State<'_, crate::AssistantManagerState>,
    input_state: State<'_, Arc<Mutex<InputState>>>,
) -> Result<DisplaySlot, String> {
    let dir = data_dir.lock()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let mut data = load_display_slots_data(&dir)?;

    // Check if assistant already exists (uniqueness constraint)
    if data.has_assistant(&assistant_id) {
        return Err(format!("该助手已在展示中: {}", assistant_id));
    }

    // Load assistant and character data
    let assistant = find_assistant(&dir, &assistant_id)?;

    // Get full character data from assistant_manager
    let manager = assistant_manager.lock()
        .map_err(|e| format!("获取角色管理器失败: {}", e))?;
    let character = manager.get_character(&character_id)
        .ok_or_else(|| format!("角色 {} 不存在", character_id))?;

    // Check if appearance exists
    if !has_appearance(&character, &appearance_id) {
        return Err(format!("形象不存在: {}", appearance_id));
    }

    // Create the display slot
    let slot_id = format!("slot_{}", crate::logic::character::generate_dj_id());
    let appearance_name = get_appearance_name(&character, &appearance_id)?;

    let slot = DisplaySlot {
        id: slot_id.clone(),
        assistant_id: assistant_id.clone(),
        assistant_name: assistant.name.clone(),
        character_id: character_id.clone(),
        character_name: character.name.clone(),
        appearance_id: appearance_id.clone(),
        appearance_name,
        window_id: None,
        visible: true,
        position: None,
        created_at: Some(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64),
    };

    // Add to data
    data.add_slot(slot.clone());
    save_display_slots_data(&dir, &data)?;

    // Create the character window (use slot count as index for positioning)
    let slot_index = data.slots.len() - 1;
    let window_id = create_character_window(&app, &slot, slot_index, &input_state)?;
    update_slot_window_id(&dir, &slot_id, &window_id)?;

    Ok(slot)
}

/// Update an existing display slot
///
/// Updates the display slot configuration and refreshes the window.
#[tauri::command(rename_all = "camelCase")]
pub async fn update_display_slot(
    slot_id: String,
    assistant_id: String,
    character_id: String,
    appearance_id: String,
    app: AppHandle,
    data_dir: State<'_, DataDirState>,
    assistant_manager: State<'_, crate::AssistantManagerState>,
    input_state: State<'_, Arc<Mutex<InputState>>>,
) -> Result<(), String> {
    let dir = data_dir.lock()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let mut data = load_display_slots_data(&dir)?;

    // Find the slot
    let slot = data.find_slot(&slot_id)
        .ok_or_else(|| format!("槽位不存在: {}", slot_id))?;

    // Check if the new assistant is different and already exists
    if slot.assistant_id != assistant_id && data.has_assistant(&assistant_id) {
        return Err(format!("该助手已在展示中: {}", assistant_id));
    }

    // Load assistant and character data
    let assistant = find_assistant(&dir, &assistant_id)?;

    // Get full character data from assistant_manager
    let manager = assistant_manager.lock()
        .map_err(|e| format!("获取角色管理器失败: {}", e))?;
    let character = manager.get_character(&character_id)
        .ok_or_else(|| format!("角色 {} 不存在", character_id))?;

    // Check if appearance exists
    if !has_appearance(&character, &appearance_id) {
        return Err(format!("形象不存在: {}", appearance_id));
    }

    let appearance_name = get_appearance_name(&character, &appearance_id)?;

    // Close old window if exists
    if let Some(ref window_id) = slot.window_id {
        close_character_window(&app, window_id, &input_state);
    }

    // Update the slot
    let slot_index = data.slots.iter()
        .position(|s| s.id == slot_id)
        .ok_or_else(|| format!("槽位不存在: {}", slot_id))?;

    data.slots[slot_index].assistant_id = assistant_id.clone();
    data.slots[slot_index].assistant_name = assistant.name.clone();
    data.slots[slot_index].character_id = character_id.clone();
    data.slots[slot_index].character_name = character.name.clone();
    data.slots[slot_index].appearance_id = appearance_id.clone();
    data.slots[slot_index].appearance_name = appearance_name.clone();
    data.slots[slot_index].window_id = None;

    save_display_slots_data(&dir, &data)?;

    // Create new window
    let updated_slot = &data.slots[slot_index];
    let window_id = create_character_window(&app, updated_slot, slot_index, &input_state)?;
    update_slot_window_id(&dir, &slot_id, &window_id)?;

    Ok(())
}

/// Delete a display slot
///
/// Removes the display slot and closes the associated window.
#[tauri::command(rename_all = "camelCase")]
pub async fn delete_display_slot(
    slot_id: String,
    app: AppHandle,
    data_dir: State<'_, DataDirState>,
    input_state: State<'_, Arc<Mutex<InputState>>>,
) -> Result<(), String> {
    let dir = data_dir.lock()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let mut data = load_display_slots_data(&dir)?;

    // Find the slot before removing
    let slot = data.find_slot(&slot_id)
        .ok_or_else(|| format!("槽位不存在: {}", slot_id))?;

    // Close the window if exists
    if let Some(ref window_id) = slot.window_id {
        close_character_window(&app, window_id, &input_state);
    }

    // Remove the slot
    data.remove_slot(&slot_id);
    save_display_slots_data(&dir, &data)?;

    Ok(())
}

/// Set display slot visibility
///
/// Shows or hides the character window for the given slot.
#[tauri::command(rename_all = "camelCase")]
pub async fn set_slot_visibility(
    slot_id: String,
    visible: bool,
    app: AppHandle,
    data_dir: State<'_, DataDirState>,
) -> Result<(), String> {
    let dir = data_dir.lock()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let mut data = load_display_slots_data(&dir)?;

    // Find the slot
    let slot = data.slots.iter_mut()
        .find(|s| s.id == slot_id)
        .ok_or_else(|| format!("槽位不存在: {}", slot_id))?;

    // Update visibility
    slot.visible = visible;

    // Show/hide the window
    if let Some(ref window_id) = slot.window_id {
        if let Some(window) = app.get_webview_window(window_id) {
            if visible {
                window.show()
                    .map_err(|e| format!("显示窗口失败: {}", e))?;
                window.set_focus()
                    .map_err(|e| format!("聚焦窗口失败: {}", e))?;
            } else {
                window.hide()
                    .map_err(|e| format!("隐藏窗口失败: {}", e))?;
            }
        }
    }

    save_display_slots_data(&dir, &data)?;

    Ok(())
}

// ============ Window Management Functions ============

/// Create a character window for the given display slot
///
/// This function is public so it can be called during app startup
/// to restore display slot windows.
pub fn create_character_window(
    app: &AppHandle,
    slot: &DisplaySlot,
    slot_index: usize,
    input_state: &Arc<Mutex<InputState>>,
) -> Result<String, String> {
    let window_id = format!("{}{}", CHAR_WINDOW_PREFIX, slot.id);

    // Check if window already exists
    if app.get_webview_window(&window_id).is_some() {
        return Ok(window_id);
    }

    // Create the window - 500x500 like the main character window
    let mut builder = WebviewWindowBuilder::new(
        app,
        window_id.clone(),
        WebviewUrl::App("index.html".into())
    )
    .title(&format!("{} - {}", slot.assistant_name, slot.character_name))
    .inner_size(500.0, 500.0)
    .min_inner_size(200.0, 200.0)
    .max_inner_size(800.0, 800.0)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(true)
    // 修复 Windows release 打包后背景不透明问题：使用 dark 主题避免 WebView2 显示白色背景
    .theme(Some(Theme::Dark));

    // Use saved position if available, otherwise position with offset
    if let Some(pos) = &slot.position {
        // Restore saved position (convert i32 to f64)
        builder = builder.position(pos.x as f64, pos.y as f64);
        println!("[display_slot] Restoring window '{}' to saved position: ({}, {})", window_id, pos.x, pos.y);
    } else {
        // Calculate offset position based on slot index to avoid overlap
        // Default: centered with offset (each window offset by 100px)
        let offset = (slot_index as i32) * 100;
        builder = builder.center();
        // Note: Tauri doesn't support relative positioning directly,
        // so we rely on the frontend to emit position events that we save
        println!("[display_slot] Creating window '{}' centered (will be repositioned by frontend)", window_id);
    }

    let _window = builder
    .build()
    .map_err(|e| format!("创建窗口失败: {}", e))?;

    println!("[display_slot] Window created successfully: {}", window_id);

    // Register window for passthrough mode support
    input_state.lock()
        .map_err(|e| format!("获取 InputState 失败: {}", e))?
        .registered_windows
        .push(window_id.clone());
    println!("[display_slot] Registered window '{}' for passthrough mode", window_id);

    // Clone necessary data for the delayed event
    let window_id_for_event = window_id.clone();
    let app_handle = app.clone();
    let event_payload = serde_json::json!({
        "slotId": slot.id,
        "assistantId": slot.assistant_id,
        "characterId": slot.character_id,
        "appearanceId": slot.appearance_id,
    });

    println!("[display_slot] Spawning thread to send character:load event after 1500ms delay");

    // Spawn a thread to delay the event emission
    // This gives the frontend window time to initialize and set up event listeners
    std::thread::spawn(move || {
        println!("[display_slot] Thread started, waiting 1500ms...");
        std::thread::sleep(std::time::Duration::from_millis(1500));
        println!("[display_slot] Delay complete, sending character:load event to window '{}': {:?}", window_id_for_event, event_payload);
        match app_handle.emit("character:load", event_payload) {
            Ok(_) => println!("[display_slot] Event sent successfully"),
            Err(e) => println!("[display_slot] Failed to send event: {:?}", e),
        }
    });

    println!("[display_slot] Thread spawned, returning window_id: {}", window_id);

    Ok(window_id)
}

/// Close a character window
fn close_character_window(app: &AppHandle, window_id: &str, input_state: &Arc<Mutex<InputState>>) {
    // Unregister window from passthrough mode
    input_state.lock()
        .ok()
        .and_then(|mut state| {
            if let Some(pos) = state.registered_windows.iter().position(|w| w == window_id) {
                state.registered_windows.remove(pos);
                println!("[display_slot] Unregistered window '{}' from passthrough mode", window_id);
            }
            Some(())
        });

    if let Some(window) = app.get_webview_window(window_id) {
        let _ = window.close();
    }
}

/// Update the window_id for a slot
///
/// This function is public so it can be called during app startup
/// to update window IDs for restored windows.
pub fn update_slot_window_id(
    data_dir: &PathBuf,
    slot_id: &str,
    window_id: &str,
) -> Result<(), String> {
    let mut data = load_display_slots_data(data_dir)?;

    if let Some(slot) = data.slots.iter_mut().find(|s| s.id == slot_id) {
        slot.window_id = Some(window_id.to_string());
        save_display_slots_data(data_dir, &data)?;
        Ok(())
    } else {
        Err(format!("槽位不存在: {}", slot_id))
    }
}

/// Update the window position for a slot
///
/// Called when the user moves a character window.
#[tauri::command(rename_all = "camelCase")]
pub async fn update_slot_position(
    slot_id: String,
    x: i32,
    y: i32,
    data_dir: State<'_, DataDirState>,
) -> Result<(), String> {
    let dir = data_dir.lock()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let mut data = load_display_slots_data(&dir)?;

    if let Some(slot) = data.slots.iter_mut().find(|s| s.id == slot_id) {
        use crate::models::integration::Position;
        slot.position = Some(Position { x, y });
        save_display_slots_data(&dir, &data)?;
        println!("[display_slot] Updated position for slot {}: ({}, {})", slot_id, x, y);
        Ok(())
    } else {
        Err(format!("槽位不存在: {}", slot_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Create a test data directory with sample files
    fn create_test_data_dir() -> TempDir {
        let temp_dir = TempDir::new().unwrap();

        // Create a sample assistants.json
        let assistant = Assistant {
            id: "ast_001".to_string(),
            name: "测试助手".to_string(),
            description: Some("测试用助手".to_string()),
            created_at: Some(1234567890000),
            characters: vec![
                Character {
                    id: "char_001".to_string(),
                    assistant_id: "ast_001".to_string(),
                    name: "程序员".to_string(),
                    description: Some("程序员角色".to_string()),
                    appearances: vec![
                        crate::models::Appearance {
                            id: "appr_001".to_string(),
                            name: "默认形象".to_string(),
                            description: None,
                            is_default: true,
                            actions: HashMap::new(),
                        }
                    ],
                    default_appearance_id: Some("appr_001".to_string()),
                }
            ],
            app_type: Some("openclaw".to_string()),
            agent_label: Some("test".to_string()),
        };

        let assistants_data = crate::models::AssistantsData {
            version: "1.0".to_string(),
            assistants: vec![assistant],
        };

        let content = serde_json::to_string_pretty(&assistants_data).unwrap();
        fs::write(temp_dir.path().join(ASSISTANTS_FILE), content).unwrap();

        temp_dir
    }

    #[test]
    fn test_load_display_slots_data_empty() {
        let temp_dir = TempDir::new().unwrap();
        let result = load_display_slots_data(&temp_dir.path().to_path_buf());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().slots.len(), 0);
    }

    #[test]
    fn test_save_and_load_display_slots_data() {
        let temp_dir = TempDir::new().unwrap();

        let mut data = DisplaySlotsData::new();
        let slot = DisplaySlot::new(
            "slot_001".to_string(),
            "ast_001".to_string(),
            "测试助手".to_string(),
            "char_001".to_string(),
            "程序员".to_string(),
            "appr_001".to_string(),
            "默认形象".to_string(),
        );
        data.add_slot(slot);

        let result = save_display_slots_data(&temp_dir.path().to_path_buf(), &data);
        assert!(result.is_ok());

        let loaded_data = load_display_slots_data(&temp_dir.path().to_path_buf()).unwrap();
        assert_eq!(loaded_data.slots.len(), 1);
        assert_eq!(loaded_data.slots[0].id, "slot_001");
    }

    #[test]
    fn test_has_assistant() {
        let temp_dir = TempDir::new().unwrap();

        let mut data = DisplaySlotsData::new();
        let slot = DisplaySlot::new(
            "slot_001".to_string(),
            "ast_001".to_string(),
            "测试助手".to_string(),
            "char_001".to_string(),
            "程序员".to_string(),
            "appr_001".to_string(),
            "默认形象".to_string(),
        );
        data.add_slot(slot);

        assert!(data.has_assistant("ast_001"));
        assert!(!data.has_assistant("ast_002"));
    }

    #[tokio::test]
    async fn test_get_display_slots_empty() {
        let temp_dir = TempDir::new().unwrap();
        let state = Mutex::new(temp_dir.path().to_path_buf());

        let result = get_display_slots(&state).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_add_display_slot_duplicate_assistant() {
        let temp_dir = create_test_data_dir();
        let state = Mutex::new(temp_dir.path().to_path_buf());

        // Mock app handle - this will fail in tests but we can verify the logic
        let app_handle = tauri::test::mock_app_handle(tauri::test::NoopRuntime);

        // First add should succeed (but will fail to create window in test)
        let result1 = add_display_slot(
            "ast_001".to_string(),
            "char_001".to_string(),
            "appr_001".to_string(),
            app_handle.clone(),
            &state,
        ).await;

        // Due to window creation failure in test, we just verify the assistant uniqueness check
        // by checking the slots directly
        let slots = get_display_slots(&state).await.unwrap();
        if !slots.is_empty() {
            // If first add succeeded, second should fail due to duplicate assistant
            let result2 = add_display_slot(
                "ast_001".to_string(),
                "char_001".to_string(),
                "appr_001".to_string(),
                app_handle,
                &state,
            ).await;
            assert!(result2.is_err());
            assert!(result2.unwrap_err().contains("已在展示中"));
        }
    }
}
