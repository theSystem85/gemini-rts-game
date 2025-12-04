#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '..', 'package.json')
const outputPath = join(__dirname, '..', 'src', 'version.js')

/**
 * Generate version.js file from package.json
 */
function generateVersionFile() {
  try {
    // Read package.json
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const version = packageJson.version || '0.0.0'
    
    // Generate version.js content
    const content = `// Auto-generated file - DO NOT EDIT
// This file is generated during build time from package.json
// To update the version, modify package.json or use the bump-version script

export const APP_VERSION = '${version}'
`
    
    // Write version.js
    writeFileSync(outputPath, content)
    window.logger(`✅ Generated version.js with version: ${version}`)
  } catch (error) {
    console.error('Error generating version file:', error.message)
    process.exit(1)
  }
}

generateVersionFile()
