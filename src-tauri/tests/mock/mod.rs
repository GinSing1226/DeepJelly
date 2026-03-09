//! Mock objects for testing
//!
//! 提供各种Mock对象，用于隔离外部依赖。

pub mod event;
pub mod system1;
pub mod config;
pub mod websocket;

pub use event::*;
pub use system1::*;
pub use config::*;
pub use websocket::*;
