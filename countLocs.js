import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
  .sort((a, b) => b.lines - a.lines)

const total = counts.reduce((sum, { lines }) => sum + lines, 0)

console.log(`Total LOCs: ${total}`)
counts.forEach(({ file, lines }) => {
  const relativePath = path.relative(process.cwd(), file)
  console.log(`${lines}\t\t${relativePath}`)
})
