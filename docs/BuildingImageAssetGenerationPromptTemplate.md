
If the user did **not specify** the footprint, **ask first**:
> “What is the footprint size of this building (in tiles, e.g., 2x2 or 3x4)?”

Each tile = **64×64 px**, so:
- 1×1 → 64×64 px  
- 2×2 → 128×128 px  
- 3×3 → 192×192 px  
- 4×4 → 256×256 px  
...and so on.

This determines the **final downscaled map sprite resolution**.

---

### 🧩 Step 1: Generate Base Renders

#### **A. Sidebar Build-Button Render**
- **Resolution:** 2048×2048 px  
- **Aspect Ratio:** 1:1 (square)  
- **Perspective:** Front-left **¾ low-angle** view  
  (as if seen by a person standing near the building)  
- **Lighting:** Bright **desert daylight**, realistic exposure, soft shadows  
- **Environment:** Realistic **desert military base** (no transparency)  
- **Style:** **Photorealistic PBR**, not stylized or painted  
- **Scale:** Appears **large and industrial**, like a production facility or factory  
- **Materials:** Reinforced **concrete**, **metal plating**, **pipes**, **silos**, **vents**, **antennas**, etc.  
- **Details:** Use real-world proportions, heavy structures, and visible machinery  
- **Output Format:** **PNG** (lossless, large source image)

---

#### **B. Map Building Render (Top-Down Transparent)**
- **Resolution:** 2048×2048 px  
- **Aspect Ratio:** 1:1 (square)  
- **View:** **Perfect 90° top-down orthographic** (satellite-like)  
- **Rotation:** Building rotated **45° on the ground** (diagonal alignment)  
- **Lighting:** Neutral daylight, **soft shadows**, low contrast  
- **Background:** **True alpha transparency** (`transparent_background: true`) —  
  no checkerboard, no ground, no visible plane  
- **Style:** Same **industrial PBR realism** as sidebar image — consistent colors and materials  
- **Environment Reflection:** Minimal, ambient only  
- **Output Format:** **PNG with real alpha transparency**

---

### 🛠️ Step 2: Post-Processing and Conversion

1. **Sidebar Render →**
   - Downscale to **255×255 px**
   - Keep **opaque** desert background  
   - Convert to **WebP (quality 80%)**
   - Save as `buildingname_sidebar.webp`

2. **Map Render →**
   - Downscale to **(tiles_x × 64) × (tiles_y × 64)** px  
     (e.g., a 2×2 footprint = 128×128 px)  
   - Maintain **true alpha transparency**
   - Convert to **WebP (quality 80%)**
   - Save as `buildingname_map.webp`

3. **Consistency Check**
   - Both images clearly represent the same building  
   - Materials, lighting, and proportions must match  
   - Map sprite remains clear and readable at its final scaled size  

---

### ▶️ Step 3: Automated Workflow

1. **Ask for footprint (if not provided)**  
2. **Generate Sidebar Render (Step 1A)**  
3. **Wait for approval** (`"ok"` / `"approved"`)  
4. **Generate Map Render (Step 1B)** with 45° rotation and transparency  
5. **Auto-scale** the map sprite based on footprint tile size  
6. **Convert both images** to final WebP formats  
7. **Deliver final assets:**
   - `buildingname_sidebar.webp`
   - `buildingname_map.webp`

---

### ✅ Notes
- Avoid cartoon-like outlines or over-saturated colors.  
- All renders should look **gritty, large-scale, and functional**,  
  like a real-world military or industrial base from the Command & Conquer era.

now generate all assets for a technology research center with the footprint 2x3 tiles