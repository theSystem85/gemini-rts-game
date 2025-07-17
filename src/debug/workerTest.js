// Simple test to verify web worker functionality
// This file helps debug web worker issues

try {
  console.log('Testing Web Worker support...')
  
  // Test 1: Basic Worker support
  if (typeof Worker === 'undefined') {
    console.error('❌ Web Workers not supported in this browser')
  } else {
    console.log('✅ Web Workers supported')
  }
  
  // Test 2: Module Worker support
  try {
    const testWorker = new Worker(
      new URL('../ai/aiWorker.js', import.meta.url),
      { type: 'module' }
    )
    
    testWorker.onmessage = (e) => {
      console.log('✅ Module Worker test successful:', e.data.type)
      testWorker.terminate()
    }
    
    testWorker.onerror = (error) => {
      console.error('❌ Module Worker test failed:', error)
      testWorker.terminate()
    }
    
    testWorker.postMessage({ type: 'TEST' })
    
  } catch (error) {
    console.error('❌ Module Worker creation failed:', error)
  }
  
  // Test 3: Import.meta.url support
  if (typeof import.meta.url === 'undefined') {
    console.error('❌ import.meta.url not supported')
  } else {
    console.log('✅ import.meta.url supported:', import.meta.url)
  }
  
} catch (error) {
  console.error('❌ Worker test failed:', error)
}

export default 'workerTest'
