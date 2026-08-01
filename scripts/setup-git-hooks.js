#!/usr/bin/env node

/**
 * Setup Git Hooks for Spark Capture Project
 * 
 * This script installs the pre-commit hook that enforces mandatory time tracking.
 * 
 * Usage:
 *   node scripts/setup-git-hooks.js
 *   
 * Or on Windows (PowerShell):
 *   node scripts\setup-git-hooks.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = process.cwd();
const HOOKS_DIR = path.join(REPO_ROOT, '.git', 'hooks');
const HOOK_SOURCE = path.join(REPO_ROOT, 'scripts', 'git-hooks', 'pre-commit');
const HOOK_TARGET = path.join(HOOKS_DIR, 'pre-commit');

console.log('Setting up Git hooks for Spark Capture project...\n');

// Check if we're in the right directory
if (!fs.existsSync(path.join(REPO_ROOT, 'package.json'))) {
  console.error('Error: This script must be run from the project root directory.');
  process.exit(1);
}

// Check if .git directory exists
if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) {
  console.error('Error: This is not a Git repository.');
  process.exit(1);
}

// Check if source hook exists
if (!fs.existsSync(HOOK_SOURCE)) {
  console.error(`Error: Source hook not found at ${HOOK_SOURCE}`);
  console.error('Please ensure scripts/git-hooks/pre-commit exists.');
  process.exit(1);
}

// Create hooks directory if it doesn't exist
if (!fs.existsSync(HOOKS_DIR)) {
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  console.log(`Created directory: ${HOOKS_DIR}`);
}

// Check if hook already exists
if (fs.existsSync(HOOK_TARGET)) {
  console.log(`Pre-commit hook already exists at ${HOOK_TARGET}`);
  console.log('Overwriting...\n');
}

// Copy the hook (symlink might not work on Windows)
try {
  // Try to create a symlink first (preferred)
  try {
    const relativePath = path.relative(HOOKS_DIR, HOOK_SOURCE);
    if (fs.existsSync(HOOK_TARGET)) {
      fs.unlinkSync(HOOK_TARGET);
    }
    fs.symlinkSync(relativePath, HOOK_TARGET);
    console.log(`Created symlink: ${HOOK_TARGET} -> ${relativePath}`);
  } catch (e) {
    // Fall back to copy on Windows or if symlink fails
    fs.copyFileSync(HOOK_SOURCE, HOOK_TARGET);
    console.log(`Copied: ${HOOK_SOURCE} -> ${HOOK_TARGET}`);
  }
  
  // Make it executable
  try {
    fs.chmodSync(HOOK_TARGET, 0o755);
    console.log(`Made executable: ${HOOK_TARGET}`);
  } catch (e) {
    // On Windows, this might fail, but the file should still work
    console.log(`Note: Could not set executable permissions (Windows?): ${e.message}`);
  }
  
  console.log('\n✅ Pre-commit hook installed successfully!\n');
  console.log('The hook will now prompt you for time tracking information on every commit.');
  console.log('\nTo test it, make a change and try to commit:');
  console.log('  git add .');
  console.log('  git commit -m "Test commit"');
  console.log('\nTo bypass the hook (not recommended):');
  console.log('  git commit --no-verify -m "Commit message"');
  
} catch (err) {
  console.error(`\n❌ Error installing hook: ${err.message}`);
  process.exit(1);
}
