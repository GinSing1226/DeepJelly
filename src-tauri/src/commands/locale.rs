//! Locale management commands for Tauri
//!
//! Provides commands to get and set the application locale.

use crate::locale::{get_locale as get_locale_inner, set_locale_with_config as set_locale_inner};
use log::{info, error, debug};
use crate::utils::logging::{LogCategory, format_log_arg1};
use tauri::{AppHandle, Manager};

/// Get the current application locale
#[tauri::command]
pub async fn get_locale() -> String {
    let locale = get_locale_inner();
    debug!("{}", format_log_arg1(LogCategory::Locale, "Current locale: ", &locale));
    locale
}

/// Set the application locale
#[tauri::command]
pub async fn set_locale(locale: String, app: AppHandle) -> Result<(), String> {
    info!("{}", format_log_arg1(LogCategory::Locale, "Setting locale to: ", &locale));

    // Use the same data directory path as lib.rs for consistency
    // Windows: %APPDATA%\DeepJelly\data
    let data_dir = if cfg!(target_os = "windows") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            std::path::PathBuf::from(appdata).join("DeepJelly").join("data")
        } else {
            // Fallback
            app.path().app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .join("data")
        }
    } else {
        app.path().app_data_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join("data")
    };

    let config_path = data_dir.join("language.json");

    // Set locale and persist to config file
    set_locale_inner(&locale, &config_path).map_err(|e| {
        error!("{}", format_log_arg1(LogCategory::Locale, "Failed to set locale: ", &e));
        e
    })?;

    info!("{}", format_log_arg1(LogCategory::Locale, "Locale set successfully: ", &locale));

    // Rebuild the tray menu with the new locale
    if let Err(e) = crate::tray::rebuild_tray_menu_on_locale_change(&app) {
        error!("{}", format_log_arg1(LogCategory::Locale, "Failed to rebuild tray menu: ", &e));
        // Don't fail the command if tray rebuild fails, just log the error
    }

    Ok(())
}
