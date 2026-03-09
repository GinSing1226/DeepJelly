# DeepJelly Portable Build Script
# This script builds a portable version of the application without NSIS installer

$ErrorActionPreference = "Stop"

# Paths
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SrcTauriDir = Join-Path $ProjectRoot "src-tauri"
$TargetDir = Join-Path $ProjectRoot "target\release"
$PortableDir = Join-Path $ProjectRoot "portable"
$ZipFile = Join-Path $ProjectRoot "DeepJelly-Portable.zip"

Write-Host "=== DeepJelly Portable Build ===" -ForegroundColor Cyan
Write-Host ""

# Check if deepjelly.exe is running
$Process = Get-Process -Name "deepjelly" -ErrorAction SilentlyContinue
if ($Process) {
    Write-Host "WARNING: deepjelly.exe is currently running!" -ForegroundColor Red
    Write-Host "Please close the application before building." -ForegroundColor Yellow
    $Response = Read-Host "Attempt to close it automatically? (y/n)"
    if ($Response -eq 'y' -or $Response -eq 'Y') {
        Write-Host "Stopping deepjelly.exe..." -ForegroundColor Yellow
        Stop-Process -Name "deepjelly" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        $Process = Get-Process -Name "deepjelly" -ErrorAction SilentlyContinue
        if ($Process) {
            Write-Host "Failed to stop the process. Please close it manually." -ForegroundColor Red
            exit 1
        }
        Write-Host "  ✓ Application closed" -ForegroundColor Green
    } else {
        Write-Host "Build cancelled. Please close deepjelly.exe and try again." -ForegroundColor Yellow
        exit 1
    }
}

# Clean previous build
Write-Host "Cleaning previous portable build..." -ForegroundColor Yellow
if (Test-Path $PortableDir) {
    Remove-Item -Path $PortableDir -Recurse -Force
}
if (Test-Path $ZipFile) {
    Remove-Item -Path $ZipFile -Force
}

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
Push-Location $ProjectRoot
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Create portable directory
Write-Host "Creating portable package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null

# Copy executable
$ExePath = Join-Path $TargetDir "deepjelly.exe"
if (Test-Path $ExePath) {
    Copy-Item -Path $ExePath -Destination $PortableDir -Force
    Write-Host "  ✓ Copied deepjelly.exe" -ForegroundColor Green
} else {
    Write-Host "  ✗ deepjelly.exe not found!" -ForegroundColor Red
    exit 1
}

# Copy dependencies (DLL files)
$DllFiles = Get-ChildItem -Path $TargetDir -Filter "*.dll" | Where-Object { $_.Name -like "WebView2Loader.dll" -or $_.Name -like "tauri_*" }
foreach ($Dll in $DllFiles) {
    Copy-Item -Path $Dll.FullName -Destination $PortableDir -Force
    Write-Host "  ✓ Copied $($Dll.Name)" -ForegroundColor Green
}

# Copy data folder
$DataDir = Join-Path $ProjectRoot "data"
if (Test-Path $DataDir) {
    Copy-Item -Path $DataDir -Destination $PortableDir -Recurse -Force
    Write-Host "  ✓ Copied data folder" -ForegroundColor Green
} else {
    Write-Host "  ✗ data folder not found!" -ForegroundColor Red
    exit 1
}

# Create ZIP archive
Write-Host ""
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path "$PortableDir\*" -DestinationPath $ZipFile -Force

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host "Portable package: $PortableDir" -ForegroundColor Cyan
Write-Host "ZIP archive: $ZipFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "To distribute:" -ForegroundColor Yellow
Write-Host "1. Share the ZIP file with users" -ForegroundColor White
Write-Host "2. Users extract and run deepjelly.exe" -ForegroundColor White
