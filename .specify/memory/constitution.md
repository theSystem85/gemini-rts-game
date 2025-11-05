<!--
Sync Impact Report - Version 1.0.0
=====================================
Version Change: Initial → 1.0.0
Change Type: MINOR (Initial constitution ratification)
Modified Principles: N/A (initial creation)
Added Sections: Core Principles, Technical Constraints, AI Agent Coordination, Governance
Removed Sections: N/A

Templates Status:
✅ plan-template.md - Compatible (constitution checks can reference these principles)
✅ spec-template.md - Compatible (requirements align with vanilla JS, modular architecture)
✅ tasks-template.md - Compatible (task organization supports modular file structure)

Follow-up TODOs: None
-->

# CodeAndConquer Constitution

## Core Principles

### I. Vanilla JavaScript & ES6 Modules (NON-NEGOTIABLE)

**Principle**: All game code MUST use vanilla JavaScript ES6 modules without frameworks or external libraries beyond Vite for bundling.

**Rules**:
- NO frameworks (React, Vue, Angular, etc.)
- NO game libraries (Phaser, PixiJS, etc.)
- NO utility libraries (lodash, jQuery, etc.)
- ALWAYS use ES6 import/export syntax with `.js` file extensions
- NEVER use CommonJS `require()` - use `import` statements exclusively
- Named exports ONLY - avoid default exports for consistency

**Rationale**: This project tests frontier LLM capabilities on complex codebases without framework abstraction. The constraint forces modular thinking and provides direct control over performance. Vite is permitted solely for development server and bundling, not as a runtime dependency.

### II. Modular Architecture & Separation of Concerns

**Principle**: Code MUST be organized into specialized, single-purpose modules with clear boundaries between rendering, game logic, input handling, and AI systems.

**Rules**:
- Game logic MUST be separate from rendering logic
- Each module MUST have a single, well-defined responsibility
- Core files (gameState.js, config.js) require special care when modifying
- File naming MUST follow camelCase convention for .js files
- Maximum file size target: 1000 lines of code (to maintain LLM workability)
- All magic numbers MUST be defined as constants in config.js

**Rationale**: LLMs struggle with files exceeding 1000 lines. Modular architecture ensures each file remains digestible for AI agents while maintaining code quality. Clear separation prevents cascading bugs and enables parallel development by multiple AI agents.

### III. Agent-Specific Specialization

**Principle**: Development follows agent role patterns with specialized focus areas to prevent conflicts and maintain architectural integrity.

**Agent Roles**:
- **GAME_LOGIC_AGENT**: Combat, AI, resources, victory conditions (src/logic.js, src/game/, src/ai/)
- **RENDERING_AGENT**: Canvas optimization, UI, visual effects (src/rendering.js, src/rendering/, src/ui/)
- **INPUT_CONTROL_AGENT**: Mouse/keyboard, unit selection, camera controls (src/inputHandler.js)
- **SYSTEMS_AGENT**: Pathfinding, save/load, audio, configuration (src/config.js, src/saveGame.js, src/sound.js)

**Rules**:
- Each agent MUST respect the boundaries of other agents' domains
- Changes to shared dependencies (gameState.js, config.js) require cross-agent validation
- Coordinate system conventions MUST be maintained (tile vs pixel vs screen coordinates)

**Rationale**: Multiple AI agents working on this project need clear domain boundaries to avoid conflicts and maintain consistency. This role-based approach mirrors human team specialization patterns.

### IV. Performance & Canvas Optimization

**Principle**: Game MUST maintain 60fps with hundreds of units through aggressive optimization of Canvas rendering and game loop efficiency.

**Rules**:
- Use `requestAnimationFrame` for all animations
- Implement object pooling for bullets, explosions, particles
- Use dirty rectangles and minimize Canvas redraws
- Pathfinding MUST be limited with `PATHFINDING_LIMIT` to prevent lag
- Use `performance.now()` for all timing operations
- Frame-rate independent updates using `deltaTime`

**Rationale**: Canvas-based RTS games are performance-sensitive. Without framework optimization, we must implement aggressive performance patterns ourselves. The game's complexity (AI, pathfinding, hundreds of units) requires disciplined optimization.

### V. Configuration-Driven Design

**Principle**: Game behavior MUST be configurable through centralized constants and JSON configuration files, not hardcoded values scattered throughout the codebase.

**Rules**:
- ALL game constants MUST be defined in src/config.js with UPPER_SNAKE_CASE naming
- Unit/building configurations MUST use JSON files (tankImageConfig.json, turretImageConfig.json)
- Configuration changes MUST NOT require code modifications
- Constants MUST be grouped logically (e.g., tile system, unit properties, AI parameters)

**Rationale**: Configuration-driven design enables rapid iteration, easier balancing, and maintainability. It separates data from logic, allowing game designers (or LLMs) to adjust parameters without touching implementation code.

### VI. Backward Compatibility & Graceful Degradation

**Principle**: New features MUST NOT break existing functionality, save games, or fallback to original behavior when assets fail to load.

**Rules**:
- Save/load system MUST handle missing properties with auto-initialization
- New rendering systems MUST provide fallback to original rendering
- Configuration changes MUST provide sensible defaults for missing values
- Asset loading failures MUST NOT crash the game
- All new properties MUST be optional and backward-compatible

**Rationale**: This is an evolving project built incrementally by LLMs. Breaking changes destroy confidence and create debugging nightmares. Graceful degradation ensures the game remains playable even when individual features fail.

## Technical Constraints

### Technology Stack

**MUST Use**:
- Vanilla JavaScript ES6+ (latest features acceptable)
- Vite (development server and bundling only)
- HTML5 Canvas API for rendering
- Web Audio API for sound (preload all assets)
- LocalStorage for save/load functionality

**MUST NOT Use**:
- Any npm packages beyond Vite, ESLint, and Sharp (build-time only)
- Any runtime frameworks or libraries
- External CDN dependencies
- Server-side code (static site only)

### Code Style Standards

**File Naming**: camelCase.js (e.g., inputHandler.js, gameState.js)
**Variables/Functions**: camelCase (e.g., selectedUnits, moveUnitToPosition)
**Constants**: UPPER_SNAKE_CASE (e.g., TILE_SIZE, MAP_WIDTH)
**Classes**: PascalCase (e.g., PathfindingNode)
**Indentation**: 2 spaces (no tabs)
**Semicolons**: Omit (project convention)
**Quotes**: Single quotes preferred
**Line length**: 120 characters maximum
**Comments**: `//` for single line, `/** */` for JSDoc

### Import/Export Pattern

```javascript
// CORRECT: Always include .js extension, use named exports
import { gameState } from './gameState.js'
import { TILE_SIZE, MAP_WIDTH } from './config.js'

export const functionName = () => {}
export function calculateDamage() {}
export const CONSTANT_VALUE = 42

// WRONG: No .js extension, default export
import gameState from './gameState'
export default functionName
```

### Critical Shared Dependencies

**gameState.js** - Handle with extreme care:
- Central game state object shared across all systems
- Changes MUST be validated against all dependent systems
- Use consistent property naming conventions
- Never modify structure without cross-system validation

**config.js** - Constants management:
- ALL magic numbers MUST be defined here
- Use descriptive UPPER_SNAKE_CASE names
- Group related constants together
- Export as individual named exports

## AI Agent Coordination

### Development Workflow

**Agent Identification**: When working on this project, identify your role based on the task:
- Modifying combat/AI/resources → GAME_LOGIC_AGENT
- Changing rendering/UI/effects → RENDERING_AGENT
- Updating input/controls/camera → INPUT_CONTROL_AGENT
- Working on pathfinding/save/audio/config → SYSTEMS_AGENT

**Cross-Agent Validation**: When modifying shared dependencies (gameState.js, config.js), validate impact on all systems.

**Documentation**: Use `.github/copilot-instructions.md` as runtime guidance for AI agents working on the codebase.

### Agentic Development Rules

**MUST NOT**:
- Run development server (assume user has already started it)
- Run linter (assume user will run if needed)
- Make assumptions about missing context - research first
- Modify files outside your agent role without justification

**MUST**:
- Follow existing patterns rather than inventing new approaches
- Use semantic_search to understand codebase before changes
- Validate changes maintain separation of concerns
- Update documentation when adding new features

## Governance

### Amendment Process

**Constitution Authority**: This constitution supersedes all other development practices and guidelines. In case of conflict, constitution principles take precedence.

**Amendment Procedure**:
1. Proposed changes MUST be documented with rationale
2. Version MUST be incremented following semantic versioning:
   - **MAJOR**: Backward incompatible governance/principle changes
   - **MINOR**: New principles or materially expanded guidance
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements
3. Sync Impact Report MUST be updated at top of constitution file
4. All dependent templates MUST be reviewed for consistency
5. `LAST_AMENDED_DATE` MUST be updated to current date (ISO format: YYYY-MM-DD)

### Compliance Verification

**All Development Work MUST**:
- Verify alignment with Core Principles before implementation
- Follow naming conventions and code style standards
- Maintain modular architecture and agent boundaries
- Ensure performance optimization patterns are followed
- Validate backward compatibility for changes

**Complexity Justification**: Any violation of principles MUST be explicitly justified in implementation documentation with explanation of why simpler alternatives were rejected.

### Version Information

**Version**: 1.0.0 | **Ratified**: 2025-11-05 | **Last Amended**: 2025-11-05
