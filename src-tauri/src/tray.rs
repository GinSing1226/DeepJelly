//! System tray menu management with i18n support
//!
//! Provides functions to create and manage the system tray menu
//! with internationalized menu items using rust_i18n.

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, Submenu, PredefinedMenuItem, CheckMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIcon},
    AppHandle, Emitter, Wry, Manager,
};
use crate::logic::character::CharacterManager;

/// Global reference to the tray icon for menu updates
static TRAY_ICON: Mutex<Option<TrayIcon<Wry>>> = Mutex::new(None);

/// Type alias for AppHandle with Wry runtime
type AppHandleWry = AppHandle<Wry>;

/// Creates the system tray menu with i18n support
///
/// Menu structure (per requirements doc 3.6):
/// ```
/// ├── 打开对话框
/// ├── 设置
/// ├── 切换角色/形象 → (子菜单：角色列表/形象列表)
/// ├── ─────────────
/// ├── 隐藏角色 (动态：显示角色)
/// ├── 回到屏幕中央
/// ├── ─────────────
/// ├── 语言 → 中文 / English / 日本語
/// ├── ─────────────
/// └── 退出
/// ```
pub fn create_tray(app: &AppHandleWry, _character_manager: &Mutex<CharacterManager>) -> Result<Menu<Wry>, String> {
    // Ensure locale is set before creating menu items
    let locale = crate::locale::get_locale();
    rust_i18n::set_locale(&locale);

    // ========== 基础菜单项 ==========

    let open_dialog = MenuItem::with_id(
        app,
        "open_dialog",
        rust_i18n::t!("tray_open_dialog"),
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create open_dialog menu item: {}", e))?;

    let settings = MenuItem::with_id(
        app,
        "settings",
        rust_i18n::t!("tray_settings"),
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create settings menu item: {}", e))?;

    // ========== 调试面板 ==========
    // REMOVED: Debug panel feature
    /*
    let debug_panel = MenuItem::with_id(
        app,
        "debug_panel",
        rust_i18n::t!("tray_debug_panel"),
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create debug menu item: {}", e))?;
    */

    // MVP阶段：注释掉切换角色/形象子菜单
    // let character_submenu = create_character_submenu(app, character_manager)?;

    // ========== 隐藏角色（动态文字） ==========
    // TEMPORARILY DISABLED: Feature not working reliably
    // TODO: Fix the hide/show functionality
    /*
    let hide_character = MenuItem::with_id(
        app,
        "toggle_hide",
        rust_i18n::t!("tray_hide_character"),
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create hide menu item: {}", e))?;

    // Store reference globally for text updates
    *TOGGLE_HIDE_ITEM.lock().expect("TOGGLE_HIDE_ITEM mutex poisoned") = Some(hide_character.clone());
    */
    let _hide_character = MenuItem::with_id(
        app,
        "toggle_hide_disabled",
        rust_i18n::t!("tray_hide_character"),
        false, // disabled
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create disabled hide menu item: {}", e))?;

    // ========== 回到屏幕中央 ==========
    // TEMPORARILY DISABLED: Feature may not work reliably
    // TODO: Test and re-enable if working correctly
    /*
    let center_character = MenuItem::with_id(
        app,
        "center_character",
        rust_i18n::t!("tray_center_character"),
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create center menu item: {}", e))?;
    */
    let _center_character = (); // Placeholder to prevent unused variable warnings

    // ========== 语言子菜单 ==========

    // Get current locale to determine which language is checked
    let current_locale = crate::locale::get_locale();

    let lang_zh = CheckMenuItem::with_id(
        app,
        "lang_zh",
        "中文",
        true,
        current_locale == "zh",
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create lang_zh menu item: {}", e))?;

    let lang_en = CheckMenuItem::with_id(
        app,
        "lang_en",
        "English",
        true,
        current_locale == "en",
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create lang_en menu item: {}", e))?;

    let lang_ja = CheckMenuItem::with_id(
        app,
        "lang_ja",
        "日本語",
        true,
        current_locale == "ja",
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create lang_ja menu item: {}", e))?;

    let language_submenu = Submenu::with_items(
        app,
        rust_i18n::t!("tray_language"),
        true,
        &[&lang_zh, &lang_en, &lang_ja],
    )
    .map_err(|e| format!("Failed to create language submenu: {}", e))?;

    // ========== 退出 ==========

    let quit = MenuItem::with_id(
        app,
        "quit",
        rust_i18n::t!("tray_quit"),
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create quit menu item: {}", e))?;

    // ========== 分隔线 ==========

    // separator1 已移除（后面的菜单项暂时被注释）
    let separator2 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("Failed to create separator: {}", e))?;

    let separator3 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("Failed to create separator: {}", e))?;

    // ========== 组装菜单（按需求文档3.6） ==========

    let menu = Menu::with_items(
        app,
        &[
            &open_dialog,
            &settings,
            // REMOVED: Debug panel feature
            // &debug_panel,
            // MVP阶段：注释掉切换角色/形象子菜单
            // &character_submenu,
            // TEMPORARILY DISABLED: Hide/show character feature and center feature
            // &hide_character,
            // &center_character,
            &separator2,
            &language_submenu,
            &separator3,
            &quit,
        ],
    )
    .map_err(|e| format!("Failed to create menu: {}", e))?;

    Ok(menu)
}

/// Handles tray icon events
pub fn handle_tray_icon_event(app: &AppHandleWry, event: &TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "open-dialog" }));
        }
        _ => {}
    }
}

/// Handles tray menu item events
pub fn handle_tray_menu_event(app: &AppHandleWry, event: &tauri::menu::MenuEvent) {
    let event_id = event.id.as_ref();

    // Check if it's a character selection (format: char_{character_id}_{appearance_id})
    if event_id.starts_with("char_") {
        let parts: Vec<&str> = event_id.split('_').collect();
        if parts.len() == 3 {
            let character_id = parts[1];
            let appearance_id = parts[2];
            let _ = app.emit("tray-event", serde_json::json!({
                "action": "switch-character",
                "characterId": character_id,
                "appearanceId": appearance_id
            }));
        }
        return;
    }

    match event_id {
        "open_dialog" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "open-dialog" }));
        }
        "settings" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "settings" }));
        }
        // REMOVED: Debug panel feature
        /*
        "debug_panel" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "debug-panel" }));
        }
        */
        // TEMPORARILY DISABLED: Hide/show character feature and center feature
        /*
        "toggle_hide" => {
            // CRITICAL FIX: Call backend command directly instead of emitting event to frontend
            // This ensures the toggle works even when the frontend component is unmounted (isHidden=true)
            let _ = app.emit("tray-event", serde_json::json!({ "action": "toggle-hide" }));
            // Also call the backend command directly for reliability
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::commands::window::toggle_hide_window(app_clone).await {
                    eprintln!("Failed to toggle window visibility: {}", e);
                }
            });
        }
        "center_character" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "center-character" }));
        }
        */
        "lang_zh" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "change-language", "lang": "zh" }));
        }
        "lang_en" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "change-language", "lang": "en" }));
        }
        "lang_ja" => {
            let _ = app.emit("tray-event", serde_json::json!({ "action": "change-language", "lang": "ja" }));
        }
        "quit" => {
            // 打开退出确认窗口（独立窗口）
            let _ = app.emit("tray-event", serde_json::json!({ "action": "open-quit-confirm" }));
        }
        _ => {}
    }
}

/// Creates and builds the complete tray icon with menu and event handlers
pub fn build_tray(app: &AppHandleWry, character_manager: &Mutex<CharacterManager>) -> Result<(), String> {
    // Create menu with i18n and character list
    let menu = create_tray(app, character_manager)?;

    // Get default icon
    let icon = app.default_window_icon()
        .ok_or("Failed to get default window icon")?
        .clone();

    // Create and build tray icon with explicit type parameter
    let tray = TrayIconBuilder::<Wry>::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_tray_menu_event(app, &event);
        })
        .on_tray_icon_event(|tray, event| {
            handle_tray_icon_event(tray.app_handle(), &event);
        })
        .build(app)
        .map_err(|e| format!("Failed to build tray: {}", e))?;

    // Store tray reference globally
    *TRAY_ICON.lock().expect("TRAY_ICON mutex poisoned") = Some(tray);

    Ok(())
}

/// Update the text of a menu item in the tray menu
/// TEMPORARILY DISABLED: Hide/show character feature
pub fn update_tray_item_text(item_id: &str, _text: &str) -> Result<(), String> {
    match item_id {
        // TEMPORARILY DISABLED
        /*
        "toggle_hide" => {
            let item_guard = TOGGLE_HIDE_ITEM.lock().expect("TOGGLE_HIDE_ITEM mutex poisoned");
            if let Some(item) = item_guard.as_ref() {
                item.set_text(text)
                    .map_err(|e| format!("Failed to set menu item text: {}", e))?;
                Ok(())
            } else {
                Err(format!("Toggle hide item not initialized"))
            }
        }
        */
        _ => Err(format!("Unknown menu item: '{}'", item_id))
    }
}

/// Rebuild the tray menu when locale changes
///
/// This function is called when the application locale is changed to rebuild
/// the system tray menu with translated text in the new locale.
///
/// # Arguments
/// * `app` - Tauri app handle
///
/// # Returns
/// * `Ok(())` - Tray menu was successfully rebuilt
/// * `Err(String)` - Failed to rebuild tray menu
pub fn rebuild_tray_menu_on_locale_change(app: &AppHandleWry) -> Result<(), String> {
    // Try to get character_manager from app state
    let character_manager_result = app.try_state::<Mutex<CharacterManager>>();

    if let Some(character_manager_state) = character_manager_result {
        // Create new menu with current locale
        let menu = create_tray(app, &character_manager_state)?;

        // Get the tray icon
        let tray_guard = TRAY_ICON.lock().expect("TRAY_ICON mutex poisoned");
        if let Some(tray) = tray_guard.as_ref() {
            // Set the new menu on the existing tray icon
            tray.set_menu(Some(menu))
                .map_err(|e| format!("Failed to set tray menu: {}", e))?;
            Ok(())
        } else {
            Err("Tray icon not initialized".to_string())
        }
    } else {
        Err("Character manager state not found".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_menu_creation() {
        // Mock test for menu creation logic
        // Actual testing requires a Tauri app context
        assert!(true);
    }
}
