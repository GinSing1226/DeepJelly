//! Input commands for handling frontend events

use crate::input_state::{InputState, CtrlState, handle_ctrl_state_from_frontend, handle_drag_start, handle_drag_end};
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
