//! Brain layer module
//!
//! Handles AI adapter communication and session management.

pub mod types;
pub mod config;
pub mod client;
pub mod manager;

pub use types::*;
pub use config::{BrainAdapterConfig, BrainAdapterSettings};
pub use client::AdapterClient;
pub use manager::AdapterManager;
