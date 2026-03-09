# OpenClaw Connection Diagnostic Script
# Test DeepJelly to OpenClaw WebSocket connection

param(
    [string]$Url = "ws://192.168.10.128:18790"
)

# Read config file
$configPath = ".\config\brain_adapter.json"
$config = $null

if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    $config = $configContent | ConvertFrom-Json
    Write-Host "Current config: $($config.brain_adapter.url)"
} else {
    Write-Host "Config file not found, using default"
    $config = @{
        brain_adapter = @{
            url = "ws://192.168.10.128:18790"
        }
    }
}

# Use URL from parameter or config
$testUrl = if ($Url) { $Url } else { $config.brain_adapter.url }

Write-Host ""
Write-Host "Starting diagnosis..."
Write-Host "Target URL: $testUrl"

# Parse URL
if ($testUrl -match "^ws://([^:]+):(\d+)") {
    $host = $Matches[1]
    $port = [int]$Matches[2]
    Write-Host "Target host: $host"
    Write-Host "Target port: $port"
} else {
    Write-Host "Error: Invalid URL format. Should be ws://IP:PORT"
    exit 1
}

# Test TCP connection
Write-Host ""
Write-Host "Testing TCP connection..."

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connectResult = $tcpClient.BeginConnect($host, $port, $null, $null)

    # Wait for connection (max 5 seconds)
    $timeout = 5000
    $startTime = Get-Date

    while (-not $connectResult.IsCompleted) {
        $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
        if ($elapsed -gt $timeout) {
            Write-Host "TCP connection TIMEOUT"
            Write-Host ""
            Write-Host "Possible causes:"
            Write-Host "  1. Host unreachable - check IP address"
            Write-Host "  2. Firewall blocking - check firewall settings"
            Write-Host "  3. Target host is down"
            $tcpClient.Close()
            exit 1
        }
        Start-Sleep -Milliseconds 100
    }

    if ($connectResult.IsCompleted) {
        try {
            $tcpClient.EndConnect($connectResult)
            if ($tcpClient.Connected) {
                Write-Host "SUCCESS: TCP connection established!"
                $tcpClient.Close()
            } else {
                Write-Host "FAILED: TCP connection failed"
                $tcpClient.Close()
                exit 1
            }
        } catch {
            Write-Host "FAILED: TCP connection refused"
            Write-Host ""
            Write-Host "Possible causes:"
            Write-Host "  1. OpenClaw is not running"
            Write-Host "  2. DeepJellyChannel plugin is not enabled"
            Write-Host "  3. WebSocket port is not $port"
            exit 1
        }
    }
} catch {
    Write-Host "ERROR: TCP connection error: $_"
    exit 1
}

Write-Host ""
Write-Host "TCP connection test PASSED"
Write-Host ""
Write-Host "Next steps - manually verify WebSocket service:"
Write-Host "1. Make sure OpenClaw is running"
Write-Host "2. Make sure DeepJellyChannel plugin is enabled"
Write-Host "3. Check if plugin is listening on port $port"
Write-Host ""
Write-Host "To change config, edit: config\brain_adapter.json"
