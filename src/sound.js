// sound.js
let audioContext = null
try {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
} catch (e) {
  console.error("Web Audio API is not supported.")
}

export function playSound(eventName) {
  if (!audioContext) return
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
