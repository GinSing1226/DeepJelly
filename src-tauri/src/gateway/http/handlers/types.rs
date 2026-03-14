//! Shared types for HTTP API handlers

use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use http::StatusCode;

/// Standard API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let status = if self.success {
            StatusCode::OK
        } else {
            self.error.as_ref()
                .map(|e| e.status_code())
                .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
        };

        (status, Json(self)).into_response()
    }
}

/// API error details
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl ApiError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(code: &str, message: &str, details: serde_json::Value) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: Some(details),
        }
    }

    pub fn status_code(&self) -> StatusCode {
        match self.code.as_str() {
            "UNAUTHORIZED" => StatusCode::UNAUTHORIZED,
            "FORBIDDEN" => StatusCode::FORBIDDEN,
            "NOT_FOUND" => StatusCode::NOT_FOUND,
            "NOT_IMPLEMENTED" => StatusCode::NOT_IMPLEMENTED,
            "VALIDATION_ERROR" => StatusCode::BAD_REQUEST,
            "CONFLICT" => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

/// Create a success response
pub fn success_response<T>(data: T) -> ApiResponse<T> {
    ApiResponse {
        success: true,
        data: Some(data),
        error: None,
    }
}

/// Create an error response (generic, works with any T)
pub fn error_response<T>(code: &str, message: &str) -> ApiResponse<T> {
    ApiResponse {
        success: false,
        data: None,
        error: Some(ApiError::new(code, message)),
    }
}

/// Create an error response with details (generic, works with any T)
pub fn error_response_details<T>(code: &str, message: &str, details: serde_json::Value) -> ApiResponse<T> {
    ApiResponse {
        success: false,
        data: None,
        error: Some(ApiError::with_details(code, message, details)),
    }
}

/// Path parameters extracted from URL
#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
pub struct IdPath {
    pub id: String,
}

/// Character-Appearance-Action path parameters
#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
pub struct ActionPath {
    pub character_id: String,
    pub appearance_id: String,
    pub action_key: String,
}
