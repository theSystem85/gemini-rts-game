// config.js
export const TILE_SIZE = 32;
export const MAP_TILES_X = 100;
export const MAP_TILES_Y = 100;
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE;
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE;

// Define colors for each tile type
export const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700'
};

// Inertia decay factor for smooth scrolling
export const INERTIA_DECAY = 0.95;

// Fire range for tanks is defined in tiles (4 cells)
export const TANK_FIRE_RANGE = 6;  // Increased from 4 to 6 tiles


// Constants for ore spreading (every 90 seconds with a 20% chance)
export const ORE_SPREAD_INTERVAL = 90000; // milliseconds
export const ORE_SPREAD_PROBABILITY = 0.2;
