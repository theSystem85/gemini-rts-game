#!/usr/bin/env node

import { readdir, writeFile } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

/**
 * Node.js script to analyze grass tiles structure and generate JSON configuration
 * Usage: node map_analyse.js
 * This will scan the public/images/map/grass_tiles folder and generate grass_tiles.json
 */

const GRASS_TILES_DIR = 'public/images/map/grass_tiles'
const OUTPUT_FILE = join(GRASS_TILES_DIR, 'grass_tiles.json')
const BASE_PATH = 'images/map/grass_tiles'

// Supported image extensions
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']

/**
 * Check if a file has a supported image extension
 */
function isImageFile(filename) {
  const ext = extname(filename).toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(ext)
}

/**
 * Remove file extension from filename for texture loading
 */
function removeExtension(filename) {
  return filename.replace(/\.[^.]+$/, '')
}

/**
 * Recursively scan a directory for image files
 */
async function scanDirectory(dirPath) {
  try {
    const files = await readdir(dirPath, { withFileTypes: true })
    const imageFiles = []
    
    for (const file of files) {
      if (file.isFile() && isImageFile(file.name)) {
        imageFiles.push(file.name)
      }
    }
    
    return imageFiles.sort() // Sort for consistent output
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dirPath}:`, error.message)
    return []
  }
}

/**
 * Generate full paths for tiles relative to the public directory
 */
function generatePaths(files, relativePath) {
  return files.map(file => `${BASE_PATH}/${relativePath}/${removeExtension(file)}`)
}

/**
 * Main function to analyze grass tiles structure
 */
async function analyzeGrassTiles() {
  console.log('🔍 Analyzing grass tiles structure...')
  
  // Check if the grass tiles directory exists
  if (!existsSync(GRASS_TILES_DIR)) {
    console.error(`❌ Error: Grass tiles directory not found: ${GRASS_TILES_DIR}`)
    process.exit(1)
  }
  
  try {
    // Scan each category of tiles
    console.log('📁 Scanning passable tiles...')
    const passableFiles = await scanDirectory(join(GRASS_TILES_DIR, 'passable'))
    
    console.log('🎨 Scanning decorative tiles...')
    const decorativeFiles = await scanDirectory(join(GRASS_TILES_DIR, 'passable', 'decorative'))
    
    console.log('🚫 Scanning impassable tiles...')
    const impassableFiles = await scanDirectory(join(GRASS_TILES_DIR, 'impassable'))
    
    // Generate the paths (without file extensions for texture loading)
    const passablePaths = generatePaths(passableFiles, 'passable')
    const decorativePaths = generatePaths(decorativeFiles, 'passable/decorative')
    const impassablePaths = generatePaths(impassableFiles, 'impassable')
    
    // Create the JSON structure
    const grassTilesConfig = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalFiles: passableFiles.length + decorativeFiles.length + impassableFiles.length,
        counts: {
          passable: passableFiles.length,
          decorative: decorativeFiles.length,
          impassable: impassableFiles.length
        }
      },
      passablePaths,
      decorativePaths,
      impassablePaths
    }
    
    // Write the JSON file
    const jsonContent = JSON.stringify(grassTilesConfig, null, 2)
    await writeFile(OUTPUT_FILE, jsonContent, 'utf8')
    
    // Output summary
    console.log('\n✅ Grass tiles analysis complete!')
    console.log(`📄 Generated: ${OUTPUT_FILE}`)
    console.log(`\n📊 Summary:`)
    console.log(`   Passable tiles: ${passableFiles.length}`)
    console.log(`   Decorative tiles: ${decorativeFiles.length}`)
    console.log(`   Impassable tiles: ${impassableFiles.length}`)
    console.log(`   Total tiles: ${grassTilesConfig.metadata.totalFiles}`)
    
    if (passableFiles.length === 0 && decorativeFiles.length === 0 && impassableFiles.length === 0) {
      console.warn('\n⚠️  Warning: No image files found in any category!')
    }
    
  } catch (error) {
    console.error('❌ Error analyzing grass tiles:', error.message)
    process.exit(1)
  }
}

// Run the analysis
analyzeGrassTiles()
