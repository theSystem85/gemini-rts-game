UTC Timestamp: 20251121T205608
LLM: GPT-5.1-Codex-Max

User Prompt:
"Move terrain and sprite rendering to WebGL/WebGPU. The engine currently binds both the main and minimap canvases to the CPU-bound 2D context, which limits batching and GPU utilization. Replacing the main canvas context with WebGL (or WebGPU where available) would allow you to stream a single tile atlas to the GPU and render the map with instanced quads, drastically reducing per-tile CPU draw calls. Sprites (units, effects, overlays) can share the same pipeline through texture atlases and instanced vertex data."
