fn main() {
    // Watch for changes in the i18n directory
    // Path relative to src-tauri/ directory
    println!("cargo:rerun-if-changed=i18n");

    tauri_build::build()
}
