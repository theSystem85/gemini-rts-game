// sound.js
import { MASTER_VOLUME } from './config.js'

// Import videoOverlay to update video audio volume
let videoOverlay = null
// Use dynamic import to avoid circular dependency
import('./ui/videoOverlay.js').then(module => {
  videoOverlay = module.videoOverlay
}).catch(e => {
  console.warn('Could not import videoOverlay for volume control:', e)
})

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
  cancel: [], // No cancel.mp3 file exists - will use fallback
  construction_paused: ['construction_paused.mp3'], // Direct file access
  construction_cancelled: ['construction_cancelled.mp3'], // Direct file access
  construction_started: ['construction_started.mp3'] // Direct file access
}

const activeAudioElements = new Map()
const soundThrottleTimestamps = new Map() // Track last play time for throttled sounds

// Queue for narrated (stackable) sounds
const narratedSoundQueue = []
let isNarratedPlaying = false
const MAX_NARRATED_STACK = 3

function playAssetSound(eventName, volume = 1.0, onEnded) {
  const files = soundFiles[eventName]
  if (files && files.length > 0) {
    const file = files[Math.floor(Math.random() * files.length)]
    const soundPath = 'sound/' + file

    // Create new audio instance every time to allow multiple instances
    const audio = new Audio(soundPath)
    audio.volume = volume * masterVolume // Apply master volume
    
    // Track this audio instance
    const audioId = soundPath + '_' + Date.now() + '_' + Math.random()
    
    const cleanup = () => {
      activeAudioElements.delete(audioId)
      if (onEnded) onEnded()
    }
    
    audio.addEventListener('ended', cleanup, { once: true })
    audio.addEventListener('error', (e) => {
      console.error('Error loading sound asset:', soundPath, e)
      cleanup()
    }, { once: true })

    audio.play().catch(e => {
      console.error('Error playing sound asset:', soundPath, e)
      cleanup()
    })

    activeAudioElements.set(audioId, audio)
    return true
  }
  // Return false if no files available (will trigger fallback beep)
  return false
}

function playImmediate(eventName, volume = 1.0, throttleSeconds = 0, onEnded) {
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
    const played = playAssetSound(eventName, volume, onEnded)
    if (played) return
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
  const { eventName, volume, throttleSeconds } = narratedSoundQueue.shift()
  playImmediate(eventName, volume, throttleSeconds, () => {
    playNextNarrated()
  })
}

export function playSound(eventName, volume = 1.0, throttleSeconds = 0, stackable = false) {
  if (stackable) {
    if (narratedSoundQueue.length + (isNarratedPlaying ? 1 : 0) >= MAX_NARRATED_STACK) {
      return
    }
    narratedSoundQueue.push({ eventName, volume, throttleSeconds })
    if (!isNarratedPlaying) {
      playNextNarrated()
    }
    return
  }

  playImmediate(eventName, volume, throttleSeconds)
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
const backgroundMusicFiles = ['music01.mp3'] // add more files as needed
export let bgMusicAudio = null

export async function initBackgroundMusic() {
  if (bgMusicAudio) return
  if (!backgroundMusicFiles || backgroundMusicFiles.length === 0) return

  const file = backgroundMusicFiles[Math.floor(Math.random() * backgroundMusicFiles.length)]
  bgMusicAudio = new Audio('sound/music/' + file)
  bgMusicAudio.loop = true
  bgMusicAudio.volume = masterVolume // Apply master volume to background music

  return new Promise(resolve => {
    const cleanup = () => {
      bgMusicAudio.removeEventListener('canplaythrough', cleanup)
      bgMusicAudio.removeEventListener('error', cleanup)
      resolve()
    }

    bgMusicAudio.addEventListener('canplaythrough', cleanup, { once: true })
    bgMusicAudio.addEventListener('error', cleanup, { once: true })
    bgMusicAudio.load()
  })
}

export async function toggleBackgroundMusic() {
  if (!bgMusicAudio) {
    await initBackgroundMusic()
  }

  if (bgMusicAudio) {
    if (bgMusicAudio.paused) {
      bgMusicAudio.play().catch(e => {
        console.error('Error resuming background music:', e)
      })
    } else {
      bgMusicAudio.pause()
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
