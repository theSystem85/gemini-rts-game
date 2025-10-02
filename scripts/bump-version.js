#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '..', 'package.json')

/**
 * Parse version string and bump according to commit type
 * @param {string} version - Current version (e.g., "1.2.3")
 * @param {string} commitMessage - Git commit message
 * @returns {string} New version
 */
function bumpVersion(version, commitMessage) {
  const parts = version.split('.').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error('Invalid version format:', version)
    return version
  }

  let [major, minor, patch] = parts
  const upperMessage = commitMessage.toUpperCase()

  // Check commit message prefix
  if (upperMessage.startsWith('FIX') || upperMessage.startsWith('REFACTOR')) {
    patch++
    console.log(`🔧 ${commitMessage.split('\n')[0].substring(0, 50)} → Bumping patch version`)
  } else if (upperMessage.startsWith('FEAT') || upperMessage.startsWith('IMPROVE')) {
    minor++
    patch = 0
    console.log(`✨ ${commitMessage.split('\n')[0].substring(0, 50)} → Bumping minor version`)
  } else {
    console.log(`ℹ️  No version bump (commit doesn't match patterns: FIX, REFACTOR, FEAT, IMPROVE)`)
    return version
  }

  return `${major}.${minor}.${patch}`
}

/**
 * Main function - expects commit message as argument
 */
function main() {
  // Get commit message from command line argument (passed from prepare-commit-msg hook)
  const commitMessage = process.argv[2]
  
  if (!commitMessage || commitMessage.trim() === '') {
    console.log('No commit message provided, skipping version bump')
    return
  }

  // Read package.json
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  const currentVersion = packageJson.version

  // Calculate new version
  const newVersion = bumpVersion(currentVersion, commitMessage)
  
  if (newVersion === currentVersion) {
    console.log(`Version remains: ${currentVersion}`)
    return
  }

  // Update package.json
  packageJson.version = newVersion
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  
  console.log(`✅ Version bumped: ${currentVersion} → ${newVersion}`)
}

main()
