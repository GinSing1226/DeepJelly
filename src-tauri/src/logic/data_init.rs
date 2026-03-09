//! Data initialization module
//!
//! Handles initialization of user data directory from default templates.

use std::fs;
use std::path::{Path, PathBuf};

use crate::utils::error::{DeepJellyError, Result as DeepJellyResult};

/// Default data directory name (read-only templates)
pub const DEFAULT_DIR: &str = "default";

/// User data directory name (writable, initialized from default)
pub const USER_DIR: &str = "user";

/// Configuration files to copy from default to user
const CONFIG_FILES: &[&str] = &["assistants.json", "language.json"];

/// Initialize user data directory from default templates
///
/// This function ensures the user data directory exists and is populated
/// with default configuration files if they don't already exist.
///
/// # Arguments
/// * `data_dir` - Root data directory containing default/ and user/ subdirectories
///
/// # Returns
/// * `Ok(())` if initialization succeeds
/// * `Err(DeepJellyError)` if initialization fails
///
/// # Behavior
/// 1. Creates `data_dir/USER_DIR` if it doesn't exist
/// 2. Copies config files from `default/` to `user/` if they don't exist in user/
/// 3. Creates `user/characters/` directory
pub fn initialize_user_data(data_dir: &Path) -> DeepJellyResult<()> {
    let default_dir = get_default_dir(data_dir);
    let user_dir = get_user_dir(data_dir);

    // Ensure user directory exists
    fs::create_dir_all(&user_dir)
        .map_err(|e| DeepJellyError::Config(format!("Failed to create user directory: {}", e)))?;

    // Copy configuration files from default to user if they don't exist
    for config_file in CONFIG_FILES {
        let default_path = default_dir.join(config_file);
        let user_path = user_dir.join(config_file);

        // Only copy if user file doesn't exist
        if !user_path.exists() {
            if default_path.exists() {
                fs::copy(&default_path, &user_path)
                    .map_err(|e| {
                        DeepJellyError::Config(format!(
                            "Failed to copy {} from default to user: {}",
                            config_file, e
                        ))
                    })?;
            }
        }
    }

    // Ensure user/characters/ directory exists
    let characters_dir = user_dir.join("characters");
    fs::create_dir_all(&characters_dir)
        .map_err(|e| {
            DeepJellyError::Config(format!("Failed to create characters directory: {}", e))
        })?;

    Ok(())
}

/// Get the default data directory path
///
/// # Arguments
/// * `data_dir` - Root data directory
///
/// # Returns
/// Path to `data_dir/DEFAULT_DIR`
pub fn get_default_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(DEFAULT_DIR)
}

/// Get the user data directory path
///
/// # Arguments
/// * `data_dir` - Root data directory
///
/// # Returns
/// Path to `data_dir/USER_DIR`
pub fn get_user_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(USER_DIR)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    /// Helper to create a test file with content
    fn create_test_file(dir: &Path, filename: &str, content: &str) -> std::io::Result<()> {
        let file_path = dir.join(filename);
        let mut file = File::create(&file_path)?;
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    #[test]
    fn test_get_default_dir() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        let default_dir = get_default_dir(data_dir);
        let expected = data_dir.join("default");

        assert_eq!(default_dir, expected);
    }

    #[test]
    fn test_get_user_dir() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        let user_dir = get_user_dir(data_dir);
        let expected = data_dir.join("user");

        assert_eq!(user_dir, expected);
    }

    #[test]
    fn test_initialize_user_data_creates_directories() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        // Before initialization, user directory should not exist
        let user_dir = get_user_dir(data_dir);
        assert!(!user_dir.exists());

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // After initialization, user directory and characters subdirectory should exist
        assert!(user_dir.exists());
        assert!(user_dir.join("characters").exists());
        assert!(user_dir.join("characters").is_dir());
    }

    #[test]
    fn test_initialize_user_data_copies_config_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);

        // Create default directory and config files
        fs::create_dir_all(&default_dir).unwrap();
        create_test_file(&default_dir, "assistants.json", r#"{"test": "data"}"#).unwrap();
        create_test_file(&default_dir, "language.json", r#"{"lang": "en"}"#).unwrap();

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // Verify config files were copied to user directory
        let user_dir = get_user_dir(data_dir);
        assert!(user_dir.join("assistants.json").exists());
        assert!(user_dir.join("language.json").exists());

        // Verify content matches
        let assistants_content = fs::read_to_string(user_dir.join("assistants.json")).unwrap();
        assert_eq!(assistants_content, r#"{"test":"data"}"#);

        let language_content = fs::read_to_string(user_dir.join("language.json")).unwrap();
        assert_eq!(language_content, r#"{"lang":"en"}"#);
    }

    #[test]
    fn test_initialize_user_data_preserves_existing_user_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();
        let default_dir = get_default_dir(data_dir);
        let user_dir = get_user_dir(data_dir);

        // Create default directory with config files
        fs::create_dir_all(&default_dir).unwrap();
        create_test_file(&default_dir, "assistants.json", r#"{"default": "config"}"#).unwrap();
        create_test_file(&default_dir, "language.json", r#"{"default": "lang"}"#).unwrap();

        // Create user directory with existing config file
        fs::create_dir_all(&user_dir).unwrap();
        create_test_file(&user_dir, "assistants.json", r#"{"user": "config"}"#).unwrap();

        // Initialize user data
        initialize_user_data(data_dir).unwrap();

        // Verify existing user file was not overwritten
        let assistants_content = fs::read_to_string(user_dir.join("assistants.json")).unwrap();
        assert_eq!(assistants_content, r#"{"user":"config"}"#);

        // Verify missing config file was still copied
        assert!(user_dir.join("language.json").exists());
        let language_content = fs::read_to_string(user_dir.join("language.json")).unwrap();
        assert_eq!(language_content, r#"{"default":"lang"}"#);
    }

    #[test]
    fn test_initialize_user_data_handles_missing_default_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        // Don't create any default files - should not error
        let result = initialize_user_data(data_dir);
        assert!(result.is_ok());

        // User directory should still be created
        let user_dir = get_user_dir(data_dir);
        assert!(user_dir.exists());
        assert!(user_dir.join("characters").exists());
    }

    #[test]
    fn test_initialize_user_data_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path();

        // Run initialization twice
        initialize_user_data(data_dir).unwrap();
        initialize_user_data(data_dir).unwrap();

        // Should not error and directories should exist
        let user_dir = get_user_dir(data_dir);
        assert!(user_dir.exists());
        assert!(user_dir.join("characters").exists());
    }
}
