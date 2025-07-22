import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/* global process */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getAllFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(dirent => {
    const res = path.join(dir, dirent.name)
    return dirent.isDirectory() ? getAllFiles(res) : res
  })
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  if (content === '') return 0
  return content.split(/\r?\n/).length
}

const srcDir = path.join(__dirname, 'src')
const files = getAllFiles(srcDir)

const counts = files.map(file => ({ file, lines: countLines(file) }))
const total = counts.reduce((sum, { lines }) => sum + lines, 0)

console.log(`Total LOCs: ${total}`)
counts.forEach(({ file, lines }) => {
  console.log(`${path.relative(process.cwd(), file)}: ${lines}`)
})
