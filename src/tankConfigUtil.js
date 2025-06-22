// Tank Image Configuration Utility
// Use this file to easily modify tank rendering configuration

import { getTankImageConfig } from './rendering/tankImageRenderer.js'

/**
 * Print current tank image configuration to console
 * Useful for debugging and tweaking values
 */
export function printTankImageConfig() {
  const config = getTankImageConfig()
  console.log('Current Tank Image Configuration:')
  console.log(JSON.stringify(config, null, 2))
}

/**
 * Example usage in browser console:
 * 
 * 1. Open browser console
 * 2. Import the utility:
 *    import('./src/tankConfigUtil.js').then(util => window.tankConfig = util)
 * 3. Print current config:
 *    tankConfig.printTankImageConfig()
 * 4. Modify the tankImageConfig.json file as needed
 * 5. Reload the game to see changes
 */

// Development helper - expose to window in dev mode
if (process.env.NODE_ENV !== 'production') {
  window.tankConfigUtil = {
    printTankImageConfig
  }
}
