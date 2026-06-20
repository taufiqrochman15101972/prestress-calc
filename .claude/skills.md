# PRESTRESS-CALC — Custom Skills Registry

Dokumen ini mendefinisikan custom skill yang tersedia untuk Claude Code pada proyek PRESTRESS-CALC.
Setiap skill memetakan satu layer dari arsitektur 5-layer engine.

Untuk membuat skill menjadi invocable via `/skill-name`, pindahkan setiap blok ke file terpisah:
`.claude/skills/<name>/skill.md`

---

## skill: section-engine

```yaml
name: section-engine
description: >
  Implement, debug, or extend the Section & Geometry Engine (Layer 1).
  Computes gross I-girder section properties and composite transformed section
  properties. Trigger when working on src/engine/section.ts or when section
  property results look incorrect.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**Input types expected:**
```typescript
interface IGirderGeometry {
  b1: number; h1: number;  // top flange: width, thickness (mm)
  b2: number; h2: number;  // web: width, height (mm)
  b3: number; h3: number;  // bottom flange: width, thickness (mm)
}
interface DeckGeometry {
  thicknessTd: number;     // deck slab thickness (mm)
  widthBeff: number;       // effective deck width (mm)
  fcDeck: number;          // f'c deck (MPa)
  fcGirder: number;        // f'c girder at service (MPa)
}
```

**Step 1 — Gross section (`calculateGrossProperties`):**
1. Discretize I-girder into 3 rectangles: bottom flange, web, top flange.
2. Compute `y_i` for each rectangle (centroid from bottom fiber).
3. `A_g = Σ(b_i × h_i)`
4. `y_b = Σ(A_i × y_i) / A_g` — centroid from bottom fiber.
5. `y_t = H_girder − y_b`
6. `I_g = Σ(b_i×h_i³/12 + A_i×(y_i − y_b)²)` — parallel-axis theorem.
7. `Z_tg = I_g / y_t`, `Z_bg = I_g / y_b`

**Step 2 — Composite section (`calculateCompositeProperties`):**
1. `E_c = 4700 × √f'c` (MPa) — compute for both deck and girder.
2. `n_c = E_c_deck / E_c_girder` — modular ratio (always dynamic, never hardcoded).
3. `A_deck_tr = n_c × b_eff × t_d`
4. `y_deck = H_girder + t_d / 2` — deck centroid from bottom of girder.
5. `y_bc = (A_g×y_b + A_deck_tr×y_deck) / (A_g + A_deck_tr)`
6. `y_tgc = H_girder − y_bc` — from top of precast girder to composite NA.
7. `y_ttc = H_girder + t_d − y_bc` — from top of deck to composite NA.
8. `I_c = I_g + A_g×(y_b−y_bc)² + n_c×b_eff×t_d³/12 + A_deck_tr×(y_deck−y_bc)²`
9. `Z_bc = I_c/y_bc`, `Z_tgc = I_c/y_tgc`, `Z_ttc = I_c/(n_c × y_ttc)`

**Step 3 — Benchmark assertion:**
Run `npx vitest run tests/core_engine_assertion.test.ts` section block.
All values must match within ±0.5%:
- `A_g = 535,000 mm²`
- `y_b = 721.5 mm`
- `I_g ≈ 1.942 × 10¹¹ mm⁴`
- `n_c ≈ 0.7746`
- `A_c ≈ 860,332 mm²`
- `y_bc ≈ 1,110.8 mm`
- `I_c ≈ 4.105 × 10¹¹ mm⁴`

---

## skill: prestress-forces

```yaml
name: prestress-forces
description: >
  Implement or debug tendon profile geometry and immediate prestress losses
  (Layer 2). Handles straight, harped, and parabolic tendon profiles, plus
  friction/wobble losses, anchorage slip, and elastic shortening.
  Trigger when working on src/engine/tendon.ts.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**Tendon profile geometry** — compute `e(x)` and `θ(x)` at 100 discrete points:

| Profile | e(x) | θ(x) |
|---|---|---|
| Straight | `e_midspan` (constant) | `0` |
| Harped | Linear interpolation in anchor zone, constant in middle zone | `atan((e_mid − e_sup)/x_g)` in anchor zone, `0` in middle |
| Parabolic | `e_sup + 4(e_mid−e_sup)×[x/L − (x/L)²]` | `atan(4(e_mid−e_sup)×(1−2x/L)/L)` |

**Immediate losses:**

1. **Friction & Wobble** — iterate over 100 discrete x positions:
   ```
   P(x) = P_j × exp(−(μ×α(x) + K×x))
   ```
   - `μ` = curvature friction coefficient (default 0.20 for grouted duct)
   - `K` = wobble friction coefficient (default 0.002 /mm)
   - `α(x)` = cumulative angle change from jacking end to x
   - If `(μα + Kx) ≤ 0.3`: use linear approximation `P(x) = P_j / (1 + μα + Kx)`

2. **Anchorage Slip** — `Δ_set = 6 mm` (default):
   ```
   p      = (P_j − P(L)) / L               [force gradient, N/mm]
   L_set  = √(Δ_set × A_ps × E_ps / p)
   ΔP(x)  = 2p × (L_set − x)  for x ≤ L_set
   P_after_slip(x) = P(x) − ΔP(x)
   ```

3. **Elastic Shortening** (Post-Tensioning, N strands jacked sequentially):
   ```
   f_cgp = P_i/A_g + P_i×e²/I_g − M_g×e/I_g
   ES    = (N−1)/(2N) × (E_ps/E_ci) × f_cgp
   ```
   - For Pre-Tensioning: `ES = A_ps × (E_ps/E_ci) × f_cgp`

**Balance load** (for parabolic profile):
```
w_p   = 8 × P × (e_mid − e_sup) / L²   [upward UDL, kN/m]
W_up  = P × (e_mid − e_sup) / x_g       [upward point load for harped, kN]
```

---

## skill: losses-tracker

```yaml
name: losses-tracker
description: >
  Implement or debug the Time-Dependent Loss Tracker (Layer 3) using
  AASHTO LRFD Refined Method. Computes creep (ΔfpCR), shrinkage (ΔfpSR),
  and low-relaxation strand relaxation (ΔfpR2).
  Trigger when working on src/engine/losses.ts or when long-term loss values
  seem incorrect.
tools: [read, write, bash]
model: sonnet
argument_hint: Pass project_id to fetch from Supabase, or inline {material, section, tendon} object.
```

### Task Protocol

Total long-term loss: `Δf_pLT = Δf_pSR + Δf_pCR + Δf_pR2`

**Shrinkage (ΔfpSR):**
```
ε_sh    = k_vs × k_hs × k_f × k_td × 0.00048
K_df    = 1 / (1 + (E_ps/E_c) × (A_ps/A_g) × [1 + A_g×e²/I_g] × [1 + 0.7×ψ_b])
Δf_pSR  = ε_sh × E_ps × K_df
```

Correction factors (AASHTO LRFD):
- `k_vs = 1.45 − 0.13(V/S)` — volume-to-surface ratio factor (V/S in mm)
- `k_hs = 2.00 − 0.014×RH` — humidity factor
- `k_f  = 35 / (7 + f'ci)` — concrete strength factor
- `k_td = t / (61 − 4f'ci + t)` — time development factor (t in days)

**Creep (ΔfpCR):**
```
ψ_b(t_f, t_i) = 1.9 × k_vs × k_hc × k_f × k_td × t_i^(−0.118)
k_hc           = 1.56 − 0.008×RH
Δf_pCR         = n × f_cgp × ψ_b × K_df
```
where `n = E_ps / E_c`

**Relaxation (ΔfpR2) — Low-Relaxation strand:**
```
Δf_pR2 = (f_pt/45) × (f_pt/f_pu − 0.55) × log(t_f / t_i)
```
- `t` in hours; `t_i` = time at end of cure, `t_f` = end of service life
- Only applies when `f_pt/f_pu > 0.55`; otherwise relaxation = 0

**Output:**
Write computed loss vectors to `src/engine/outputs/losses_vector.json`:
```json
{
  "project_id": "...",
  "friction_profile": [/* P(x) at 100 points */],
  "after_slip_profile": [/* P_after_slip(x) at 100 points */],
  "elastic_shortening_MPa": 0,
  "creep_loss_MPa": 0,
  "shrinkage_loss_MPa": 0,
  "relaxation_loss_MPa": 0,
  "total_long_term_loss_MPa": 0,
  "effective_prestress_Pe_kN": 0
}
```

---

## skill: sls-validator

```yaml
name: sls-validator
description: >
  Implement or debug the SLS Stress Matrix Validator (Layer 4).
  Evaluates fiber stresses at transfer and service stages against ACI 318 /
  SNI 2847 / AASHTO allowable limits and produces AMAN/OVERSTRESS verdicts.
  Trigger when working on src/engine/sls.ts or when stress limit checks fail.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**Inputs needed:** `SectionProperties`, `LossResults`, `MomentResults`, `GirderInputs`.

**Transfer Stage** (P_i = P_j for post-tension MVP; non-composite section):
```
σ_top = −P_i/A_g + P_i×e/Z_tg − M_g/Z_tg
σ_bot = −P_i/A_g − P_i×e/Z_bg + M_g/Z_bg
Allowable: σ_comp ≤ −0.60×f'ci  |  σ_tens ≤ +0.50×√f'ci
```

**Service Stage** (P_e after all losses; composite section for live load):
```
σ_top = −Pe/A_g + Pe×e/Z_tg − (M_g + M_sdl)/Z_tg − M_live/Z_tgc
σ_bot = −Pe/A_g − Pe×e/Z_bg + (M_g + M_sdl)/Z_bg + M_live/Z_bc
σ_deck = −M_live / Z_ttc
Allowable (full prestress): σ_comp ≤ −0.45×f'c  |  σ_tens ≤ +0.50×√f'c
Allowable (partial prestress): σ_tens ≤ +1.00×√f'c
```

**Output — `StressMatrix` object per fiber:**
```typescript
interface FiberResult {
  stage: 'Transfer' | 'Service';
  fiber: 'Top' | 'Bottom' | 'Deck';
  stress_MPa: number;
  limit_comp_MPa: number;
  limit_tens_MPa: number;
  utilization_comp: number;   // |σ| / limit_comp (0 if tensile)
  utilization_tens: number;   // σ / limit_tens (0 if compressive)
  is_safe: boolean;
  verdict: 'AMAN' | 'OVERSTRESS';
}
```

---

## skill: uls-engine

```yaml
name: uls-engine
description: >
  Implement or debug the ULS Detailing Suite (Layer 5). Covers nominal flexural
  capacity (Whitney block iteration), shear capacity (Vci/Vcw method), interface
  shear transfer, anchorage zone bursting, and long-term deflection/camber.
  Trigger when working on src/engine/uls.ts.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**A. Flexural ULS:**

```
f_ps = f_pu × [1 − (γ_p/β₁) × (ρ_p × f_pu/f'c + d/d_p × (ω − ω'))]
```
where `γ_p = 0.28` (low-relaxation), `β₁ = max(0.85 − 0.05(f'c−28)/7, 0.65)`

Iterate depth `a` until `|C_b − T_total| < 1×10⁻⁵ N`:
- `if a ≤ t_d` → `C_b = 0.85 × f'c_deck × b_eff × a`
- `if a > t_d` → deck contribution + top flange + web contributions (see PRD §7.1)

```
T_total = A_ps × f_ps + A_s × f_y
M_n     = A_ps×f_ps×(d_p − a/2) + A_s×f_y×(d − a/2)
Check:  φ×M_n ≥ M_u  (φ = 0.90)
```

**B. Shear ULS:**

```
V_p   = P_e × sin(θ_support)
M_cr  = Z_bg × (0.50×√f'c + f_pe − f_d)
V_ci  = max(0.05√f'c×b_w×d_v + V_d + V_i×M_cr/M_max,  0.17√f'c×b_w×d_v)
V_cw  = (0.29√f'c + 0.30×f_pc)×b_w×d_v + V_p
V_c   = min(V_ci, V_cw)
A_v/s = (V_u/φ − V_c − V_p) / (f_ys × d_v),   φ = 0.75
```

**C. Interface Shear Transfer:**
```
V_uh = V_u / d_v
V_nh = c×A_cv + μ×(A_vh×f_y + P_c)
Check: φ×V_nh ≥ V_uh  (φ = 0.75)
```

**D. Anchorage Zone Bursting:**
```
T_burst     = 0.25 × P_j × (1 − a_anchor/h_end_block)
A_s_burst   = T_burst / f_s   (f_s ≤ 150 MPa)
```

**E. Deflection (superposition):**
```
δ_total = δ_camber + δ_sw + δ_deck + δ_live
```
Apply creep multiplier 1.80–2.45 to long-term dead load components.
For partial prestress: compute crack width `w = s_r_max × (ε_sm − ε_cm)`.

**Benchmark:**
- `f_ps ≈ 1,710.5 MPa`
- `a ≈ 145.2 mm`
- `M_n ≈ 7.23 × 10⁹ N·mm`

---

## skill: box-girder-engine

```yaml
name: box-girder-engine
description: >
  Implement or debug the Box-Girder Bridge Superstructure Engine
  (src/engine/boxgirder.ts), per Christian Menn "Prestressed Concrete Bridges"
  Ch.5. Single-cell closed-section (St. Venant / Bredt) torsion, eccentric-load
  distribution to the two webs, and §5.3 cross-section component design (deck
  slab / webs / bottom slab). Surfaced as the standalone 🌉 Box Girder tab in
  ExtraCalculators (modal, same pattern as pile/corbel). Trigger when working on
  box-girder torsion, web shear+torsion interaction, or deck-slab transverse design.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**§5.1.2 — Closed-section (Bredt) torsion of a single cell:**
```
hk        = H − tt/2 − tb/2                    [enclosed height, slab mid-lines]
A_k       = ½(sw_top + sw_bot) × hk            [area enclosed by wall mid-lines]
v         = Tu / (2·A_k)                        [constant shear flow, Bredt 1st]
τ_i       = v / t_i                             [wall stress, each plate]
∮(ds/t)   = sw_top/tt + sw_bot/tb + 2·L_web/tw
J_box     = 4·A_k² / ∮(ds/t)                    [closed torsion constant, Bredt 2nd]
J_open    = Σ(b·t³)/3                            [open-section comparison ≪ J_box]
θ'        = Tu / (G·J_box),  G = Ec/2.4         [twist rate]
```
Report `J_box / J_open` (~40×) to demonstrate why a closed box is torsionally stiff.

**§5.1.1 — Distribution of an eccentric load P at transverse eccentricity e:**
```
symmetric  → P/2 per web (flexural shear)
torsion    → T = P·e  →  shear flow  →  ±v·hk per web (antisymmetric)
V_web_max  = P/2 + v·hk     V_web_min = P/2 − v·hk
```

**§5.3.2 — Web (variable-angle truss, combined gravity + torsion):**
```
V_web      = Vu/2 + v(Tu)·hk + V_tor(P·e)
z          = 0.9·hk
A_v/s      = V_web / (φ·z·fy·cotθ)                       φ = 0.75
σ_strut    = V_web / (t_w·z·sinθ·cosθ) ≤ ν·f'c           ν = 0.6(1−f'c/250)
```

**§5.3.1 — Deck slab transverse bending:** cantilever overhang moment vs
continuous interior span between webs; `As = M/(0.9·d·fy)`.

**§5.3.3 — Bottom slab:** longitudinal compression over interior supports of a
continuous box, `σ = −|Mu|/Z_b ≥ −0.6f'c`.

NOTE: procedure/structure from Menn Ch.5; numeric limits/factors follow the
project's adopted codes, never the book's figures.

---

## skill: bridge-load-engine

```yaml
name: bridge-load-engine
description: >
  Implement or debug the SNI 1725:2016 / RSNI T-02-2005 bridge live-load
  generator (src/engine/bridgeload.ts), per Soetoyo "Konstruksi Beton Pratekan"
  §9 + Nawir Rasidi "Monograf Jembatan" BAB 4. Lane load "D" (BTR + BTG) with
  dynamic allowance FBD → per-girder M_live / V_live and an equivalent uniform
  wLive. Surfaced as the standalone 🚚 Beban Jembatan SNI 1725 tab. Trigger when
  working on Indonesian bridge live loads or feeding M_live into the main design.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**Lane load "D" — code intensities (SNI 1725 / RSNI T-02-2005):**
```
BTR  q = 9.0 kPa                      (L ≤ 30 m)
     q = 9.0·(0.5 + 15/L) kPa         (L > 30 m)
BGT  p = 49.0 kN/m
FBD  = 0.40                            (L ≤ 50 m)
     = 0.40 − 0.0025·(L−50)           (50 < L < 90 m)
     = 0.30                            (L ≥ 90 m)
Truk "T" = 500 kN                      (short spans / local slab, reference)
```

**Per-girder effects (tributary width b_trib, simple span):**
```
q_line  = q · b_trib · btrFactor · girderDF        [kN/m]
P_knife = p · b_trib · girderDF                    [kN]
M_live  = q_line·L²/8 + (1+FBD)·P_knife·L/4         [kN·m]
V_live  = q_line·L/2  + (1+FBD)·P_knife             [kN]
wLive_equiv = 8·M_live / L²                          [kN/m, drop-in for main wLive]
```

NOTE: q, p, FBD are CODE values, never the book's worked-example arithmetic
(Soetoyo even mis-prints p as "4.9 kN/m"). btrFactor handles the SNI 100%/50%
transverse-width rule; girderDF handles lever-rule distribution.

---

## skill: lateral-stability-engine

```yaml
name: lateral-stability-engine
description: >
  Implement or debug the Lateral Stability / Lateral-Torsional Buckling engine
  (src/engine/lateralstability.ts), per Abeles & Bardhan-Roy "Prestressed
  Concrete Designer's Handbook" §13.3 (after Timoshenko). Torsional + weak-axis
  properties and the buckling check for slender beams (handling/transport/
  erection / laterally-unsupported spans). Surfaced as the standalone 🌀
  Stabilitas Lateral / Tekuk Torsi tab. Trigger when working on lateral
  stability, slender-girder buckling, or torsional section properties.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**1. Torsional + weak-axis properties (3 rectangles, symmetric):**
```
I_y = Σ(h_i·b_i³/12)                      [weak Y-Y second moment]
J   = Σ(⅓·d_i·t_i³)                        [St. Venant, open built-up; d=long, t=short]
E_eff = E_c/(1+φ)                          [creep-softened for sustained load]
G   = E_eff/(2(1+ν))                        [shear modulus]
B₁  = E_eff·I_y     C = G·J                 [flexural / torsional rigidity]
```

**2. Slenderness screen (CP 115):** if L/b_flange > 30 → must investigate.

**3. Timoshenko critical buckling load (eq. 13.3):**
```
W_cr = (K/L²)·√(B₁·C)
K: cantilever 4.013 (point) / 12.85 (UDL);
   SS 16.93 (point mid) / 19.04 (0.3L) / 24.10 (0.25L) / 28.3 (UDL);
   fixed 26.6 (point mid).
```
Load above centroid reduces W_cr (destabilising); below increases it.

**4. Factor of safety:** FS = W_cr / W_applied ≥ 3 (Abeles: not less than 3,
because E, G of concrete are uncertain).

NOTE: K constants and FS≥3 from Abeles/Timoshenko structure; material values
per the adopted code, not the book's arithmetic. Complements (does not replace)
the ACI §22.7 V+T reinforcement design in torsion.ts.

---

## skill: segmental-construction-engine

```yaml
name: segmental-construction-engine
description: >
  Implement or debug the Construction-Stage / Segmental Bridge engine
  (src/engine/segmental.ts), per Hewson "Prestressed Concrete Bridges" Ch.12-15
  + PTI Manual §2.7. Balanced-cantilever erection, incremental launching, and
  creep redistribution on a structural-system change. Surfaced as the 🏗
  Konstruksi Bertahap / Segmental tab. Trigger when working on erection-stage
  moments, launching stresses, or staged-construction creep effects.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**Balanced cantilever (one arm, hogging at the pier):**
```
M_self   = w·L_cant²/2          M_trav = P_trav·L_cant
M_constr = q_constr·L_cant²/2    M_pier = M_self + M_trav + M_constr
M_unbal  = w·L_seg·(L_cant − L_seg/2) + P_trav·L_cant   [one segment ahead]
```

**Incremental launching (reversing ±M, concentric prestress):**
```
M_cant,no-nose = w·L_span²/2
M_hog = M_cant,no-nose·(1 − noseEff)     M_sag = w·L_span²/8
σ = −P/A ± M/Z  checked against early-age 0.5√f'ci / −0.6f'ci
```

**Creep redistribution on system change (cantilever → continuous):**
```
M_final = M_built + (M_mono − M_built)·(1 − e^(−φ))
```

---

## skill: external-prestress-engine

```yaml
name: external-prestress-engine
description: >
  Implement or debug the External / Unbonded Prestressing engine
  (src/engine/external.ts), per Hewson §6-7 + PTI §3.2.3. Polygonal external
  tendons deviated at saddles, deviator forces and friction, second-order
  eccentricity loss, and the ACI unbonded ULS stress. Surfaced as the 🪢
  Prategang Eksternal tab. Trigger when working on external tendons, deviators,
  or unbonded f_ps.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
Deviator force   F = 2·P·sin(Δθ/2)         friction = 1 − e^(−μ·Δθ)
Equivalent uplift w_eq = n_dev·F / L
2nd-order ecc.   e_eff = e_dev − δ_beam     d_p,eff = d_p − δ_beam
ULS unbonded (ACI 318-19 §20.3.2.4.1):
  L/h ≤ 35:  f_ps = f_pe + 70 + f'c/(100·ρ_p),  cap min(f_py, f_pe+420)
  L/h > 35:  f_ps = f_pe + 70 + f'c/(300·ρ_p),  cap min(f_py, f_pe+210)
  a = A_ps·f_ps/(0.85 f'c b),  M_n = A_ps·f_ps·(d_p,eff − a/2)
```

NOTE: external Δf_ps is member-dependent (much smaller than bonded) and the
lever arm reduces under deflection → lower flexural capacity; always check
deviator forces and friction. Procedure from Hewson/PTI; caps are ACI code.

---

## skill: handling-erection-engine

```yaml
name: handling-erection-engine
description: >
  Implement or debug the Component Handling, Erection & Long-Term Camber engine
  (src/engine/handling.ts), per PCI Design Handbook 7th Ed. Ch.8 + Ch.5 camber
  multipliers. Stripping/transport/erection stresses at the lifting points and
  PCI long-term camber estimation. Surfaced as the 🏭 Handling & Ereksi + Camber
  tab. Trigger when working on precast handling stresses, lifting points, or
  long-term camber.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

**Two-point symmetric pickup (a = ratio·L, L1 = L − 2a):**
```
M_support = −w·a²/2            M_mid = w·L1²/8 − w·a²/2      (optimum a ≈ 0.207L)
w scaled per stage by impact: stripping ~1.2, transport ~1.5, erection ~1.2
σ = −P/A ± P·e/Z ∓ M/Z   checked vs +0.5√f'ci / −0.6f'ci
```

**PCI long-term camber multipliers (apply to instantaneous values):**
```
erection (no topping):  camberₚ ×1.80,  deflw ×1.85
final  (no topping):    camberₚ ×2.45,  deflw ×2.70,  defl_sdl ×3.00
final  (with topping):  camberₚ ×2.20,  deflw ×2.40,  defl_sdl ×3.00, defl_top ×2.30
```

---

## skill: fire-resistance-engine

```yaml
name: fire-resistance-engine
description: >
  Implement or debug the Fire-Resistance Design engine
  (src/engine/fireresistance.ts), per PCI Design Handbook 7th Ed. Ch.10 + Abeles
  §16 after ACI 216.1. Prescriptive thickness/cover by rating + analytical
  strength check at the fire limit state. Surfaced as the 🔥 Ketahanan Api tab.
  Trigger when working on fire endurance, strand strength at temperature, or
  cover/thickness for a fire rating.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
(1) Prescriptive: min equivalent thickness + min cover to strand from the ACI
    216 tables by rating (1/1.5/2/3/4 h) and aggregate (siliceous/carbonate/
    lightweight); restrained vs unrestrained selects the cover table.
(2) Strength: θ_s (strand temp, from cover & rating) → k_θ retained-strength
    factor (1.0 ≤150°C, ~0.5 ~425°C, 0 ~700°C); f_pu,θ = k_θ·f_pu;
    a_θ = A_ps·f_pu,θ/(0.85 f'c b);  M_n,θ = A_ps·f_pu,θ·(d_p − a_θ/2) ≥ M_fire
    (fire load factor 1.0, no φ).
```

NOTE: table thickness/cover and the k_θ curve are the ACI 216 / PCI procedure;
the member's f'c and A_ps are project data. Restrained members get extra
endurance from continuity thrust.

---

## skill: distribution-factor-engine

```yaml
name: distribution-factor-engine
description: >
  Implement or debug the AASHTO LRFD Live-Load Distribution Factor engine
  (src/engine/distribution.ts), per "Bridge Superstructure Design" Ch.3 / AASHTO
  LRFD §4.6.2.2 (Type k I/bulb-tee/spread-box girders). Surfaced as the 🛤
  Faktor Distribusi LRFD tab; the governing g feeds the manual girderDF of
  bridgeload.ts. Trigger when working on live-load distribution to girders.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
K_g = n·(I + A·e_g²)                      n = E_girder/E_deck
Interior moment  1 lane : 0.06 + (S/4300)^0.4·(S/L)^0.3·(K_g/(L·t_s³))^0.1
                 2+lane : 0.075 + (S/2900)^0.6·(S/L)^0.2·(K_g/(L·t_s³))^0.1
Interior shear   1 lane : 0.36 + S/7600
                 2+lane : 0.2 + S/3600 − (S/10700)²
Exterior moment  1 lane : lever rule (multiple-presence m=1.20)
                 2+lane : e·g_int,  e = 0.77 + d_e/2800
Exterior shear   2+lane : e·g_int,  e = 0.6 + d_e/3000
governing g_M, g_V = max over cases  → girderDF in bridgeload.ts
```

NOTE: AASHTO LRFD code equations (S, L, t_s in mm); not the manual's worked
numbers. Multiple-presence is built into the empirical eqs except the lever rule.

---

## skill: differential-shrinkage-engine

```yaml
name: differential-shrinkage-engine
description: >
  Implement or debug the Differential Shrinkage (composite members) engine
  (src/engine/diffshrinkage.ts), per Abeles & Bardhan-Roy §11.5/§11.7.4 (Evans
  & Parker; BS 5400/Hambly). The young deck shrinks relative to the older
  girder; bond restraint adds tension at the girder soffit. Surfaced as the 💧
  Susut Diferensial Komposit tab. Trigger when working on composite long-term
  effects or soffit crack checks.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
phi_red = (1 - e^-phi)/phi                       creep relaxation of shrink stress
F_sh    = dEps . E_deck . A_deck . phi_red       restraint force (+ = deck tension)
a_cent  = y_top_slab - t_d/2                      NA -> deck centroid
M_cs    = F_sh . a_cent                           about composite NA
f_free  = dEps . E_deck . phi_red                 released free-shrink tension (deck)
σ(deck)   = f_free - F_sh/A_c - M_cs.y/I_c        (y above NA +)
σ(girder) =        - F_sh/A_c ± M_cs.y/I_c        soffit (below NA) → +tension
```

NOTE: Evans-Parker procedure & phi_red form from Abeles; dEps and moduli per the
project's adopted code. The soffit tension ADDS to the SLS service tension —
include it in the composite crack check.

---

## skill: aemm-longterm-engine

```yaml
name: aemm-longterm-engine
description: >
  Implement or debug the Age-Adjusted Effective Modulus (AEMM) long-term engine
  (src/engine/aemm.ts), per Gilbert/Mickleborough/Ranzi §5.7/§5.11.4 (Trost-
  Bazant). Surfaced as the ⏳ Jangka Panjang AEMM tab, incl. the expansion-joint
  movement sub-block (computeJointMovement, WSDOT BDM §5.8.1.E flow). Trigger
  when working on long-term deflection, time analysis, or joint movement.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
Ee    = Ec/(1+phi)        EeBar = Ec/(1+chi.phi)
eps0  = N0/(Ec.A)         kappa0 = M0/(Ec.I)       N0=-Pe, M0=Msus-Pe.e
restrained: dNcr=-EeBar.phi.eps0.A   dMcr=-EeBar.phi.kappa0.I
            dNsh=-EeBar.epsSh.A      dNr=-dSigma_rel.Aps (at tendon level)
release on [Abar Bbar; Bbar Ibar] (nbar=Ep/EeBar) -> dEps, dKappa
kappa_inf = kappa0+dKappa -> delta = 5/48.kappa.L^2 ; dSigma_p = Ep(dEps-dKappa.e)
joint: open = dElastic(1+phi) + epsSh.L + alpha.dT-.L ; range = gamma.(open+close)
```

---

## skill: special-members-engine

```yaml
name: special-members-engine
description: >
  Implement or debug the special prestressed members engine
  (src/engine/specialmembers.ts) — circular pipes (hoop + wire winding), poles
  (annular cantilever, wind), railway sleepers (rail-seat/centre moments) — per
  Krishna Raju Ch.16/19. Surfaced as the 🧪 Pipa·Tiang·Bantalan Rel tab.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
PIPE   : N_theta=p.Di/2 ; sigma_pre,req=sigma_hoop+residual ; s=Aw.sigma_w/(sigma_pre.t)
POLE   : annular A,Z ; Mbase=P.H+w.H^2/2 ; faces ±M/Z vs 0.5√fc / 0.45fc ; Mcrack FS
SLEEPER: R=(axle/2).impact ; p=2R/(B.L) ; Mrs=p.B.a^2/2 (a=(L-gauge)/2) ; centre hogging
```

---

## skill: dual-method-engine

```yaml
name: dual-method-engine
description: >
  Implement or debug the side-by-side Full vs LRFD-Partial method comparison
  (src/engine/dualmethod.ts, computeDualMethod). Always computed in runPipeline;
  rendered as DualMethodBlock (SLS tab) and report §16A. Trigger when working on
  Class U vs Class C verdicts, crack width under partial prestress, or PPR.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
FULL    : tension limit 0.5√f'c (Class U, uncracked)
PARTIAL : limit 1.0√f'c ; cracked if sigma_b > f_r = 0.62√f'c
          -> Gergely-Lutz w_cr vs 0.30 mm, fs steel, As required, PPR
governs : the stricter verdict wins; both ALWAYS computed (never a toggle)
```

---

## skill: curved-tendon-engine

```yaml
name: curved-tendon-engine
description: >
  Implement or debug the curved-tendon radial force engine
  (src/engine/curvedtendon.ts), per Stone & Breen CTR 208-3F + CTR 365-1 as
  codified in AASHTO LRFD §5.9.5.4.3. Surfaced as the ➰ Tendon Melengkung tab.
  Trigger when working on in-duct curvature, multistrand flattening, or tieback.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
F_in  = Pu/R              in-plane radial (kN/m)
F_out = Pu/(pi.R)         out-of-plane multistrand flattening
d_eff = d_c + duct/4 ;  Vr = 0.75 . 2 . 0.33√f'ci . d_eff   (two shear planes)
if F_in > Vr -> tieback As = F_in/(0.9 fy) per metre (carries FULL force)
web strip bending sigma = (F_out.bw/8)/(1000.t^2/6) ; screen R >= 6 m else deviator
```

---

## skill: load-rating-engine

```yaml
name: load-rating-engine
description: >
  Implement or debug the LRFR bridge load-rating engine (src/engine/rating.ts),
  per AASHTO MBE §6A with the CDOT Rating Manual §9B procedure. Surfaced as the
  🏷 Load Rating tab. Trigger when working on rating factors, posting, or
  inventory/operating levels.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
RF = (phiC.phiS.phi.Rn - 1.25 DC - 1.50 DW) / (gammaLL . (LL+IM))
     inventory gammaLL=1.75 ; operating 1.35 ; phiC.phiS >= 0.85
Service III (PS only, inventory): RF = (fR - fD)/(0.80 fLL), fR = 0.5√f'c
governing RF = min(all) ; safe load = RF x rating-vehicle weight ; RF>=1 adequate
```

---

## skill: spliced-girder-engine

```yaml
name: spliced-girder-engine
description: >
  Implement or debug the spliced two-stage PT girder engine
  (src/engine/splicedgirder.ts), per Ronald (PCI Journal 2001), TxDOT 0-6652-1
  (duct shear) and WSDOT BDM §5.9. Surfaced as the 🧩 Gelagar Spliced tab.
  Trigger when working on staged PT, closure joints, or duct shear knock-down.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
Stage A: pretension + Mg on PRECAST section (f'ci limits, transfer 0.6/0.5√)
Stage B: stage-1 PT + Mdeck still on PRECAST section (non-composite)
Stage C: stage-2 PT + Msdl + MLL on COMPOSITE section (f'c, service 0.45)
cumulative sigma(top/bot) per stage; each stage checked at ITS section
joint: only PT crosses the splice -> sigma_joint = stageB+stageC parts <= 0
duct: lambda = 1 - 2(duct/bw)^2 on (Vc+Vs)  [AASHTO 5.7.2.8]
      legacy bv_eff = bw - 0.25duct (grouted) / 0.50duct (ungrouted)
```

---

## skill: fatigue-engine

```yaml
name: fatigue-engine
description: >
  Implement or debug the fatigue limit-state engine (src/engine/fatigue.ts),
  per FHWA NHI-04-043/044 step 5.6.6 and AASHTO LRFD §5.5.3 (Fatigue I).
  Surfaced as the 🔁 Fatik tab. Trigger when working on stress ranges,
  fatigue trucks, or the uncracked screen.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
screen : sigma_bot = sigma_perm + 1.75 Mfat/Zbc <= 0.25√f'c -> strand check waived
strand : dfp = np . 1.75 Mfat . e_ps / Ic
         DF_TH = 125 MPa (R>9m) ... 70 MPa (R<=3.6m), linear between
rebar  : dfs = ns . 1.75 Mfat . (ybc-ds)/Ic <= 166 - 0.33 f_min
also   : longitudinal tie check lives in mcft.ts (T_req vs Aps.fps + As.fy)
```

---

## skill: pt-approx-loss-engine

```yaml
name: pt-approx-loss-engine
description: >
  Implement or debug the post-tensioned approximate long-term loss method
  (computePTApproxLoss in src/engine/losses.ts), per Shing & Kottari UCSD
  SSRP-11/02 (Caltrans 2011) eq. 6.7. Surfaced as the 3rd sub-block of the
  ⏳ AEMM tab. Trigger when working on PT-specific losses, age at stressing,
  or mild-steel restraint of creep/shrinkage.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
df_pLT = (14 g_st g_ac fpi.Aps/At + 69 g_as) g_h g_sr + df_pR    [MPa]
g_st = 1/(0.67 + f'c/62)         g_ac = ti^-0.118
g_as = 1 - [ti/(35+ti)][(45+ti)/(157+ti)]
g_h  = 1.7 - 0.01H               g_sr = 1/(1+(eta-1)(rho_ps+rho_ns))
eta  = 6(1 + 1.2 ti^-0.118)      df_pR = 16.5 (LL) / 69 (SR)
PT vs pretensioned: ti maturity lowers creep+shrink; rho_ns restrains both
```

---

## skill: cost-optimization-engine

```yaml
name: cost-optimization-engine
description: >
  Implement or debug the HPC girder-bridge cost optimization engine
  (src/engine/optimization.ts), per Hassanain & Loov (PCI Journal 1999).
  Surfaced as the 💰 Optimasi Biaya HPC tab. Trigger when working on cost
  per deck area, CMCR, or girder-count/spacing alternatives.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
C      = [ng.Cg + Cc.Vc + Cs.ms]/(W.L)        cost per m2 deck
CMCR   = 0.936 + (f'c/100 MPa)^3              mix cost ratio (vs fcRef)
C_te   = C_fixed + ng . c_per_girder          transport + erection
screens: 3.0 <= spacing <= 6.0 m, ng >= 2 (>=3 staged repair), td >= 225 mm
girder cost scales: volume x CMCR(fc)/CMCR(fcRef)
profiles: NU750-2400+NU2000PT & CPCI 1200-2300 live in lib/presets.ts
debond : checkDebondLimits in development.ts (<=25% total, <=40% per row)
```

---

## skill: mast-roll-stability-engine

```yaml
name: mast-roll-stability-engine
description: >
  Implement or debug the Mast roll-equilibrium lateral stability (computeMastHanging
  / computeMastHauling in src/engine/lateralstability.ts), per PCI BDM §8.10. This
  is rigid-body ROLL + lateral bending, physically distinct from the Timoshenko
  buckling W_cr in the same file. Surfaced as MastBlock in the 🌀 tab. Trigger on
  hanging/hauling/superelevation/roll-axis stability work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
sweep offset factor   = (L1/L)^2 - 1/3
hanging  FSc = 1/(zo/yr + thetaI/thetaMax)            >= 1.5
hauling  r   = Ktheta/W ; theta_eq = (alpha.r+ei)/(r-y-zo)
         FSc (cracking) >= 1.0 ; FSf (rollover) >= 1.5
zo' = zo(1 + 2.5.theta'max). DO NOT trust PDF numbers; procedure only.
```

---

## skill: aashto-hl93-engine

```yaml
name: aashto-hl93-engine
description: >
  Implement or debug the AASHTO HL-93 closed-form per-lane live load
  (computeAashtoLiveLoad in src/engine/bridgeload.ts), per PCI BDM §8.11 / AASHTO
  LRFD §3.6.1. Surfaced as Hl93Block in the 🚚 tab beside the SNI "D" load. Trigger
  on HS20 truck/tandem/lane/fatigue moment-shear envelope work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
truck HS20 = 35+145+145 kN ; tandem = 2x110 kN @1.2 m ; lane = 9.3 kN/m
HL-93 = max(truck,tandem).(1+IM) + lane    (simple-span closed form)
fatigue truck: rear axle fixed 9.1 m, IM 15%, factor 1.15.gM
per-girder M/V = lane value x g (gM/gV from 🛤 LLDF tab) -> wLive_equiv
```

---

## skill: transverse-box-pt-engine

```yaml
name: transverse-box-pt-engine
description: >
  Implement or debug the adjacent box-beam transverse design (src/engine/transversept.ts),
  per PCI BDM §8.9 (El-Remaily, Tadros). Surfaced as the 🔲 tab. Trigger on transverse
  PT diaphragm force, Fig 8.9.3-2 chart, grout stress, or Oregon tie-rod work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
method 1 (rational): F from digitized Fig 8.9.3-2 (kip/ft by width 28-90 ft x
          depth 27/33/39/42 in, bilinear) ; Apt = F/(0.55 fpu)
          grout no-tension + 1.72 MPa (0.250 ksi) rigid limit ; x1.30 unbonded
method 2 (Oregon): O22 A449 @ 175 kN each, count by span, total >= beam weight
```

---

## skill: strut-and-tie-engine

```yaml
name: strut-and-tie-engine
description: >
  Implement or debug the strut-and-tie model engine (src/engine/strutandtie.ts),
  per PCI BDM §8.12 / AASHTO LRFD §5.6.3. Surfaced as the ▽ tab. Trigger on
  D-region truss, f_cu compression softening, node factors, or pier-cap truss work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
f_cu = f'c/(0.8 + 170.eps1) <= 0.85 f'c ; eps1 = (eps_s + 0.002).cot^2(alpha_s)
node factors: CCC 0.85 / CCT 0.75 / CTT 0.65 ; phi_strut 0.70 / phi_tie 0.90
A_st = Tu/(phi.fy). pier cap: F_topTie = Pu/tan(theta), diagonals Pu/sin(theta)
```

---

## skill: deck-slab-engine

```yaml
name: deck-slab-engine
description: >
  Implement or debug the bridge deck slab design engine (src/engine/deckslab.ts),
  per PCI BDM §8.8. Surfaced as the 🛞 tab. Trigger on transverse deck bending,
  AASHTO Standard (S+2)/32 vs LRFD equivalent-strip method work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
Standard: M_LL = cont.((S_ft+2)/32).P  x impact 30% ; M_u = 1.3(M_D + 1.67 M_LLI)
LRFD strip: Epos=660+0.55S, Eneg=1220+0.25S, Eov=1140+0.833X (mm), IM 1.33
            M_u = 1.25 M_DC + 1.75 M_LL   (positive / negative / overhang)
```

---

## skill: seismic-engine

```yaml
name: seismic-engine
description: >
  Implement or debug the single-mode uniform-load seismic engine (src/engine/seismic.ts),
  per PCI BDM Ch.15 / AASHTO STD Div. I-A + LRFD §4.7.4. Surfaced as the 🌐 tab.
  Trigger on SPC category, period T, Cs, design force V/R, or min seat width N work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
SPC A-D by A ; K = direct, or 3.EI/h^3 (single) / 12.EI/h^3 (double curvature)
T = 2.pi.sqrt(W/(g.K)) ; Cs = 1.2.A.S/T^(2/3) <= 2.5 A ; V = Cs.W/R
min connection (SPC A) = 0.20.DL ; seat N: STD I-A (in) vs LRFD §4.7.4.4 (mm), skew
precast prestressed girders force-protected -> columns/connections absorb energy
```

---

## skill: substructure-engine

```yaml
name: substructure-engine
description: >
  Implement or debug the ordinary-RC substructure engine (beton bertulang biasa,
  src/engine/substructure.ts), per Wai-Fah Chen "Bridge Engineering: Substructure
  Design" + AASHTO LRFD §3/§5/§10 + SUSPA/VSL rock anchor. Surfaced as the 🏛️ tab
  (7 sub-tabs). Trigger on load combinations, RC pier column P-M, bent cap,
  spread footing, pile group/cap, abutment stability, or ground/rock anchor work.
  Keep strain control (phiFromStrain, εt ramp) consistent with column.ts/uls.ts.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
load combos: AASHTO Tbl 3.4.1-1 Strength I/III/V + Service I + Extreme I ; γ_p max/min
phiFromStrain: φ=0.90 (εt>=0.005) ; 0.65/0.75 (εt<=εty) ; linear transition
pier col: P-M by NA sweep ; ρ 1-8% ; δ = Cm/(1-Pu/0.75Pc) >= 1.0
footing: q = ΣP/A ± M/S (kern L/6) ; punch b0 @ d/2 (min of 3 vc) ; 1-way @ d ; flexure @ col face
pile group: R = P/n ± M.x/Σx² ; Converse-Labarre eff ; uplift screen
abutment: Ka = tan²(45-φ/2) ; FS_ot>=2.0 ; FS_sl>=1.5 ; bearing ; stem RC
anchor: T_steel=0.6 fpu Aps ; T_bond = π.d.Lb.τ/FS (perm FS>=2.0) ; lock-off 0.7T
NEVER trust PDF numbers — only chapter/sub-chapter order, procedure, formulas
```

---

## skill: creep-shrinkage-engine

```yaml
name: creep-shrinkage-engine
description: >
  Implement or debug the time-dependent creep & shrinkage prediction engine
  (src/engine/creepshrinkage.ts), the long-term backbone of books 123-135.
  Four parallel models: ACI 209R-92, CEB-FIP MC90/fib MC2010, GL2000, B3.
  Surfaced as the 🕰 tab; feeds ⏳ AEMM, PCI camber, and prestress-loss path.
  Trigger on φ(t,t0), ε_sh(t), effective/age-adjusted modulus, χ, or model
  comparison work. Keep χ in 0.6–0.9 and ε_sh negative (shortening).
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
ACI209: φ=(τ^0.6/(10+τ^0.6))·φu ; ε_sh=(t/(35+t))·ε_shu ; RH/size/load-age γ
CEB-FIP/fib: φ0=φRH·β(fcm)·β(t0) ; βc=(τ/(βH+τ))^0.3 ; ε_cd drying + ε_ca autogenous
GL2000: Φ(τ) 3-term ; ε_shu·βh·βt    B3: condensed compliance → φ, tanh shrinkage
E_eff=Ec/(1+φ) ; χ=Trost-Bažant aging ; E_adj=Ec/(1+χφ) (AEMM) ; compareAllModels()
```

---

## skill: box-girder-engine (extended)

```yaml
name: box-girder-engine
description: >
  Implement or debug the single-cell box-girder engine (src/engine/boxgirder.ts),
  per Menn Ch.5 (torsion/eccentric split/components) PLUS computeBoxDistortion
  (Wright deformable cross-section, BEF analogy — book 124) and computeBoxShearLag
  (effective flange width + Timoshenko shear-deformation deflection — book 135).
  Surfaced as the 🌉 tab. Trigger on Bredt torsion, distortion/diaphragm spacing,
  shear lag, or box deflection work.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
torsion: v=T/(2Ak) ; J=4Ak²/∮(ds/t) ; Jbox/Jopen ; eccentric → sym + antisym webs
distortion: λ=(Kframe/4EI_dw)^0.25 ; βL ; corner M ; σ_warp/σ_bend ≤ 0.10 ; diaphragm
shear lag: b_eff=ψ·b ; deflection δ=δ_bend(5wL⁴/384EI)+δ_shear(wL²/8GAv) ; ≤ L/800
```

---

## skill: rc-girder-engine

```yaml
name: rc-girder-engine
description: >
  Implement or debug the ordinary RC T-beam BRIDGE SUPERSTRUCTURE engine
  (src/engine/rcgirder.ts) — beton bertulang biasa, standar Bina Marga
  "Gelagar Beton Bertulang Balok-T 5–25 m" (book 152) + AASHTO LRFD §4.6.2.6/§5
  + SNI 2847/1725. Surfaced as the 🧱 Gelagar Balok-T tab. Reuses beta1 &
  phiFromStrain from substructure.ts (no duplication). Trigger on effective
  flange width, T-section flexure, RC bridge-girder shear, or strain control.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
1. b_eff = min(L/4, S, b_w+16h_f)
2. loads → Mu = 1.25DC+1.5DW+1.8LL (SNI 1725 "D": q BTR + p=49 BGT, FBD, × g)
3. flexure T-section: a=(As−As')fy/(0.85f'c·b_eff); a≤h_f rectangular else true-T
   (Asf flange overhang couple + Asw web couple); εt=εcu(d−c)/c → phiFromStrain
   As,min=max(0.25√f'c/fy, 1.4/fy)·b_w·d ; φMn ≥ Mu
4. shear: Vc=0.17√f'c·b_w·d ; Vs=Vu/φ−Vc ; Av/s ; s_max ; Vs ≤ 0.66√f'c·b_w·d
```

---

## skill: made-continuous-engine

```yaml
name: made-continuous-engine
description: >
  Implement or debug the made-continuous precast prestressed girder engine
  (src/engine/madecontinuous.ts) — NCHRP 322 + Freyermuth/PCA + PCI BDM §11.1.
  DISTINCT from continuous.ts (TY-Lin secondary moments): here simple-span
  girders are made continuous AFTER prestress+self-weight; time-dependent
  RESTRAINT moments develop. Surfaced as ⛓️ Gelagar Dibuat Menerus tab.
  Reuses Ec from substructure.ts. Trigger on restraint moment, continuity
  diaphragm, positive-moment connection, or creep redistribution at supports.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
rotation method (2/3 equal spans): θ=w·L³/(24EI) ; M_support=−3EI·θ/L
w_p=8·Pe·e/L² (prestress, +sag) ; self-weight (−hog)
M_r = (M_p,cont + M_g,cont)·(1−e^−φ) + M_sh·(1−e^−φ)/φ   [shrinkage relieves +]
positive-moment connection (AASHTO §5.12.3.3): M_conn=max(1.2Mcr, M_r⁺)
  Mcr=0.5√f'c·Z ; As=M/(φ·fy·jd)
```

---

## Skill: foundation-engine (Pondasi Statik & Dinamik)

```
name: foundation-engine
description: >
  Deep & shallow foundation analysis/design — engine/pilefoundation.ts
  (static pile/bore-pile/shaft axial capacity α/β/Meyerhof Q_s+Q_p, group
  Converse-Labarre + block, settlement Vesic, lateral Broms, dynamic driving
  ENR/Modified-ENR/Hiley/Janbu) and engine/foundationdynamics.ts (shallow
  bearing Vesic N_c/N_q/N_γ, machine-foundation half-space Richart k/D/f_n/
  amplitude 4 modes, SSI Veletsos T̃/T). Books 194–205 (Bowles/Budhu/Das/TM
  5-818-1/Vulcanhammer). Opt-in via foundation.enabled → §30 in PDF report.
  Trigger on pile capacity, bored pile, shaft, settlement, lateral pile,
  pile driving, bearing capacity, machine foundation, SSI, dynamic foundation.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
SINGLE PILE: Q_ult=Q_s+Q_p ; clay f_s=α·c_u, q_p=9·c_u ; sand f_s=K·σ'v·tanδ,
  q_p=σ'v·N_q (N_q=e^(π tanφ)tan²(45+φ/2)) ; bored: α×0.7, N_q×0.6 ; Q_all=Q_ult/FS
GROUP: η=1−(θ/90)[(n−1)m+(m−1)n]/(mn), θ=atan(D/s) ; block (clay) governs if closer
SETTLEMENT (Vesic): s=s1+s2+s3 (pile compression + tip + skin), ≤ 25mm/0.1D
LATERAL (Broms): short (soil rotation) vs long (yield moment) → min ; clay/sand, free/fixed
DRIVING: ENR Ru=ηE/(s+C) ; Hiley ×(Wr+n²Wp)/(Wr+Wp) ; Janbu Ku(λe,Cd) ; Ra=Ru/FS
BEARING (Vesic): q_ult=cNc·sc·dc+qNq·sq·dq+½γB·Nγ·sγ·dγ ; q_all=q_ult/FS
MACHINE (half-space): r0 per mode ; kz=4Gr0/(1−ν) etc ; B mass-ratio, D damping,
  fn=√(k/m)/2π ; rotating-mass A=(m_e e/m)·r²/√((1−r²)²+(2Dr)²) ; resonance ±20%
SSI (Veletsos): (T̃/T)²=1+k/Kx+k·h²/Kφ
```

---

## Skill: indo-load-seismic-struct (Beban/Gempa SNI + Kabel + Rangka)

```
name: indo-load-seismic-struct
description: >
  Indonesian loading + seismic + bridge-structure engines — sni2833seismic.ts
  (SNI 2833:2016 response spectrum As/S_DS/S_D1/T0/Ts/C_sm, zone/SDC, R),
  cablestayed.ts (Gimsing cable-stayed: stay V/sinθ, Ernst E_eff, pylon axial),
  steeltruss.ts (Pratt/Warren/Howe: chord M/h, diagonal V/sinθ, tension yield +
  compression buckling F_cr), and bridgeload.ts computeSecondaryLoads (SNI 1725
  wind EWs/EWl, brake TB, temperature EUn). Books 207/209/210/211. Tabs 🌎/🪢/🔺.
  Trigger on SNI 2833, response spectrum, cable-stayed, pylon, steel truss,
  rangka baja, wind load, braking force, temperature load, SNI 1725.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
SNI 2833 spectrum: As=Fpga·PGA ; S_DS=Fa·Ss ; S_D1=Fv·S1 ; T0=0.2 S_D1/S_DS ;
  Ts=S_D1/S_DS ; C_sm: ramp<T0, plateau S_DS [T0..Ts], S_D1/T >Ts ; EQ=C_sm·W/R
CABLE-STAYED: stay force=w·trib/sinθ ; A=force/σ_all ; Ernst Ee=E/(1+γ²Lh²E/12σ³) ;
  pylon axial=Σforce·sinθ ; deck compression=Σforce·cosθ
STEEL TRUSS: Mmax=wL²/8 → chord=M/h ; Vend → diagonal=V/sinθ ;
  tension φPn=0.90·Fy·A ; compression Fcr (0.658^(Fy/Fe)·Fy or 0.877Fe), φ=0.90
SECONDARY (SNI 1725): wind P=0.0006·Cw·Vw² (kPa) ; EWl=1.5 kN/m ;
  TB=max(25%·250, 5%(qL+P)) ; EUn=α·ΔT·E·A (restrained)
NOTE: PDF numbers are NOT code references — only chapter/order/procedure.
```

---

## Skill: seismic-dynamics-substructure (Dinamik & Gempa Bangunan Bawah)

```
name: seismic-dynamics-substructure
description: >
  Dynamic analysis & seismic DESIGN of the substructure — engine/seismicdynamics.ts:
  computeSDOF (pier as SDOF: T=2π√(m/K), damping B, Sd=Sa·g/ω², Vbase),
  computeModal2 (2-DOF eigen det(K−ω²M)=0, mode shapes, participation, SRSS),
  computeCapacityDesign (plastic hinge: Mpo=λo·Mp, Vpo, Lp Priestley, Δy, Δp, ΔC,
  μΔ, P-Δ ≤0.25Mp), computeLiquefaction (Seed–Idriss/Youd: CSR, (N1)60cs, CRR7.5,
  MSF, FS). Standards: AASHTO Guide Spec LRFD Seismic / Caltrans SDC / Priestley
  DBD / SNI 2833 (books 219–229, files not yet present → built from procedure).
  DISTINCT from seismic.ts (single-mode), sni2833seismic.ts (spectrum),
  foundationdynamics.ts (machine/SSI). Tab 🌋. Wired into the foundation.enabled
  checkbox → report §31. Trigger on dynamic analysis, modal, SRSS, capacity
  design, plastic hinge, ductility, P-Δ, liquefaction, pushover, seismic pier.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
SDOF: m=W/g ; ω=√(K/m) ; T=2π/ω ; B=√(0.10/(0.05+ζ)) ; V=Sa·B·W ; Sd=Sa·g/ω²
MODAL 2-DOF: M=diag(m1,m2), K=[[k1+k2,-k2],[-k2,k2]] ; solve λ=ω² quadratic ;
  φ shapes (φ1=1) ; Γ=L*/M* ; SRSS V=√(ΣVk²), Vk=Sa_k·g·Meff_k
CAPACITY: Mpo=λo·Mp ; Vpo=Mpo/H (cant) or 2Mpo/H (fixed) ; Lp=0.08L+0.022fye·dbl ;
  Δy=φy·L²/3 ; θp=(φu−φy)Lp ; Δp=θp(L−Lp/2) ; ΔC=Δy+Δp ; μΔ=ΔC/Δy ;
  check Δ_D≤ΔC and P-Δ Pdl·Δ≤0.25Mp
LIQUEFACTION: σ'v=σv−u ; rd=1−0.00765z (≤9.15m) ; CSR=0.65·amax·(σv/σ'v)·rd ;
  (N1)60cs fines-corrected ; CRR7.5 (Youd curve) ; MSF (Idriss) ; FS=CRR·MSF/CSR
REPORT WIRING: foundation.enabled → pierK=3EI/H³ → SDOF Sd = Δ_D → capacity ;
  liquefaction from foundation soil ; render report §31. NOTE: PDF numbers never
  a code reference — procedure only.
```

---

## Skill: dxf-import (Impor Geometri Gambar CAD)

```
name: dxf-import
description: >
  Read bridge geometry from CAD drawings — engine/dxfimport.ts (pure ASCII-DXF
  parser) + tab 📐 Impor Gambar DXF. parseDxf tokenises group-code/value pairs;
  analyseDxf extracts extents (bridge length/width), girder cross-section bbox
  (→ profile H), girder/diaphragm spacing (median vertical-line gap), DIMENSION
  values (code 42), TEXT/MTEXT labels, and substructure rectangles (abutment/
  pier/pilecap/pierhead). Apply buttons set span / deck width / girder height.
  IMPORTANT: binary DWG (AC1015/AC1018) cannot be parsed without a converter
  (ODA/AutoCAD/python) — none in this env; user must export DWG→DXF (SAVE AS →
  DXF or DXFOUT). Trigger on: read DWG, read DXF, import CAD geometry, extract
  span/girder spacing/profile from drawing.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
DXF = alternating lines (group-code \n value). code 0 starts an entity (value=type).
collect codes into Record<number,string[]> (arrays keep polyline 10/20 repeats).
LINE 10/20→11/21 ; LWPOLYLINE 10[]/20[] vertices ; CIRCLE 10/20/40 ; TEXT 1+10/20 ;
DIMENSION measured value = code 42.
HEURISTICS: extents = bbox(all points) ; girderProfile = tallest polyline with
0.6w ≤ h ≤ 6w ; memberSpacing = median gap of vertical-line x-positions ;
rectangles sorted by area → substructure candidates.
UNITS unknown in DXF → UI scale selector (×1 mm / ×10 cm / ×1000 m).
DWG is BINARY → not parseable here; instruct export to DXF.
```
