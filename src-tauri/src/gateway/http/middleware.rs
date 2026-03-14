//! HTTP API Middleware
//!
//! Authentication and common middleware for HTTP API
#![allow(dead_code)]

use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};

/// Extract Bearer token from headers
pub fn extract_bearer_token(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| {
            if h.starts_with("Bearer ") {
                Some(h[7..].to_string())
            } else {
                None
            }
        })
}

/// Optional authentication middleware (bypass if no token provided)
pub async fn optional_auth_middleware(
    request: Request,
    next: Next,
) -> Response {
    // Allow request to proceed, handlers can check auth if needed
    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_bearer_token() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("Authorization", "Bearer test_token_123".parse().unwrap());

        assert_eq!(
            extract_bearer_token(&headers),
            Some("test_token_123".to_string())
        );
    }

    #[test]
    fn test_extract_bearer_token_missing() {
        let headers = axum::http::HeaderMap::new();
        assert!(extract_bearer_token(&headers).is_none());
    }

    #[test]
    fn test_extract_bearer_token_invalid_format() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("Authorization", "InvalidFormat".parse().unwrap());

        assert!(extract_bearer_token(&headers).is_none());
    }
}
