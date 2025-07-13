#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import Jimp from 'jimp'

const baseDir = path.join('public', 'images', 'map')
const outputImage = path.join(baseDir, 'spriteSheet.png')
const outputMap = path.join(baseDir, 'spriteMap.json')
const validExt = /\.(png|jpg|jpeg|webp)$/i

async function collectImages(dir) {
  let results = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(await collectImages(full))
    } else if (validExt.test(entry.name) && entry.name !== 'spriteSheet.png' && entry.name !== 'spriteMap.json') {
      results.push(full)
    }
  }
  return results
}

function keyFor(file) {
  const rel = path.relative(baseDir, file)
  return rel.replace(/\\/g, '/').replace(/\.[^/.]+$/, '')
}

async function makeSpriteSheet() {
  const files = await collectImages(baseDir)
  const images = await Promise.all(files.map(f => Jimp.read(f)))

  const placements = []
  const maxRowWidth = 2048
  let x = 0
  let y = 0
  let rowHeight = 0
  let sheetWidth = 0

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const file = files[i]
    if (x + img.bitmap.width > maxRowWidth) {
      y += rowHeight
      x = 0
      rowHeight = 0
    }
    placements.push({ img, x, y, width: img.bitmap.width, height: img.bitmap.height, key: keyFor(file) })
    x += img.bitmap.width
    rowHeight = Math.max(rowHeight, img.bitmap.height)
    sheetWidth = Math.max(sheetWidth, x)
  }
  const sheetHeight = y + rowHeight
  const sheet = new Jimp(sheetWidth, sheetHeight, 0x00000000)
  const map = {}
  for (const p of placements) {
    sheet.composite(p.img, p.x, p.y)
    map[p.key] = { x: p.x, y: p.y, width: p.width, height: p.height }
  }
  await sheet.writeAsync(outputImage)
  await fs.writeFile(outputMap, JSON.stringify(map, null, 2))
  console.log(`Sprite sheet written to ${outputImage}`)
  console.log(`Mapping written to ${outputMap}`)
}

makeSpriteSheet().catch(err => {
  console.error(err)
  process.exit(1)
})
