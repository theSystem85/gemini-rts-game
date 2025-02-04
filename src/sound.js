// sound.js
export function playSound(eventName) {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    // Choose frequency based on event type.
    oscillator.frequency.value =
      eventName === 'unitSelection' ? 600 :
      eventName === 'movement' ? 400 :
      eventName === 'shoot' ? 800 :
      eventName === 'productionStart' ? 500 :
      eventName === 'productionReady' ? 700 :
      eventName === 'bulletHit' ? 900 :
      eventName === 'harvest' ? 350 :
      eventName === 'deposit' ? 450 :
      eventName === 'explosion' ? 200 : 500;
    oscillator.type = 'sine';
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  } catch (e) {
    // If the Web Audio API is not supported, silently fail.
  }
}
