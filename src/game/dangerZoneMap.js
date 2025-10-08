export function computeBuildingDps(building) {
  const shots = building.burstFire ? (building.burstCount || 1) : 1
  const cooldownSec = (building.fireCooldown || 1000) / 1000
  return (building.damage * shots) / (cooldownSec || 1)
}

export function generateDangerZoneMapForPlayer(playerId, mapGrid, buildings, gameState) {
  if (!mapGrid || mapGrid.length === 0) return []
  const h = mapGrid.length
  const w = mapGrid[0].length
  const map = Array.from({ length: h }, () => Array(w).fill(0))

  buildings.forEach(b => {
    if (!b || !b.fireRange || b.health <= 0) return
    if (!(b.type && (b.type.startsWith('turretGun') || b.type === 'rocketTurret' || b.type === 'teslaCoil' || b.type === 'artilleryTurret'))) return
    if (b.owner === playerId) return

    const supply = b.owner === gameState.humanPlayer ? gameState.playerPowerSupply : gameState.enemyPowerSupply
    if ((b.type === 'rocketTurret' || b.type === 'teslaCoil') && supply < 0) return

    const dps = computeBuildingDps(b)
    const cx = b.x + (b.width || 1) / 2
    const cy = b.y + (b.height || 1) / 2
    const r = b.fireRange
    const minR = b.minFireRange || 0
    const minY = Math.max(0, Math.floor(cy - r))
    const maxY = Math.min(h - 1, Math.ceil(cy + r))
    const minX = Math.max(0, Math.floor(cx - r))
    const maxX = Math.min(w - 1, Math.ceil(cx + r))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x + 0.5) - cx
        const dy = (y + 0.5) - cy
        const dist = Math.hypot(dx, dy)
        if (dist <= r && dist >= minR) {
          map[y][x] += dps
        }
      }
    }
  })

  return map
}

export function updateDangerZoneMaps(gameState) {
  if (!gameState || !gameState.mapGrid) return
  const players = []
  for (let i = 1; i <= (gameState.playerCount || 2); i++) players.push(`player${i}`)
  gameState.dangerZoneMaps = {}
  players.forEach(id => {
    gameState.dangerZoneMaps[id] = generateDangerZoneMapForPlayer(id, gameState.mapGrid, gameState.buildings || [], gameState)
  })
}
