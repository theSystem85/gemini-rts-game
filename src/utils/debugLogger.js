/**
 * Custom Debug Logger
 * Only logs when ?debug query parameter is present in the URL
 *
 * Usage:
 *   window.logger('message', arg1, arg2)  // like console.log
 *   window.logger.warn('message', arg1)   // like console.warn
 *
 * Enable by adding ?debug to the URL:
 *   http://localhost:5173/?debug
 *   http://localhost:5173/?debug&invite=token
 */

// Check if debug mode is enabled via URL query parameter
function isDebugEnabled() {
  if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') {
    return false
  }
  const params = new URLSearchParams(window.location.search)
  return params.has('debug')
}

// Cache the debug state at module load time
const DEBUG_ENABLED = isDebugEnabled()

// Store references to native console methods to avoid recursion after find/replace
const nativeLog = console.log.bind(console)
const nativeWarn = console.warn.bind(console)
const nativeInfo = console.info.bind(console)
const nativeDebug = console.debug.bind(console)

/**
 * Logger function - works like console.log
 * Only outputs when ?debug is in the URL
 * @param  {...any} args - Arguments to log
 */
function logger(...args) {
  if (DEBUG_ENABLED) {
    nativeLog(...args)
  }
}

/**
 * Warning logger - works like console.warn
 * Only outputs when ?debug is in the URL
 * @param  {...any} args - Arguments to log
 */
logger.warn = function(...args) {
  if (DEBUG_ENABLED) {
    nativeWarn(...args)
  }
}

/**
 * Info logger - works like console.info
 * Only outputs when ?debug is in the URL
 * @param  {...any} args - Arguments to log
 */
logger.info = function(...args) {
  if (DEBUG_ENABLED) {
    nativeInfo(...args)
  }
}

/**
 * Debug logger - works like console.debug
 * Only outputs when ?debug is in the URL
 * @param  {...any} args - Arguments to log
 */
logger.debug = function(...args) {
  if (DEBUG_ENABLED) {
    nativeDebug(...args)
  }
}

/**
 * Check if debug logging is currently enabled
 * @returns {boolean}
 */
logger.isEnabled = function() {
  return DEBUG_ENABLED
}

// Expose logger globally on window object
if (typeof window !== 'undefined') {
  window.logger = logger
}

// Also export for ES module usage
export { logger, DEBUG_ENABLED }
export default logger
