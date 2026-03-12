//! Input commands for handling frontend events

use crate::input_state::{InputState, CtrlState, handle_ctrl_state_from_frontend, handle_drag_start, handle_drag_end, register_window, unregister_window};
use tauri::State;
use std::sync::{Arc, Mutex};

#[tauri::command]
pub fn ctrl_state_changed(pressed: bool, input_state: State<Arc<Mutex<InputState>>>) {
  let mut state = input_state.lock().expect("InputState mutex poisoned in ctrl_state_changed");
  handle_ctrl_state_from_frontend(&mut state, &CtrlState { pressed });
}

#[tauri::command]
pub fn drag_started(input_state: State<Arc<Mutex<InputState>>>) {
  handle_drag_start(&mut input_state.lock().expect("InputState mutex poisoned in drag_started"));
}

#[tauri::command]
pub fn drag_ended(input_state: State<Arc<Mutex<InputState>>>) {
  handle_drag_end(&mut input_state.lock().expect("InputState mutex poisoned in drag_ended"));
}

#[tauri::command]
pub fn register_passthrough_window(window_label: String, input_state: State<Arc<Mutex<InputState>>>) {
  register_window(&mut input_state.lock().expect("InputState mutex poisoned in register_passthrough_window"), window_label);
}

#[tauri::command]
pub fn unregister_passthrough_window(window_label: String, input_state: State<Arc<Mutex<InputState>>>) {
  unregister_window(&mut input_state.lock().expect("InputState mutex poisoned in unregister_passthrough_window"), &window_label);
}
