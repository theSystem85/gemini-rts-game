# Phase 5 Mine System - Testing Guide

## Quick Start Testing

### Prerequisites
1. Start the game: `npm run dev`
2. Build a Vehicle Factory if not already present
3. Have a Workshop built (required for Mine Layer/Sweeper production)

### Testing Mine Layer

#### 1. Spawn a Mine Layer
- Select Vehicle Factory
- Build a Mine Layer (costs 1000)
- Unit will spawn with 20 mines

#### 2. Single Mine Deployment (Ctrl+Click)
- Select the Mine Layer
- Hold `Ctrl` and click on a tile
- Mine Layer will move to that location
- Wait 4 seconds for mine to deploy
- Mine becomes active (armed) 4 seconds after deployment

#### 3. Area Mine Deployment (Drag)
- Select the Mine Layer
- Click and drag to create a rectangle
- You should see a yellow checkerboard pattern overlay
- Release mouse to queue deployment
- Mine Layer will deploy mines in checkerboard pattern across the area
- Use `Shift` + drag to queue additional deployments

#### 4. Verify Auto-Refill
- Deplete all 20 mines
- Mine Layer should automatically pathfind to nearest:
  - Ammunition Factory (if available)
  - Ammunition Truck (if available)
- After refill, it resumes deployment queue

### Testing Mine Sweeper

#### 1. Spawn a Mine Sweeper
- Select Vehicle Factory
- Build a Mine Sweeper (costs 1000)
- Unit will spawn ready to sweep

#### 2. Rectangle Sweep (Drag)
- First deploy some mines with Mine Layer
- Select the Mine Sweeper
- Click and drag to create a rectangle over mined area
- You should see an orange overlay
- Release to queue zig-zag sweep pattern
- Mine Sweeper will sweep left-right serpentine pattern
- Speed reduces to 30% while sweeping
- Mines detonate safely without damaging the sweeper

#### 3. Verify Safe Detonation
- Sweep over an active mine
- Mine should explode with visual effects
- Mine Sweeper should take **NO damage**
- Other units nearby should take damage

### Visual Indicators

**Mine Indicators**:
- Deployed mines show skull icon overlay
- Unarmed mines have pulsing yellow circle
- Armed mines are static

**Preview Overlays**:
- Mine deployment: Yellow checkerboard pattern
- Sweep area: Orange rectangular overlay

**Unit Behavior**:
- Mine Layer slows to 50% speed during deployment mode
- Mine Layer stops for 4 seconds at each deployment location
- Mine Sweeper slows to 30% speed while sweeping

### Expected Behaviors

**Mine Deployment**:
- Mines deploy only on unoccupied tiles
- Mines arm 4 seconds after truck leaves tile
- Mines detonate on contact (90 damage center, 50 orthogonal)
- Chain reactions trigger adjacent mines

**Mine Sweeper**:
- Sweeping mode activates during sweep commands
- Speed reduces appropriately
- Mines detonate without damaging sweeper
- Normal units take damage from explosions

### Command Queue (Shift Key)

**Without Shift**:
- New commands replace existing queue
- Unit starts new task immediately

**With Shift**:
- Commands append to queue
- Unit completes current task first
- Useful for chaining deployments or sweeps

### Troubleshooting

**Mine Layer won't deploy**:
- Check if unit has mines remaining (HUD ammo bar)
- Ensure target tile is not occupied
- Verify unit is not currently deploying (4-second stop)

**Mine Sweeper takes damage**:
- Ensure sweeping mode is active (speed should be 30%)
- Verify sweep command is queued, not just movement

**Auto-refill not working**:
- Build an Ammunition Factory or Ammunition Truck
- Ensure they're owned by same player
- Check that ammo source has capacity

## Testing Checklist

### Basic Functionality
- [ ] Mine Layer spawns correctly
- [ ] Mine Layer has 20 mines initially
- [ ] Ctrl+Click deploys single mine
- [ ] Drag creates checkerboard preview
- [ ] Area deployment works
- [ ] Mines arm after 4 seconds
- [ ] Mine Sweeper spawns correctly
- [ ] Sweep drag shows orange preview
- [ ] Zig-zag sweep pattern executes

### Advanced Features
- [ ] Shift+Click queues commands
- [ ] Auto-refill activates when depleted
- [ ] Auto-refill finds ammo source
- [ ] Deployment resumes after refill
- [ ] Mine detonation works correctly
- [ ] Chain reactions trigger
- [ ] Safe detonation for sweeper works

### Visual Feedback
- [ ] Yellow checkerboard overlay renders
- [ ] Orange sweep overlay renders
- [ ] Skull indicators show on mines
- [ ] Unarmed mines pulse yellow
- [ ] Preview clears on mouseup

### Performance
- [ ] 60 FPS with 50+ mines
- [ ] No lag during area deployment
- [ ] No lag during sweep operations

## Known Limitations

1. **PPF Markers**: Command queue markers for mine operations not yet implemented (optional enhancement)
2. **Freeform Sweep**: Ctrl+Drag for painted sweep area foundation exists but needs additional gesture tracking
3. **AI Integration**: Enemy AI doesn't yet use mine units (future enhancement)

## Next Steps

Once testing is complete, consider:
1. Adding PPF visual markers for queued mine commands
2. Implementing AI mine deployment strategies
3. Fine-tuning deployment/sweep speeds based on gameplay feedback
4. Adding sound effects for deployment and sweep actions

---

**Testing Date**: 2025-11-18
**Build**: 5db302c
**Status**: Ready for manual testing ✅
