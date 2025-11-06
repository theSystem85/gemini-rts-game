# Retrofit Plan: TODO.md to SpecKit Alignment

**Created:** 2025-11-06  
**Status:** Planning Phase  
**Purpose:** Systematically document all implemented features from TODO.md into SpecKit specification system

---

## Overview

This plan outlines the step-by-step process to retrofit 150+ completed features from TODO.md into the SpecKit specification framework. The work will be organized into phases, with each phase covering related feature systems.

---

## Current State Analysis

### Existing Specs (Already Documented)
- ✅ **002-unit-progression-system** - 3-star leveling system
- ✅ **003-hospital-crew-system** - Hospital, crew system, ambulance
- ✅ **004-advanced-unit-control** - Remote control, guard mode, path planning, attack groups
- ✅ **005-building-system-enhancements** - Drag-and-drop, blueprint mode, chain build, construction animations
- ✅ **006-combat-system-enhancements** - Hit zones, recoil, muzzle flash, tank variants, target indicators
- ✅ **007-multi-player-ai-system** - Multi-party gameplay, AI decision-making (needs infantry removal)

### Features NOT Yet Documented in Specs

From TODO.md analysis, the following major feature categories need retrospective specs:

1. **Visual Improvements & Rendering** (~15 features)
2. **Audio System** (~5 features)
3. **Economy & Resource Management** (~12 features)
4. **UI/UX Enhancements** (~20 features)
5. **Performance & Optimization** (~8 features)
6. **Save/Load System** (~4 features)
7. **Cheat System** (~2 features)
8. **Map Generation & Terrain** (~8 features)
9. **Recovery Tank System** (partially documented in 003, needs completion)
10. **Gas Station & Fuel System** (NOT implemented yet - skip)
11. **Miscellaneous Improvements** (~10 features)

---

## Retrofit Strategy

### Principles
1. **Retrospective Documentation**: All specs document already-implemented features
2. **Technology-Agnostic**: Focus on "what" not "how"
3. **Measurable Success Criteria**: Define concrete metrics for each feature
4. **Constitution Compliance**: Ensure all specs align with project constitution
5. **No Code Changes**: This is documentation work only
6. **Preserve Implementation Details**: Reference actual file paths and implementations

### Scope Boundaries
- **IN SCOPE**: Features marked with `[x]` in TODO.md
- **OUT OF SCOPE**: Features marked with `[ ]` (not yet implemented)
- **SKIP**: Features that contradict constitution (e.g., infantry references)

---

## Phase-by-Phase Plan

### Phase 1: Visual Improvements & Rendering (Spec 008)
**Estimated Time:** 3-4 hours  
**Priority:** High (user-facing features)

#### Features to Document:
1. Tank image-based rendering system (wagon + turret + barrel)
2. Recoil and muzzle flash animations
3. Smoke animations (damaged tanks, cooling towers)
4. Flag animations for buildings (party identification)
5. Corner smoothing algorithm for streets
6. Corner smoothing for water tiles
7. Health bar visibility rules (only when damaged/selected)
8. Selection indicators (corner-only display)
9. Transparency for building images
10. Hit zone visual indicators
11. Movement target indicators (green triangles)
12. Attack target indicators (red triangles)
13. Occupancy map visualization (O key toggle)
14. Level-up stars display
15. Level progress indicator in health bar

#### Key Files Referenced:
- `src/rendering/tankImageRenderer.js`
- `src/rendering/buildingRenderer.js`
- `src/rendering/effectsRenderer.js`
- `src/rendering/hudRenderer.js`
- `src/rendering/mapRenderer.js`
- `tankImageConfig.json`
- `turretImageConfig.json`

#### Spec Structure:
- **User Stories**: Visual clarity, combat feedback, party identification, performance optimization
- **Functional Requirements**: ~40-50 requirements covering each rendering feature
- **Success Criteria**: Visual consistency, performance metrics (60fps with 100+ units)
- **Edge Cases**: Overlapping animations, z-index conflicts, retina display handling

---

### Phase 2: Audio System (Spec 009)
**Estimated Time:** 2-3 hours  
**Priority:** Medium (enhances experience but not blocking)

#### Features to Document:
1. Spatial audio system (3D positioning based on screen center)
2. Sound stacking prevention (max 3 narrated sounds)
3. Sound prioritization and queuing
4. Context-specific sounds (crew member deaths, unit ready, attack confirmation)
5. Music toggle and autoplay prevention

#### Key Files Referenced:
- `src/sound.js`
- `public/sound/` directory structure

#### Spec Structure:
- **User Stories**: Immersive audio, non-overlapping narration, performance
- **Functional Requirements**: ~15-20 requirements
- **Success Criteria**: Audio clarity, no audio lag, proper spatial effect
- **Edge Cases**: Multiple simultaneous events, audio context suspension

---

### Phase 3: Economy & Resource Management (Spec 010)
**Estimated Time:** 3-4 hours  
**Priority:** High (core gameplay mechanics)

#### Features to Document:
1. Refinery system (ore processing)
2. Harvester AI and automation
3. Ore field mechanics (blue crystals, red seed crystals)
4. Ore spreading algorithm
5. Harvester queuing at refineries
6. Gradual cost deduction during production
7. Energy/power system
8. Power brownout effects on production
9. Cost-to-build-time correlation
10. Money display updates (throttled to 300ms)
11. Production queue money reservation
12. Unit and building costs system

#### Key Files Referenced:
- `src/game/harvesterLogic.js`
- `src/buildings.js` (refinery logic)
- `src/config.js` (costs and energy values)
- `src/gameState.js` (money tracking)

#### Spec Structure:
- **User Stories**: Economic gameplay, harvester automation, power management
- **Functional Requirements**: ~35-40 requirements
- **Success Criteria**: Economic balance, harvester efficiency, power stability
- **Edge Cases**: All harvesters destroyed, refinery destroyed, power outage

---

### Phase 4: UI/UX Enhancements (Spec 011)
**Estimated Time:** 4-5 hours  
**Priority:** High (usability critical)

#### Features to Document:
1. Minimap system (radar-dependent)
2. FPS overlay (F key toggle)
3. Sidebar build menu (tabs, disabled states, "new" labels)
4. Unit/building selection (double-click, shift-expand)
5. Control groups (Ctrl+1-9, number key recall)
6. Assembly points per factory
7. Milestone system (video overlays)
8. Notification system (non-overlapping)
9. Cursor system (context-sensitive cursors)
10. Keyboard shortcuts (S stop, R repair, O occupancy, etc.)
11. Input focus detection (disable shortcuts when typing)
12. Help menu
13. Save/load menu UI
14. Statistics overlay
15. Unit count display
16. Build queue stacking indicators
17. Production progress indicators
18. Repair mode toggle
19. Sell mode toggle
20. Drag selection box

#### Key Files Referenced:
- `src/ui/` directory (all files)
- `src/inputHandler.js`
- `cursors.css`
- `index.html` (UI elements)

#### Spec Structure:
- **User Stories**: Intuitive controls, clear feedback, accessibility
- **Functional Requirements**: ~50-60 requirements (largest spec)
- **Success Criteria**: UI responsiveness, shortcut reliability, visual clarity
- **Edge Cases**: Conflicting shortcuts, modal interactions, keyboard focus

---

### Phase 5: Performance & Optimization (Spec 012)
**Estimated Time:** 2-3 hours  
**Priority:** Medium (already working well)

#### Features to Document:
1. Pathfinding optimization (3-second update throttle)
2. AI update throttling (3000ms intervals)
3. Occupancy map caching
4. Image asset caching (tanks, buildings)
5. Unit count limits (200 max)
6. DOM update throttling (money display 300ms)
7. Frame budget management
8. Spatial queries optimization
9. Code modularization (1000 LOC max per file)

#### Key Files Referenced:
- `src/performanceUtils.js`
- `src/game/pathfinding.js`
- `src/ai/enemyAIPlayer.js`
- All major files (demonstrate modularization)

#### Spec Structure:
- **User Stories**: Smooth gameplay, no lag, scalability
- **Functional Requirements**: ~25-30 requirements
- **Success Criteria**: 60fps with 100+ units, sub-100ms AI update time
- **Edge Cases**: Heavy combat scenarios, pathfinding loops

---

### Phase 6: Save/Load System (Spec 013)
**Estimated Time:** 2 hours  
**Priority:** Medium (functional but could be enhanced)

#### Features to Document:
1. Save game to localStorage
2. Load game from save file
3. Save game naming (Enter key support)
4. Game state serialization
5. Backward compatibility handling
6. AI state reset on load
7. Statistics persistence (win/loss tracking)
8. Restart without page reload

#### Key Files Referenced:
- `src/saveGame.js`
- `src/gameStateManager.js`

#### Spec Structure:
- **User Stories**: Progress preservation, quick loading
- **Functional Requirements**: ~15-20 requirements
- **Success Criteria**: Save reliability, load speed, state integrity
- **Edge Cases**: Corrupted saves, version migration, storage quota

---

### Phase 7: Cheat System (Spec 014)
**Estimated Time:** 1 hour  
**Priority:** Low (development/testing tool)

#### Features to Document:
1. Console command interface
2. Godmode (invincibility)
3. Money injection ("give 10000$")
4. Cheat activation/deactivation

#### Key Files Referenced:
- `src/utils.js` (cheat command handlers)
- Implementation in console interface

#### Spec Structure:
- **User Stories**: Testing efficiency, debugging aid
- **Functional Requirements**: ~8-10 requirements
- **Success Criteria**: Command reliability, no production interference
- **Edge Cases**: Invalid commands, command conflicts

---

### Phase 8: Map Generation & Terrain (Spec 015)
**Estimated Time:** 3 hours  
**Priority:** Medium (foundation for gameplay)

#### Features to Document:
1. Seeded random map generation
2. Multi-party starting positions
3. Ore field placement (blue crystals)
4. Red seed crystal placement (high spread rate)
5. Street corridor generation (connecting bases and ore)
6. Street merging for multiple parties
7. Rock placement
8. Water tile generation
9. Terrain tile types
10. Occupancy map initialization

#### Key Files Referenced:
- `src/gameSetup.js` (map generation)
- `src/config.js` (map constants)
- Map generation utilities

#### Spec Structure:
- **User Stories**: Balanced maps, strategic variety, fair starts
- **Functional Requirements**: ~30-35 requirements
- **Success Criteria**: Map balance, generation speed, no overlaps
- **Edge Cases**: Blocked spawn points, unreachable ore fields

---

### Phase 9: Recovery Tank Completion (Update Spec 003)
**Estimated Time:** 1 hour  
**Priority:** Medium (spec exists but incomplete)

#### Additional Features to Add to Spec 003:
1. ❌ Towing functionality (NOT implemented per TODO.md)
2. ✅ All repair functionality (already documented)

#### Action:
- Review spec 003
- Add note about towing feature being planned but not implemented
- Ensure repair system is fully documented
- Verify file references are accurate

---

### Phase 10: Miscellaneous Improvements (Spec 016 or integrate into existing)
**Estimated Time:** 2 hours  
**Priority:** Low (small improvements)

#### Features to Document:
1. Unit acceleration/deceleration
2. Damaged unit speed reduction (50% at <25% health)
3. Unit rotation-in-place for harvesters
4. Initial power level (100 starting power)
5. Victory/defeat conditions refinement
6. Unit color consistency
7. Sell building feature
8. Building repair system
9. Occupancy map bug fixes (as requirements)
10. Production queue refinements

#### Action:
- Determine if these warrant separate spec or should be integrated into existing specs
- Option A: Create Spec 016 "Core Gameplay Refinements"
- Option B: Add to relevant existing specs as amendments

---

## Work Breakdown & Timeline

### Week 1: Visual & Audio Systems
- Day 1-2: Spec 008 (Visual Improvements) - 8 hours
- Day 3: Spec 009 (Audio System) - 3 hours
- Day 4: Review and refinement - 2 hours

### Week 2: Economy & UI
- Day 5-6: Spec 010 (Economy) - 7 hours
- Day 7-8: Spec 011 (UI/UX) - 10 hours
- Day 9: Review - 2 hours

### Week 3: Systems & Polish
- Day 10: Spec 012 (Performance) - 3 hours
- Day 11: Spec 013 (Save/Load) - 2 hours
- Day 12: Spec 014 (Cheat System) - 1 hour
- Day 13: Spec 015 (Map Generation) - 3 hours
- Day 14: Update Spec 003, create Spec 016, final review - 3 hours

### Total Estimated Time: ~44 hours
**Realistic Timeline with Breaks/Delays:** 3-4 weeks

---

## Execution Process (Per Spec)

### Step 1: Feature Extraction
1. Read TODO.md section for features marked `[x]`
2. List all completed features in that category
3. Group related features into logical user stories
4. Note any dependencies or prerequisites

### Step 2: Code Archaeology
1. Search codebase for implementations using `grep_search` and `semantic_search`
2. Identify primary implementation files
3. Note key functions, classes, constants
4. Verify feature is actually implemented (check against TODO claims)

### Step 3: Spec Drafting
1. Create spec directory: `specs/XXX-feature-name/`
2. Create `spec.md` from template
3. Fill in metadata (branch name, status: Implemented, dates)
4. Write Overview section (2-3 paragraphs describing system)
5. Create 3-6 user stories with acceptance criteria
6. Define 30-50 functional requirements (technology-agnostic)
7. Create 20-30 success criteria (measurable)
8. Document 8-12 edge cases
9. List dependencies (file references)
10. Add testing approach notes
11. Include implementation notes and limitations

### Step 4: Validation
1. Cross-reference spec against actual code
2. Verify all functional requirements are implemented
3. Check success criteria are measurable
4. Ensure constitution compliance
5. Validate file paths exist
6. Check for consistency with other specs

### Step 5: Review & Refinement
1. Read through entire spec for clarity
2. Remove any technology-specific implementation details
3. Ensure language is product-oriented not code-oriented
4. Verify numbering and formatting consistency
5. Spell check and grammar check
6. Commit to repository

---

## Quality Checklist (Per Spec)

- [ ] Status clearly marked as "Implemented (Retrospective Documentation)"
- [ ] 3-6 user stories with clear "As a/I want/So that" structure
- [ ] All user stories have 5-10 measurable acceptance criteria marked `[x]`
- [ ] 30-50 functional requirements with clear priorities (P0, P1, P2)
- [ ] 20-30 success criteria with concrete measurements and targets
- [ ] 8-12 edge cases documented with handling approaches
- [ ] Dependencies section lists all relevant source files
- [ ] Testing approach describes verification methods
- [ ] Implementation notes capture design decisions and limitations
- [ ] No code snippets (only file references)
- [ ] Technology-agnostic language throughout
- [ ] Constitution compliance verified
- [ ] Consistent formatting with existing specs (002-007)
- [ ] All file paths verified to exist
- [ ] No infantry or non-existent features referenced
- [ ] Cross-references to related specs included

---

## Maintenance & Updates

### Ongoing
- When new features are implemented, update TODO.md first
- Mark feature with `[x]` when complete
- Add to appropriate spec if exists, or create new spec
- Keep constitution aligned with actual practices

### Periodic Reviews
- Quarterly: Review all specs for accuracy
- After major refactors: Update affected specs
- When onboarding new developers: Use specs as documentation

---

## Tools & Templates

### Available Templates
- `/.specify/templates/spec-template.md` - Base spec structure
- `/.specify/memory/constitution.md` - Project principles

### Useful Commands
```bash
# Search for feature implementations
grep -r "featureName" src/

# Find files by pattern
find src/ -name "*keyword*.js"

# Count lines of code per file
wc -l src/**/*.js

# List all spec directories
ls -la specs/
```

### SpecKit Scripts
- `/.specify/scripts/bash/create-new-feature.sh` - Create new spec
- `/.specify/scripts/bash/check-prerequisites.sh` - Validate spec

---

## Success Metrics

### Completion Criteria
- ✅ All `[x]` features from TODO.md documented in specs
- ✅ Each spec follows template structure
- ✅ Constitution compliance verified for all specs
- ✅ All file references validated
- ✅ Cross-references between specs established
- ✅ No conflicting information between specs and code

### Quality Metrics
- **Coverage**: 100% of implemented features documented
- **Accuracy**: <5% discrepancy between specs and actual code
- **Consistency**: All specs follow same format and style
- **Clarity**: Non-technical stakeholders can understand 80%+ of content
- **Completeness**: Each spec has all required sections filled

---

## Risk Mitigation

### Potential Issues
1. **Feature Drift**: TODO.md claims feature exists but code doesn't match
   - **Mitigation**: Always verify implementation before documenting
   
2. **Spec Bloat**: Trying to document every minor detail
   - **Mitigation**: Focus on measurable requirements, avoid implementation details
   
3. **Inconsistency**: Different writing styles across specs
   - **Mitigation**: Use existing specs 002-007 as style guide
   
4. **Time Overruns**: Each spec takes longer than estimated
   - **Mitigation**: Start with smaller specs (009, 014) to calibrate estimates

5. **Constitution Conflicts**: Finding features that violate principles
   - **Mitigation**: Document as-is, add note about future refactor needs

---

## Next Steps

### Immediate Actions (This Week)
1. ✅ Complete this retrofit plan document
2. ⏭️ Fix infantry references in Spec 007 (already done previously)
3. ⏭️ Begin Phase 1: Create Spec 008 (Visual Improvements)
4. ⏭️ Set up working branch for spec work if needed

### Communication
- Share this plan with stakeholders for approval
- Set up check-in schedule for progress updates
- Create tracking board for 8 new specs

---

## Appendix

### Feature Count Summary

| Category | Completed Features | Spec Status |
|----------|-------------------|-------------|
| Unit Progression | 8 | ✅ Spec 002 |
| Hospital & Crew | 20 | ✅ Spec 003 |
| Advanced Unit Control | 12 | ✅ Spec 004 |
| Building System | 15 | ✅ Spec 005 |
| Combat System | 18 | ✅ Spec 006 |
| Multi-Player & AI | 25 | ✅ Spec 007 |
| Visual Improvements | 15 | ⏳ Spec 008 |
| Audio System | 5 | ⏳ Spec 009 |
| Economy & Resources | 12 | ⏳ Spec 010 |
| UI/UX Enhancements | 20 | ⏳ Spec 011 |
| Performance | 8 | ⏳ Spec 012 |
| Save/Load | 4 | ⏳ Spec 013 |
| Cheat System | 2 | ⏳ Spec 014 |
| Map Generation | 8 | ⏳ Spec 015 |
| Miscellaneous | 10 | ⏳ Spec 016 or integrate |
| **TOTAL** | **~180 features** | **6 done, 9-10 pending** |

### Constitution Reference

Key principles to remember while writing specs:
1. **Vanilla JavaScript Only** - No frameworks/libraries
2. **Modular Architecture** - Max 1000 LOC per file
3. **Agent Specialization** - Clear role boundaries
4. **Performance First** - 60fps target with 100+ units
5. **Configuration-Driven** - Constants in config.js
6. **Backward Compatibility** - Save games must work across versions

---

**Plan Status:** Ready for Execution  
**Approval Required:** Yes  
**Estimated Completion:** 3-4 weeks from approval  
**Next Review Date:** After completing first 2 specs (008-009)
