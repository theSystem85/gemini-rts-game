# Gemini RTS Game - Documentation

## Enemy Unit Retaliation System

### Overview
This feature ensures that enemy units always attack player units when they are being attacked themselves, unless they are in "flee to base" mode with low health. This makes combat more engaging and realistic while preserving strategic retreat behavior.

### Key Changes Made

#### 1. Damage Tracking System
Added comprehensive tracking when units take damage:
- `unit.lastDamageTime` - Timestamp of when the unit was last damaged
- `unit.lastAttacker` - Reference to the unit/building that attacked
- `unit.isBeingAttacked` - Flag indicating if the unit is currently under attack

#### 2. Enhanced Bullet Collision (`src/game/bulletSystem.js`)
- When a bullet hits an enemy unit, it now tracks the attacker and marks the unit as being attacked
- Added console logging for debugging retaliation behavior
- Works for all projectile types (bullets, rockets)

#### 3. Enhanced Tesla Coil Damage (`src/game/buildingSystem.js`)
- Tesla coil attacks now also track the attacking building as the attacker
- Enemy units can retaliate against Tesla coils and other defensive buildings
- Includes proper damage attribution for building-based attacks

#### 4. Enhanced Explosion Damage (`src/logic.js`)
- Explosion damage now tracks the original shooter as the attacker
- Enemy units will retaliate against the unit that fired the explosive projectile
- Handles area-of-effect damage attribution correctly

#### 5. Priority-Based Target Selection (`src/enemy.js`)
Enhanced enemy AI with new target priority system:
1. **Highest Priority**: Retaliate against attacker when being attacked (unless in flee mode)
2. **Second Priority**: Defend harvesters under attack
3. **Third Priority**: Group attack strategy

Additional improvements:
- Added logic to handle both unit attackers and building attackers (turrets, Tesla coils)
- Retaliation works within reasonable ranges (15 tiles for units, 20 tiles for buildings)
- Imported `shouldRetreatLowHealth` function from enemy strategies

#### 6. Flee Mode Protection
- Units in "flee to base" mode (low health retreat) will NOT retaliate and will continue fleeing
- This preserves the existing low-health retreat behavior at 10% health threshold
- Ensures strategic retreat behavior is maintained for severely damaged units

#### 7. Cleanup and Reset Logic
- `isBeingAttacked` flag resets after 5 seconds of not taking damage
- Invalid attacker references are cleared when attackers are destroyed
- Prevents units from getting stuck in retaliation mode indefinitely

### How It Works

1. **Damage Detection**: When an enemy unit takes damage from any source (bullets, Tesla coils, explosions), it's marked as being attacked and the attacker is recorded

2. **AI Update Cycle**: On the next AI update cycle (every 2 seconds), the unit checks if it should flee due to low health

3. **Target Prioritization**: If not fleeing, the unit prioritizes retaliating against its attacker over all other targets

4. **Pathfinding & Attack**: The unit will pathfind to and attack the unit/building that attacked it

5. **Cleanup**: If the attacker is destroyed or moves too far away, the unit resumes normal AI behavior

6. **Auto-Reset**: The retaliation state automatically clears after 5 seconds of not being attacked

### Benefits

- **More Engaging Combat**: Enemy units fight back when attacked, creating more dynamic battles
- **Realistic Behavior**: Units respond naturally to threats and attacks
- **Strategic Depth**: Players must consider retaliation when engaging enemy forces
- **Preserved Retreat Logic**: Low-health units still flee to base as intended
- **Balanced Gameplay**: Retaliation has range limits and time constraints to prevent exploitation

### Technical Implementation

The system integrates seamlessly with existing AI strategies and combat systems:
- Uses existing `shouldRetreatLowHealth` function to respect flee mode
- Leverages current target selection and pathfinding systems
- Maintains compatibility with group attack strategies
- Includes proper cleanup to prevent memory leaks or stuck states

This ensures that enemy units will always fight back when attacked, making combat more engaging and realistic, while preserving the strategic "flee to base" behavior for severely damaged units.