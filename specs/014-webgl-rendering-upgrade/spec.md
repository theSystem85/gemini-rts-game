# Feature Specification: GPU Terrain and Sprite Rendering

**Feature Branch**: `014-webgl-rendering-upgrade`
**Created**: 2025-11-21
**Status**: Proposed
**Input**: "Move terrain and sprite rendering to WebGL/WebGPU. The engine currently binds both the main and minimap canvases to the CPU-bound 2D context, which limits batching and GPU utilization. Replacing the main canvas context with WebGL (or WebGPU where available) would allow you to stream a single tile atlas to the GPU and render the map with instanced quads, drastically reducing per-tile CPU draw calls. Sprites (units, effects, overlays) can share the same pipeline through texture atlases and instanced vertex data."

---

## Overview

Upgrade the rendering stack to prioritize GPU-backed pipelines for the main playfield and minimap. Prefer WebGL2 when available and gracefully fall back to WebGL (or 2D) when GPU contexts are not accessible. Use shared atlases for tiles and sprites so draw work can be submitted with instancing rather than thousands of individual CPU draw calls.

---

## Requirements

1. **GPU Context Preference**
   - Attempt to bind the main canvas to WebGL2 first, then WebGL, with a transparent fallback path to existing 2D rendering if GPU contexts are unavailable.
   - Keep the input-handling canvas interactive even when the base layer is rendered via GPU.
2. **Tile Atlas Streaming**
   - Upload the existing tile atlas (and future sprite atlases) once per load and reuse it for draws; avoid per-frame uploads.
   - Represent tiles as instanced quads with per-instance UV rectangles and color fallbacks for missing atlas entries.
3. **Sprite Batching Path**
   - Define a sprite batching interface that can ingest unit, effect, and overlay quads with atlas UVs and per-instance transforms/rotations.
   - Allow the sprite path to share the same shader/program pipeline as the tile renderer when compatible.
4. **Visibility and Overlays**
   - Preserve fog-of-war/visibility overlays and UI layers by compositing on top of GPU-rendered layers; ensure z-order matches the current experience.
5. **Minimap Compatibility**
   - Provide a GPU rendering path for the minimap where available, with a 2D fallback; reuse atlas data to avoid duplicate loads.
6. **Performance Goals**
   - Reduce per-frame CPU draw overhead for terrain to a single instanced draw per frame (per layer) and eliminate redundant state changes.
   - Keep GPU submission resilient to changing map sizes and visibility windows without reallocating buffers each frame.
7. **Viewport Coverage**
   - Draw a buffer of off-screen tiles beyond the visible viewport (accounting for device pixel ratios) so no gaps or black bars appear when panning to any map edge.
8. **Animated Tiles**
   - Preserve animated terrain (e.g., water) in the GPU path by sampling the existing water animation frames; fall back to atlas UVs only when animation frames are unavailable.

---

## Notes

- WebGPU adoption is optional but the abstraction should leave room for a future adapter.
- Texture atlases should remain source-of-truth for both tiles and sprite layers to simplify batching and asset management.

---

## WebGPU Transition Plan (Chrome + Safari Alignment)

1. **Spec & Support Baseline**
   - Target the current W3C WebGPU specification and verify feature availability for Chrome and Safari (adapter limits, required texture formats, optional features).
   - Maintain a compatibility matrix in docs that lists required core features vs. optional features and maps them to each browser.
2. **Abstraction Layer**
   - Introduce a renderer interface that normalizes WebGL2/WebGPU operations (pipeline creation, buffer/texture uploads, draw calls, and resource lifecycle).
   - Keep the existing 2D fallback as the last-resort renderer for unsupported devices.
3. **WebGPU Core Pipeline**
   - Implement WebGPU device/queue initialization, swap chain configuration, and a render loop aligned with the existing WebGL draw phases (terrain → sprites → overlays).
   - Establish a shared WGSL shader set for tile/sprite instancing with configurable per-instance data layouts.
4. **Asset & Buffer Migration**
   - Move atlas upload to WebGPU textures and use staging buffers for initial load plus incremental updates.
   - Define a single instance buffer layout for tiles, units, effects, and overlays to reduce per-frame buffer churn.
5. **Feature Parity & Validation**
   - Mirror WebGL features: animated water tiles, fog-of-war overlays, shadow-of-war masks, SOT overlays, and minimap rendering.
   - Implement visual parity checks (screenshot diffing) for WebGL vs. WebGPU across a fixed set of maps/scenarios.
6. **Fallback & Error Handling**
   - Use `navigator.gpu` checks, adapter request failures, and `device.lost` handling to fall back to WebGL2 or 2D without breaking gameplay.
   - Add telemetry/logging for renderer selection and failure modes to drive future optimizations.
7. **Performance Milestones**
   - Measure CPU time per frame, draw call count, and GPU timings (when available) for WebGL2 vs. WebGPU.
   - Track a target reduction in CPU draw overhead and stabilize frame time variance before defaulting to WebGPU.
