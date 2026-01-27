// cursorStyles.js
// Shared cursor style constants and helpers for consistent cursor appearance across the game.

export const GAME_DEFAULT_CURSOR_URL = '/cursors/default.svg'
export const GAME_DEFAULT_CURSOR = `url("${GAME_DEFAULT_CURSOR_URL}") 6 4, auto`

const CURSOR_ASSET_URLS = [
  GAME_DEFAULT_CURSOR_URL,
  '/cursors/repair.svg',
  '/cursors/repair_blocked.svg',
  '/cursors/sell.svg',
  '/cursors/sell_blocked.svg',
  '/cursors/move.svg',
  '/cursors/moveInto.svg',
  '/cursors/move_blocked.svg',
  '/cursors/attack.svg',
  '/cursors/attack_blocked.svg',
  '/cursors/attack_out_of_range.svg',
  '/cursors/guard.svg'
]

let cursorsPreloaded = false

export function preloadCursorAssets() {
  if (cursorsPreloaded || typeof document === 'undefined') {
    return
  }

  cursorsPreloaded = true

  const head = document.head || document.getElementsByTagName('head')[0]
  const canInstantiateImage = typeof Image !== 'undefined'

  CURSOR_ASSET_URLS.forEach((href) => {
    if (!href) {
      return
    }

    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = href
    link.type = 'image/svg+xml'
    head.appendChild(link)

    if (canInstantiateImage) {
      const img = new Image()
      img.src = href
    }
  })
}
