//! Simple logging utilities without i18n overhead
//!
//! Lightweight logging for better performance. Uses static strings
//! to avoid any runtime translation lookups.

/// Log category for organizing log messages
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LogCategory {
    Setup,
    Window,
    Locale,
    Brain,
    Input,
    Character,
    Event,
    Gateway,
    Config,
}

impl LogCategory {
    /// Get the short category name for log prefix
    #[inline]
    pub const fn as_str(&self) -> &'static str {
        match self {
            LogCategory::Setup => "SETUP",
            LogCategory::Window => "WINDOW",
            LogCategory::Locale => "LOCALE",
            LogCategory::Brain => "BRAIN",
            LogCategory::Input => "INPUT",
            LogCategory::Character => "CHAR",
            LogCategory::Event => "EVENT",
            LogCategory::Gateway => "GATEWAY",
            LogCategory::Config => "CONFIG",
        }
    }
}

/// Format a log message with category prefix
#[inline]
pub fn format_log(category: LogCategory, message: &str) -> String {
    format!("[{}] {}", category.as_str(), message)
}

/// Format a log message with category prefix and one argument
#[inline]
pub fn format_log_arg1(category: LogCategory, message: &str, arg1: &str) -> String {
    format!("[{}] {}{}", category.as_str(), message, arg1)
}

/// Format a log message with category prefix and Display argument
#[inline]
pub fn format_log_fmt<T: std::fmt::Display>(category: LogCategory, message: &str, arg: T) -> String {
    format!("[{}] {}{}", category.as_str(), message, arg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_category_as_str() {
        assert_eq!(LogCategory::Setup.as_str(), "SETUP");
        assert_eq!(LogCategory::Window.as_str(), "WINDOW");
    }

    #[test]
    fn test_format_log() {
        let msg = format_log(LogCategory::Setup, "Application starting");
        assert_eq!(msg, "[SETUP] Application starting");
    }

    #[test]
    fn test_format_log_arg1() {
        let msg = format_log_arg1(LogCategory::Locale, "Locale set to: ", "en");
        assert_eq!(msg, "[LOCALE] Locale set to: en");
    }
}
