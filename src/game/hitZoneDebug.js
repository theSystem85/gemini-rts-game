// Debug utility to test hit zone calculations
// This file is for testing and can be removed in production

import { calculateHitZoneDamageMultiplier } from './hitZoneCalculator.js'

/**
 * Test function to validate hit zone calculations
 * Run this in browser console: window.testHitZones()
 */
export function testHitZoneCalculations() {
  window.logger('Testing Hit Zone Damage Calculations...')

  // Create a mock tank unit at position (100, 100) facing right (0 radians)
  const mockTank = {
    type: 'tank',
    x: 100,
    y: 100,
    direction: 0, // Facing right
    id: 'test-tank'
  }

  // Test bullets from different directions
  const testCases = [
    { name: 'Front hit', bullet: { x: 140, y: 116 } }, // From right (front)
    { name: 'Rear hit', bullet: { x: 60, y: 116 } },   // From left (rear)
    { name: 'Side hit (top)', bullet: { x: 116, y: 60 } }, // From top
    { name: 'Side hit (bottom)', bullet: { x: 116, y: 140 } }, // From bottom
    { name: 'Front-right diagonal', bullet: { x: 140, y: 140 } },
    { name: 'Rear-left diagonal', bullet: { x: 60, y: 60 } }
  ]

  window.logger('Tank position: (116, 116) - center of 32x32 tile at (100, 100)')
  window.logger('Tank facing: Right (0 radians)')
  window.logger('')

  testCases.forEach(testCase => {
    const result = calculateHitZoneDamageMultiplier(testCase.bullet, mockTank)
    window.logger(`${testCase.name}:`)
    window.logger(`  Bullet at: (${testCase.bullet.x}, ${testCase.bullet.y})`)
    window.logger(`  Damage multiplier: ${result.multiplier}x`)
    window.logger(`  Critical hit: ${result.isRearHit ? 'YES' : 'NO'}`)
    window.logger('')
  })
}

// Make function available globally for testing
if (typeof window !== 'undefined') {
  window.testHitZones = testHitZoneCalculations
}
