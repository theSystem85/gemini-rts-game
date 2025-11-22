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
