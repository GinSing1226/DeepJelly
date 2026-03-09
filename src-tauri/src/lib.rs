//! DeepJelly - Desktop Virtual Assistant
//!
//! A Tauri-based desktop pet application with AI assistant capabilities.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Load i18n translations
// Path is relative to Cargo.toml (src-tauri/), so "i18n" points to src-tauri/i18n/
rust_i18n::i18n!("i18n");

// Module declarations
mod brain;
mod commands;
mod logic;
mod tray;
mod input_state;
mod locale;
mod utils;

use std::sync::{Arc, Mutex};
use std::fs;
use tauri::{Manager, Emitter};
use log::{info, error};
use crate::utils::logging::{format_log, format_log_arg1};

// Re-exports for use in other modules
pub use brain::{AdapterClient, Assistant as BrainAssistant, BrainAdapterConfig, BrainAdapterSettings};
pub use commands::app_integration::{AppIntegrationManagerState};
pub use commands::assistant::{AssistantManagerState, get_all_assistants, get_assistant, create_assistant, update_assistant, delete_assistant, get_characters_dir};
pub use commands::character::{CharacterManagerState, get_all_characters, get_character, set_current_appearance, get_current_appearance, get_available_animations,
    update_character, update_appearance, add_action, update_action, delete_action, update_action_resources, remove_action_resource, add_action_resources};
pub use logic::{
    AppConfig, BrainConfig, CharacterAppConfig, ConfigManager, GatewayConfig, ReactionConfig,
    AnimationActionId, AnimationCategory, AnimationCommand, AnimationDomain,
    AnimationResource, Appearance, AppearanceConfig, Character,
    CharacterConfig, ResourceType, ChatType, Session, SessionManager,
    Event, EventAction, EventScene, EventState, EventTarget, EventTime,
    MatchedRule, ProcessedEvent, process_event, validate_event,
    BehaviorCommand, BubbleContent, BehaviorMentalPayload, CapActor,
    CapMessage, CapMessageType, CapPayload, ChatDelta, ChatMessage,
    EventPayload, NotificationPayload, SessionPayload,
    BubbleCommand, BubblePosition, BubbleType, Condition, ConditionOperator,
    EventMatcher, PresentationResponse, ResponseAction, Rule, RuleResponse, RuleTrigger, System1,
    MessageRouter, RouteTarget, RoutedMessage,
    AppState, ConnectionStatus, SharedState,
    character::{CharacterManager, Assistant as CharacterAssistant, AssistantManager, UpdatedAssistant},
};
pub use utils::{DeepJellyError, Result, LogCategory};

/// Recursively copy a directory from source to destination
fn copy_dir_recursive(source: &std::path::Path, destination: &std::path::Path) -> std::io::Result<()> {
    if !source.exists() {
        return Ok(());
    }

    // Create destination directory
    fs::create_dir_all(destination)?;

    // Iterate through entries in source directory
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dest_path = destination.join(entry.file_name());

        if ty.is_dir() {
            // Recursively copy subdirectory
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            // Copy file
            fs::copy(&src_path, &dest_path)?;
        }
    }
    Ok(())
}

/// Application entry point called by main.rs
pub fn run() {
    // Initialize logger with INFO level for deepjelly modules
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    // Build and run the Tauri application
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            info!("{}", format_log(LogCategory::Setup, "Application starting..."));

            // ========== Initialize Locale ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing locale..."));
            let locale = locale::get_locale();
            rust_i18n::set_locale(&locale);
            info!("{}", format_log_arg1(LogCategory::Setup, "Locale set to: ", &locale));

            // ========== Initialize Data Directories ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing data directories..."));

            // We need TWO directories:
            // 1. resource_data_dir: for bundled read-only resources (characters, defaults)
            // 2. local_data_dir: for writable user data (configs, saved state)

            let (resource_data_dir, local_data_dir, is_portable_mode) = if cfg!(debug_assertions) {
                // Development mode: use ../data for both
                info!("{}", format_log(LogCategory::Setup, "Development mode detected, using ../data"));
                let data_path = std::path::PathBuf::from("../data");
                fs::create_dir_all(&data_path)
                    .map_err(|e| format!("Failed to create data directory: {}", e))?;
                let resolved = data_path.canonicalize()
                    .map_err(|e| format!("Failed to resolve data directory: {}", e))?;
                info!("{}", format_log_arg1(LogCategory::Setup, "Data directory resolved to: ", &resolved.display().to_string()));
                (resolved.clone(), resolved, false)  // debug mode is not portable
            } else {
                // Production mode: separate read-only resources and writable data
                info!("{}", format_log(LogCategory::Setup, "Production mode detected"));

                // For read-only bundled resources (characters, etc.)
                let resource_dir = app.path().resource_dir()
                    .map_err(|e| format!("Failed to get resource dir: {}", e))?;

                info!("{}", format_log_arg1(LogCategory::Setup, "Resource dir from Tauri: ", &resource_dir.display().to_string()));

                // Note: resource_dir may contain '_up_' folder (Tauri update temp directory)
                // In that case, the bundled resources are actually inside the _up_ folder
                // We keep the path as-is since resources are there
                let resource_dir_str = resource_dir.to_string_lossy().to_string();
                if resource_dir_str.contains("_up_") {
                    info!("{}", format_log(LogCategory::Setup, "Resource path contains _up_ folder, resources should be inside it"));
                }

                let resource_data = resource_dir.join("data");
                info!("{}", format_log_arg1(LogCategory::Setup, "Resource data dir: ", &resource_data.display().to_string()));
                info!("{}", format_log_arg1(LogCategory::Setup, "Resource data exists: ", &resource_data.exists().to_string()));

                // For writable user data (configs, etc.)
                // Use custom path: %APPDATA%\DeepJelly\data on Windows
                let local_data_path = if cfg!(target_os = "windows") {
                    // Windows: %APPDATA%\DeepJelly\data
                    if let Ok(appdata) = std::env::var("APPDATA") {
                        std::path::PathBuf::from(appdata).join("DeepJelly").join("data")
                    } else {
                        // Fallback to Tauri's default
                        let local_data = app.path().app_local_data_dir()
                            .unwrap_or_else(|_| std::path::PathBuf::from("."));
                        local_data.join("data")
                    }
                } else {
                    // Non-Windows: use Tauri's default
                    let local_data = app.path().app_local_data_dir()
                        .unwrap_or_else(|_| std::path::PathBuf::from("."));
                    local_data.join("data")
                };
                fs::create_dir_all(&local_data_path)
                    .map_err(|e| format!("Failed to create local data directory: {}", e))?;
                let resolved_local = local_data_path.canonicalize()
                    .map_err(|e| format!("Failed to resolve local data directory: {}", e))?;
                info!("{}", format_log_arg1(LogCategory::Setup, "Local data dir: ", &resolved_local.display().to_string()));

                // For portable builds, ALWAYS prefer data folder next to exe first
                // This handles both portable builds and NSIS installer bugs
                let (resource_data_dir, is_portable_mode) = if let Ok(exe_path) = std::env::current_exe() {
                    if let Some(exe_dir) = exe_path.parent() {
                        let portable_data = exe_dir.join("data");
                        if portable_data.exists() {
                            // Portable build detected - use data next to exe
                            (portable_data, true)
                        } else {
                            // Not a portable build, use Tauri's resource_dir
                            (resource_data, false)
                        }
                    } else {
                        (resource_data, false)
                    }
                } else {
                    (resource_data, false)
                };

                (resource_data_dir, resolved_local, is_portable_mode)
            };

            // In portable mode, use portable data dir directly for everything
            // In normal mode, use local_data_dir (with copy from resources during first run)
            let data_dir = if is_portable_mode {
                resource_data_dir.clone()
            } else {
                local_data_dir.clone()
            };

            // Skip initialization copy in portable mode - resources are already there
            // Only do initialization in normal (installed) mode
            if !cfg!(debug_assertions) && !is_portable_mode {
                // Copy characters directory if it doesn't exist
                let local_characters_dir = local_data_dir.join("characters");
                if !local_characters_dir.exists() {
                    let resource_characters_dir = resource_data_dir.join("characters");
                    if resource_characters_dir.exists() {
                        info!("{}", format_log(LogCategory::Setup, "Copying bundled characters to local data directory"));
                        if let Err(e) = copy_dir_recursive(&resource_characters_dir, &local_characters_dir) {
                            error!("{}", format_log_arg1(LogCategory::Setup, "Failed to copy characters directory: ", &e.to_string()));
                        }
                    }
                }

                // Copy default configs if they don't exist
                let assistants_config = local_data_dir.join("assistants.json");
                if !assistants_config.exists() {
                    let resource_assistants = resource_data_dir.join("assistants.default.json");
                    if resource_assistants.exists() {
                        let _ = fs::copy(&resource_assistants, &assistants_config);
                    }
                }

                let app_integrations_config = local_data_dir.join("app_integrations.json");
                if !app_integrations_config.exists() {
                    let resource_integrations = resource_data_dir.join("app_integrations.default.json");
                    if resource_integrations.exists() {
                        let _ = fs::copy(&resource_integrations, &app_integrations_config);
                    }
                }

                let language_config = local_data_dir.join("language.json");
                if !language_config.exists() {
                    let resource_language = resource_data_dir.join("language.json");
                    if resource_language.exists() {
                        let _ = fs::copy(&resource_language, &language_config);
                    }
                }
            }

            // ========== Load Locale from Config ==========
            // Now that data directory is available, try to load saved locale
            let config_path = data_dir.join("language.json");

            // If config doesn't exist, copy from project data directory for initialization
            if !config_path.exists() {
                let project_data_path = std::path::PathBuf::from("../data/language.json");
                if project_data_path.exists() {
                    if let Ok(_) = fs::copy(&project_data_path, &config_path) {
                        info!("{}", format_log(LogCategory::Setup, "Initialized language.json from project data"));
                    }
                }
            }

            if config_path.exists() {
                if let Ok(content) = fs::read_to_string(&config_path) {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(locale_value) = value.get("locale").and_then(|v| v.as_str()) {
                            if ["zh", "en", "ja"].contains(&locale_value) {
                                info!("{}", format_log_arg1(LogCategory::Locale, "Loaded locale from config: ", locale_value));
                                // Update both rust_i18n and the in-memory state
                                rust_i18n::set_locale(locale_value);
                                let _ = locale::set_locale(locale_value);
                            }
                        }
                    }
                }
            }

            // ========== Initialize Assistant Manager ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing assistant manager..."));
            let assistant_manager = match logic::character::AssistantManager::new(data_dir.clone()) {
                Ok(m) => {
                    info!("{}", format_log_arg1(LogCategory::Setup, "Loaded assistants: ", &m.get_all().len().to_string()));
                    m
                }
                Err(e) => {
                    error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize assistant manager: ", &e.to_string()));
                    // Try to recover by backing up and recreating
                    let config_path = data_dir.join("assistants.json");
                    if config_path.exists() {
                        let backup_path = data_dir.join("assistants.json.backup");
                        info!("{}", format_log(LogCategory::Setup, "Backing up corrupted assistants.json"));
                        std::fs::rename(&config_path, &backup_path).ok();
                    }
                    // Retry with fresh config
                    logic::character::AssistantManager::new(data_dir.clone()).expect("Failed to create assistant manager after recovery")
                }
            };
            let assistant_manager_state: AssistantManagerState = Mutex::new(assistant_manager);

            // ========== Initialize Character Manager ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing character manager..."));
            let mut character_manager = CharacterManager::new(
                data_dir.clone(),  // Use unified data directory
            );

            // Load all character configurations
            if let Err(e) = character_manager.load_all() {
                error!("{}", format_log_arg1(LogCategory::Setup, "Failed to load characters: ", &e.to_string()));
            } else {
                info!("{}", format_log_arg1(LogCategory::Setup, "Loaded characters: ", &character_manager.get_all_characters().len().to_string()));
            }

            let character_manager_state: CharacterManagerState = Mutex::new(character_manager);

            // ========== Initialize App Integration Manager ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing app integration manager..."));
            let app_integration_manager = match logic::character::AppIntegrationManager::new(data_dir.clone()) {
                Ok(m) => {
                    info!("{}", format_log_arg1(LogCategory::Setup, "Loaded app integrations: ", &m.get_all().len().to_string()));
                    m
                }
                Err(e) => {
                    error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize app integration manager: ", &e.to_string()));
                    // Try to recover by backing up and recreating
                    let config_path = data_dir.join("app_integrations.json");
                    if config_path.exists() {
                        let backup_path = data_dir.join("app_integrations.json.backup");
                        info!("{}", format_log(LogCategory::Setup, "Backing up corrupted app_integrations.json"));
                        std::fs::rename(&config_path, &backup_path).ok();
                    }
                    // Retry with fresh config
                    logic::character::AppIntegrationManager::new(data_dir.clone()).expect("Failed to create app integration manager after recovery")
                }
            };
            let app_integration_manager_state: AppIntegrationManagerState = Mutex::new(app_integration_manager);

            // ========== Initialize Input State ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing input state..."));
            let input_state = Arc::new(Mutex::new(input_state::InputState::new()));
            let main_window_label = String::from("main");

            // Start input listener for global keyboard/mouse events
            input_state::start_input_listener(
                app.handle().clone(),
                input_state.clone(),
                main_window_label.clone(),
            );

            // ========== Build System Tray ==========
            info!("{}", format_log(LogCategory::Setup, "Building system tray..."));
            if let Err(e) = tray::build_tray(&app.handle(), &character_manager_state) {
                error!("{}", format_log_arg1(LogCategory::Setup, "Failed to build tray: ", &e.to_string()));
            } else {
                info!("{}", format_log(LogCategory::Setup, "System tray built successfully"));
            }

            // ========== Manage Application State ==========
            app.manage(assistant_manager_state);
            app.manage(character_manager_state);
            app.manage(app_integration_manager_state);
            app.manage(input_state);
            app.manage(Arc::new(Mutex::new(AppState::default())));

            // ========== Handle Window Events ==========
            let main_window = app.get_webview_window("main");
            if let Some(window) = main_window {
                info!("{}", format_log_arg1(LogCategory::Setup, "Main window found: ", window.label()));

                // Listen for window close requests
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { .. } => {
                            info!("{}", format_log(LogCategory::Window, "Main window close requested, hiding instead"));
                            // Prevent window from closing, just hide it
                            let _ = window_clone.hide();
                        }
                        _ => {}
                    }
                });
            } else {
                error!("{}", format_log(LogCategory::Setup, "Main window not found"));
            }

            info!("{}", format_log(LogCategory::Setup, "Initialization complete"));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Brain commands
            commands::brain::connect_brain,
            commands::brain::disconnect_brain,
            commands::brain::is_brain_connected,
            commands::brain::get_agents,
            commands::brain::send_message,
            commands::brain::get_session_history,
            commands::brain::get_all_sessions,
            commands::brain::brain_call,
            commands::brain::get_brain_config,
            commands::brain::set_brain_config,
            commands::brain::test_brain_connection,
            // Assistant commands
            commands::assistant::get_all_assistants,
            commands::assistant::get_assistant,
            commands::assistant::create_assistant,
            commands::assistant::update_assistant,
            commands::assistant::delete_assistant,
            commands::assistant::get_characters_dir,
            // App Integration commands
            commands::app_integration::get_app_integrations,
            commands::app_integration::get_app_integration,
            commands::app_integration::add_app_integration,
            commands::app_integration::update_app_integration,
            commands::app_integration::delete_app_integration,
            // Character commands
            commands::character::get_all_characters,
            commands::character::get_character,
            commands::character::set_current_appearance,
            commands::character::get_current_appearance,
            commands::character::get_available_animations,
            commands::character::reload_characters,
            commands::character::add_character,
            commands::character::remove_character,
            commands::character::get_character_resource_path,
            commands::character::get_character_resource_paths,
            commands::character::load_character_resource,
            commands::character::load_character_resources,
            commands::character::add_character_resources,
            commands::character::is_character_user_defined,
            commands::character::update_character,
            commands::character::update_appearance,
            commands::character::add_action,
            commands::character::update_action,
            commands::character::delete_action,
            commands::character::update_action_resources,
            commands::character::remove_action_resource,
            commands::character::add_action_resources,
            // Input commands (penetration mode)
            commands::input::ctrl_state_changed,
            commands::input::drag_started,
            commands::input::drag_ended,
            // Event commands
            commands::event::emit_event,
            // Locale commands
            commands::locale::get_locale,
            commands::locale::set_locale,
            // System commands
            commands::system::set_auto_launch,
            commands::system::is_auto_launch_enabled,
            // Window commands
            commands::window::open_dialog_window,
            commands::window::close_dialog_window,
            commands::window::minimize_dialog_window,
            commands::window::is_dialog_window_open,
            commands::window::open_settings_window,
            commands::window::close_settings_window,
            commands::window::is_settings_window_open,
            commands::window::open_quit_confirm_window,
            commands::window::close_quit_confirm_window,
            commands::window::confirm_quit,
            // REMOVED: Debug panel feature
            // commands::window::open_debug_window,
            // commands::window::close_debug_window,
            commands::window::update_tray_item_text,
            commands::window::hide_all_windows,
            commands::window::show_main_window,
            commands::window::toggle_hide_window,
            commands::window::open_onboarding_window,
            commands::window::close_onboarding_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
