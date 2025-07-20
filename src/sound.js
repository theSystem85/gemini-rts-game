// sound.js
import { MASTER_VOLUME } from './config.js'
import { videoOverlay } from './ui/videoOverlay.js'
import { gameState } from './gameState.js'

let audioContext = null
try {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
} catch {
  console.error('Web Audio API is not supported.')
}

// Master volume control with localStorage persistence
const VOLUME_STORAGE_KEY = 'rts-game-master-volume'

// Load volume from localStorage or use default
function loadVolumeFromStorage() {
  try {
    const storedVolume = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (storedVolume !== null) {
      const parsedVolume = parseFloat(storedVolume)
      if (!isNaN(parsedVolume) && parsedVolume >= 0 && parsedVolume <= 1) {
        return parsedVolume
      }
    }
  } catch (e) {
    console.warn('Failed to load volume from localStorage:', e)
  }
  return MASTER_VOLUME // Fall back to default
}

// Save volume to localStorage
function saveVolumeToStorage(volume) {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString())
  } catch (e) {
    console.warn('Failed to save volume to localStorage:', e)
  }
}

let masterVolume = loadVolumeFromStorage()

const soundFiles = {
  // Original sound categories
  explosion: ['explosion01.mp3', 'explosion02.mp3', 'explosion03.mp3', 'explosion04.mp3'],
  tankShot: ['tankShot01.mp3', 'tankShot02.mp3', 'tankShot03.mp3'],
  tankShot03: ['tankShot03.mp3'], // Specific sound for turretGunV3
  tankMove: ['tankEngineStart01.mp3', 'confirmed.mp3', 'onMyWay.mp3'],
  confirmed: ['confirmed.mp3'], // Direct mapping for confirmed sound
  constructionComplete: ['constructionComplete.mp3'],
  unitReady: ['unitReady01.mp3', 'unitReady02.mp3', 'unitReady03.mp3'],
  unitReady01: ['unitReady01.mp3'],
  unitReady02: ['unitReady02.mp3'], 
  unitReady03: ['unitReady03.mp3'],
  unit_is_being_repaired: ['unit_is_being_repaired.mp3'],
  bulletHit: ['bulletHit01.mp3'],
  deposit: ['deposit.mp3'],
  unitSelection: ['yesSir01.mp3'],
  patriotMissile: ['patriotMissile01.mp3', 'patriotMissile02.mp3'],
  constructionStarted: ['construction_started.mp3', 'building.mp3'],
  constructionPaused: ['construction_paused.mp3'],
  constructionCancelled: ['construction_cancelled.mp3'],
  building: ['building.mp3'],
  buildingPlaced: ['buildingPlaced.mp3'],
  harvest: ['harvest.mp3'],
  unitLost: ['unit_lost.mp3'],
  attacking: ['attacking.mp3'],
  enemyUnitDestroyed: ['enemy_unit_destroyed.mp3'],
  enemyBuildingDestroyed: ['enemy_building_destroyed.mp3'],
  teslacoil_loading: ['teslacoil_loading.mp3'],
  teslacoil_firing: ['teslacoil_firing.mp3'],
  criticalDamage: ['critical_damage.mp3'],
  Repair_impossible_when_under_attack: ['Repair_impossible_when_under_attack.mp3'],
  battleWon: ['battleWon.mp3'],
  battleLost: ['battleLost.mp3'],
  playerBlueDefeated: ['playerBlueDefeated.mp3'],
  playerGreenDefeated: ['playerGreenDefeated.mp3'],
  playerRedDefeated: ['playerRedDefeated.mp3'],
  playerYellowDefeated: ['playerYellowDefeated.mp3'],
  new_units_types_available: ['new_units_types_available.mp3'],
  new_building_types_available: ['new_building_types_available.mp3'],
  new_production_options: ['new_production_options.mp3'],
  
  // New waypoint and attack notification sounds
  movingAlongThePath: ['movingAlongThePath.mp3'],
  ourBaseIsUnderAttack: ['ourBaseIsUnderAttack.mp3'],
  ourHarvestersAreUnderAttack: ['ourHarvestersAreUnderAttack.mp3'],
  chainOfCommandsReceived: ['chainOfCommandsReceived.mp3'],
  
  // Game event aliases (previously in soundMapping)
  movement: ['tankEngineStart01.mp3', 'confirmed.mp3', 'onMyWay.mp3'], // alias for tankMove
  shoot: ['tankShot01.mp3', 'tankShot02.mp3', 'tankShot03.mp3'], // alias for tankShot
  shoot_rocket: ['patriotMissile01.mp3', 'patriotMissile02.mp3'], // alias for patriotMissile
  shoot_heavy: ['tankShot03.mp3'], // alias for tankShot03
  productionStart: ['construction_started.mp3', 'building.mp3'], // alias for constructionStarted
  productionPaused: ['construction_paused.mp3'], // alias for constructionPaused
  productionCancelled: ['construction_cancelled.mp3'], // alias for constructionCancelled
  construction_obstructed: ['construction_obstructed.mp3'], // alias for constructionObstructed
  
  // Direct file access (for legacy compatibility)
  yesSir01: ['yesSir01.mp3'],
  
  // Missing sound placeholders (will use fallback beep)
  error: [], // No error.mp3 file exists - will use fallback
  cancel: [] // No cancel.mp3 file exists - will use fallback
}

const activeAudioElements = new Map()
const soundThrottleTimestamps = new Map() // Track last play time for throttled sounds

// Background music files
const backgroundMusicFiles = ['music01.mp3'] // add more files as needed

// Cache audio buffers using Web Audio API for true zero-network caching
const audioBufferCache = new Map()
const loadingPromises = new Map() // Track files currently being loaded

async function getCachedAudioBuffer(soundPath) {
  // Check if already cached
  let buffer = audioBufferCache.get(soundPath)
  if (buffer) {
    return buffer
  }

  // Check if currently loading
  let loadPromise = loadingPromises.get(soundPath)
  if (loadPromise) {
    return await loadPromise
  }

  // Start loading
  loadPromise = loadAudioBuffer(soundPath)
  loadingPromises.set(soundPath, loadPromise)

  try {
    buffer = await loadPromise
    audioBufferCache.set(soundPath, buffer)
    loadingPromises.delete(soundPath)
    return buffer
  } catch (error) {
    loadingPromises.delete(soundPath)
    throw error
  }
}

async function loadAudioBuffer(soundPath) {
  if (!audioContext) {
    throw new Error('AudioContext not available')
  }

  try {
    const response = await fetch(soundPath)
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return audioBuffer
  } catch (error) {
    console.error(`Error loading audio buffer for ${soundPath}:`, error)
    throw error
  }
}

function playAudioBuffer(audioBuffer, volume = 1.0, onEnded, options = {}) {
  const { pan = 0 } = options
  if (!audioContext || !audioBuffer) {
    if (onEnded) setTimeout(onEnded, 0)
    return
  }

  try {
    const source = audioContext.createBufferSource()
    const gainNode = audioContext.createGain()
    let panner = null

    source.buffer = audioBuffer
    if (typeof audioContext.createStereoPanner === 'function') {
      panner = audioContext.createStereoPanner()
      panner.pan.value = pan
      source.connect(panner)
      panner.connect(gainNode)
    } else {
      source.connect(gainNode)
    }
    gainNode.connect(audioContext.destination)
    gainNode.gain.value = volume * masterVolume

    // Handle ended event
    if (onEnded) {
      source.addEventListener('ended', onEnded, { once: true })
    }

    source.start()
    return source
  } catch (error) {
    console.error('Error playing audio buffer:', error)
    if (onEnded) setTimeout(onEnded, 0)
    return null
  }
}

// Fallback function for legacy Audio elements (background music)
function getCachedAudioElement(soundPath) {
  let element = soundElementCache.get(soundPath)
  if (!element) {
    element = new Audio(soundPath)
    element.preload = 'auto'
    
    // Ensure the audio is fully loaded before caching
    const loadPromise = new Promise((resolve, reject) => {
      const onLoad = () => {
        element.removeEventListener('canplaythrough', onLoad)
        element.removeEventListener('error', onError)
        resolve(element)
      }
      const onError = (e) => {
        element.removeEventListener('canplaythrough', onLoad)
        element.removeEventListener('error', onError)
        // Don't cache failed loads
        soundElementCache.delete(soundPath)
        reject(e)
      }
      
      element.addEventListener('canplaythrough', onLoad, { once: true })
      element.addEventListener('error', onError, { once: true })
    })
    
    loadingPromises.set(soundPath + '_element', loadPromise)
    element.load()
    soundElementCache.set(soundPath, element)
  }
  
  // Clone so multiple sounds can play simultaneously while sharing cached data
  return element.cloneNode(true)
}

// Keep legacy element cache for background music
const soundElementCache = new Map()

function calculatePositionalAudio(x, y) {
  const canvas = document.getElementById('gameCanvas')
  if (!canvas) {
    return { pan: 0, volumeFactor: 1 }
  }
  const centerX = gameState.scrollOffset.x + canvas.width / 2
  const centerY = gameState.scrollOffset.y + canvas.height / 2
  const dx = x - centerX
  const dy = y - centerY
  const distance = Math.hypot(dx, dy)
  const maxDistance = Math.max(canvas.width, canvas.height) * 0.75
  const volumeFactor = Math.max(0, 1 - distance / maxDistance)
  const pan = Math.max(-1, Math.min(1, dx / maxDistance))
  return { pan, volumeFactor }
}

// Preload all sound files to ensure they're cached
async function preloadAllSounds() {
  const allSoundFiles = new Set()
  
  // Collect all unique sound files from soundFiles object
  Object.values(soundFiles).forEach(fileArray => {
    fileArray.forEach(filename => {
      if (filename) { // Skip empty entries
        allSoundFiles.add('sound/' + filename)
      }
    })
  })
  
  // DON'T preload background music files - they will be loaded on demand
  // backgroundMusicFiles.forEach(filename => {
  //   allSoundFiles.add('sound/music/' + filename)
  // })
  
  console.log(`Preloading ${allSoundFiles.size} unique sound files into audio buffer cache...`)
  console.log(`Background music (${backgroundMusicFiles.length} files) will be loaded on demand`)
  
  const loadPromises = []
  
  allSoundFiles.forEach(soundPath => {
    // Use Web Audio API buffer cache for sound effects only
    loadPromises.push(
      getCachedAudioBuffer(soundPath).catch(e => {
        console.warn(`Failed to preload sound buffer: ${soundPath}`, e)
      })
    )
  })
  
  // Wait for all sound effects to preload
  try {
    await Promise.allSettled(loadPromises)
    console.log(`Sound effects preloaded into buffer cache! ${audioBufferCache.size} buffers cached.`)
  } catch (error) {
    console.error('Error during sound preloading:', error)
  }
}

// Queue for narrated (stackable) sounds
const narratedSoundQueue = []
let isNarratedPlaying = false
const MAX_NARRATED_STACK = 3

async function playAssetSound(eventName, volume = 1.0, onEnded, options = {}) {
  const files = soundFiles[eventName]
  if (files && files.length > 0) {
    const file = files[Math.floor(Math.random() * files.length)]
    const soundPath = 'sound/' + file

    try {
      // Use Web Audio API buffer for zero-network cached playback
      const audioBuffer = await getCachedAudioBuffer(soundPath)
      
      // Track this audio instance
      const audioId = soundPath + '_' + Date.now() + '_' + Math.random()
      
      const cleanup = () => {
        activeAudioElements.delete(audioId)
        if (onEnded) onEnded()
      }
      
      const source = playAudioBuffer(audioBuffer, volume, cleanup, options)
      if (source) {
        activeAudioElements.set(audioId, source)
        return true
      }
    } catch (error) {
      console.error('Error playing cached audio buffer:', soundPath, error)
      if (onEnded) onEnded()
    }
  }
  // Return false if no files available (will trigger fallback beep)
  return false
}

function playImmediate(eventName, volume = 1.0, throttleSeconds = 0, onEnded, options = {}) {
  if (!audioContext) { 
    if (onEnded) setTimeout(onEnded, 0)
    return 
  }

  // Check throttling if throttleSeconds > 0
  if (throttleSeconds > 0) {
    const now = Date.now()
    const lastPlayTime = soundThrottleTimestamps.get(eventName)
    if (lastPlayTime && (now - lastPlayTime) < (throttleSeconds * 1000)) {
      // Sound is throttled, don't play
      if (onEnded) setTimeout(onEnded, 0)
      return
    }
    // Update timestamp for this sound
    soundThrottleTimestamps.set(eventName, now)
  }

  // Use eventName directly with soundFiles instead of mapping
  if (soundFiles[eventName]) {
    playAssetSound(eventName, volume, onEnded, options).catch(e => {
      console.error('Error in playAssetSound:', e)
      if (onEnded) onEnded()
    })
    return
  }

  // Fallback beep sound.
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 500
    oscillator.type = 'sine'
    gainNode.gain.value = volume * masterVolume // Apply master volume
    
    // Use a more reliable callback mechanism for the fallback beep
    const duration = 0.3 // Slightly longer beep for better audio feedback
    oscillator.start()
    oscillator.stop(audioContext.currentTime + duration)
    
    // Ensure callback is only called once
    if (onEnded) {
      let callbackCalled = false
      const callOnce = () => {
        if (!callbackCalled) {
          callbackCalled = true
          onEnded()
        }
      }
      oscillator.addEventListener('ended', callOnce, { once: true })
      // Also set a timeout as backup
      setTimeout(callOnce, duration * 1000 + 50) // Add 50ms buffer
    }
  } catch (e) {
    console.error('AudioContext error:', e)
    if (onEnded) setTimeout(onEnded, 0)
  }
}

function playNextNarrated() {
  if (narratedSoundQueue.length === 0) {
    isNarratedPlaying = false
    return
  }
  isNarratedPlaying = true
  const { eventName, volume, throttleSeconds, options } = narratedSoundQueue.shift()
  playImmediate(eventName, volume, throttleSeconds, () => {
    playNextNarrated()
  }, options)
}

export function playSound(eventName, volume = 1.0, throttleSeconds = 0, stackable = false, options = {}) {
  if (stackable) {
    if (narratedSoundQueue.length + (isNarratedPlaying ? 1 : 0) >= MAX_NARRATED_STACK) {
      return
    }
    narratedSoundQueue.push({ eventName, volume, throttleSeconds, options })
    if (!isNarratedPlaying) {
      playNextNarrated()
    }
    return
  }

  playImmediate(eventName, volume, throttleSeconds, undefined, options)
}

export function playPositionalSound(eventName, x, y, volume = 1.0, throttleSeconds = 0, stackable = false) {
  const { pan, volumeFactor } = calculatePositionalAudio(x, y)
  const finalVolume = volume * volumeFactor
  if (finalVolume <= 0) return
  const options = { pan }
  playSound(eventName, finalVolume, throttleSeconds, stackable, options)
}

// Test function for narrated sound stacking (can be called from browser console)
export function testNarratedSounds() {
  console.log('Testing narrated sound stacking...')
  playSound('construction_started', 1.0, 0, true)
  playSound('constructionComplete', 1.0, 0, true)
  playSound('unitReady01', 1.0, 0, true)
  console.log('Queued 3 narrated sounds. They should play one after another.')
}

// --- Background Music Functionality ---
export let bgMusicAudio = null
let backgroundMusicInitialized = false
let backgroundMusicLoading = false

export async function initBackgroundMusic() {
  if (bgMusicAudio && backgroundMusicInitialized) return
  if (backgroundMusicLoading) {
    // Already loading, wait for it to complete
    while (backgroundMusicLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return
  }
  if (!backgroundMusicFiles || backgroundMusicFiles.length === 0) return

  backgroundMusicLoading = true
  console.log('Loading background music on demand...')
  
  const file = backgroundMusicFiles[Math.floor(Math.random() * backgroundMusicFiles.length)]
  const musicPath = 'sound/music/' + file
  
  try {
    // Check if already cached from a previous session
    let element = soundElementCache.get(musicPath)
    if (!element) {
      // Create and load the audio element only once
      element = new Audio(musicPath)
      element.preload = 'auto'
      element.loop = true
      element.volume = masterVolume
      
      // Wait for it to be ready before caching
      await new Promise((resolve, reject) => {
        const onLoad = () => {
          element.removeEventListener('canplaythrough', onLoad)
          element.removeEventListener('error', onError)
          resolve()
        }
        const onError = (e) => {
          element.removeEventListener('canplaythrough', onLoad)
          element.removeEventListener('error', onError)
          reject(e)
        }
        
        element.addEventListener('canplaythrough', onLoad, { once: true })
        element.addEventListener('error', onError, { once: true })
        element.load() // Only load once here
      })
      
      // Cache the loaded element
      soundElementCache.set(musicPath, element)
      console.log('Background music loaded and cached successfully')
    } else {
      console.log('Background music retrieved from cache')
    }
    
    // Use the cached element directly (no cloning for background music)
    bgMusicAudio = element
    bgMusicAudio.volume = masterVolume // Ensure volume is correct
    
  } catch (e) {
    console.error('Error loading background music:', e)
  } finally {
    backgroundMusicLoading = false
    backgroundMusicInitialized = true
  }
}

export async function toggleBackgroundMusic() {
  // Initialize music on first toggle (loads from server once)
  if (!backgroundMusicInitialized && !backgroundMusicLoading) {
    await initBackgroundMusic()
  }

  if (bgMusicAudio) {
    if (bgMusicAudio.paused) {
      try {
        await bgMusicAudio.play()
        console.log('Background music resumed from cache')
      } catch (e) {
        console.error('Error resuming background music:', e)
      }
    } else {
      bgMusicAudio.pause()
      console.log('Background music paused')
    }
  }
}

// --- Master Volume Control Functions ---
export function setMasterVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume)) // Clamp between 0 and 1
  
  // Save to localStorage
  saveVolumeToStorage(masterVolume)
  
  // Update background music volume if it exists
  if (bgMusicAudio) {
    bgMusicAudio.volume = masterVolume
  }
  
  // Update video audio volume if video overlay is available
  if (videoOverlay && typeof videoOverlay.updateAudioVolume === 'function') {
    videoOverlay.updateAudioVolume()
  }
}

export function getMasterVolume() {
  return masterVolume
}

// Preload all sound files during game initialization
export async function preloadSounds() {
  await preloadAllSounds()
}

// Get cache status for debugging
export function getSoundCacheStatus() {
  const bufferCacheSize = audioBufferCache.size
  const elementCacheSize = soundElementCache.size
  const loadingCount = loadingPromises.size
  const cachedBuffers = Array.from(audioBufferCache.keys())
  const cachedElements = Array.from(soundElementCache.keys())
  
  console.log(`Sound cache status:`)
  console.log(`- Audio buffers cached: ${bufferCacheSize} (sound effects)`)
  console.log(`- Audio elements cached: ${elementCacheSize} (background music)`)
  console.log(`- Background music initialized: ${backgroundMusicInitialized}`)
  console.log(`- Background music loading: ${backgroundMusicLoading}`)
  console.log(`- Currently loading: ${loadingCount}`)
  console.log(`- Buffer cache contents:`, cachedBuffers)
  console.log(`- Element cache contents:`, cachedElements)
  
  return { 
    bufferCacheSize, 
    elementCacheSize, 
    loadingCount, 
    cachedBuffers, 
    cachedElements,
    backgroundMusicInitialized,
    backgroundMusicLoading
  }
}

// Clear cache (for testing/debugging)
export function clearSoundCache() {
  console.log(`Clearing sound cache (${audioBufferCache.size} buffers, ${soundElementCache.size} elements)...`)
  audioBufferCache.clear()
  soundElementCache.clear()
  loadingPromises.clear()
  
  // Reset background music state
  backgroundMusicInitialized = false
  backgroundMusicLoading = false
  if (bgMusicAudio) {
    bgMusicAudio.pause()
    bgMusicAudio = null
  }
  
  console.log('Sound cache cleared, background music reset')
}
