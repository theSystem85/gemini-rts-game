#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '..', 'package.json')

/**
 * Get the last commit message
 */
function getLastCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim()
  } catch (error) {
    console.error('Error getting commit message:', error.message)
    return ''
  }
}

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
 * Main function
 */
function main() {
  // Read package.json
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  const currentVersion = packageJson.version
  
  // Get commit message
  const commitMessage = getLastCommitMessage()
  if (!commitMessage) {
    console.log('No commit message found, skipping version bump')
    return
  }

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
  
  // Stage the updated package.json
  try {
    execSync('git add package.json', { stdio: 'inherit' })
    console.log('📝 Staged package.json')
  } catch (error) {
    console.error('Error staging package.json:', error.message)
  }
}

main()
