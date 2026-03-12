//! Window management commands for Tauri
//!
//! Provides commands to create and manage dialog window, settings window, and quit confirm window.

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use log::{info, error, debug};
use crate::utils::logging::{LogCategory, format_log, format_log_arg1};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};

// 🔒 全局标志：防止引导窗口被多次创建
static ONBOARDING_WINDOW_CREATING: AtomicBool = AtomicBool::new(false);

// 🔒 全局标志：防止退出确认窗口被多次创建
static QUIT_CONFIRM_WINDOW_CREATING: AtomicBool = AtomicBool::new(false);

/// Dialog window label
pub const DIALOG_WINDOW_LABEL: &str = "dialog";

/// Settings window label
pub const SETTINGS_WINDOW_LABEL: &str = "settings";

/// Quit confirm window label
pub const QUIT_CONFIRM_WINDOW_LABEL: &str = "quit-confirm";

// REMOVED: Debug panel feature
/*
/// Debug panel window label
pub const DEBUG_PANEL_WINDOW_LABEL: &str = "debug-panel";
*/

/// Onboarding window label
pub const ONBOARDING_WINDOW_LABEL: &str = "onboarding";

/// Open or focus the settings window
#[tauri::command]
pub async fn open_settings_window(app: AppHandle, tab: Option<String>) -> Result<(), String> {
    info!("{}", format_log(LogCategory::Window, "open_settings_window called"));

    let tab_for_later = tab.clone();

    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        info!("{}", format_log(LogCategory::Window, "Settings window already exists"));

        // Window already exists - emit event immediately (listener is already set up)
        if let Some(ref tab_name) = tab {
            info!("{}", format_log_arg1(LogCategory::Window, "Emitting settings:open-tab event with tab: ", tab_name));
            let result = app.emit("settings:open-tab", tab_name.clone());
            if let Err(e) = result {
                println!("[open_settings_window] Failed to emit event: {}", e);
            } else {
                println!("[open_settings_window] Successfully emitted settings:open-tab with tab: {}", tab_name);
            }
        }

        window
            .set_focus()
            .map_err(|e| format!("Failed to focus settings window: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show settings window: {}", e))?;
        window
            .unminimize()
            .map_err(|e| format!("Failed to unminimize settings window: {}", e))?;
        info!("{}", format_log(LogCategory::Window, "Settings window focused"));
        return Ok(());
    }

    // Create new window
    let _window = WebviewWindowBuilder::new(
        &app,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::default(),
    )
    .title("DeepJelly - Settings")
    .inner_size(1200.0, 800.0)
    .min_inner_size(1000.0, 700.0)
    .resizable(true)
    .decorations(false)  // Use custom title bar with programmatic drag (smooth)
    .transparent(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .center()
    .build()
    .map_err(|e| {
        error!("{}", format_log_arg1(LogCategory::Window, "Failed to create settings window: ", &e.to_string()));
        format!("Failed to create settings window: {}", e)
    })?;

    info!("{}", format_log(LogCategory::Window, "Settings window created"));

    // For newly created windows, delay the tab event to allow frontend to initialize listeners
    if let Some(tab_name) = tab_for_later {
        info!("{}", format_log_arg1(LogCategory::Window, "Scheduling delayed settings:open-tab event with tab: ", &tab_name));
        let app_clone = app.clone();
        tokio::spawn(async move {
            // Wait for frontend to initialize (500ms should be enough)
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            info!("{}", format_log_arg1(LogCategory::Window, "Emitting delayed settings:open-tab event with tab: ", &tab_name));
            let _ = app_clone.emit("settings:open-tab", tab_name);
        });
    }

    Ok(())
}

/// Close the settings window
#[tauri::command]
pub async fn close_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        let close_start = std::time::Instant::now();

        window
            .close()
            .map_err(|e| {
                error!("{}", format_log_arg1(LogCategory::Window, "Failed to close settings window: ", &e.to_string()));
                format!("Failed to close settings window: {}", e)
            })?;

        debug!("{}", format_log(LogCategory::Window, &format!("Window close took {:?}", close_start.elapsed())));
    }

    Ok(())
}

/// Check if settings window is open
#[tauri::command]
pub async fn is_settings_window_open(app: AppHandle) -> bool {
    app.get_webview_window(SETTINGS_WINDOW_LABEL).is_some()
}

/// Open or focus the dialog window
#[tauri::command]
pub async fn open_dialog_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DIALOG_WINDOW_LABEL) {
        debug!("{}", format_log(LogCategory::Window, "Dialog window already exists"));
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus dialog window: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show dialog window: {}", e))?;
        window
            .unminimize()
            .map_err(|e| format!("Failed to unminimize dialog window: {}", e))?;
        info!("{}", format_log(LogCategory::Window, "Dialog window focused"));
        return Ok(());
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        DIALOG_WINDOW_LABEL,
        WebviewUrl::default(),
    )
    .title("DeepJelly - Dialog")
    .inner_size(900.0, 700.0)
    .min_inner_size(600.0, 500.0)
    .resizable(true)
    .decorations(false)  // Use custom title bar with programmatic drag (smooth)
    .transparent(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .center()
    .build()
    .map_err(|e| {
        error!("{}", format_log_arg1(LogCategory::Window, "Failed to create dialog window: ", &e.to_string()));
        format!("Failed to create dialog window: {}", e)
    })?;

    info!("{}", format_log(LogCategory::Window, "Dialog window created"));
    Ok(())
}

/// Close the dialog window
#[tauri::command]
pub async fn close_dialog_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DIALOG_WINDOW_LABEL) {
        window
            .close()
            .map_err(|e| {
                error!("{}", format_log_arg1(LogCategory::Window, "Failed to close dialog window: ", &e.to_string()));
                format!("Failed to close dialog window: {}", e)
            })?;
    }

    Ok(())
}

/// Minimize the dialog window
#[tauri::command]
pub async fn minimize_dialog_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DIALOG_WINDOW_LABEL) {
        window
            .minimize()
            .map_err(|e| format!("Failed to minimize dialog window: {}", e))?;
    }
    Ok(())
}

/// Check if dialog window is open
#[tauri::command]
pub async fn is_dialog_window_open(app: AppHandle) -> bool {
    app.get_webview_window(DIALOG_WINDOW_LABEL).is_some()
}

/// Open or focus the quit confirm window
#[tauri::command]
pub async fn open_quit_confirm_window(app: AppHandle) -> Result<(), String> {
    // 如果窗口已存在，聚焦并返回
    if let Some(window) = app.get_webview_window(QUIT_CONFIRM_WINDOW_LABEL) {
        debug!("{}", format_log(LogCategory::Window, "Quit confirm window already exists"));
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus quit confirm window: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show quit confirm window: {}", e))?;
        window
            .unminimize()
            .map_err(|e| format!("Failed to unminimize quit confirm window: {}", e))?;
        info!("{}", format_log(LogCategory::Window, "Quit confirm window focused"));
        return Ok(());
    }

    // 🔒 防止并发创建：使用原子操作设置标志
    if QUIT_CONFIRM_WINDOW_CREATING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        // 如果设置失败，说明已经有另一个线程在创建窗口
        debug!("{}", format_log(LogCategory::Window, "Quit confirm window is already being created, skipping"));
        return Ok(());
    }

    // 创建窗口
    let result = WebviewWindowBuilder::new(
        &app,
        QUIT_CONFIRM_WINDOW_LABEL,
        WebviewUrl::default(),
    )
    .title("DeepJelly")
    .inner_size(400.0, 260.0)
    .resizable(false)
    .decorations(false)  // Use custom title bar with programmatic drag (smooth)
    .transparent(true)   // Allow transparent background for clean dialog look
    .always_on_top(true)
    .skip_taskbar(false)
    .center()
    .build();

    // 🔒 创建完成后重置标志
    QUIT_CONFIRM_WINDOW_CREATING.store(false, Ordering::SeqCst);

    let _window = result.map_err(|e| {
        error!("{}", format_log_arg1(LogCategory::Window, "Failed to create quit confirm window: ", &e.to_string()));
        format!("Failed to create quit confirm window: {}", e)
    })?;

    info!("{}", format_log(LogCategory::Window, "Quit confirm window created"));
    Ok(())
}

/// Close the quit confirm window
#[tauri::command]
pub async fn close_quit_confirm_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(QUIT_CONFIRM_WINDOW_LABEL) {
        window
            .close()
            .map_err(|e| format!("Failed to close quit confirm window: {}", e))?;
    }

    Ok(())
}

/// Confirm and execute application quit
#[tauri::command]
pub async fn confirm_quit(app: AppHandle) -> Result<(), String> {
    // Close the quit confirm window first
    if let Some(window) = app.get_webview_window(QUIT_CONFIRM_WINDOW_LABEL) {
        window
            .close()
            .map_err(|e| format!("Failed to close quit confirm window: {}", e))?;
    }

    // Give the window time to close gracefully
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Exit the application with code 0 (success)
    std::process::exit(0);
}

// REMOVED: Debug panel feature
/*
/// Open or focus the debug panel window
#[tauri::command]
pub async fn open_debug_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DEBUG_PANEL_WINDOW_LABEL) {
        debug!("{}", format_log(LogCategory::Window, "Debug panel window already exists"));
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus debug panel window: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show debug panel window: {}", e))?;
        window
            .unminimize()
            .map_err(|e| format!("Failed to unminimize debug panel window: {}", e))?;
        info!("{}", format_log(LogCategory::Window, "Debug panel window focused"));
        return Ok(());
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        DEBUG_PANEL_WINDOW_LABEL,
        WebviewUrl::default(),
    )
    .title("DeepJelly - Debug Panel")
    .inner_size(500.0, 600.0)
    .min_inner_size(450.0, 500.0)
    .resizable(true)
    .decorations(false)
    .transparent(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .center()
    .build()
    .map_err(|e| {
        error!("{}", format_log_arg1(LogCategory::Window, "Failed to create debug panel window: ", &e.to_string()));
        format!("Failed to create debug panel window: {}", e)
    })?;

    info!("{}", format_log(LogCategory::Window, "Debug panel window created"));
    Ok(())
}

/// Close the debug panel window
#[tauri::command]
pub async fn close_debug_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DEBUG_PANEL_WINDOW_LABEL) {
        window
            .close()
            .map_err(|e| format!("Failed to close debug panel window: {}", e))?;
    }

    Ok(())
}
*/

/// Update the text of a tray menu item
#[tauri::command]
pub async fn update_tray_item_text(item_id: String, text: String) -> Result<(), String> {
    crate::tray::update_tray_item_text(&item_id, &text)
}

/// Hide all application windows
#[tauri::command]
pub async fn hide_all_windows(app: AppHandle) -> Result<(), String> {
    // REMOVED: Debug panel feature
    let labels = ["main", DIALOG_WINDOW_LABEL, SETTINGS_WINDOW_LABEL, /* DEBUG_PANEL_WINDOW_LABEL, */ QUIT_CONFIRM_WINDOW_LABEL];
    for label in labels {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.hide();
        }
    }

    // Update tray menu item text to "Show Character"
    if let Err(e) = crate::tray::update_tray_item_text("toggle_hide", &rust_i18n::t!("tray_show_character")) {
        error!("{}", format_log_arg1(LogCategory::Window, "Failed to update tray item text: ", &e.to_string()));
    }

    Ok(())
}

/// Show main window
#[tauri::command]
pub async fn show_main_window(app: AppHandle) -> Result<(), String> {
    // CRITICAL FIX: Reset penetration mode state BEFORE showing window
    // This prevents the window from being shown with passthrough still enabled
    if let Some(input_state) = app.try_state::<Arc<Mutex<crate::input_state::InputState>>>() {
        if let Ok(mut state) = input_state.lock() {
            debug!("{}", format_log(LogCategory::Window, "Resetting penetration mode state"));
            state.passthrough_enabled = false;
            state.ctrl_from_frontend = false;
            state.ctrl_left = false;
            state.ctrl_right = false;
            state.mark_state_changed();
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        // Check if window is already visible to avoid redundant operations
        if window.is_visible().unwrap_or(false) {
            debug!("{}", format_log(LogCategory::Window, "Window already visible, just focusing"));
            let _ = window.set_focus();
            // Still emit event to ensure state is synced
            let _ = app.emit("window-shown", ());
            return Ok(());
        }

        match window.show() {
            Ok(_) => {}
            Err(e) => error!("{}", format_log_arg1(LogCategory::Window, "Failed to show window: ", &e.to_string())),
        }
        match window.set_focus() {
            Ok(_) => {}
            Err(e) => error!("{}", format_log_arg1(LogCategory::Window, "Failed to focus window: ", &e.to_string())),
        }

        // CRITICAL FIX: Reset penetration mode when showing window
        // This ensures the window is in a consistent state and can receive mouse events
        let _ = window.set_ignore_cursor_events(false);

        // Update tray menu item text to "Hide Character"
        if let Err(e) = crate::tray::update_tray_item_text("toggle_hide", &rust_i18n::t!("tray_hide_character")) {
            error!("{}", format_log_arg1(LogCategory::Window, "Failed to update tray item text: ", &e.to_string()));
        }

        // Emit event to notify frontend to reset isHidden state
        if let Err(e) = app.emit("window-shown", ()) {
            error!("{}", format_log_arg1(LogCategory::Window, "Failed to emit event: ", &e.to_string()));
        }
    }
    Ok(())
}

/// Toggle main window visibility
/// This command checks the current window state and shows/hides accordingly
/// It works even when the frontend component is unmounted (isHidden=true)
#[tauri::command]
pub async fn toggle_hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            // Window is visible, hide it
            debug!("{}", format_log(LogCategory::Window, "Toggle: Hiding main window"));
            let _ = window.hide();

            // Update tray menu item text to "Show Character"
            if let Err(e) = crate::tray::update_tray_item_text("toggle_hide", &rust_i18n::t!("tray_show_character")) {
                error!("{}", format_log_arg1(LogCategory::Window, "Failed to update tray item text: ", &e.to_string()));
            }

            // Emit event to notify frontend
            let _ = app.emit("window-hidden", ());
        } else {
            // Window is hidden, show it
            debug!("{}", format_log(LogCategory::Window, "Toggle: Showing main window"));

            // Reset penetration mode state before showing
            if let Some(input_state) = app.try_state::<Arc<Mutex<crate::input_state::InputState>>>() {
                if let Ok(mut state) = input_state.lock() {
                    debug!("{}", format_log(LogCategory::Window, "Resetting penetration mode state"));
                    state.passthrough_enabled = false;
                    state.ctrl_from_frontend = false;
                    state.ctrl_left = false;
                    state.ctrl_right = false;
                    state.mark_state_changed();
                }
            }

            match window.show() {
                Ok(_) => {}
                Err(e) => error!("{}", format_log_arg1(LogCategory::Window, "Failed to show window: ", &e.to_string())),
            }
            match window.set_focus() {
                Ok(_) => {}
                Err(e) => error!("{}", format_log_arg1(LogCategory::Window, "Failed to focus window: ", &e.to_string())),
            }

            // Reset penetration mode when showing window
            let _ = window.set_ignore_cursor_events(false);

            // Update tray menu item text to "Hide Character"
            if let Err(e) = crate::tray::update_tray_item_text("toggle_hide", &rust_i18n::t!("tray_hide_character")) {
                error!("{}", format_log_arg1(LogCategory::Window, "Failed to update tray item text: ", &e.to_string()));
            }

            // Emit event to notify frontend
            let _ = app.emit("window-shown", ());
        }
    }
    Ok(())
}

/// Open or focus the onboarding window
/// Optional edit_integration_id parameter for editing existing integration
#[tauri::command]
pub async fn open_onboarding_window(
    app: AppHandle,
    edit_integration_id: Option<String>,
) -> Result<(), String> {
    // 🔒 首先检查窗口是否已存在
    if let Some(window) = app.get_webview_window(ONBOARDING_WINDOW_LABEL) {
        debug!("{}", format_log(LogCategory::Window, "Onboarding window already exists"));
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus onboarding window: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show onboarding window: {}", e))?;
        window
            .unminimize()
            .map_err(|e| format!("Failed to unminimize onboarding window: {}", e))?;

        // Emit event to notify frontend about edit mode
        if let Some(ref id) = edit_integration_id {
            let _ = app.emit("onboarding:edit-mode", id);
        }
        return Ok(());
    }

    // 🔒 检查是否正在创建窗口（防止竞态条件）
    if ONBOARDING_WINDOW_CREATING.swap(true, Ordering::SeqCst) {
        debug!("{}", format_log(LogCategory::Window, "Onboarding window creation already in progress"));
        return Ok(()); // 另一个调用已经在创建窗口了
    }

    debug!("{}", format_log(LogCategory::Window, "Starting onboarding window creation"));

    // Build URL with edit_integration_id as query parameter for new windows
    let url = if let Some(ref id) = edit_integration_id {
        format!("onboarding.html?edit={}", id)
    } else {
        "onboarding.html".to_string()
    };

    let result = WebviewWindowBuilder::new(
        &app,
        ONBOARDING_WINDOW_LABEL,
        WebviewUrl::App(url.into()),
    )
    .title("DeepJelly - Integration Guide")
    .inner_size(900.0, 700.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .decorations(false)
    .transparent(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .center()
    .build();

    // 🔒 重置创建标志（无论成功或失败）
    ONBOARDING_WINDOW_CREATING.store(false, Ordering::SeqCst);

    result.map_err(|e| {
        error!("{}", format_log_arg1(LogCategory::Window, "Failed to create onboarding window: ", &e.to_string()));
        format!("Failed to create onboarding window: {}", e)
    })?;

    info!("{}", format_log(LogCategory::Window, "Onboarding window created successfully"));
    Ok(())
}

/// Close the onboarding window
#[tauri::command]
pub async fn close_onboarding_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(ONBOARDING_WINDOW_LABEL) {
        window
            .close()
            .map_err(|e| {
                error!("{}", format_log_arg1(LogCategory::Window, "Failed to close onboarding window: ", &e.to_string()));
                format!("Failed to close onboarding window: {}", e)
            })?;
    }
    Ok(())
}
