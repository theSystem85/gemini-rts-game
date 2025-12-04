#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const missionFile = path.join(__dirname, '../src/missions/mission_01.js');
const content = fs.readFileSync(missionFile, 'utf8');

// Extract the state JSON string
const stateMatch = content.match(/"state": "({.*})"/);
if (!stateMatch) {
  console.error('Could not find state in mission file');
  process.exit(1);
}

const stateStr = stateMatch[1].replace(/\\n/g, '').replace(/\\"/g, '"');
const parsed = JSON.parse(stateStr);

console.log('=== FIXING MISSION 01 ===\n');

// Fix 1: Resolve building overlaps
console.log('Fix 1: Resolving building overlaps...');
const buildings = parsed.gameState.buildings;

// Move gasStation from (68,34) to (68,37)
const gasStation = buildings.find(b => b.id === 'mission01-p2-gas');
if (gasStation) {
  console.log(`  Moving Gas Station from (${gasStation.x},${gasStation.y}) to (68,37)`);
  gasStation.y = 37;
}

// Move artilleryTurret from (82,26) to (85,26)
const artillery = buildings.find(b => b.id === 'mission01-p2-artillery');
if (artillery) {
  console.log(`  Moving Artillery Turret from (${artillery.x},${artillery.y}) to (85,26)`);
  artillery.x = 85;
}

// Move radarStation from (80,30) to (82,33)
const radar = buildings.find(b => b.id === 'mission01-p2-radar');
if (radar) {
  console.log(`  Moving Radar Station from (${radar.x},${radar.y}) to (82,33)`);
  radar.x = 82;
  radar.y = 33;
}

// Fix 2: Move turrets outside walls
console.log('\nFix 2: Moving turrets outside walls...');

// Turrets at y=16 (north wall) - move to y=15
const turretsNorth = [
  { id: 'mission01-p2-v2-nw', x: 66 },
  { id: 'mission01-p2-v1-north', x: 72 },
  { id: 'mission01-p2-v2-ne', x: 80 }
];

turretsNorth.forEach(({ id, x }) => {
  const turret = buildings.find(b => b.id === id);
  if (turret && turret.y === 16) {
    console.log(`  Moving ${turret.type} from (${turret.x},${turret.y}) to (${x},15)`);
    turret.x = x;
    turret.y = 15;
  }
});

// Turrets at y=44 (south wall) - move to y=45
const turretsSouth = [
  { id: 'mission01-p2-gate-v3-west', x: 70 },
  { id: 'mission01-p2-gate-v2-mid', x: 72 },
  { id: 'mission01-p2-gate-v3-east', x: 78 }
];

turretsSouth.forEach(({ id, x }) => {
  const turret = buildings.find(b => b.id === id);
  if (turret && turret.y === 44) {
    console.log(`  Moving ${turret.type} from (${turret.x},${turret.y}) to (${x},45)`);
    turret.x = x;
    turret.y = 45;
  }
});

// Remove walls where turrets were (now they're outside)
console.log('\nRemoving walls at turret positions outside the base...');
const wallsToRemove = ['mission01-wall-70-44', 'mission01-wall-72-44', 'mission01-wall-78-44'];
wallsToRemove.forEach(wallId => {
  const wallIndex = buildings.findIndex(b => b.id === wallId);
  if (wallIndex !== -1) {
    console.log(`  Removing wall ${wallId}`);
    buildings.splice(wallIndex, 1);
  }
});

// Add new walls at y=44 where turrets moved from (gaps in defense)
console.log('\nFilling gaps in wall defense...');
// Note: Walls at 70,44 72,44 and 78,44 should stay, only turrets moved out

// Verify no overlaps remain
console.log('\nVerifying no overlaps remain...');
const occupancy = {};
buildings.forEach(b => {
  for (let y = b.y; y < b.y + b.height; y++) {
    for (let x = b.x; x < b.x + b.width; x++) {
      const key = `${x},${y}`;
      if (!occupancy[key]) occupancy[key] = [];
      occupancy[key].push({ type: b.type, id: b.id });
    }
  }
});

let hasOverlaps = false;
Object.entries(occupancy).forEach(([key, list]) => {
  if (list.length > 1) {
    console.log(`  ⚠️  Overlap still at ${key}:`, list.map(b => b.type).join(' + '));
    hasOverlaps = true;
  }
});

if (!hasOverlaps) {
  console.log('  ✓ No overlaps detected!');
}

// Reconstruct the state string
const newStateStr = JSON.stringify(parsed).replace(/"/g, '\\"');
const newContent = content.replace(
  /"state": "({.*})"/,
  `"state": "${newStateStr}"`
);

// Write back to file
fs.writeFileSync(missionFile, newContent, 'utf8');
console.log('\n✓ Mission file updated successfully!');
console.log('File:', missionFile);
