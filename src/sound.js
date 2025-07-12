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

function playAssetSound(eventName, volume = 1.0) {
  const files = soundFiles[eventName]
  if (files && files.length > 0) {
    const file = files[Math.floor(Math.random() * files.length)]
    const soundPath = 'sound/' + file

    // Check if this sound is already playing
    if (activeAudioElements.has(soundPath)) {
      const existingAudio = activeAudioElements.get(soundPath)
      existingAudio.currentTime = 0
      existingAudio.volume = volume * masterVolume // Apply master volume
      existingAudio.play().catch(e => {
        console.error('Error replaying sound asset:', e)
      })
      return true
    }

    const audio = new Audio(soundPath)
    audio.volume = volume * masterVolume // Apply master volume
    audio.addEventListener('ended', () => {
      activeAudioElements.delete(soundPath)
    })

    audio.play().catch(e => {
      console.error('Error playing sound asset:', e)
      activeAudioElements.delete(soundPath)
    })

    activeAudioElements.set(soundPath, audio)
    return true
  }
  // Return false if no files available (will trigger fallback beep)
  return false
}

export function playSound(eventName, volume = 1.0, throttleSeconds = 0) {
  if (!audioContext) return
  
  // Check throttling if throttleSeconds > 0
  if (throttleSeconds > 0) {
    const now = Date.now()
    const lastPlayTime = soundThrottleTimestamps.get(eventName)
    if (lastPlayTime && (now - lastPlayTime) < (throttleSeconds * 1000)) {
      // Sound is throttled, don't play
      return
    }
    // Update timestamp for this sound
    soundThrottleTimestamps.set(eventName, now)
  }
  
  // Use eventName directly with soundFiles instead of mapping
  if (soundFiles[eventName]) {
    const played = playAssetSound(eventName, volume)
    if (played) return
  }
  
  // Fallback beep sound.
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value =
      eventName === 'unitSelection' ? 600 :
        eventName === 'movement' ? 400 :
          eventName === 'shoot' ? 800 :
            eventName === 'shoot_rocket' ? 100 :
              eventName === 'productionStart' ? 500 :
                eventName === 'constructionComplete' ? 700 :
                  eventName === 'bulletHit' ? 900 :
                    eventName === 'harvest' ? 350 :
                      eventName === 'deposit' ? 450 :
                        eventName === 'explosion' ? 200 : 500
    oscillator.type = 'sine'
    gainNode.gain.value = volume * masterVolume // Apply master volume
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.1)
    console.log(`Fallback sound played for event: ${eventName}`)
  } catch (e) {
    console.error('AudioContext error:', e)
  }
}

// --- Background Music Functionality ---
const backgroundMusicFiles = ['music01.mp3'] // add more files as needed
export let bgMusicAudio = null

export function initBackgroundMusic() {
  if (!backgroundMusicFiles || backgroundMusicFiles.length === 0) return
  const file = backgroundMusicFiles[Math.floor(Math.random() * backgroundMusicFiles.length)]
  bgMusicAudio = new Audio('sound/music/' + file)
  bgMusicAudio.loop = true
  bgMusicAudio.volume = masterVolume // Apply master volume to background music
  // Comment out or remove the auto-play so music does not start on startup.
  // bgMusicAudio.play().catch(e => {
  //   console.error("Error playing background music:", e)
  // })
}

export function toggleBackgroundMusic() {
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
