//! Endpoint Configuration Commands
//!
//! Commands for managing DeepJelly HTTP API endpoint configuration

use crate::models::endpoint::{EndpointConfig, EndpointManager};
use std::sync::Mutex;
use tauri::State;

/// Endpoint Manager State
pub type EndpointManagerState = Mutex<EndpointManager>;

/// Get the current endpoint configuration
#[tauri::command]
pub async fn get_endpoint_config(
    state: State<'_, EndpointManagerState>,
) -> Result<EndpointConfig, String> {
    let manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(manager.get())
}

/// Update the endpoint configuration
///
/// # Arguments
/// * `config` - New endpoint configuration
///
/// # Returns
/// * `Result<()>` - Success or error message
#[tauri::command]
pub async fn update_endpoint_config(
    state: State<'_, EndpointManagerState>,
    config: EndpointConfig,
) -> Result<(), String> {
    let mut manager = state.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    manager.update(config)?;

    Ok(())
}

/// Get the local machine's IP address
///
/// Uses UDP socket technique to discover the local IP address.
/// Falls back to 127.0.0.1 if no suitable address is found.
///
/// # Returns
/// * `String` - The local IP address
#[tauri::command]
pub async fn get_local_ip() -> String {
    get_local_ip_address()
}

/// Get the default recommended host address
///
/// Returns the local machine's IP address, or 127.0.0.1 if unavailable.
/// This is used to pre-fill the host field in settings.
#[tauri::command]
pub async fn get_recommended_host() -> String {
    get_local_ip_address()
}

/// Get local IP address using UDP socket technique
///
/// This method creates a UDP socket and attempts to connect to a public DNS server.
/// The local address of the socket will be the IP address of the interface
/// that would route to the internet, which is typically the desired LAN IP.
fn get_local_ip_address() -> String {
    use std::net::UdpSocket;

    // Try to connect to a public DNS server (doesn't actually send data)
    // This will give us the local IP address of the interface that would route to internet
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                let ip = local_addr.ip();
                // Filter out loopback and link-local addresses
                if !ip.is_loopback() && !ip.is_unspecified() && ip.is_ipv4() {
                    return ip.to_string();
                }
            }
        }
    }

    // Fallback to localhost
    "127.0.0.1".to_string()
}
