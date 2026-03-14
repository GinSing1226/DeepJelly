# DeepJelly HTTP API Test Script
# 测试 DeepJelly HTTP API 的各个端点

# 配置
$BaseUrl = "http://127.0.0.1:12261"
$TestToken = "dj_test_token_abc123"  # 如果有认证的话

Write-Host "=== DeepJelly HTTP API Test ===" -ForegroundColor Green
Write-Host ""

# 颜色函数
function Success([string]$Message) {
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Info([string]$Message) {
    Write-Host "[~] $Message" -ForegroundColor Yellow
}

# 测试端点函数
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body,
        [string]$Token,
        [int]$ExpectedStatus = 200
    )

    $url = "$BaseUrl$Path"
    $headers = @{"Content-Type" = "application/json"}

    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }

    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -TimeoutSec 5
        }
        elseif ($Method -eq "POST") {
            $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $Body -TimeoutSec 5
        }
        elseif ($Method -eq "PATCH") {
            $response = Invoke-RestMethod -Uri $url -Method Patch -Headers $headers -Body $Body -TimeoutSec 5
        }
        elseif ($Method -eq "DELETE") {
            $response = Invoke-RestMethod -Uri $url -Method Delete -Headers $headers -TimeoutSec 5
        }

        $statusCode = $response.StatusCode

        if ($statusCode -eq $ExpectedStatus) {
            Success "$Method $Path (HTTP $statusCode)"
            $json = $response.Content | ConvertFrom-Json
            Write-Host "  Response: $($json | ConvertTo-Json -Compress)" -ForegroundColor Gray
        } else {
            Fail "$Method $Path (expected HTTP $ExpectedStatus, got $statusCode)"
            Write-Host "  Response: $($response.Content)" -ForegroundColor DarkGray
        }
    }
    catch {
        Fail "$Method $Path - $($_.Exception.Message)"
    }
}

# ============================================================================
# 开始测试
# ============================================================================

Write-Host ""
Write-Host "Make sure DeepJelly is running first!" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop testing." -ForegroundColor Gray
Write-Host ""

# 等待用户确认
Write-Host "Press Enter to start testing..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Test 1: Health Check
Write-Host ""
Info "Test 1: Health Check"
Test-Endpoint "GET" "/health"

# Test 2: List App Integrations
Write-Host ""
Info "Test 2: List App Integrations"
Test-Endpoint "GET" "/api/v1/integration/app"

# Test 3: Test Connection
Write-Host ""
Info "Test 3: Test Connection"
$testBody = @{
    endpoint = "ws://192.168.1.100:18790"
    authToken = $null
} | ConvertTo-Json -Compress
Test-Endpoint "POST" "/api/v1/integration/app/test" $testBody

# Test 4: List Character Integrations
Write-Host ""
Info "Test 4: List Character Integrations"
Test-Endpoint "GET" "/api/v1/integration/character"

# Test 5: Get Config Paths
Write-Host ""
Info "Test 5: Get Config Paths"
Test-Endpoint "GET" "/api/v1/content/config/paths"

# Test 6: List Assistants
Write-Host ""
Info "Test 6: List Assistants"
Test-Endpoint "GET" "/api/v1/content/assistant"

# Test 7: List Characters
Write-Host ""
Info "Test 7: List Characters"
Test-Endpoint "GET" "/api/v1/content/character"

# Test 8: List Appearances
Write-Host ""
Info "Test 8: List Appearances"
Test-Endpoint "GET" "/api/v1/content/appearance"

# Test 9: 404 Not Found
Write-Host ""
Info "Test 9: 404 Not Found"
Test-Endpoint "GET" "/api/v1/nonexistent" "" "" 404

# ============================================================================
# Summary
# ============================================================================

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Some tests may fail if:" -ForegroundColor Yellow
Write-Host "  1. DeepJelly is not running" -ForegroundColor Gray
Write-Host "  2. HTTP server hasn't started yet" -ForegroundColor Gray
Write-Host "  3. Protected endpoints require valid deepjellyToken" -ForegroundColor Gray
