import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TILE_SIZE = 32
const ROOT_DIR = path.join(__dirname, 'public', 'images', 'map')
const OUT_IMAGE = path.join(ROOT_DIR, 'map_sprites.webp')
const OUT_JSON = path.join(ROOT_DIR, 'map_sprites.json')

function walk(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'units' || entry.name === 'buildings') continue
      results.push(...walk(full))
    } else if (/(png|jpg|jpeg|webp)$/i.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

function relativeName(file) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/')
  return rel.replace(/\.(png|jpg|jpeg|webp)$/i, '')
}

async function main() {
  const files = walk(ROOT_DIR)
  console.log(`Processing ${files.length} image files...`)
  
  // Process all images to TILE_SIZE and get their buffers
  const imageBuffers = []
  for (const file of files) {
    try {
      const buffer = await sharp(file)
        .resize(TILE_SIZE, TILE_SIZE, { fit: 'cover' })
        .png() // Convert to PNG for consistent processing
        .toBuffer()
      imageBuffers.push(buffer)
    } catch (error) {
      console.error(`Failed to process image: ${file}`)
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  }

  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(imageBuffers.length))
  const rows = Math.ceil(imageBuffers.length / cols)
  
  // Create the sprite sheet
  const canvasWidth = cols * TILE_SIZE
  const canvasHeight = rows * TILE_SIZE
  
  // Create base canvas
  const canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })

  // Prepare composite operations
  const compositeOps = []
  const map = {}
  
  imageBuffers.forEach((buffer, i) => {
    const x = (i % cols) * TILE_SIZE
    const y = Math.floor(i / cols) * TILE_SIZE
    
    compositeOps.push({
      input: buffer,
      left: x,
      top: y
    })
    
    map[relativeName(files[i])] = { x, y, width: TILE_SIZE, height: TILE_SIZE }
  })

  // Composite all images and save as WebP
  await canvas
    .composite(compositeOps)
    .webp({ quality: 90 })
    .toFile(OUT_IMAGE)

  // Save the JSON mapping
  fs.writeFileSync(OUT_JSON, JSON.stringify(map, null, 2))
  console.log(`Generated ${OUT_IMAGE} and ${OUT_JSON}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
