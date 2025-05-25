// saveGame.js
import { gameState } from './gameState.js';
import { factories } from './main.js';
import { units } from './main.js';
import { mapGrid } from './main.js';
import { TILE_SIZE } from './config.js';
import { createUnit } from './units.js';
import { buildingData } from './buildings.js';
import { showNotification } from './ui/notifications.js';

// === Save/Load Game Logic ===
export function getSaveGames() {
  const saves = [];
  for (let key in localStorage) {
    if (key.startsWith('rts_save_')) {
      try {
        const save = JSON.parse(localStorage.getItem(key));
        saves.push({
          key,
          label: save.label || '(no label)',
          time: save.time,
        });
      } catch {}
    }
  }
  // Sort by most recent
  saves.sort((a, b) => b.time - a.time);
  return saves;
}

export function saveGame(label) {
  // Gather enemy money (budget)
  const enemyFactory = factories.find(f => f.id === 'enemy');
  const enemyMoney = enemyFactory ? enemyFactory.budget : 0;

  // Gather all units (player and enemy)
  const allUnits = units.map(u => ({
    type: u.type,
    owner: u.owner,
    x: u.x,
    y: u.y,
    health: u.health,
    maxHealth: u.maxHealth,
    id: u.id,
    // Add more fields if needed (e.g., oreCarried, groupNumber, etc.)
  }));

  // Gather all buildings (player and enemy)
  const allBuildings = gameState.buildings.map(b => ({
    type: b.type,
    owner: b.owner,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    health: b.health,
    maxHealth: b.maxHealth,
    id: b.id,
    // Add more fields if needed
  }));

  // Gather all ore positions
  const orePositions = [];
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[y].length; x++) {
      if (mapGrid[y][x].type === 'ore') {
        orePositions.push({ x, y });
      }
    }
  }

  // Save the full mapGrid tile types for restoring building/wall/terrain occupancy
  const mapGridTypes = mapGrid.map(row => row.map(tile => tile.type));

  // Save everything in a single object
  const saveData = {
    gameState: { ...gameState },
    enemyMoney,
    units: allUnits,
    buildings: allBuildings,
    orePositions,
    mapGridTypes, // ADDED: save mapGrid tile types
  };

  const saveObj = {
    label: label || 'Unnamed',
    time: Date.now(),
    state: JSON.stringify(saveData),
  };
  localStorage.setItem('rts_save_' + saveObj.label, JSON.stringify(saveObj));
}

export function loadGame(key) {
  const saveObj = JSON.parse(localStorage.getItem(key));
  if (saveObj && saveObj.state) {
    const loaded = JSON.parse(saveObj.state);
    Object.assign(gameState, loaded.gameState);
    const enemyFactory = factories.find(f => f.id === 'enemy');
    if (enemyFactory && typeof loaded.enemyMoney === 'number') {
      enemyFactory.budget = loaded.enemyMoney;
    }
    units.length = 0;
    loaded.units.forEach(u => {
      // Rehydrate unit using createUnit logic
      // Find the factory for owner (player/enemy)
      let factory = factories.find(f => (f.owner === u.owner || f.id === u.owner));
      if (!factory) {
        // fallback: use first factory of that owner
        factory = factories.find(f => f.owner === u.owner) || factories[0];
      }
      // Use tileX/tileY if present, else calculate from x/y
      const tileX = u.tileX !== undefined ? u.tileX : Math.floor(u.x / TILE_SIZE);
      const tileY = u.tileY !== undefined ? u.tileY : Math.floor(u.y / TILE_SIZE);
      const hydrated = createUnit(factory, u.type, tileX, tileY);
      // Copy over all saved properties (health, id, etc.)
      Object.assign(hydrated, u);
      // Ensure tileX/tileY/x/y are consistent
      hydrated.tileX = tileX;
      hydrated.tileY = tileY;
      hydrated.x = u.x;
      hydrated.y = u.y;
      // Ensure path is always an array
      if (!Array.isArray(hydrated.path)) hydrated.path = [];
      units.push(hydrated);
    });
    gameState.buildings.length = 0;
    loaded.buildings.forEach(b => {
      // Rehydrate defensive buildings (turrets) so they work after loading
      let building = { ...b };
      // Defensive turrets: turretGunV1/V2/V3, rocketTurret
      if (building.type && (building.type.startsWith('turretGun') || building.type === 'rocketTurret')) {
        // Get config from buildingData
        const data = buildingData[building.type];
        // Set all runtime properties if missing
        building.fireRange = data.fireRange;
        building.fireCooldown = data.fireCooldown;
        building.damage = data.damage;
        building.armor = data.armor || 1;
        building.projectileType = data.projectileType;
        building.projectileSpeed = data.projectileSpeed;
        if (typeof building.lastShotTime !== 'number') building.lastShotTime = 0;
        if (typeof building.turretDirection !== 'number') building.turretDirection = 0;
        if (typeof building.targetDirection !== 'number') building.targetDirection = 0;
        // Aim-ahead/feature flags
        if (data.useAimAhead) building.useAimAhead = true;
        if (data.aimAhead) building.aimAhead = true;
        // Burst fire
        if (data.burstFire) {
          building.burstFire = true;
          building.burstCount = data.burstCount || 3;
          building.burstDelay = data.burstDelay || 150;
          if (typeof building.currentBurst !== 'number') building.currentBurst = 0;
          if (typeof building.lastBurstTime !== 'number') building.lastBurstTime = 0;
        }
      }
      gameState.buildings.push(building);
    });
    // Restore mapGrid tile types (including 'building' and 'wall' etc.)
    if (loaded.mapGridTypes) {
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[y].length; x++) {
          if (loaded.mapGridTypes[y] && loaded.mapGridTypes[y][x]) {
            mapGrid[y][x].type = loaded.mapGridTypes[y][x];
          }
        }
      }
    } else {
      // Fallback: clear ore tiles
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[y].length; x++) {
          if (mapGrid[y][x].type === 'ore') mapGrid[y][x].type = 'land';
        }
      }
      loaded.orePositions.forEach(pos => {
        if (mapGrid[pos.y] && mapGrid[pos.y][pos.x]) {
          mapGrid[pos.y][pos.x].type = 'ore';
        }
      });
    }
    
    // Import these functions as needed after loading
    import('./main.js').then(module => {
      // Update build menu states after loading using ProductionController
      const gameInstance = module.getCurrentGame();
      if (gameInstance && gameInstance.productionController) {
        gameInstance.productionController.updateVehicleButtonStates();
        gameInstance.productionController.updateBuildingButtonStates();
      }
    });
    
    showNotification('Game loaded: ' + (saveObj.label || key));
  }
}

export function deleteGame(key) {
  localStorage.removeItem(key);
}

export function updateSaveGamesList() {
  const list = document.getElementById('saveGamesList');
  if (!list) return; // Early return if element doesn't exist
  
  list.innerHTML = '';
  const saves = getSaveGames();
  saves.forEach(save => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.padding = '2px 0';
    const label = document.createElement('span');
    label.textContent = save.label + ' (' + new Date(save.time).toLocaleString() + ')';
    label.style.flex = '1';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.style.marginLeft = '6px';
    loadBtn.onclick = () => { loadGame(save.key); };
    const delBtn = document.createElement('button');
    delBtn.textContent = '✗';
    delBtn.title = 'Delete save';
    delBtn.style.marginLeft = '3px';
    delBtn.onclick = () => { deleteGame(save.key); updateSaveGamesList(); };
    li.appendChild(label);
    li.appendChild(loadBtn);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

// Add initialization function to set up event listeners
export function initSaveGameSystem() {
  const saveGameBtn = document.getElementById('saveGameBtn');
  if (saveGameBtn) {
    saveGameBtn.addEventListener('click', () => {
      const label = document.getElementById('saveLabelInput').value.trim();
      saveGame(label);
      updateSaveGamesList();
      showNotification('Game saved as: ' + (label || 'Unnamed'));
    });
  }
  
  const refreshSavesBtn = document.getElementById('refreshSavesBtn');
  if (refreshSavesBtn) {
    refreshSavesBtn.addEventListener('click', updateSaveGamesList);
  }
  
  // Initial population of save games list
  updateSaveGamesList();
}