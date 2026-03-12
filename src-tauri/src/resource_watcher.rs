//! Resource watcher module
//!
//! Monitors character resource files for changes and emits events to the frontend.

use crate::utils::logging::{format_log, format_log_arg1, LogCategory};
use log::info;
use notify::{RecursiveMode, Result, Watcher, Event, EventKind};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

/// Resource watcher that monitors character configuration changes
pub struct ResourceWatcher {
    app_handle: AppHandle,
    watch_path: PathBuf,
}

impl ResourceWatcher {
    /// Create a new resource watcher
    pub fn new(app_handle: AppHandle, watch_path: PathBuf) -> Self {
        Self {
            app_handle,
            watch_path,
        }
    }

    /// Start watching for resource changes
    pub fn start(&self) -> Result<()> {
        let watch_path = self.watch_path.clone();
        let app_handle = self.app_handle.clone();

        info!("{}", format_log(LogCategory::Setup, "Starting resource watcher..."));
        info!("{}", format_log_arg1(LogCategory::Setup, "Watching path: ", &watch_path.display().to_string()));

        // Create a channel to receive events
        // The channel type is DebouncedEvent from notify
        let (_tx, rx) = std::sync::mpsc::channel::<notify::Result<notify::Event>>();

        // Create a watcher with debouncing (2 seconds)
        let mut watcher = notify::recommended_watcher(move |res: Result<Event>| {
            match res {
                Ok(event) => {
                    // Only process file modifications, not creations or deletions
                    if matches!(event.kind, EventKind::Modify(_)) {
                        if let Some(path) = event.paths.first() {
                            // Check if it's a file we care about
                            let file_name = path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("");

                            // Monitor assistants.json and character resource changes
                            if file_name == "assistants.json" || file_name == "characters.json" {
                                info!("{}", format_log_arg1(LogCategory::Setup, "Resource file modified: ", file_name));

                                // Emit event to frontend
                                let _ = app_handle.emit("resource-changed", serde_json::json!({
                                    "file": file_name,
                                    "path": path.to_string_lossy().to_string(),
                                }));
                            }
                        }
                    }
                }
                Err(e) => {
                    log::error!("Watch error: {:?}", e);
                }
            }
        })?;

        // Add the watch path
        watcher.watch(&watch_path, RecursiveMode::Recursive)?;

        info!("{}", format_log(LogCategory::Setup, "Resource watcher started successfully"));

        // Spawn a thread to keep the watcher alive
        // Use std::thread instead of tokio::spawn because we're not in an async context
        std::thread::spawn(move || {
            // Keep receiving events to keep the watcher alive
            while let Ok(_event) = rx.recv() {
                // Events are processed in the watcher callback above
            }
        });

        Ok(())
    }
}
