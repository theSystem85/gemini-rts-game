export function playSound(eventName) {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      oscillator.frequency.value = eventName === 'unitSelection' ? 600 :
        eventName === 'movement' ? 400 :
        eventName === 'shoot' ? 800 : 500
      oscillator.type = 'sine'
      oscillator.start()
      oscillator.stop(context.currentTime + 0.1)
    } catch (e) {
      // Do nothing if Web Audio API is unsupported
    }
  }
  