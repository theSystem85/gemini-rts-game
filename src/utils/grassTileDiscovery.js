// utils/grassTileDiscovery.js
// Dynamic discovery of grass tiles from JSON configuration

/**
 * Discover grass tiles from the generated JSON configuration file
 * Returns arrays of tile paths organized by type
 */
export async function discoverGrassTiles() {
  try {
    // Load the generated JSON configuration
    const response = await fetch('images/map/grass_tiles/grass_tiles.json')
    
    if (!response.ok) {
      throw new Error(`Failed to load grass tiles configuration: ${response.status} ${response.statusText}`)
    }
    
    const config = await response.json()
    
    // Validate the configuration structure
    if (!config.passablePaths || !config.decorativePaths || !config.impassablePaths) {
      throw new Error('Invalid grass tiles configuration: missing required path arrays')
    }
    
    console.log(`🌱 Loaded grass tiles configuration:`)
    console.log(`   Passable: ${config.passablePaths.length} tiles`)
    console.log(`   Decorative: ${config.decorativePaths.length} tiles`)
    console.log(`   Impassable: ${config.impassablePaths.length} tiles`)
    console.log(`   Total: ${config.passablePaths.length + config.decorativePaths.length + config.impassablePaths.length} tiles`)
    console.log(`   Generated: ${config.metadata?.generatedAt || 'Unknown'}`)
    
    // Validate that we have tiles in each category
    if (config.passablePaths.length === 0) {
      console.warn('⚠️  No passable grass tiles found - this may cause rendering issues')
    }
    if (config.decorativePaths.length === 0) {
      console.warn('⚠️  No decorative grass tiles found - reduced variety')
    }
    if (config.impassablePaths.length === 0) {
      console.warn('⚠️  No impassable grass tiles found - reduced variety')
    }
    
    return {
      passablePaths: config.passablePaths,
      decorativePaths: config.decorativePaths,
      impassablePaths: config.impassablePaths
    }
    
  } catch (error) {
    console.error('❌ Failed to load grass tiles configuration from JSON:', error.message)
    console.error('❌ Cannot proceed without grass_tiles.json - this is the single source of truth')
    
    // Instead of fallback, throw error to indicate the JSON must be available
    throw new Error(`Grass tiles JSON configuration is required but could not be loaded: ${error.message}`)
  }
}

/**
 * Alternative approach using fetch to dynamically discover files
 * This would require a server endpoint that lists directory contents
 * For now, we use the JSON configuration approach above
 */
export async function discoverGrassTilesDynamic() {
  // This would be used if we had a server endpoint that could list directory contents
  // For static hosting, we use the JSON configuration approach above
  return discoverGrassTiles()
}
