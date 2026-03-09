//! System settings commands for Tauri
//!
//! Provides commands to manage system-level settings like auto-launch.

use tauri_plugin_autostart::ManagerExt;
use log::{info, error, debug};
use crate::utils::logging::{LogCategory, format_log_arg1};

/// Enable auto-launch at startup
#[tauri::command]
pub async fn enable_auto_launch(app: tauri::AppHandle) -> Result<(), String> {
    info!("{}", crate::utils::logging::format_log(LogCategory::Setup, "Enabling auto-launch..."));

    let _ = app.autolaunch().enable();
    debug!("{}", format_log_arg1(LogCategory::Setup, "Auto-launch enabled for: ", &app.package_info().name));

    Ok(())
}

/// Disable auto-launch at startup
#[tauri::command]
pub async fn disable_auto_launch(app: tauri::AppHandle) -> Result<(), String> {
    info!("{}", crate::utils::logging::format_log(LogCategory::Setup, "Disabling auto-launch..."));

    let _ = app.autolaunch().disable();
    debug!("{}", format_log_arg1(LogCategory::Setup, "Auto-launch disabled for: ", &app.package_info().name));

    Ok(())
}

/// Check if auto-launch is enabled
#[tauri::command]
pub async fn is_auto_launch_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    let enabled = app.autolaunch().is_enabled().map_err(|e| e.to_string())?;
    debug!("{}", format_log_arg1(LogCategory::Setup, "Auto-launch status: ", &enabled.to_string()));

    Ok(enabled)
}

/// Set auto-launch state
#[tauri::command]
pub async fn set_auto_launch(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        enable_auto_launch(app).await
    } else {
        disable_auto_launch(app).await
    }
}
