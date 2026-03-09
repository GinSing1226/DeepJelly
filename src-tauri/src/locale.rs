//! Locale state management for DeepJelly
//!
//! Provides thread-safe locale management with validation against available locales.
//! Supports persistence to JSON configuration file.

use once_cell::sync::Lazy;
use std::sync::RwLock;
use std::path::Path;

/// Type alias for locale identifier
pub type Locale = String;

/// List of supported locales in the application
const SUPPORTED_LOCALES: &[&str] = &["zh", "en", "ja"];

/// Default locale (Chinese)
const DEFAULT_LOCALE: &str = "zh";

/// Global locale state
///
/// Thread-safe storage for the current application locale using RwLock
/// for concurrent read access and exclusive write access.
static CURRENT_LOCALE: Lazy<RwLock<Locale>> = Lazy::new(|| {
    // Initialize with default locale and set it in rust_i18n
    rust_i18n::set_locale(DEFAULT_LOCALE);
    RwLock::new(DEFAULT_LOCALE.to_string())
});

/// Sets the current application locale
///
/// # Arguments
/// * `locale` - Locale identifier to set (e.g., "zh", "en", "ja")
///
/// # Returns
/// * `Ok(())` - Locale was successfully set
/// * `Err(String)` - Locale is not supported, containing error message
///
/// # Example
/// ```rust
/// use deepjelly::locale::set_locale;
///
/// match set_locale("en") {
///     Ok(_) => println!("Locale set to English"),
///     Err(e) => eprintln!("Failed to set locale: {}", e),
/// }
/// ```
pub fn set_locale(locale: &str) -> Result<(), String> {
    set_locale_impl(locale, None)
}

/// Sets the current application locale and persists to config file
///
/// # Arguments
/// * `locale` - Locale identifier to set (e.g., "zh", "en", "ja")
/// * `config_path` - Optional path to the locale config file for persistence
///
/// # Returns
/// * `Ok(())` - Locale was successfully set
/// * `Err(String)` - Locale is not supported or save failed
pub fn set_locale_with_config(locale: &str, config_path: &Path) -> Result<(), String> {
    set_locale_impl(locale, Some(config_path))
}

/// Internal implementation for setting locale
fn set_locale_impl(locale: &str, config_path: Option<&Path>) -> Result<(), String> {
    // Validate locale against supported locales
    if !SUPPORTED_LOCALES.contains(&locale) {
        return Err(format!(
            "Unsupported locale: '{}'. Supported locales: {}",
            locale,
            SUPPORTED_LOCALES.join(", ")
        ));
    }

    // Update global state
    let mut current = CURRENT_LOCALE
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
    *current = locale.to_string();

    // Update rust_i18n locale
    rust_i18n::set_locale(locale);

    // Save to config file if path provided
    if let Some(path) = config_path {
        // Try to load existing deepjelly.json to preserve other fields
        let config_value = if path.exists() {
            match std::fs::read_to_string(path) {
                Ok(content) => {
                    // Parse as generic JSON to preserve other fields
                    serde_json::from_str::<serde_json::Value>(&content)
                        .unwrap_or(serde_json::json!({}))
                }
                Err(_) => serde_json::json!({}),
            }
        } else {
            serde_json::json!({})
        };

        // Update the locale field
        let mut config_obj = config_value.as_object()
            .cloned()
            .unwrap_or(serde_json::Map::new());
        config_obj.insert("locale".to_string(), serde_json::json!(locale));

        // Write back the updated config
        let content = serde_json::to_string_pretty(&config_obj)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        std::fs::write(path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        log::info!("Saved locale config to {:?}", path);
    }

    Ok(())
}

/// Gets the current application locale
///
/// # Returns
/// Current locale string (e.g., "zh", "en", "ja")
///
/// # Example
/// ```rust
/// use deepjelly::locale::get_locale;
///
/// let current = get_locale();
/// println!("Current locale: {}", current);
/// ```
pub fn get_locale() -> Locale {
    CURRENT_LOCALE
        .read()
        .map(|locale| locale.clone())
        .unwrap_or_else(|_| DEFAULT_LOCALE.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_locale() {
        let locale = get_locale();
        assert_eq!(locale, DEFAULT_LOCALE);
    }

    #[test]
    fn test_set_valid_locale() {
        assert!(set_locale("en").is_ok());
        assert_eq!(get_locale(), "en");

        assert!(set_locale("ja").is_ok());
        assert_eq!(get_locale(), "ja");

        // Reset to default
        set_locale(DEFAULT_LOCALE).unwrap();
    }

    #[test]
    fn test_set_invalid_locale() {
        let result = set_locale("fr");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported locale"));
    }
}
