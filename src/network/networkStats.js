/**
 * Network Statistics Module
 * Tracks network usage and bandwidth statistics for multiplayer sessions
 */

// ============ NETWORK STATS ============
const networkStats = {
  bytesSent: 0,
  bytesReceived: 0,
  lastBytesSent: 0,
  lastBytesReceived: 0,
  sendRate: 0,    // bytes per second
  receiveRate: 0, // bytes per second
  lastRateUpdate: 0
}

/**
 * Get current network statistics
 * @returns {Object} Network stats object
 */
export function getNetworkStats() {
  return { ...networkStats }
}

/**
 * Update network statistics with new sent/received bytes
 * @param {number} sent - Bytes sent in this update
 * @param {number} received - Bytes received in this update
 */
export function updateNetworkStats(sent = 0, received = 0) {
  const now = performance.now()

  // Update cumulative totals
  networkStats.bytesSent += sent
  networkStats.bytesReceived += received

  // Update rates every second
  const elapsed = now - networkStats.lastRateUpdate
  if (elapsed >= 1000) {
    const bytesSentSinceLastUpdate = networkStats.bytesSent - networkStats.lastBytesSent
    const bytesReceivedSinceLastUpdate = networkStats.bytesReceived - networkStats.lastBytesReceived

    networkStats.sendRate = Math.round((bytesSentSinceLastUpdate / elapsed) * 1000)
    networkStats.receiveRate = Math.round((bytesReceivedSinceLastUpdate / elapsed) * 1000)

    networkStats.lastBytesSent = networkStats.bytesSent
    networkStats.lastBytesReceived = networkStats.bytesReceived
    networkStats.lastRateUpdate = now
  }
}
