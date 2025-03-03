// sound.js
let audioContext = null
try {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
} catch (e) {
  console.error("Web Audio API is not supported.")
}

const soundMapping = {
  unitSelection: 'unitSelection',
  movement: 'tankMove',
  shoot: 'tankShot',
  shoot_rocket: null,
  productionStart: null,
  productionReady: 'productionReady',
  bulletHit: 'bulletHit',
  harvest: null,
  deposit: 'deposit',
  explosion: 'explosion'
}

const soundFiles = {
  explosion: ['explosion01.mp3', 'explosion02.mp3'],
  tankShot: ['tankShot01.mp3', 'tankShot02.mp3', 'tankShot03.mp3'],
  tankMove: ['tankEngineStart01.mp3', 'confirmed.mp3', 'onMyWay.mp3'],
  productionReady: ['unitReady01.mp3', 'unitReady02.mp3', 'unitReady03.mp3'],
  bulletHit: ['bulletHit01.mp3'],
  deposit: ['deposit.mp3'],
  unitSelection: ['yesSir01.mp3']
}

const activeAudioElements = new Map();

function playAssetSound(category) {
  const files = soundFiles[category]
  if (files && files.length > 0) {
    const file = files[Math.floor(Math.random() * files.length)]
    const soundPath = 'sound/' + file;

    // Check if this sound is already playing
    if (activeAudioElements.has(soundPath)) {
      const existingAudio = activeAudioElements.get(soundPath);
      existingAudio.currentTime = 0;
      existingAudio.play().catch(e => {
        console.error("Error replaying sound asset:", e);
      });
      return true;
    }

    const audio = new Audio(soundPath);
    audio.addEventListener('ended', () => {
      activeAudioElements.delete(soundPath);
    });
    
    audio.play().catch(e => {
      console.error("Error playing sound asset:", e);
      activeAudioElements.delete(soundPath);
    });
    
    activeAudioElements.set(soundPath, audio);
    return true;
  }
  return false;
}

export function playSound(eventName) {
  if (!audioContext) return
  const category = soundMapping[eventName]
  if (category) {
    const played = playAssetSound(category)
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
      eventName === 'productionReady' ? 700 :
      eventName === 'bulletHit' ? 900 :
      eventName === 'harvest' ? 350 :
      eventName === 'deposit' ? 450 :
      eventName === 'explosion' ? 200 : 500
    oscillator.type = 'sine'
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.1)
  } catch (e) {
    console.error("AudioContext error:", e)
  }
}

// --- Background Music Functionality ---
const backgroundMusicFiles = ['music01.mp3'] // add more files as needed
let bgMusicAudio = null

export function initBackgroundMusic() {
  if (!backgroundMusicFiles || backgroundMusicFiles.length === 0) return
  const file = backgroundMusicFiles[Math.floor(Math.random() * backgroundMusicFiles.length)]
  bgMusicAudio = new Audio('sound/music/' + file)
  bgMusicAudio.loop = true
  // Comment out or remove the auto-play so music does not start on startup.
  // bgMusicAudio.play().catch(e => {
  //   console.error("Error playing background music:", e)
  // })
}

export function toggleBackgroundMusic() {
  if (bgMusicAudio) {
    if (bgMusicAudio.paused) {
      bgMusicAudio.play().catch(e => {
        console.error("Error resuming background music:", e)
      })
    } else {
      bgMusicAudio.pause()
    }
  }
}
