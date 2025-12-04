#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
}

try {
  const commitHash = run('git rev-parse --short HEAD')
  const commitMessage = run('git log -1 --pretty=%s')

  const versionInfo = {
    commit: commitHash,
    message: commitMessage,
  }

  const versionPath = resolve(__dirname, '..', 'src', 'version.json')
  writeFileSync(versionPath, `${JSON.stringify(versionInfo, null, 2)}\n`, 'utf8')

  window.logger(`✅ Wrote commit hash: ${commitHash}`)
} catch (error) {
  console.error('Failed to write commit hash to version.json:', error.message)
  process.exitCode = 1
}
