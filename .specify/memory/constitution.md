# Gemini RTS Game Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### I. Modular ES6 Architecture
Use ES6 modules with named exports, no default exports. Separate concerns into specialized directories (game/, rendering/, ui/, ai/, etc.). Always include .js extension in imports.

### II. Performance Optimization
Implement object pooling for bullets/explosions/particles, canvas dirty rectangles, cached pathfinding, and preloaded audio. Use requestAnimationFrame for smooth animations and performance.now() for timing.

### III. Vanilla JavaScript Only (NON-NEGOTIABLE)
No external libraries or frameworks besides Vite for build tooling. All game logic in pure JavaScript with Canvas API. Keep as lightweight static site with no server dependencies.

### IV. AI and Automation Focus
Unique game mechanics emphasizing AI behaviors and automation systems during gameplay. Enemy units with sophisticated strategies, automated resource management, and emergent behaviors.

### V. Code Style Consistency
Follow camelCase for variables/functions, UPPER_SNAKE_CASE for constants, PascalCase for classes. 2-space indentation, single quotes, semicolons omitted. 120 char line limit. JSDoc for complex functions.

## Technology Stack & Constraints
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

Technology stack limited to vanilla JavaScript ES6+, HTML5 Canvas, and Vite for development/build. No npm dependencies beyond Vite. All assets AI-generated and inline/included. Game must run as static site in browser. Performance target: smooth 60fps with 100+ units. Memory usage optimized for mobile browsers.

## Development Workflow
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

Code changes via GitHub PRs with review. Automated linting with ESLint. Manual testing before merge. No breaking changes without migration plan. Documentation updated for new features. AI agent coordination follows specialized roles (GAME_LOGIC_AGENT, RENDERING_AGENT, etc.).

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

Constitution supersedes all practices; amendments require PR with rationale, approved by maintainer. Semantic versioning for constitution changes. Compliance verified via code reviews ensuring principles followed. Runtime guidance in copilot-instructions.md.

**Version**: 1.0.0 | **Ratified**: 2025-11-05 | **Last Amended**: 2025-11-05
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
