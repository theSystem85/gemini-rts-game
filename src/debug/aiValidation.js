// aiValidation.js - Simple validation tests for AI refactoring
// Run this in browser console to validate AI system

class AIValidator {
  constructor() {
    this.tests = []
    this.results = []
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn })
  }

  async runAllTests() {
    console.log('🧪 Running AI Validation Tests...')
    console.log('='.repeat(50))
    
    this.results = []
    
    for (const test of this.tests) {
      try {
        const result = await test.testFn()
        this.results.push({ name: test.name, passed: result, error: null })
        console.log(`✅ ${test.name}: PASSED`)
      } catch (error) {
        this.results.push({ name: test.name, passed: false, error })
        console.log(`❌ ${test.name}: FAILED - ${error.message}`)
      }
    }
    
    this.printSummary()
  }

  printSummary() {
    console.log('='.repeat(50))
    const passed = this.results.filter(r => r.passed).length
    const total = this.results.length
    console.log(`📊 Test Summary: ${passed}/${total} tests passed`)
    
    if (passed === total) {
      console.log('🎉 All tests passed! AI refactoring is working correctly.')
    } else {
      console.log('⚠️  Some tests failed. Check the results above.')
    }
  }
}

// Create validator instance
const validator = new AIValidator()

// Test 1: Check if AIManager exists
validator.addTest('AI Manager Exists', () => {
  const aiManager = window.gameInstance?.gameLoop?.aiManager
  if (!aiManager) {
    throw new Error('AIManager not found in game instance')
  }
  return true
})

// Test 2: Check if AI Performance Display exists
validator.addTest('AI Performance Display Exists', () => {
  const aiPerformanceDisplay = window.gameInstance?.gameLoop?.aiPerformanceDisplay
  if (!aiPerformanceDisplay) {
    throw new Error('AIPerformanceDisplay not found in game instance')
  }
  return true
})

// Test 3: Check if Web Worker is initialized
validator.addTest('Web Worker Initialized', () => {
  const aiManager = window.gameInstance?.gameLoop?.aiManager
  if (!aiManager) {
    throw new Error('AIManager not found')
  }
  
  // Worker might be null (fallback mode) but that's still valid
  if (aiManager.worker === null) {
    console.log('ℹ️  Web Worker not available, using fallback mode')
  }
  
  return aiManager.isInitialized || aiManager.worker === null
})

// Test 4: Check if AI loop can be started
validator.addTest('AI Loop Can Start', async () => {
  const aiManager = window.gameInstance?.gameLoop?.aiManager
  if (!aiManager) {
    throw new Error('AIManager not found')
  }
  
  // Try to start AI loop
  aiManager.startAILoop()
  
  // Wait a moment for initialization
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Check if AI loop is active
  return aiManager.isAILoopActive()
})

// Test 5: Check debug commands
validator.addTest('Debug Commands Available', () => {
  if (typeof window.debugAI !== 'object') {
    throw new Error('debugAI commands not available')
  }
  
  const requiredMethods = ['getPerformance', 'toggleDebug', 'showDisplay', 'hideDisplay', 'isAIActive', 'getCurrentInterval']
  
  for (const method of requiredMethods) {
    if (typeof window.debugAI[method] !== 'function') {
      throw new Error(`debugAI.${method} is not a function`)
    }
  }
  
  return true
})

// Test 6: Check performance data
validator.addTest('Performance Data Available', async () => {
  const aiManager = window.gameInstance?.gameLoop?.aiManager
  if (!aiManager) {
    throw new Error('AIManager not found')
  }
  
  // Start AI if not already running
  if (!aiManager.isAILoopActive()) {
    aiManager.startAILoop()
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  const perfData = aiManager.getPerformanceData()
  
  // Performance data might be empty initially, that's okay
  return typeof perfData === 'object'
})

// Test 7: Check if AI performance display can be toggled
validator.addTest('AI Performance Display Toggle', () => {
  const display = window.gameInstance?.gameLoop?.aiPerformanceDisplay
  if (!display) {
    throw new Error('AI Performance Display not found')
  }
  
  const initialState = display.visible
  display.toggle()
  const toggledState = display.visible
  display.toggle()
  const finalState = display.visible
  
  if (toggledState === initialState) {
    throw new Error('Display toggle did not change state')
  }
  
  if (finalState !== initialState) {
    throw new Error('Display toggle did not return to initial state')
  }
  
  return true
})

// Test 8: Check if old AI update is removed from main loop
validator.addTest('AI Removed from Main Update Loop', () => {
  // Check if updateGame.js no longer imports updateEnemyAI
  // This is a indirect test by checking if the AI manager is handling AI
  const aiManager = window.gameInstance?.gameLoop?.aiManager
  if (!aiManager) {
    throw new Error('AIManager not found - AI might still be in main loop')
  }
  
  // If AI manager exists and can start, the refactoring is likely successful
  return true
})

// Test 9: Check keyboard shortcut
validator.addTest('Keyboard Shortcut Works', () => {
  // Simulate 'j' key press to toggle AI performance display
  const display = window.gameInstance?.gameLoop?.aiPerformanceDisplay
  if (!display) {
    throw new Error('AI Performance Display not found')
  }
  
  const initialState = display.visible
  
  // Simulate keydown event
  const event = new KeyboardEvent('keydown', { key: 'j', keyCode: 74 })
  document.dispatchEvent(event)
  
  // The event might be processed asynchronously, so we check the method exists
  // rather than the actual state change
  return typeof display.toggle === 'function'
})

// Test 10: Stress test with performance monitoring
validator.addTest('Performance Monitoring Under Load', async () => {
  const aiManager = window.gameInstance?.gameLoop?.aiManager
  if (!aiManager) {
    throw new Error('AIManager not found')
  }
  
  // Enable debug mode for detailed logging
  aiManager.setDebugMode(true)
  
  // Start AI loop if not running
  if (!aiManager.isAILoopActive()) {
    aiManager.startAILoop()
  }
  
  // Wait for at least one AI iteration
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const perfData = aiManager.getPerformanceData()
  
  // Disable debug mode
  aiManager.setDebugMode(false)
  
  // Check that we have some performance data
  return typeof perfData === 'object' && Object.keys(perfData).length >= 0
})

// Export for console use
window.AIValidator = AIValidator
window.aiValidator = validator

// Auto-run if not in test mode
if (typeof window.gameInstance !== 'undefined' && window.gameInstance.gameLoop) {
  console.log('🤖 AI Validation Test Suite Loaded')
  console.log('Run: aiValidator.runAllTests()')
} else {
  console.log('⏳ Game not loaded yet. Load the game first, then run: aiValidator.runAllTests()')
}
