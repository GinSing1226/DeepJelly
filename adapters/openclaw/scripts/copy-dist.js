#!/usr/bin/env node

/**
 * Copy manifest and README to dist directory
 * Used by npm prepack script
 */

const fs = require('fs');
const path = require('path');

function main() {
  const rootDir = path.dirname(__dirname);
  const distDir = path.join(rootDir, 'dist');
  const manifestFile = path.join(rootDir, 'openclaw.plugin.json');
  const readmeFile = path.join(rootDir, 'README.md');

  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest
  if (fs.existsSync(manifestFile)) {
    fs.copyFileSync(manifestFile, path.join(distDir, 'openclaw.plugin.json'));
    console.log('✅ Copied openclaw.plugin.json to dist/');
  }

  // Copy README
  if (fs.existsSync(readmeFile)) {
    fs.copyFileSync(readmeFile, path.join(distDir, 'README.md'));
    console.log('✅ Copied README.md to dist/');
  }
}

main();
