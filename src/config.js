export const TILE_SIZE = 32
export const MAP_TILES_X = 100
export const MAP_TILES_Y = 100
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE

export const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700'
}

export const INERTIA_DECAY = 0.95

// Enemy production settings
export const enemyProductionInterval = 10000 // in ms
export const enemyGroupSize = 3

// Tank firing range (for cursor hover indication)
export const TANK_FIRE_RANGE = TILE_SIZE * 2
