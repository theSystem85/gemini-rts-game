// Tank Image Configuration Utility
// Use this file to easily modify tank rendering configuration

import { getTankImageConfig } from './rendering/tankImageRenderer.js'

/**
 * Print current tank image configuration to console
 * Useful for debugging and tweaking values
 * @param {string} variant - Tank variant to print (tankV1, tankV2, tankV3, or 'all')
 */
export function printTankImageConfig(variant = 'all') {
  const config = getTankImageConfig()
  
  if (variant === 'all') {
    console.log('Current Tank Image Configuration:')
    console.log(JSON.stringify(config, null, 2))
  } else if (config[variant]) {
    console.log(`Current Tank Image Configuration for ${variant}:`)
    console.log(JSON.stringify(config[variant], null, 2))
  } else {
    console.error(`Invalid variant: ${variant}. Use 'tankV1', 'tankV2', 'tankV3', or 'all'`)
  }
}

/**
 * Example usage in browser console:
 * 
 * 1. Open browser console
 * 2. Import the utility:
 *    import('./src/tankConfigUtil.js').then(util => window.tankConfig = util)
 * 3. Print current config:
 *    tankConfig.printTankImageConfig() // All variants
 *    tankConfig.printTankImageConfig('tankV1') // Specific variant
 * 4. Modify the tankImageConfig.json file as needed
 * 5. Reload the game to see changes
 */

// Development helper - expose to window in dev mode
if (process.env.NODE_ENV !== 'production') {
  window.tankConfigUtil = {
    printTankImageConfig
  }
}
