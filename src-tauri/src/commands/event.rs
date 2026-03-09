//! Event command handlers
//!
//! Tauri commands for event engine operations.

use crate::logic::event_engine::{Event, process_event, ProcessedEvent};

/// 发送事件到事件引擎
///
/// 处理事件并返回匹配的规则和响应
#[tauri::command]
pub async fn emit_event(event: Event) -> Result<ProcessedEvent, String> {
    let result = process_event(event).await?;
    Ok(result)
}
