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
mod gateway;
mod logic;
mod models;
mod resource_watcher;
mod tray;
mod input_state;
mod locale;
mod utils;

use std::sync::{Arc, Mutex};
use std::fs;
use tauri::Manager;
use log::{info, error};
use crate::utils::logging::{format_log, format_log_arg1};

// Re-exports for use in other modules
pub use brain::{AdapterClient, Assistant as BrainAssistant, BrainAdapterConfig, BrainAdapterSettings};
pub use commands::app_integration::{AppIntegrationManagerState, CharacterIntegrationManagerState};
pub use commands::endpoint::{EndpointManagerState};
pub use commands::data::{AssistantManagerState, data_get_all_characters, data_get_characters_by_assistant};
pub use commands::assistant::{get_all_assistants, get_assistant, create_assistant, update_assistant, delete_assistant, get_characters_dir};
pub use commands::character::{CharacterManagerState, get_all_characters, get_character, reload_character, set_current_appearance, get_current_appearance, get_available_animations,
    update_character, update_appearance, add_action, update_action, delete_action, update_action_resources, remove_action_resource, add_action_resources};
pub use gateway::http::{HttpServer};
pub use gateway::http::server::{HttpServerConfig, HttpServerState};
pub use models::integration::{AppIntegration, CharacterIntegration, ProviderType};
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
    data_init::{initialize_user_data, get_user_dir, DEFAULT_DIR, USER_DIR},
};
pub use utils::{DeepJellyError, Result, LogCategory};
pub use models::{DisplaySlot, DisplaySlotsData};

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

            // Determine the base data directory
            // Development: use ../data (from src-tauri)
            // Production: use resources/data (Tauri bundle) or data/ (next to exe)
            let data_dir = if cfg!(debug_assertions) {
                // Development mode: use ../data
                info!("{}", format_log(LogCategory::Setup, "Development mode: using ../data"));
                let data_path = std::path::PathBuf::from("../data");
                fs::create_dir_all(&data_path)
                    .map_err(|e| format!("Failed to create data directory: {}", e))?;
                data_path
            } else {
                // Production mode: try resources/data first, then data/ next to exe
                info!("{}", format_log(LogCategory::Setup, "Production mode: locating data directory..."));
                if let Ok(exe_path) = std::env::current_exe() {
                    if let Some(exe_dir) = exe_path.parent() {
                        // Try resources/data first (Tauri bundle location on Windows)
                        let resources_data_path = exe_dir.join("resources").join("data");
                        let local_data_path = exe_dir.join("data");

                        let data_path = if resources_data_path.exists() {
                            info!("{}", format_log(LogCategory::Setup, "Using resources/data (bundled resources)"));
                            resources_data_path
                        } else {
                            info!("{}", format_log(LogCategory::Setup, "Using data/ next to exe"));
                            // Create data/ directory if it doesn't exist
                            fs::create_dir_all(&local_data_path)
                                .map_err(|e| format!("Failed to create data directory: {}", e))?;
                            local_data_path
                        };

                        // Ensure user data directory exists for writable data
                        if !data_path.join("user").exists() {
                            fs::create_dir_all(data_path.join("user"))
                                .map_err(|e| format!("Failed to create user data directory: {}", e))?;
                        }

                        data_path
                    } else {
                        return Err(format!("Failed to determine executable directory").into());
                    }
                } else {
                    return Err(format!("Failed to get executable path").into());
                }
            };

            info!("{}", format_log_arg1(LogCategory::Setup, "Data directory: ", &data_dir.display().to_string()));

            // Initialize user data directory (creates user/ and copies default configs)
            initialize_user_data(&data_dir)
                .map_err(|e| format!("Failed to initialize user data: {}", e))?;

            // Get user data directory for all managers
            let user_data_dir = get_user_dir(&data_dir);
            info!("{}", format_log_arg1(LogCategory::Setup, "User data directory: ", &user_data_dir.display().to_string()));

            // ========== Load Locale from Config ==========
            // Try to load saved locale from user data directory
            let config_path = user_data_dir.join("language.json");

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
            let assistant_manager = match logic::character::AssistantManager::new(user_data_dir.clone()) {
                Ok(m) => {
                    info!("{}", format_log_arg1(LogCategory::Setup, "Loaded assistants: ", &m.get_all().len().to_string()));
                    m
                }
                Err(e) => {
                    error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize assistant manager: ", &e.to_string()));
                    // Check if the file exists to determine the error type
                    let config_path = user_data_dir.join("assistants.json");
                    if config_path.exists() {
                        // File exists but is corrupted - backup and retry
                        let backup_path = user_data_dir.join("assistants.json.backup");
                        info!("{}", format_log(LogCategory::Setup, "Backing up corrupted assistants.json"));
                        std::fs::rename(&config_path, &backup_path).ok();
                        // After backing up, try copying from default again
                        if let Err(copy_err) = logic::data_init::initialize_user_data(&data_dir) {
                            error!("{}", format_log_arg1(LogCategory::Setup, "Failed to reinitialize user data: ", &copy_err.to_string()));
                        }
                    } else {
                        // File doesn't exist - this shouldn't happen if initialize_user_data was called
                        error!("{}", format_log(LogCategory::Setup, "assistants.json not found, attempting to reinitialize user data"));
                        if let Err(copy_err) = logic::data_init::initialize_user_data(&data_dir) {
                            error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize user data: ", &copy_err.to_string()));
                        }
                    }
                    // Retry after recovery
                    logic::character::AssistantManager::new(user_data_dir.clone()).expect("Failed to create assistant manager after recovery")
                }
            };
            let assistant_manager_state: AssistantManagerState = Arc::new(Mutex::new(assistant_manager));

            // ========== Initialize Character Manager ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing character manager..."));
            let mut character_manager = CharacterManager::new(
                user_data_dir.clone(),  // Use user data directory
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
            let app_integration_manager = match logic::character::AppIntegrationManager::new(user_data_dir.clone()) {
                Ok(m) => {
                    info!("{}", format_log_arg1(LogCategory::Setup, "Loaded app integrations: ", &m.get_all().len().to_string()));
                    m
                }
                Err(e) => {
                    error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize app integration manager: ", &e.to_string()));
                    // Try to recover by backing up and recreating
                    let config_path = user_data_dir.join("app_integrations.json");
                    if config_path.exists() {
                        let backup_path = user_data_dir.join("app_integrations.json.backup");
                        info!("{}", format_log(LogCategory::Setup, "Backing up corrupted app_integrations.json"));
                        std::fs::rename(&config_path, &backup_path).ok();
                    }
                    // Retry with fresh config
                    logic::character::AppIntegrationManager::new(user_data_dir.clone()).expect("Failed to create app integration manager after recovery")
                }
            };
            let app_integration_manager_state: AppIntegrationManagerState = Mutex::new(app_integration_manager);

            // ========== Initialize Character Integration Manager ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing character integration manager..."));
            let character_integration_manager = match logic::character::CharacterIntegrationManager::new(user_data_dir.clone()) {
                Ok(m) => {
                    info!("{}", format_log_arg1(LogCategory::Setup, "Loaded character integrations: ", &m.get_all().len().to_string()));
                    m
                }
                Err(e) => {
                    error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize character integration manager: ", &e.to_string()));
                    // Try to recover by backing up and recreating
                    let config_path = user_data_dir.join("character_integrations.json");
                    if config_path.exists() {
                        let backup_path = user_data_dir.join("character_integrations.json.backup");
                        info!("{}", format_log(LogCategory::Setup, "Backing up corrupted character_integrations.json"));
                        std::fs::rename(&config_path, &backup_path).ok();
                    }
                    // Retry with fresh config
                    logic::character::CharacterIntegrationManager::new(user_data_dir.clone()).expect("Failed to create character integration manager after recovery")
                }
            };
            let character_integration_manager_state: CharacterIntegrationManagerState = Mutex::new(character_integration_manager);

            // ========== Initialize Endpoint Manager ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing endpoint manager..."));
            let endpoint_manager = match models::endpoint::EndpointManager::new(user_data_dir.clone()) {
                Ok(m) => {
                    let config = m.get();
                    info!("{}", format_log_arg1(LogCategory::Setup, "Loaded endpoint config: ", &config.url()));
                    m
                }
                Err(e) => {
                    error!("{}", format_log_arg1(LogCategory::Setup, "Failed to initialize endpoint manager: ", &e.to_string()));
                    // Try to recover by creating fresh config
                    models::endpoint::EndpointManager::new(user_data_dir.clone()).expect("Failed to create endpoint manager after recovery")
                }
            };
            let endpoint_manager_state: EndpointManagerState = Mutex::new(endpoint_manager);

            // ========== Start HTTP API Server ==========
            info!("{}", format_log(LogCategory::Setup, "Starting HTTP API server..."));

            // Get endpoint config for HTTP server
            let endpoint_config = endpoint_manager_state.lock().unwrap().get();
            info!("{}", format_log_arg1(LogCategory::Setup, "HTTP server will listen on: ", &endpoint_config.url()));

            // Use 0.0.0.0 to listen on all network interfaces (LAN accessible)
            let http_config = HttpServerConfig {
                host: "0.0.0.0".to_string(),  // Listen on all interfaces
                port: endpoint_config.port,
                require_auth: false, // TODO: Add authentication when needed
            };
            info!("{}", format_log_arg1(LogCategory::Setup, "HTTP server binding to: ", &format!("{}:{}", http_config.host, http_config.port)));

            // Create Arc-wrapped managers for HTTP server (separate instances that read from same files)
            let http_app_integration_manager = Arc::new(Mutex::new(
                match logic::character::AppIntegrationManager::new(user_data_dir.clone()) {
                    Ok(m) => m,
                    Err(_) => logic::character::AppIntegrationManager::new(user_data_dir.clone()).expect("Failed to create app integration manager for HTTP server")
                }
            ));
            let http_character_integration_manager = Arc::new(Mutex::new(
                match logic::character::CharacterIntegrationManager::new(user_data_dir.clone()) {
                    Ok(m) => m,
                    Err(_) => logic::character::CharacterIntegrationManager::new(user_data_dir.clone()).expect("Failed to create character integration manager for HTTP server")
                }
            ));
            let http_assistant_manager = Arc::new(Mutex::new(
                match logic::character::AssistantManager::new(user_data_dir.clone()) {
                    Ok(m) => m,
                    Err(_) => logic::character::AssistantManager::new(user_data_dir.clone()).expect("Failed to create assistant manager for HTTP server")
                }
            ));
            let http_character_manager = Arc::new(Mutex::new(
                logic::character::CharacterManager::new(user_data_dir.clone())
            ));

            // Create and spawn HTTP server
            let http_server = HttpServer::new(
                http_config,
                http_app_integration_manager,
                http_character_integration_manager,
                http_assistant_manager,
                http_character_manager,
                user_data_dir.clone(),
            );
            tauri::async_runtime::spawn(async move {
                if let Err(e) = http_server.start().await {
                    error!("HTTP server error: {}", e);
                }
            });
            info!("{}", format_log(LogCategory::Setup, "HTTP API server started"));

            // ========== Initialize Input State ==========
            info!("{}", format_log(LogCategory::Setup, "Initializing input state..."));
            let input_state = Arc::new(Mutex::new(input_state::InputState::new()));

            // Start input listener for global keyboard/mouse events
            input_state::start_input_listener(
                app.handle().clone(),
                input_state.clone(),
            );

            // ========== Build System Tray ==========
            info!("{}", format_log(LogCategory::Setup, "Building system tray..."));
            if let Err(e) = tray::build_tray(&app.handle(), &character_manager_state) {
                error!("{}", format_log_arg1(LogCategory::Setup, "Failed to build tray: ", &e.to_string()));
            } else {
                info!("{}", format_log(LogCategory::Setup, "System tray built successfully"));
            }

            // ========== Start Resource Watcher ==========
            info!("{}", format_log(LogCategory::Setup, "Starting resource watcher..."));
            let watcher = resource_watcher::ResourceWatcher::new(app.handle().clone(), user_data_dir.clone());
            if let Err(e) = watcher.start() {
                error!("{}", format_log_arg1(LogCategory::Setup, "Failed to start resource watcher: ", &e.to_string()));
            } else {
                info!("{}", format_log(LogCategory::Setup, "Resource watcher started successfully"));
            }

            // ========== Manage Application State ==========
            app.manage(assistant_manager_state);
            app.manage(character_manager_state);
            app.manage(app_integration_manager_state);
            app.manage(character_integration_manager_state);
            app.manage(endpoint_manager_state);
            app.manage(input_state.clone());
            app.manage(Arc::new(Mutex::new(AppState::default())));
            app.manage(Mutex::new(user_data_dir.clone())); // DataDirState for display_slot commands

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

            // ========== Restore Display Slot Windows ==========
            info!("{}", format_log(LogCategory::Setup, "Restoring display slot windows..."));
            let display_slots_path = user_data_dir.join("display_slots.json");
            let mut has_visible_slots = false;
            if display_slots_path.exists() {
                if let Ok(content) = fs::read_to_string(&display_slots_path) {
                    if let Ok(mut slots_data) = serde_json::from_str::<DisplaySlotsData>(&content) {
                        let mut restored_count = 0;
                        let mut needs_save = false;
                        for (index, slot) in slots_data.slots.iter_mut().enumerate() {
                            if slot.visible {
                                match crate::commands::display_slot::create_character_window(&app.handle(), slot, index, &input_state) {
                                    Ok(window_id) => {
                                        info!("{}", format_log_arg1(LogCategory::Setup, "Restored window: ", &window_id));
                                        // Update window_id in slot data
                                        if slot.window_id.as_ref() != Some(&window_id) {
                                            slot.window_id = Some(window_id.clone());
                                            needs_save = true;
                                        }
                                        restored_count += 1;
                                        has_visible_slots = true;
                                    }
                                    Err(e) => {
                                        error!("{}", format_log_arg1(LogCategory::Setup, "Failed to restore window: ", &e));
                                    }
                                }
                            }
                        }
                        // Save updated window_ids
                        if needs_save {
                            if let Ok(json_content) = serde_json::to_string_pretty(&slots_data) {
                                let _ = fs::write(&display_slots_path, json_content);
                                info!("{}", format_log(LogCategory::Setup, "Updated display_slots.json with window_ids"));
                            }
                        }
                        info!("{}", format_log_arg1(LogCategory::Setup, "Restored display slot windows: ", &restored_count.to_string()));
                    } else {
                        error!("{}", format_log(LogCategory::Setup, "Failed to parse display_slots.json"));
                    }
                } else {
                    error!("{}", format_log(LogCategory::Setup, "Failed to read display_slots.json"));
                }
            } else {
                info!("{}", format_log(LogCategory::Setup, "No display_slots.json found, skipping window restoration"));
            }

            // ========== Hide Main Window If Display Slots Exist ==========
            // The main window is created by Tauri automatically, but we use display slot windows for characters
            // If there are visible display slots, hide the main window to avoid showing two windows
            if has_visible_slots {
                if let Some(main_window) = app.get_webview_window("main") {
                    info!("{}", format_log(LogCategory::Setup, "Hiding main window (using display slot windows instead)"));
                    let _ = main_window.hide();
                }
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
            // Message storage commands
            commands::messages::save_local_message,
            commands::messages::get_local_messages,
            commands::messages::save_local_messages_bulk,
            commands::messages::clear_local_messages,
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
            commands::app_integration::test_app_connection,
            // Character Integration commands
            commands::app_integration::get_character_integrations,
            commands::app_integration::add_character_integration,
            commands::app_integration::update_character_integration,
            commands::app_integration::delete_character_integration,
            commands::app_integration::get_character_integrations_by_assistant,
            commands::app_integration::set_character_integration_enabled,
            // Data layer commands (new three-layer architecture)
            commands::data::data_get_all_characters,
            commands::data::data_get_characters_by_assistant,
            commands::data::data_add_character,
            commands::data::data_update_character,
            commands::data::data_delete_character,
            commands::data::data_add_appearance,
            commands::data::data_update_appearance,
            commands::data::data_delete_appearance,
            commands::data::data_add_action_resources,
            commands::data::data_remove_action_resource,
            commands::data::data_update_action_resources,
            commands::data::data_update_action,
            commands::data::data_update_action_with_spritesheet,
            // Display Slot commands
            commands::display_slot::get_display_slots,
            commands::display_slot::add_display_slot,
            commands::display_slot::update_display_slot,
            commands::display_slot::delete_display_slot,
            commands::display_slot::set_slot_visibility,
            commands::display_slot::update_slot_position,
            // Character commands
            commands::character::get_all_characters,
            commands::character::get_character,
            commands::character::reload_character,
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
            commands::character::load_character_resource_thumbnail,
            commands::character::get_resource_info,
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
            commands::input::register_passthrough_window,
            commands::input::unregister_passthrough_window,
            // Event commands
            commands::event::emit_event,
            // Locale commands
            commands::locale::get_locale,
            commands::locale::set_locale,
            // System commands
            commands::system::set_auto_launch,
            commands::system::is_auto_launch_enabled,
            // Endpoint commands
            commands::endpoint::get_endpoint_config,
            commands::endpoint::update_endpoint_config,
            commands::endpoint::get_local_ip,
            commands::endpoint::get_recommended_host,
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
            commands::window::toggle_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
