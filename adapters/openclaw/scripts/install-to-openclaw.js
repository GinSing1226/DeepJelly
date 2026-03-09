#!/usr/bin/env node

/**
 * Install DeepJelly OpenClaw plugin to OpenClaw extensions directory
 *
 * This script:
 * 1. Builds the plugin
 * 2. Copies only necessary files to ~/.openclaw/extensions/deepjelly
 * 3. Installs production dependencies only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getOpenClawExtensionsDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.openclaw', 'extensions', 'deepjelly');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function main() {
  log('🚀 Installing DeepJelly OpenClaw plugin...\n', 'blue');

  const rootDir = path.dirname(__dirname);
  const srcDir = path.join(rootDir, 'src');
  const distDir = path.join(rootDir, 'dist');
  const manifestFile = path.join(rootDir, 'openclaw.plugin.json');
  const readmeFile = path.join(rootDir, 'README.md');
  const targetDir = getOpenClawExtensionsDir();

  // Step 1: Build
  log('📦 Building plugin...', 'yellow');
  try {
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
    log('✅ Build complete\n', 'green');
  } catch (error) {
    log('❌ Build failed', 'red');
    process.exit(1);
  }

  // Step 2: Copy files
  log('📋 Copying files to OpenClaw extensions...', 'yellow');

  ensureDir(targetDir);

  // Copy source files (for TypeScript runtime loading via jiti)
  copyDir(srcDir, path.join(targetDir, 'src'));

  // Copy dist files
  if (fs.existsSync(distDir)) {
    copyDir(distDir, path.join(targetDir, 'dist'));
  }

  // Copy manifest
  if (fs.existsSync(manifestFile)) {
    copyFile(manifestFile, path.join(targetDir, 'openclaw.plugin.json'));
  }

  // Copy README
  if (fs.existsSync(readmeFile)) {
    copyFile(readmeFile, path.join(targetDir, 'README.md'));
  }

  log(`✅ Files copied to ${targetDir}\n`, 'green');

  // Step 3: Install dependencies
  log('📥 Installing production dependencies...', 'yellow');
  try {
    execSync('npm install --production', { cwd: targetDir, stdio: 'inherit' });
    log('✅ Dependencies installed\n', 'green');
  } catch (error) {
    log('❌ Dependency installation failed', 'red');
    process.exit(1);
  }

  // Done
  log('🎉 Installation complete!\n', 'green');
  log('Next steps:', 'blue');
  log('  1. Restart OpenClaw: openclaw restart');
  log('  2. Configure the plugin in ~/.openclaw/openclaw.json');
  log('  3. See README.md for configuration examples\n');
}

main();
