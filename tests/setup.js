/**
 * Vitest setup file for RTS Game testing
 *
 * This file sets up the testing environment for headless integration tests
 * without video, audio, or rendering.
 */

// Note: vi is available globally in vitest tests - import kept for explicit usage
import { vi as _vi } from 'vitest'

// Mock the global logger that the game expects
globalThis.window = globalThis.window || {}
globalThis.window.logger = Object.assign(
  (...args) => {
    // Suppress logs during tests unless DEBUG_TESTS is set
    if (process.env.DEBUG_TESTS) {
      console.log('[GAME]', ...args)
    }
  },
  {
    warn: (...args) => {
      if (process.env.DEBUG_TESTS) {
        console.warn('[GAME WARN]', ...args)
      }
    },
    error: (...args) => {
      console.error('[GAME ERROR]', ...args)
    }
  }
)

// Mock performance.now() if not available
if (typeof performance === 'undefined') {
  globalThis.performance = {
    now: () => Date.now()
  }
}

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 16)
}

globalThis.cancelAnimationFrame = (id) => {
  clearTimeout(id)
}

// Mock Audio API to prevent audio loading/playing
globalThis.Audio = class MockAudio {
  constructor() {
    this.paused = true
    this.currentTime = 0
    this.volume = 1
    this.loop = false
    this.src = ''
  }
  play() { return Promise.resolve() }
  pause() { this.paused = true }
  load() {}
  addEventListener() {}
  removeEventListener() {}
}

// Mock AudioContext
globalThis.AudioContext = class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.destination = {}
  }
  createGain() {
    return {
      connect: () => {},
      gain: { value: 1, setValueAtTime: () => {} }
    }
  }
  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: { value: 440 }
    }
  }
  resume() { return Promise.resolve() }
  suspend() { return Promise.resolve() }
  close() { return Promise.resolve() }
}

// Mock canvas and WebGL context
class MockCanvasRenderingContext2D {
  constructor() {
    this.fillStyle = ''
    this.strokeStyle = ''
    this.lineWidth = 1
    this.font = ''
    this.textAlign = 'start'
    this.textBaseline = 'alphabetic'
    this.globalAlpha = 1
  }

  // Drawing methods
  fillRect() {}
  strokeRect() {}
  clearRect() {}
  fillText() {}
  strokeText() {}
  measureText(text) { return { width: text.length * 8 } }

  // Path methods
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  arcTo() {}
  rect() {}
  fill() {}
  stroke() {}
  clip() {}

  // Transform methods
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  setTransform() {}
  resetTransform() {}

  // Image methods
  drawImage() {}
  createPattern() { return null }
  createLinearGradient() {
    return { addColorStop: () => {} }
  }
  createRadialGradient() {
    return { addColorStop: () => {} }
  }

  // Pixel manipulation
  getImageData() {
    return { data: new Uint8ClampedArray(4), width: 1, height: 1 }
  }
  putImageData() {}
  createImageData() {
    return { data: new Uint8ClampedArray(4), width: 1, height: 1 }
  }
}

class MockWebGLRenderingContext {
  constructor() {}
  getExtension() { return null }
  getParameter() { return 0 }
  createShader() { return {} }
  createProgram() { return {} }
  createBuffer() { return {} }
  createTexture() { return {} }
  bindBuffer() {}
  bufferData() {}
  bindTexture() {}
  texImage2D() {}
  texParameteri() {}
  shaderSource() {}
  compileShader() {}
  getShaderParameter() { return true }
  attachShader() {}
  linkProgram() {}
  getProgramParameter() { return true }
  useProgram() {}
  getAttribLocation() { return 0 }
  getUniformLocation() { return {} }
  enableVertexAttribArray() {}
  vertexAttribPointer() {}
  uniform1i() {}
  uniform1f() {}
  uniform2f() {}
  uniform4f() {}
  uniformMatrix4fv() {}
  viewport() {}
  clearColor() {}
  clear() {}
  enable() {}
  disable() {}
  blendFunc() {}
  drawArrays() {}
  drawElements() {}
  deleteShader() {}
  deleteProgram() {}
  deleteBuffer() {}
  deleteTexture() {}
}

// Override canvas getContext
const originalCreateElement = document.createElement.bind(document)
document.createElement = function(tagName, options) {
  const element = originalCreateElement(tagName, options)

  if (tagName.toLowerCase() === 'canvas') {
    element.getContext = function(contextType) {
      if (contextType === '2d') {
        return new MockCanvasRenderingContext2D()
      } else if (contextType === 'webgl' || contextType === 'webgl2') {
        return new MockWebGLRenderingContext()
      }
      return null
    }
  }

  return element
}

// Mock Image loading
class MockImage {
  constructor() {
    this.src = ''
    this.width = 32
    this.height = 32
    this.complete = true
    this.naturalWidth = 32
    this.naturalHeight = 32
  }

  addEventListener(event, callback) {
    if (event === 'load') {
      // Simulate async load
      setTimeout(callback, 0)
    }
  }

  removeEventListener() {}
}

globalThis.Image = MockImage

// Mock localStorage
const mockStorage = {}
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = String(value) },
  removeItem: (key) => { delete mockStorage[key] },
  clear: () => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]) }
}

// Mock matchMedia
globalThis.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})

// Mock visualViewport
globalThis.visualViewport = {
  width: 1920,
  height: 1080,
  scale: 1,
  addEventListener: () => {},
  removeEventListener: () => {}
}

console.log('[TEST SETUP] Headless test environment initialized')
