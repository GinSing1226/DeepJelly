//! HTTP API Gateway Module
//!
//! Provides HTTP REST API for AI tools to manage DeepJelly resources.

pub mod server;
pub mod middleware;
pub mod router;
pub mod handlers;

pub use server::HttpServer;
