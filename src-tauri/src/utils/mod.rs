//! Utility modules

pub mod error;
pub mod logging;

pub use error::{DeepJellyError, Result};
pub use logging::{LogCategory, format_log, format_log_arg1};
