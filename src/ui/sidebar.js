import { generateMap } from '../game/map';

export function createSidebar(gameState, updateGameState) {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  
  // Header
  const header = document.createElement('h2');
  header.className = 'sidebar-header';
  header.textContent = 'Game Controls';
  sidebar.appendChild(header);
  
  // Map controls
  const mapControlsSection = document.createElement('div');
  
  const seedLabel = document.createElement('label');
  seedLabel.className = 'sidebar-label';
  seedLabel.textContent = 'Map Seed:';
  mapControlsSection.appendChild(seedLabel);
  
  const seedInput = document.createElement('input');
  seedInput.className = 'sidebar-input';
  seedInput.type = 'number';
  seedInput.value = gameState.map.seed || '';
  seedInput.placeholder = 'Enter seed (optional)';
  mapControlsSection.appendChild(seedInput);
  
  const shuffleButton = document.createElement('button');
  shuffleButton.className = 'sidebar-button';
  shuffleButton.textContent = 'Shuffle Map';
  shuffleButton.onclick = () => {
    const seed = seedInput.value ? parseInt(seedInput.value) : null;
    const newMap = generateMap(gameState.map.width, gameState.map.height, seed);
    updateGameState({
      ...gameState,
      map: newMap
    });
  };
  mapControlsSection.appendChild(shuffleButton);
  
  sidebar.appendChild(mapControlsSection);
  
  // Unit production
  const productionHeader = document.createElement('h3');
  productionHeader.className = 'sidebar-header';
  productionHeader.textContent = 'Build Units';
  sidebar.appendChild(productionHeader);
  
  const unitProductionContainer = document.createElement('div');
  unitProductionContainer.className = 'unit-production-container';
  
  const unitTypes = [
    'worker', 'soldier', 'tank', 'artillery', 'harvester', 
    'scout', 'medic', 'engineer', 'sniper', 'helicopter'
  ];
  
  unitTypes.forEach(unitType => {
    const tile = document.createElement('div');
    tile.className = 'unit-production-tile';
    tile.dataset.unitType = unitType;
    
    const icon = document.createElement('div');
    icon.className = 'unit-icon';
    icon.textContent = unitType.charAt(0).toUpperCase();
    
    tile.appendChild(icon);
    unitProductionContainer.appendChild(tile);
    
    tile.onclick = () => {
      // Logic for building unit
    };
  });
  
  sidebar.appendChild(unitProductionContainer);
  
  return sidebar;
}
