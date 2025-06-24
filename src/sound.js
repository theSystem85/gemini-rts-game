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

/**
 * Sound mapping for game events including battle results and player defeats
 * Battle sounds: battleWon, battleLost - played when game ends
 * Player defeat sounds: playerBlueDefeated, playerGreenDefeated, playerRedDefeated, playerYellowDefeated
 * These are mapped to player colors: player1=Green, player2=Red, player3=Blue, player4=Yellow
 **/

const soundMapping = {
  unitSelection: 'unitSelection',
  movement: 'tankMove',
  shoot: 'tankShot',
  shoot_rocket: 'patriotMissile', // updated: rocket tank now uses patriotMissile sounds
  shoot_heavy: 'tankShot03', // turretGunV3 uses tankShot03.mp3
  productionStart: 'constructionStarted',
  productionPaused: 'constructionPaused',
  productionCancelled: 'constructionCancelled',
  constructionComplete: 'constructionComplete',
  buildingPlaced: 'buildingPlaced',
  unitReady: 'unitReady',
  bulletHit: 'bulletHit',
  harvest: 'harvest',
  deposit: 'deposit',
  explosion: 'explosion',
  unitLost: 'unitLost', // Adding unit lost sound mapping
  attacking: 'attacking', // New attacking sound
  enemyUnitDestroyed: 'enemyUnitDestroyed', // New enemy destruction sound
  enemyBuildingDestroyed: 'enemyBuildingDestroyed', // New enemy building destruction sound
  teslacoil_loading: 'teslacoil_loading',
  teslacoil_firing: 'teslacoil_firing',
  // New battle and player defeat sounds
  battleWon: 'battleWon',
  battleLost: 'battleLost',
  playerBlueDefeated: 'playerBlueDefeated',
  playerGreenDefeated: 'playerGreenDefeated',
  playerRedDefeated: 'playerRedDefeated',
  playerYellowDefeated: 'playerYellowDefeated'
}

const soundFiles = {
  explosion: ['explosion01.mp3', 'explosion02.mp3', 'explosion03.mp3', 'explosion04.mp3'],
  tankShot: ['tankShot01.mp3', 'tankShot02.mp3', 'tankShot03.mp3'],
  tankShot03: ['tankShot03.mp3'], // Specific sound for turretGunV3
  tankMove: ['tankEngineStart01.mp3', 'confirmed.mp3', 'onMyWay.mp3'],
  constructionComplete: ['constructionComplete.mp3'],
  unitReady: ['unitReady01.mp3', 'unitReady02.mp3', 'unitReady03.mp3'],
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
  attacking: ['attacking.mp3'], // New attacking sound
  enemyUnitDestroyed: ['enemy_unit_destroyed.mp3'], // New enemy destruction sound
  enemyBuildingDestroyed: ['enemy_building_destroyed.mp3'], // New enemy building destruction sound
  teslacoil_loading: ['teslacoil_loading.mp3'],
  teslacoil_firing: ['teslacoil_firing.mp3'],
  // New battle and player defeat sounds
  battleWon: ['battleWon.mp3'],
  battleLost: ['battleLost.mp3'],
  playerBlueDefeated: ['playerBlueDefeated.mp3'],
  playerGreenDefeated: ['playerGreenDefeated.mp3'],
  playerRedDefeated: ['playerRedDefeated.mp3'],
  playerYellowDefeated: ['playerYellowDefeated.mp3']
}

const activeAudioElements = new Map()

function playAssetSound(category, volume = 1.0) {
  const files = soundFiles[category]
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
  return false
}

export function playSound(eventName, volume = 1.0) {
  if (!audioContext) return
  const category = soundMapping[eventName]
  if (category) {
    const played = playAssetSound(category, volume)
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
