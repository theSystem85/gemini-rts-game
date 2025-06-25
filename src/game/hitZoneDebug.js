// Debug utility to test hit zone calculations
// This file is for testing and can be removed in production

import { calculateHitZoneDamageMultiplier } from './hitZoneCalculator.js'

/**
 * Test function to validate hit zone calculations
 * Run this in browser console: window.testHitZones()
 */
export function testHitZoneCalculations() {
  console.log('Testing Hit Zone Damage Calculations...')
  
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
  
  console.log('Tank position: (116, 116) - center of 32x32 tile at (100, 100)')
  console.log('Tank facing: Right (0 radians)')
  console.log('')
  
  testCases.forEach(testCase => {
    const result = calculateHitZoneDamageMultiplier(testCase.bullet, mockTank)
    console.log(`${testCase.name}:`)
    console.log(`  Bullet at: (${testCase.bullet.x}, ${testCase.bullet.y})`)
    console.log(`  Damage multiplier: ${result.multiplier}x`)
    console.log(`  Critical hit: ${result.isRearHit ? 'YES' : 'NO'}`)
    console.log('')
  })
}

// Make function available globally for testing
if (typeof window !== 'undefined') {
  window.testHitZones = testHitZoneCalculations
}
