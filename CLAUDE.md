# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Scope of this file = rules + conventions + key formulas only.** Per-session
> progress narrative and the detailed per-module architecture catalog live in the
> memory files (indexed by `MEMORY.md`) and in `PRD Prategang.md`. Keep this file
> lean — when a session adds work, record it in a memory file + a one-line
> `MEMORY.md` index entry, **not** here.

## Session Rules (selalu berlaku)

- **Selalu baca MEMORY.md di awal sesi** (`C:\Users\Taufiq\.claude\projects\D--Belajar-Coding-Desain-Prategang\memory\MEMORY.md`) — indeks satu-baris per memori; buka file memori yang relevan sebelum bekerja.
- **Update MEMORY.md setelah setiap sesi** dengan progress & keputusan baru (file memori baru + satu baris indeks).
- **Jika ada `/clear`, baca ulang CLAUDE.md dan MEMORY.md sebelum lanjut** — keduanya adalah satu-satunya konteks yang bertahan.
- **Angka PDF bukan acuan kode — KECUALI dokumen benchmark/verifikasi**: untuk PDF verifikasi/benchmark (MIDAS FEA Verification Manual, verifikasi MIDAS GTS/DIANA, manual "Benchmarks & Verifications", dll) angka yang tercetak ADALAH acuan mutlak; tulis vitest yang meng-assert output engine ke nilai target itu dengan toleransi kecil (closed-form ≈±0,5–1%). Untuk PDF lain (desain/tutorial/buku teks) tetap: ambil bab/urutan/prosedur saja, jangan angkanya. Lihat [[benchmark-pdf-absolute-rule]].

## Reference materials (folder ini)

Spesifikasi & instruksi: `PRD Prategang.md` (spesifikasi mengikat + riwayat revisi), `CLAUDE.md` (ini), `.claude/skills.md`, `.claude/agents.md`, `README.md`, `KAJIAN-GAMBAR-DWG.md`.

Pustaka referensi bernomor (semua sudah ditinjau — ambil prosedur/urutan, bukan angka, kecuali benchmark):
- **`1.pdf`–`255.pdf`** + **`ST1`–`ST3`** (STAAD.Pro) — buku teks/manual desain prategang, jembatan, fondasi, gempa, FEM.
- **`MD (1)`–`MD (522)`** (+`.chm` biner, `.jpg/.gif` gambar) — MIDAS technical refs/Gen+Civil tutorials + **MIDAS FEA Verification Manual** (MD174+, angka = acuan mutlak) + MIDAS GTS/DIANA geoteknik (470–522).
- **`SP (1)`–`SP (12)`** + `CSiBridge Enhancements….html` — CSiBridge.
- **`GM (1)`, `GM (118)`–`GM (272)`** — pustaka **rekayasa gempa BANGUNAN GEDUNG**: FEMA 451 / P-750 NEHRP, ASCE 7-10/7-16, IBC 2012, Eurocode 8, isolasi seismik (Naeim & Kelly), analisis nonlinier (NIST/PEER/ATC), ACI 318-19, strut-and-tie, SNI/BSN. **GM 257–272 = model histeresis & dinamika nonlinier** (Bouc-Wen/Takeda/T(x), ENGLTHA degradasi+pinching, asesmen energi kolom RC/Park-Ang, kinerja siklik sambungan pracetak EC8, RC berisi dinding bata PEER/FEMA 356) → `hysteresis.ts` 🔄.
- **`ASM (1)`–`ASM (92)`** — pustaka **mekanika padat terapan / metode variasional / teori FEM / plastisitas & analisis batas**: Megson, Washizu (variational elasticity/plasticity), Zienkiewicz FEM, de Souza Neto/Owen (computational plasticity), Lubliner, **Nielsen & Hoang "Limit Analysis and Concrete Plasticity" (3×)**, Johansen yield-line, energy/calculus-of-variations. Mayoritas memvalidasi ekosistem FEM/UMAT/fiber/strain-compat eksisting; gap = analisis batas plastis → `limitanalysis.ts` ⚖️.
- **`*.dwg`** (54 file shop-drawing AutoCAD biner; dibaca via konverter DWG→DXF terpasang) + **`O1.pdf`–`O10.pdf`** (acuan gaya output OriginPro) + **`A/B/C.pdf`** + `*.png` (rujukan dasar GAMBAR output DED) + `gambar ALLPLAN.xlsx`, `170.xls`, `174.jpg`, `123.ppm`.

## Project Overview

**PRESTRESS-CALC Design Suite** — full-stack engineering app for post-tensioned prestressed-concrete I-girder bridge design per ACI 318 / SNI 2847 / AASHTO LRFD, with parallel **BS 8110** (Kong & Evans) and **Eurocode 2 / EN 1992-1-1** (M.K. Hurst) paths for cross-comparison. Covers SLS stress verification, detailed prestress losses (AASHTO LRFD Refined + EC2 combined §5.10.6), ULS flexural/shear capacity, composite section analysis, long-term deflection — plus a large ecosystem of standalone engineering calculators (substructure RC, foundations, FEM/FEA, seismic, geotech, construction-stage) and a unified DED-style design output sheet.

**Design codes (computed in parallel, side-by-side):** ACI 318-19 / SNI 2847:2019 (`uls.ts`/`losses.ts`/`sls.ts`) · AASHTO LRFD Refined · BS 8110 (`bs8110.ts`) · Eurocode 2 (`ec2.ts`). Dual philosophy Full (Class U) vs LRFD-Partial (Class C) always computed (`dualmethod.ts`).

**Module map** — engine modules live in `src/engine/` (each = pure function → `Object.freeze`), surfaced as tabs in `ExtraCalculators.tsx`. The full annotated catalog (what each module computes, its source book, its tab emoji) is maintained in `PRD Prategang.md` and the memory files. By domain:
- **Core girder (5-layer):** `section` · `tendon` · `losses` · `sls` · `uls` (see architecture below).
- **Superstructure variants:** `boxgirder` 🌉 · `bridgeload` 🚚 · `segmental` 🏗 · `external` 🪢 · `splicedgirder` 🧩 · `madecontinuous` ⛓️ · `rcgirder` 🧱 (ordinary RC T-beam) · `continuous`.
- **Detailing / SLS-ULS add-ons:** `mcft` (sectional shear + long-rebar tie) · `straincompat` 🎚 · `fatigue` 🔁 · `curvedtendon` ➰ · `transversept` 🔲 · `strutandtie` ▽ (lower-bound/static) · `limitanalysis` ⚖️ (upper-bound/kinematic: yield-line + plastic collapse + ν) · `deckslab` 🛞 · `diffshrinkage` 💧 · `development` · `torsion` · `anchorage`.
- **Long-term:** `aemm` ⏳ · `creepshrinkage` 🕰 · `handling` 🏭 · `lateralstability` 🌀.
- **Substructure & foundation (ordinary RC):** `substructure` 🏛️ · `pilefoundation`/`foundationdynamics` 🪨 · `consolidation`+`mohrcoulomb`+`slopestability` ⛰ · `shellreinf` ◫.
- **Seismic:** bridge → `seismic` 🌐 · `sni2833seismic` 🌎 · `seismicdynamics` 🌋 · `baseisolation` 🛡; **building → `buildingseismic` 🏙️ (ASCE 7-16/NEHRP ELF + Eurocode 8, GM library)**; **nonlinear cyclic → `hysteresis` 🔄 (bilinear/Bouc-Wen/Takeda + nonlinear Newmark TH + Park-Ang + infill strut, GM 257–272).**
- **Analysis ecosystem (FEM/FEA):** `fem/` (core LU + CG sparse backend + native seam) · frame 2D 🧮 · frame3d 🧊 · plate ▦ · shellsolver ▣ · influence 📉 · pushover 📈 · timehistory 🌊 (linear) · `hysteresis` 🔄 (nonlinear) · fibermomentcurvature 🧵 · `umat` ⚗ · `pdelta`/`designcheck`.
- **Other structures:** `cablestayed` 🪢 · `steeltruss` 🔺 · `specialmembers` 🧪 (pipe/pole/sleeper) · tank/column/slab/corbel/dapped/bearing/grade.
- **Output & I/O:** `designsheet`/`SectionDiagram` 📋 (DED drawing) · `internalforces` 📊 · `dxfimport`+`dwgConvert` 📐 · `presets`/`strands` 📚 · `optimization` 💰 · `rating` 🏷 · `fireresistance` 🔥 · `distribution` 🛤 · Supabase save/load.

**Current state:** TypeScript Next.js suite (deployed). Legacy Python/Streamlit MVP (`app.py` + `engine/`) = original SLS-only proof.

---

## Target Tech Stack

| Concern | Technology |
|---|---|
| UI + Routing | Next.js (App Router), Tailwind CSS, Shadcn UI |
| State | Zustand |
| Numerics | Math.js (matrix operations, precision arithmetic) |
| Database | Supabase (PostgreSQL) |
| Visualization | Recharts / Chart.js |
| Testing | Vitest — numerical tolerance ±0.5% for all assertions |

Source layout:
```
src/
├── app/            # Next.js routes
├── components/     # UI components (one Calculator per engine, ExtraCalculators host)
├── engine/         # Pure calculation modules (+ engine/fem/ ecosystem)
├── lib/            # presets, strands, designsheet, supabase, dwgConvert
├── store/          # Zustand stores
└── types/          # Shared TypeScript interfaces
tests/              # Vitest (±0.5% tolerance)
native/             # Real Zig/Julia solver source behind the SolverBackend seam
```

---

## 5-Layer Engine Architecture

Data flows strictly one-way. No circular dependencies between layers.

```
[Layer 1: Section & Geometry]  ──>  [Layer 2: Tendon Profile & Forces]
          │                                       │
          ▼                                       ▼
[Layer 3: Time-Dependent Losses] ─────────>  [Layer 4: SLS Stress Validator]
                                                   │
                                                   ▼
                                  [Layer 5: ULS Deflection & Detailing]
```

| Layer | File | Responsibility |
|---|---|---|
| 1 | `src/engine/section.ts` | Gross and composite section properties (A, y_b, y_t, I_g, I_c, Z) |
| 2 | `src/engine/tendon.ts` | Tendon profile geometry (straight/harped/parabolic), jacking force, immediate losses |
| 3 | `src/engine/losses.ts` | AASHTO Refined: creep (ΔfpCR), shrinkage (ΔfpSR), relaxation (ΔfpR2) |
| 4 | `src/engine/sls.ts` | Transfer and service SLS fiber stress checks with AMAN/OVERSTRESS verdict |
| 5 | `src/engine/uls.ts` | Flexural ULS (Whitney block iteration), shear Vci/Vcw, interface shear, deflection/camber |

Each engine module exports a **pure function** — takes an input object, returns a frozen result object. No side effects. New analysis backends plug in behind the `SolverBackend` seam (`engine/fem/backend.ts`) without touching elements or UI.

---

## Engineering Conventions

**Units:** All dimensions in `mm`. Stresses in `MPa`. External forces/loads in `kN` and `kN/m`. Moments in `kN·m`. At the section calculation level, convert to `N` and `N·mm` explicitly (`kN × 1000`, `kN·m × 1e6`).

**Sign convention:** Positive σ = tension, Negative σ = compression. Applied uniformly throughout all stress formulas and output values.

**Reference axis:** `y = 0` at the bottom fiber of the precast girder. All distances measured upward.
- `y_b` = centroid from bottom fiber
- `y_t` = H_girder − y_b (centroid from top fiber of precast girder)
- `e` = eccentricity, measured downward from neutral axis to tendon centroid (positive = tendon below NA)

**Composite modular ratio:** `n_c = E_c_deck / E_c_girder` where `E_c = 4700 × √f'c` (MPa). Recompute dynamically; never hardcode.

**Global FEM axes:** X→right, Y→front (depth), Z→up, isometric projection + axis triad in viewports.

---

## Key Formula Reference

### Layer 1 — Gross Section (Non-Composite)

```
A_g  = Σ(b_i × h_i)                                          [3 rectangles: bot flange, web, top flange]
y_b  = Σ(A_i × y_i) / A_g                                    [y_i = centroid of rectangle from bottom]
y_t  = H_girder − y_b
I_g  = Σ(b_i×h_i³/12 + A_i×(y_i − y_b)²)
Z_tg = I_g / y_t,   Z_bg = I_g / y_b
```

### Layer 1 — Composite Transformed Section

```
n_c       = E_c_deck / E_c_girder
A_deck_tr = n_c × b_eff × t_d
y_deck    = H_girder + t_d/2
y_bc      = (A_g×y_b + A_deck_tr×y_deck) / (A_g + A_deck_tr)
y_tgc     = H_girder − y_bc
y_ttc     = H_girder + t_d − y_bc
I_c       = I_g + A_g×(y_b−y_bc)² + n_c×b_eff×t_d³/12 + A_deck_tr×(y_deck−y_bc)²
Z_bc      = I_c / y_bc
Z_tgc     = I_c / y_tgc
Z_ttc     = I_c / (n_c × y_ttc)
```

### Layer 4 — SLS Transfer Stage (non-composite, P_i and M_g only)

```
f_t = −P_i/A_g + P_i×e/Z_tg − M_g/Z_tg
f_b = −P_i/A_g − P_i×e/Z_bg + M_g/Z_bg
Limits → compression: −0.60×f'ci  |  tension: +0.50×√f'ci
```

### Layer 4 — SLS Service Stage (composite)

```
f_t_serv  = −Pe/A_g + Pe×e/Z_tg − (M_g+M_sdl)/Z_tg − M_live/Z_tgc
f_b_serv  = −Pe/A_g − Pe×e/Z_bg + (M_g+M_sdl)/Z_bg + M_live/Z_bc
f_deck    = −M_live / Z_ttc
Limits → compression: −0.45×f'c  |  tension: +0.50×√f'c (full) / +1.00×√f'c (partial)
```

### Layer 5 — ULS Flexure (Whitney block iteration)

```
f_ps = f_pu × [1 − (γ_p/β₁) × (ρ_p×f_pu/f'c + d/d_p×(ω−ω'))]
Iterate a until |C_b − T_total| < 1×10⁻⁵ N:
  if a ≤ t_d:  C_b = 0.85×f'c_deck×b_eff×a
  if a > t_d:  C_b = deck + girder flange contributions
M_n = A_ps×f_ps×(d_p − a/2) + A_s×f_y×(d − a/2)
Check: φ×M_n ≥ M_u  (φ = 0.90)
```

### Building seismic — ASCE 7-16 / NEHRP ELF (`buildingseismic.ts`)

```
SDS = ⅔·Fa·Ss ,  SD1 = ⅔·Fv·S1 ,  T0 = 0.2·SD1/SDS ,  TS = SD1/SDS
Sa(T): T<T0 → SDS(0.4+0.6T/T0) ; T0..TS → SDS ; TS..TL → SD1/T ; >TL → SD1·TL/T²
Cs = SDS/(R/Ie), capped SD1/(T·R/Ie), floor max(0.044·SDS·Ie, 0.01; 0.5·S1/(R/Ie) if S1≥0.6)
V = Cs·W ;  Fx = (wx·hx^k / Σwi·hi^k)·V  (k=1..2)
δx = Cd·δxe/Ie ;  P-Δ:  θ = Px·Δ·Ie/(Vx·hsx·Cd) ≤ θmax
EC8 parallel:  Sd(T) (EN 1998-1 §3.2.2.5),  Fb = Sd(T1)·m·λ
```

### Nonlinear hysteresis & cyclic response (`hysteresis.ts`)

```
Bilinear kinematic (return-mapping):  H_d = α·k0/(1−α) ;  k1 = α·k0
   F_trial = F + k0·Δu ;  f = |F_trial − q| − Fy ;  if f>0: Δu_p = f/(k0+H_d),
   F = F_trial − k0·sgn·Δu_p ,  q += H_d·sgn·Δu_p  (elasto-plastic α=0 ⇒ F capped ±Fy)
Bouc-Wen (smooth):  ż = A·u̇ − β|u̇||z|^(n−1)z − γ·u̇|z|^n ;  F = α·k0·u + (1−α)·Fy·z
   z_max = (A/(β+γ))^(1/n)   (monotonic saturation)
Takeda (RC degrading):  k_unload = k0·(u_y/u_max)^β_s · pinch  (envelope = bilinear)
Energy/damping per loop:  E_D = ∮F du ;  ξ_eq = E_D/(4π·E_so), E_so = ½·k_sec·u_m²
   elasto-plastic ⇒ ξ_eq = (2/π)(1 − 1/μ)
Nonlinear TH:  Newmark-β (γ=½,β=¼) + Newton on g(u)=p − m·a − c·v − F_int(u),
   k_eff = m/(βΔt²) + c·γ/(βΔt) + k_T ;  μ = u_peak/u_y
Park-Ang damage:  DI = μ/μ_cap + β_PA·E_H/(Fy·u_u),  u_u = μ_cap·u_y
Infill strut (Mainstone/FEMA 356):  λ1 = [Em·t·sin2θ/(4·Ec·Icol·h_inf)]^¼ ,
   a = 0.175·(λ1·h_col)^(−0.4)·r_inf
```

### Limit analysis & plasticity (`limitanalysis.ts`)

```
Yield-line (Johansen), rectangular slab UDL, bottom m, edge ratio i=m'/m:
   w_u = (24·m/Lx²)·(1+i) / [√(3+(Lx/Ly)²) − Lx/Ly]²
   (exact: square SS=24m/L², fixed i=1→48m/L²; 1-way SS=8/fixed=16·m/Lx²)
Plastic beam collapse (mechanism load):
   UDL:  SS 8·Mp/L² , fixed 16·Mp/L² , propped 11.657·Mp/L²
   point-mid:  SS 4·Mp/L , fixed 8·Mp/L , propped 6·Mp/L
Concrete plasticity (Nielsen):  ν = 0.7 − fc/200  (clamp 0.4–1) ;
   plastic shear τ = ν·fc·sinθ·cosθ (max ½ν·fc @45°) ; V = τ·bw·z
Bound theorems:  static/lower = SAFE (strut-and-tie) ; kinematic/upper =
   UNSAFE, lowest mechanism governs (yield-line)
```

---

## Database Schema (Supabase)

Four primary tables (full SQL in `PRD Prategang.md`):

| Table | Key Columns |
|---|---|
| `structural_projects` | project_id (UUID PK), title, standard_code (ENUM), span_length, relative_humidity |
| `material_properties` | project_id (FK), fc_girder_transfer, fc_girder_service, fc_deck_service, fpu_strand, fpy_strand, es_strand, ec_girder_service, fy_rebar, fys_rebar |
| `section_geometries` | project_id (FK), profile_type (ENUM), total_height, top/web/bottom flange dimensions, deck_thickness, deck_width_effective |
| `tendon_configurations` | project_id (FK), profile_geometry (ENUM: STRAIGHT/HARPED/PARABOLIC), total_strands_count, single_strand_area, jacking_force_percentage, eccentricity_midspan, eccentricity_support, hold_down_distance_ratio |

Supabase is env-gated (`isSupabaseConfigured()`); the app degrades gracefully when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent.

---

## Commands

```bash
npm install            # dependencies
npm run dev            # development server
npm test               # all tests
npx vitest run tests/core_engine_assertion.test.ts   # single test file
npx tsc --noEmit       # type check
npm run build          # production build
```

For the existing Python MVP: `pip install -r requirements.txt && streamlit run app.py`.

> **Build note:** Node is installed at `C:\Program Files\nodejs` (may not be on PATH) — prefix with `export PATH="$PATH:/c/Program Files/nodejs"` in the Bash tool.

---

## Benchmark Test Case (PRD §10)

All engine implementations must pass these numerical assertions within ±0.5%:

| Parameter | Value |
|---|---|
| L | 30,000 mm |
| Top flange b₁/h₁ | 600 / 200 mm |
| Web b₂/h₂ | 200 / 1,200 mm |
| Bottom flange b₃/h₃ | 700 / 250 mm |
| H_girder | 1,650 mm |
| Deck t_d / b_eff | 200 / 2,100 mm |
| f'ci / f'c (girder) | 40 / 50 MPa |
| f'c (deck) | 30 MPa |
| A_ps | 36 × 98.7 = 3,553.2 mm² |
| e_midspan / e_support | 650 / 0 mm |

**Verified gross section** (engine-computed, 29 vitest assertions passing):

| Property | Value |
|---|---|
| A_g | 535,000 mm² |
| y_b | **769.86 mm** *(PRD typo said 721.5 — incorrect)* |
| y_t | 880.14 mm |
| I_g | **1.7746 × 10¹¹ mm⁴** *(PRD typo said 1.942e11 — incorrect)* |
| Z_tg | 201.627 × 10⁶ mm³ |
| Z_bg | 230.509 × 10⁶ mm³ |

**Verified composite section:**

| Property | Value |
|---|---|
| n_c | 0.7746 |
| A_c | 860,331 mm² |
| y_bc | **1,140.5 mm** *(PRD typo said 1110.8 — incorrect)* |
| y_tgc | 509.5 mm |
| I_c | **3.7290 × 10¹¹ mm⁴** *(PRD typo said 4.105e11 — incorrect)* |
| Z_bc | 326.960 × 10⁶ mm³ |

**Verified ULS** (d_p = 1730.1 mm from top of composite):

| Property | Value |
|---|---|
| f_ps | **1,822.2 MPa** *(PRD typo said 1710.5 — incorrect)* |
| a | **120.91 mm** *(PRD typo said 145.2 — incorrect)* |
| M_n | **10,811 kN·m = 1.081 × 10¹⁰ N·mm** *(PRD typo said 7.23e9 — incorrect)* |
| φM_n | 9,730 kN·m (φ = 0.90) |
