export function triggerDistortionEffect(x, y, radius, gameState) {
  if (!radius || radius <= 0) return
  // Add styles once
  if (!document.getElementById('distortion-effect-styles')) {
    const style = document.createElement('style')
    style.id = 'distortion-effect-styles'
    style.textContent = `
      .distortion-effect {
        position: absolute;
        pointer-events: none;
        border-radius: 50%;
        mix-blend-mode: screen;
        background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%);
        animation: distortion-scale 0.5s ease-out forwards;
        filter: blur(0px);
      }
      @keyframes distortion-scale {
        from { transform: scale(0.3); opacity: 0.7; }
        to { transform: scale(1.8); opacity: 0; filter: blur(8px); }
      }
    `
    document.head.appendChild(style)
  }
  const canvas = document.getElementById('gameCanvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const screenX = x - gameState.scrollOffset.x + rect.left
  const screenY = y - gameState.scrollOffset.y + rect.top
  const effect = document.createElement('div')
  effect.className = 'distortion-effect'
  effect.style.left = `${screenX - radius}px`
  effect.style.top = `${screenY - radius}px`
  effect.style.width = `${radius * 2}px`
  effect.style.height = `${radius * 2}px`
  effect.style.zIndex = '999'
  document.body.appendChild(effect)
  effect.addEventListener('animationend', () => effect.remove())
}

