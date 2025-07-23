import { MAP_TILES_X, MAP_TILES_Y } from '../config.js'

function isDefensiveBuilding(b) {
  return (
    b.type === 'rocketTurret' ||
    b.type === 'teslaCoil' ||
    b.type === 'artilleryTurret' ||
    b.type.startsWith('turretGun')
  )
}

function isFriendly(playerId, owner) {
  if (playerId === owner) return true
  if (playerId === 'player1' && owner === 'player') return true
  if (playerId === 'player' && owner === 'player1') return true
  return false
}

function createEmptyMap() {
  const arr = new Array(MAP_TILES_Y)
  for (let y = 0; y < MAP_TILES_Y; y++) {
    arr[y] = new Array(MAP_TILES_X).fill(0)
  }
  return arr
}

export function generateDangerZoneMaps(buildings, playerCount) {
  const players = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  const maps = {}
  players.forEach(p => {
    maps[p] = createEmptyMap()
  })

  buildings.forEach(b => {
    if (!isDefensiveBuilding(b) || !b.fireRange || !b.damage || !b.fireCooldown) return
    const range = b.fireRange
    const centerX = b.x + b.width / 2
    const centerY = b.y + b.height / 2
    const burst = b.burstFire ? (b.burstCount || 1) : 1
    const dps = (b.damage * burst) / (b.fireCooldown / 1000)
    const startX = Math.max(0, Math.floor(centerX - range))
    const endX = Math.min(MAP_TILES_X - 1, Math.ceil(centerX + range))
    const startY = Math.max(0, Math.floor(centerY - range))
    const endY = Math.min(MAP_TILES_Y - 1, Math.ceil(centerY + range))

    players.forEach(pid => {
      if (isFriendly(pid, b.owner)) return
      const map = maps[pid]
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const dx = (x + 0.5) - centerX
          const dy = (y + 0.5) - centerY
          const dist = Math.hypot(dx, dy)
          if (dist <= range) {
            map[y][x] += dps
          }
        }
      }
    })
  })

  return maps
}

export function updateDangerZoneMaps(gameState) {
  gameState.dangerZoneMaps = generateDangerZoneMaps(gameState.buildings || [], gameState.playerCount || 2)
}
