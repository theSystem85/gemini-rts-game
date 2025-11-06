## 🧩 2D RTS Unit Asset Generation Prompt (True RGBA Transparency Version)

You will create two optimized images for a new 2D RTS game unit.  
The user will specify the **unit name** (e.g., “recovery tank” or “mine clearance tank”).

---

### Step 1: Generate Base Renders

#### A. Sidebar Build-Button Render
- Resolution: **2048×2048 px**  
- Perspective: **Front-left ¾ low-angle**  
- Lighting: **Bright desert daylight with soft shadows**  
- Background: **Desert environment (no transparency)**  
- Style: **Photorealistic, physically-based render (PBR)** — realistic military photo look with dust, wear, and camouflage  
- Output Format: **PNG (lossless, RGB)**

---

#### B. Map Unit Render (Top-Down with Real Alpha Channel)
Photorealistic physically-based render (PBR) of a **[unit name]**, viewed from a **perfect 90° top-down orthographic perspective** — as if seen from a satellite or aircraft.  
- Perspective: **Perfect 90° top-down orthographic**  
- Orientation: Unit faces **downward (toward the bottom of the image)**  
- Lighting: **Neutral daylight with soft shadows**, low contrast for gameplay clarity  
- Style: **Realistic (not stylized or pixel-art)**  
- Camouflage: Same materials, patterns, and colors as the sidebar render  
- **Background: True transparent alpha (RGBA)** — no fake checkerboard, no solid color, no white layer  
- Scale: **2048×2048 px**  
- Purpose: For use as a freely rotatable top-down sprite in a 2D RTS map  
- Output Format: **PNG with true RGBA transparency**

---

### Step 2: Post-Processing

1. **Sidebar Render**
   - Downscale to **255×255 px**
   - Convert to **WebP (quality 80%)**
   - Keep opaque background  
   - Filename: `unitname_sidebar.webp`

2. **Map Render**
   - Downscale to **64×64 px**
   - Maintain real transparency  
   - Convert to **WebP (quality 80%)**
   - Filename: `unitname_map.webp`

3. **Visual Consistency Checks**
   - Same geometry, materials, and camouflage between both renders  
   - Top-down version clearly depicts the same unit from above  
   - Silhouette must remain crisp and readable at small scale

---

### Step 3: Output Workflow

- Always **generate and present the sidebar version first**
- Wait for user confirmation ("ok" or "approved")
- Then **generate and process the map version**
- Deliver both final `.webp` files ready for game integration

---

Now render a new unit:  
**mine clearance tank (no gun)**  
→ Execute all steps above automatically, using true RGBA transparency for the top-down render.
