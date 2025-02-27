import { moveUnitToPosition } from './movement';

export function updateEnemyAI(gameState) {
  const playerUnits = gameState.units.filter(unit => unit.faction === 'player');
  const enemyUnits = gameState.units.filter(unit => unit.faction === 'enemy');
  
  // Don't attack until player attacks first
  if (!gameState.playerHasAttacked && !hasPlayerAttackedFirst(gameState)) {
    return;
  }
  
  // Group enemy units for attacks
  const groups = groupUnitsForAttack(enemyUnits);
  
  groups.forEach(group => {
    const targetUnits = prioritizeTargets(playerUnits);
    
    if (targetUnits.length > 0) {
      // Assign targets to group
      assignTargetsToGroup(group, targetUnits, gameState);
    }
  });
  
  // Defend harvesters
  defendHarvesters(enemyUnits, playerUnits, gameState);
}

function hasPlayerAttackedFirst(gameState) {
  if (gameState.projectiles.some(p => p.ownerFaction === 'player')) {
    gameState.playerHasAttacked = true;
    return true;
  }
  return false;
}

function groupUnitsForAttack(units) {
  // Group units by type and proximity
  const groups = [];
  const ungrouped = [...units];
  
  // Create groups of 3-5 units
  while (ungrouped.length > 0) {
    const seed = ungrouped.shift();
    const group = [seed];
    
    // Find nearby units of similar type
    for (let i = 0; i < ungrouped.length; i++) {
      const unit = ungrouped[i];
      
      if (group.length >= 5) break; // Max group size
      
      // If unit is close to seed and is a combat unit
      if (getDistance(seed.position, unit.position) < 10 && 
          isCombatUnit(unit)) {
        group.push(unit);
        ungrouped.splice(i, 1);
        i--;
      }
    }
    
    if (group.length >= 2) { // Only create groups with at least 2 units
      groups.push(group);
    }
  }
  
  return groups;
}

function prioritizeTargets(playerUnits) {
  // Sort targets by priority (harvesters > normal units > buildings)
  return [...playerUnits].sort((a, b) => {
    if (a.type === 'harvester' && b.type !== 'harvester') return -1;
    if (a.type !== 'harvester' && b.type === 'harvester') return 1;
    if (!isCombatUnit(a) && isCombatUnit(b)) return -1;
    if (isCombatUnit(a) && !isCombatUnit(b)) return 1;
    return 0;
  });
}

function assignTargetsToGroup(group, targets, gameState) {
  // Assign the highest priority target to the group
  const target = targets[0];
  
  group.forEach(unit => {
    moveUnitToPosition(unit, target.position, gameState);
  });
}

function defendHarvesters(enemyUnits, playerUnits, gameState) {
  // Find enemy harvesters
  const harvesters = enemyUnits.filter(unit => unit.type === 'harvester');
  
  // Find nearby player units that might threaten harvesters
  harvesters.forEach(harvester => {
    const threats = playerUnits.filter(unit => 
      isCombatUnit(unit) && 
      getDistance(harvester.position, unit.position) < 15
    );
    
    if (threats.length > 0) {
      // Find nearby defenders
      const defenders = enemyUnits.filter(unit => 
        isCombatUnit(unit) && 
        getDistance(harvester.position, unit.position) < 10
      );
      
      // Send defenders to protect the harvester
      defenders.forEach(defender => {
        moveUnitToPosition(defender, threats[0].position, gameState);
      });
    }
  });
}

function isCombatUnit(unit) {
  // Combat units are those that can attack
  return ['soldier', 'tank', 'artillery', 'sniper', 'helicopter'].includes(unit.type);
}

function getDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}
