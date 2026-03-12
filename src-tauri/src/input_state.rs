//! Input State Management
//!
//! 使用 rdev 监听全局键盘和鼠标事件，管理穿透模式自动切换

use rdev::{EventType, Key, listen, Button};
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use crate::utils::logging::{LogCategory, format_log, format_log_arg1};

/// Ctrl state event from frontend
#[derive(Clone, Deserialize)]
pub struct CtrlState {
    pub pressed: bool,
}

/// Input state
#[derive(Clone)]
pub struct InputState {
    pub ctrl_left: bool,
    pub ctrl_right: bool,
    pub ctrl_from_frontend: bool,
    pub passthrough_enabled: bool,
    pub is_dragging: bool,
    pub mouse_x: f64,
    pub mouse_y: f64,
    pub last_state_change: Instant,
    /// Registered windows for passthrough mode (multi-window support)
    pub registered_windows: Vec<String>,
}

impl InputState {
    pub fn new() -> Self {
        Self {
            ctrl_left: false,
            ctrl_right: false,
            ctrl_from_frontend: false,
            passthrough_enabled: false,
            is_dragging: false,
            mouse_x: 0.0,
            mouse_y: 0.0,
            last_state_change: Instant::now(),
            registered_windows: Vec::new(),
        }
    }

    pub fn is_ctrl_pressed(&self) -> bool {
        if self.ctrl_from_frontend {
            return true;
        }
        self.ctrl_left || self.ctrl_right
    }

    pub fn can_change_state(&self) -> bool {
        self.last_state_change.elapsed() >= Duration::from_millis(100)
    }

    pub fn mark_state_changed(&mut self) {
        self.last_state_change = Instant::now();
    }
}

/// Start input listener
pub fn start_input_listener(
    app_handle: AppHandle,
    input_state: Arc<Mutex<InputState>>,
) {
    log::info!("{}", format_log(LogCategory::Input, "Starting input listener for multi-window passthrough mode"));

    let state = input_state.clone();
    let handle = app_handle.clone();

    std::thread::spawn(move || {
        if let Err(error) = listen(move |event| {
            let mut state_guard = state.lock().expect("InputState mutex poisoned in input listener thread");

            match event.event_type {
                EventType::KeyPress(key) => {
                    if key == Key::ControlLeft || key == Key::ControlRight {
                        if key == Key::ControlLeft { state_guard.ctrl_left = true; }
                        if key == Key::ControlRight { state_guard.ctrl_right = true; }
                    }
                }
                EventType::KeyRelease(key) => {
                    if key == Key::ControlLeft || key == Key::ControlRight {
                        // Allow rdev to clear Ctrl state even when frontend state is set
                        // This handles the case where frontend loses focus during passthrough
                        if key == Key::ControlLeft {
                            state_guard.ctrl_left = false;
                        }
                        if key == Key::ControlRight {
                            state_guard.ctrl_right = false;
                        }
                        // Also clear frontend state since rdev detected actual key release
                        if !state_guard.ctrl_left && !state_guard.ctrl_right {
                            state_guard.ctrl_from_frontend = false;
                        }
                    }
                }
                EventType::MouseMove { x, y } => {
                    state_guard.mouse_x = x;
                    state_guard.mouse_y = y;
                }
                EventType::ButtonRelease(Button::Left) => {
                    if state_guard.is_dragging {
                        state_guard.is_dragging = false;
                    }
                }
                _ => {}
            }

            check_and_update_passthrough(&mut state_guard, &handle);
        }) {
            log::error!("{}", format_log(LogCategory::Input, &format!("Input listener error: {:?}", error)));
        }
    });
}

/// Check and update passthrough mode for all registered windows
fn check_and_update_passthrough(
    state: &mut InputState,
    app_handle: &AppHandle,
) {
    if state.is_dragging || !state.can_change_state() {
        return;
    }

    // Get a copy of registered windows to avoid holding lock while iterating
    let windows_to_check: Vec<String> = state.registered_windows.clone();

    for window_label in windows_to_check {
        let window: tauri::WebviewWindow = match app_handle.get_webview_window(&window_label) {
            Some(w) => w,
            None => continue,
        };

        let window_pos = match window.outer_position() {
            Ok(pos) => pos,
            Err(_) => continue,
        };
        let window_size = match window.outer_size() {
            Ok(size) => size,
            Err(_) => continue,
        };

        // Calculate window boundaries
        let wx = window_pos.x as f64;
        let wy = window_pos.y as f64;
        let ww = window_size.width as f64;
        let wh = window_size.height as f64;

        let mouse_in_window = state.mouse_x >= wx
            && state.mouse_x <= (wx + ww)
            && state.mouse_y >= wy
            && state.mouse_y <= (wy + wh);

        let ctrl_pressed = state.is_ctrl_pressed();
        let should_penetrate = mouse_in_window && ctrl_pressed;

        // Check current passthrough state for this window
        let is_currently_penetrating = state.passthrough_enabled;

        if should_penetrate != is_currently_penetrating {
            // State changed for this window
            if should_penetrate {
                log::info!("{}", format_log(LogCategory::Input, &format!(
                    "Enabling passthrough for '{}' - mouse: ({:.1}, {:.1}), window: ({:.1}, {:.1}, {:.1}x{:.1}), in_window: {}, ctrl: {}",
                    window_label, state.mouse_x, state.mouse_y, wx, wy, ww, wh, mouse_in_window, ctrl_pressed
                )));
                let _ = window.set_ignore_cursor_events(true);
            } else {
                log::info!("{}", format_log(LogCategory::Input, &format!(
                    "Disabling passthrough for '{}' - mouse: ({:.1}, {:.1}), window: ({:.1}, {:.1}, {:.1}x{:.1}), in_window: {}, ctrl: {}",
                    window_label, state.mouse_x, state.mouse_y, wx, wy, ww, wh, mouse_in_window, ctrl_pressed
                )));
                let _ = window.set_ignore_cursor_events(false);
            }
            state.passthrough_enabled = should_penetrate;
            state.mark_state_changed();
            let _ = app_handle.emit("penetration_mode_changed", should_penetrate);
        }
    }
}

/// Handle Ctrl state from frontend
pub fn handle_ctrl_state_from_frontend(
    state: &mut InputState,
    ctrl_state: &CtrlState,
) {
    log::info!("{}", format_log(LogCategory::Input, &format!("Frontend Ctrl state changed: {}", ctrl_state.pressed)));
    // Only set frontend state; don't clear rdev state
    // rdev will handle clearing on actual key release
    if ctrl_state.pressed {
        state.ctrl_from_frontend = true;
    } else {
        state.ctrl_from_frontend = false;
        // When frontend explicitly clears, also clear rdev states
        state.ctrl_left = false;
        state.ctrl_right = false;
    }
    log::info!("{}", format_log(LogCategory::Input, &format!(
        "Ctrl state after update - frontend: {}, left: {}, right: {}",
        state.ctrl_from_frontend, state.ctrl_left, state.ctrl_right
    )));
}

/// Handle drag start
pub fn handle_drag_start(state: &mut InputState) {
    state.is_dragging = true;
    state.passthrough_enabled = false;
}

/// Handle drag end
pub fn handle_drag_end(state: &mut InputState) {
    state.is_dragging = false;
}

/// Register a window for passthrough mode
pub fn register_window(state: &mut InputState, window_label: String) {
    if !state.registered_windows.contains(&window_label) {
        log::info!("{}", format_log_arg1(LogCategory::Input, "Registered window for passthrough: ", &window_label));
        state.registered_windows.push(window_label);
    }
}

/// Unregister a window from passthrough mode
pub fn unregister_window(state: &mut InputState, window_label: &str) {
    if let Some(pos) = state.registered_windows.iter().position(|w| w == window_label) {
        log::info!("{}", format_log_arg1(LogCategory::Input, "Unregistered window from passthrough: ", window_label));
        state.registered_windows.remove(pos);
    }
}
