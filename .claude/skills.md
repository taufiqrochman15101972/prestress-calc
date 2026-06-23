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

---

## Skill: dwg-converter (DWG→DXF in-project)

```
name: dwg-converter
description: >
  Reusable in-project DWG→DXF converter — lib/dwgConvert.ts lazy-loads LibreDWG
  WebAssembly (@mlightcad/libredwg-web) client-only; dwg_write_dxf(ArrayBuffer)
  → DXF text → engine/dxfimport.ts. Tab 📐 accepts .dwg directly (auto-convert)
  or .dxf. Use for any new .dwg drawing. Trigger on: read/convert DWG, DWG to DXF.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
const mod = await import("@mlightcad/libredwg-web"); // client-only dynamic import
const lib = await mod.LibreDwg.create();             // loads WASM (cache it)
const dxfBytes = lib.dwg_write_dxf(arrayBuffer);     // Uint8Array | null
const dxfText = new TextDecoder().decode(dxfBytes);  // → analyseDxf()
NOTE: keep import dynamic (never top-level) so SSR/main-bundle stay clean; build OK.
Old/corrupt DWG that LibreDWG can't read → ask user to re-export DXF in CAD.
```

---

## Skill: force-diagrams (Diagram Gaya Dalam & Tegangan, OriginPro-style)

```
name: force-diagrams
description: >
  Real-time internal-force / stress / deflection diagrams — engine/internalforces.ts
  (computeBeamFields: Mz/My/Vy/Vx/N/T/dz/dy fields along span from SoM equilibrium;
  queryAt: point query with Navier & kernel stress (equivalent); jetColor colormap)
  + ForceDiagramsCalculator.tsx (tab 📊). OriginPro/IDEA-StatiCa/Robot/MIDAS look:
  filled jet-gradient curves, checkbox toggles, click span→forces, click section
  height→σ + deflection. Pre-FEM (architecture ready for FEM/FEA). Style ref
  O1–O10.pdf. Trigger on: bending/shear/axial/torsion diagram, deflection plot,
  stress distribution, interactive beam, OriginPro/contour/colormap output.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
FIELDS (simply-supported): Mz=w·x(L−x)/2 (+point) ; Vy=R−wx ; N=−P+Next ;
  dz = −(udlDefl(w)+pointDefl) + udlDefl(wBal up) ; My/Vx/dy from wLat ; T=Tu.
  udlDefl=w·x(L³−2Lx²+x³)/24EI ; pointDefl central standard.
STRESS (equivalent): Navier σ=N/A+P·e·y/I−Mz·y/I ; kernel σ=(−P/A)(1−e·y/r²)−Mz·y/I
  (identical since r²=I/A). y up from NA, tension +, compression −.
INPUTS from store: Pe(kN→N), e=yb−yResultant, EI=Ec·Ig, Iy≈Σb³h/12, wBal=8Pe·e/L².
UI: jetColor(norm −1..1) blue→green→red ; click maps px→x (span) / py→y (height).
NOTE: pre-FEM SoM equilibrium — correct & beautiful now, FEM/FEA later.
```

---

## Skill: fem-ecosystem (FEM/FEA core — frame + flat shell)

```
name: fem-ecosystem
description: >
  FEM/FEA ecosystem (engine/fem/) + 🧮 FEM Modeler tab (STAAD.Pro-style).
  3 layers: Pre-processor (fem/model.ts geometry + 3 copy methods linearRepeat/
  mirror/rotateCopy + deflectedShape), Solver Core (fem/core.ts LU on Float64Array
  zero-copy + scatter/matMul; fem/frame.ts 2D beam-column 3-DOF axial+flexure+
  Timoshenko shear, locking-free; assemble/BC/recover), Post-processor (deflected
  shape, N/V/M, reactions). Element library + fem/shell.ts flat-shell Q4 (membrane
  + Mindlin SRI plate → shear-locking-free). Validated vs closed-form. Phase-2
  target: native Python+Julia+Zig (not in this env). Trigger on: FEM, FEA, finite
  element, stiffness matrix, beam-column element, shell element, mesh, solver,
  STAAD/MIDAS/Robot modeler, shear locking.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
FRAME elem (local 6×6): axial EA/L ; bending+shear Timoshenko c=EI/(L³(1+Φ)),
  Φ=12EI/(G·As·L²) (As=0 → Euler) ; transform Tᵀ k T ; UDL fixed-end [0,wL/2,
  wL²/12,0,wL/2,−wL²/12]. Assemble K (Float64Array n²), BC penalty 1e30, solveLinear
  LU. Recover: dl=T·dg, fl=kl·dl−fe ; N/V/M samples along L.
SHELL Q4 (locking-free): membraneK 8×8 (2×2 Gauss) ; plateK 12×12 = bending Db
  (2×2 Gauss) + shear Ds (1-pt REDUCED → no locking) ; flatShellK 24×24 (u,v,w,
  θx,θy,θz + tiny drilling). Validate: membrane εx=1→½E/(1−ν²); plate κx=1 γ=0→½D.
ZERO-COPY: keep heavy data in Float64Array, pass by reference (assemble→solve→
  recover seam). Native Python/Julia/Zig backend swaps in behind this seam later.
3 COPY METHODS: linearRepeat(dx,dy,n) / mirror(V|H,at) / rotateCopy(cx,cy,dθ,n),
  merge coincident nodes within TOL.
```

---

## Skill: fem-plate-iso (📊→FEM wiring, isometric axes, plate solve)

```
name: fem-plate-iso
description: >
  📊 force diagrams wired to the FEM solver (fem/beamfields.ts computeBeamFieldsFEM
  → BeamFieldResult; toggle FEM⇄closed-form). Global axes X→right/Y→front/Z→up,
  ISOMETRIC view (true scale) + axis triad in FEM/plate viewports. Plate/shell
  meshing+solve (fem/plate.ts solvePlate, ▦ tab, Q4 Mindlin-SRI, SS/clamped,
  isometric deflected colored surface, validated vs thin-plate theory, no shear
  locking). Trigger on: wire diagrams to FEM, isometric view, global axes, plate
  mesh/solve, deflection surface, shell solve.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
ISO: cI=cos30,sI=sin30 ; isoX=(X−Y)cI ; isoUp=Z−(X+Y)sI ; screen.x=ox+isoX·sc,
  screen.y=oy−isoUp·sc. X→right-down, Y→left-down(front), Z→up. Triad in corner.
BEAMFIELDS-FEM: 40-elem SS frame ; gravity solve (−wUDL)→Mz/Vy + dz_grav ;
  camber solve (+wBal)→dz_camber ; dz=sum ; Mz GRAVITY-ONLY (P·e added in query).
  Validate ≈ closed-form with RELATIVE tol (not toBeCloseTo for big numbers).
PLATE solve: mesh nx×ny Q4 plateK (3 DOF/node) ; load −q·Ae/4 → w DOF (down) ;
  BC SS w=0 / clamped w=θ=0 penalty ; theory w=α·q·a⁴/D (SS 0.00406, clamp 0.00126)
  ; ratio→1 confirms convergence & no shear locking (test thin t/a=1/200 too).
```

---

## Skill: fem-3d-backend-straincompat (3D frame, solver seam, strain compatibility)

```
name: fem-3d-backend-straincompat
description: >
  3D space frame FEM (engine/fem/frame3d.ts, 6 DOF/node axial+torsion+biaxial
  bending, tab 🧊), pluggable solver backend seam (engine/fem/backend.ts —
  SolverBackend.solve over Float64Array zero-copy; native Julia/Zig swaps in
  without UI change), and strain-compatibility ULS (engine/straincompat.ts,
  Naaman, tab 🎚 — layered NA search, f_ps from real σ–ε, full & partial
  prestressing). Trigger on: 3D frame, space frame, 6 DOF, torsion member,
  solver backend/native swap, strain compatibility, layered section, f_ps exact.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
FRAME3D local 12×12: axial EA/L (0,6); torsion GJ/L (3,9); bend-z EIz on v,θz
  (1,5,7,11); bend-y EIy on w,θy (2,4,8,10). T=blockdiag(R×4), R rows=ex,ey,ez
  (ex=axis; up=Z unless vertical then Y; ey=up×ex; ez=ex×ey). Validate cantilever
  PL³/3EIz & /3EIy, torsion TL/GJ, axial PL/EA.
BACKEND seam: every solver calls solve(K,n,F) from backend.ts (default denseLU).
  setSolverBackend(native) later; keep (K,n,F) as Float64Array (pointer/zero-copy).
STRAIN-COMPAT: bisection on c; layer ε=εcu(d−c)/c (PS add f_se/E_ps prestrain);
  f from σ–ε (PS bilinear+hardening cap fpu; RC ±fy); g(c)=Cc−ΣT (0.85f'c·b·a);
  Mn=ΣT·d−Cc·a/2; εt extreme → phiFromStrain. Works full (A_ps) & partial (+A_s).
```

---

## Skill: influence-moving-load (MIDAS-style)

```
name: influence-moving-load
description: >
  Influence-line & moving-load analysis (engine/fem/influence.ts, tab 📉) — unit
  load traversed via the FEM solver → influence lines for R₀/M_mid/V_mid; multi-
  axle vehicle slid → max/min envelope + critical position. MIDAS/Civil-style
  (ref MD-1). Also: frame.ts reaction recovery R=K_pure·d−F (exact). Trigger on:
  influence line, moving load, vehicle envelope, Müller-Breslau, reaction recovery.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
INFLUENCE: build N-element beam (1 or 2 equal spans, rollers at boundaries, left
  pinned). For each node: apply unit fy=-1, solveFrame, read R₀ (left reaction),
  M_mid (mid member M2), V_mid → IL ordinate. Validate IL(R₀)=1 at support,
  0.5 at mid, 0 at far end; IL(M_mid)=L/4 at mid (SS).
MOVING LOAD: interpolate IL(x); slide axle group (P,dx), response=ΣP·IL(x_axle);
  track max/min + critical lead position.
REACTION (frame.ts): solve on penalty COPY (Ksolve/Fsolve); reactions from PURE
  K & F → R=Σ K[dof][j]·d[j] − F[dof] (exact even with load on a support).
```

---

## Skill: midas-designcheck-nonlinear-th (design check + P-Δ + time history)

```
name: midas-designcheck-nonlinear-th
description: >
  MIDAS/Robot-style post-processing & nonlinear: engine/fem/designcheck.ts
  (AISC/SNI 1729 steel utilisation ratio H1-1, integrated into 🧮 modeler),
  engine/fem/pdelta.ts (geometric nonlinear P-Δ, amplification 1/(1−P/Pcr)),
  engine/timehistory.ts (Newmark-β SDOF time history, tab 🌊). Refs MD(40)-(70)
  MIDAS Gen (pushover, base-isolation, time-history). Trigger on: design check,
  utilisation ratio, code check, P-Delta, second-order, buckling amplification,
  time history, Newmark, dynamic response, pushover, base isolation.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
DESIGN CHECK (steel): λ=KL/√(I/A); Fcr (0.658^(Fy/Fe)Fy if λ≤4.71√(E/Fy) else
  0.877Fe); φPn=0.9·(FyA tension|FcrA comp); φMn=0.9Fy·Z (Z≈1.12·2I/d); φVn=
  0.9·0.6Fy·0.5A; H1-1 interaction; ratio=max(interaction,shear). Colour by ratio.
P-Δ: K_g(P) consistent geometric (tension+); iterate solve→axial fl[3]→K_e+K_g→
  re-solve; amplification δ₂/δ₁ → 1/(1−P/Pcr); divergence ⇒ buckling.
NEWMARK-β: γ=½ β=¼; khat=k+a1; step phat=p+a1·u+a2·v+a3·a; u=phat/khat; update
  v,a. Validate Tn=2π√(m/k), low-ω DAF≈1, resonance DAF≈1/2ζ.
NEXT (MD): pushover (plastic-hinge incremental), base isolation (isolator/damper).
```

---

## Skill: pushover-isolation-benchmark (MIDAS nonlinear + verification)

```
name: pushover-isolation-benchmark
description: >
  Pushover (engine/fem/pushover.ts, event-to-event plastic hinge via static
  condensation, capacity curve, tab 📈), base isolation (engine/baseisolation.ts,
  AASHTO/SNI T_iso/B/shear-reduction, tab 🛡), and BENCHMARK VERIFICATION
  (tests/benchmark.test.ts) vs theory (fixed-fixed, propped, continuous, Euler
  buckling Gere-Timoshenko, 2-DOF eigenvalue Greenwood — MIDAS FEA Verification
  Manual). P-Δ amplification fixed to per-direction (axial≈1, lateral amplifies).
  Trigger on: pushover, capacity curve, plastic hinge, base isolation, isolator,
  damper, benchmark, verification, buckling load, eigenvalue, MIDAS verification.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
PUSHOVER: refLoad pattern×λ; per step compute end moments (condense released rot
  DOFs, recover dr=−Σk[r][j]d[j]/k[r][r] so f[r]=0); Δλ=min((±Mp−Mcur)/rate);
  insert hinge; record (Δ_control, base shear); stop at mechanism. Verify
  cantilever V_max≈Mp/H.
ISOLATION: T_iso=2π√(W/gK_iso); B=max(0.8,(ζ/0.05)^0.3); Sa(T_iso)/B; Viso<Vfixed;
  d_iso=Sa·g·(T/2π)². 
P-Δ amplitude: measure per translational direction (max|ux|,max|uy|), amp=max of
  ratios → axial direction ≈1, lateral → 1/(1−P/Pcr). Don't use hypot (axial dominates).
BENCHMARK vs theory: fixed-fixed δ=wL⁴/384EI M=wL²/12; propped 3wL/8; 2-span 1.25wL;
  Euler Pcr=π²EI/L² (pin) & π²EI/4L² (cantilever) [Gere&Timoshenko]; 2-DOF equal m,k
  → ω²=(3∓√5)/2·k/m [Greenwood]. MIDAS Verification Manual = MD174+.
```

---

## Skill: cg-backend-shell-fiber (iterative solver + full shell + fiber UMAT)

```
name: cg-backend-shell-fiber
description: >
  Iterative CG solver backend (engine/fem/sparsebackend.ts cgBackend via the
  SolverBackend seam — native-ready), full flat-shell assembly+solve
  (engine/fem/shellsolver.ts, 6 DOF/node membrane+plate+drilling, tab ▣), and
  fiber moment-curvature UMAT nonlinear material (engine/fibermomentcurvature.ts,
  Hognestad + elastoplastic steel, Newton on top strain, tab 🧵). Refs MD430-469
  MIDAS, SP1-12 CSiBridge. Trigger on: iterative solver, conjugate gradient,
  sparse backend, full shell assembly, membrane, fiber section, moment curvature,
  UMAT, nonlinear material, M-phi.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
CG backend: PCG (Jacobi M=diag(K)); register via setSolverBackend(cgBackend);
  K/F Float64Array (pointer/zero-copy) — native Julia/Zig swaps in same API.
SHELL solve: mesh Q4 flatShellK (24×24, node DOF u,v,w,θx,θy,θz), scatter;
  pressure→w (−q·Ae/4), edge tension→u; BC: fix θz all (no drilling), w=0 (SS)
  /+θ (clamp) on edges, u=v=0 at x=0 wall. Verify w≈α·q·a⁴/D, u≈N·a/EA.
FIBER M-φ (UMAT): slice section into concrete fibers (Hognestad+softening+crush)
  + steel layers (elastoplastic); for each φ Newton on top strain so ΣF=N;
  M=Σf·A·(yc−y). M-φ curve → My, Mu, ductility. Verify Mu≈As·fy·(d−a/2).
```

---

## Skill: slope-shell-reinf (geotech slope + shell reinforcement)

```
name: slope-shell-reinf
description: >
  Slope stability (engine/slopestability.ts: infinite-slope + circular Bishop/
  Fellenius method of slices, tab ⛰, MIDAS GTS MD482) and concrete-shell
  reinforcement design (engine/shellreinf.ts: IASS sandwich + Baumann/CEB from
  the 8 stress resultants, tab ◫, file 253). Trigger on: slope stability, factor
  of safety, method of slices, Bishop, Fellenius, landslide, shell reinforcement,
  Wood-Armer, sandwich method, shell rebar.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
SLOPE infinite: FS=[c+γz cos²β tanφ]/[γz sinβ cosβ]; seepage → γ' on friction term.
  Verify cohesionless FS=tanφ/tanβ.
SLOPE slices: uniform slope (toe flat, slope 0..B, crest H), trial circle (xc,yc,R);
  per slice W=γ·b·h, α=asin((xm−xc)/R), u=ru·γ·h. Fellenius FS=Σ[cl+(Wcosα−ul)tanφ]/
  Σ(Wsinα); Bishop iterate FS=Σ[(cb+(W−ub)tanφ)/mα]/Σ(Wsinα), mα=cosα(1+tanα tanφ/FS).
SHELL reinf (sandwich): z=t−2cover; face membrane n*=n/2±m/z; Baumann As·fy=n+|nxy|
  (compression clamped, revised off-diag). As(mm²/m)=F/fy×1000 each face & direction.
  Verify pure tension → As split both faces; pure bending → tension face only.
```

---

## Skill: building-seismic (ASCE 7-16 / NEHRP ELF + Eurocode 8)

```
name: building-seismic
description: >
  BUILDING (multi-storey) seismic design — engine/buildingseismic.ts, tab 🏙️.
  ASCE 7-16 / NEHRP (FEMA P-750, FEMA 451) Equivalent Lateral Force §11.4+§12.8
  plus a parallel Eurocode 8 (EN 1998-1) lateral-force path. DISTINCT from the
  bridge seismic modules (seismic.ts single-mode, sni2833seismic.ts bridge
  spectrum, seismicdynamics.ts pier capacity, baseisolation.ts). Source = GM (1)
  + GM (118)–(256) earthquake-engineering library. Trigger on: building seismic,
  ELF, base shear, ASCE 7, NEHRP, FEMA, design response spectrum, SDS, SD1,
  story drift, P-Delta stability, Eurocode 8, behaviour factor q, IBC seismic.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
RULE: FEMA/EC8 are DESIGN-EXAMPLE docs → take procedure only, NOT the example
  numbers. Assert the closed-form CODE EQUATIONS (identities) in tests.
SPECTRUM (ASCE 7-16): SDS=⅔Fa·Ss, SD1=⅔Fv·S1, T0=0.2SD1/SDS, TS=SD1/SDS;
  Sa: T<T0→SDS(0.4+0.6T/T0); T0..TS→SDS; TS..TL→SD1/T; >TL→SD1·TL/T².
BASE SHEAR: Ta=Ct·hn^x (system table); Cs=SDS/(R/Ie) capped SD1/(T·R/Ie),
  floor max(0.044·SDS·Ie, 0.01; +0.5·S1/(R/Ie) if S1≥0.6g); V=Cs·W.
DISTRIBUTION: k=1(T≤0.5)..2(T≥2.5) linear; Fx=(wx·hx^k/Σwi·hi^k)·V; Vx=Σ above.
DRIFT/P-Δ: δx=Cd·δxe/Ie; Δ/hsx ≤ Δa; θ=Px·Δ·Ie/(Vx·hsx·Cd) ≤ θmax=min(0.5/Cd,0.25).
EC8: Sd(T) EN1998-1 §3.2.2.5 (plateau ag·S·2.5/q, lower bound β·ag); Fb=Sd(T1)·W·λ.
VERIFY: SDS=⅔Fa·Ss; ΣCvx=1 & ΣFx=V; spectrum branches; EC8 plateau; Fb.
```

## Skill: hysteresis-cyclic (nonlinear hysteresis + cyclic/seismic response)

```
name: hysteresis-cyclic
description: >
  NONLINEAR hysteretic cyclic & seismic response — engine/hysteresis.ts, tab 🔄.
  Rate-independent hysteresis constitutive models (bilinear kinematic via
  return-mapping, Bouc-Wen smooth, Takeda RC degrading-stiffness + pinching);
  F–u loop tracing with dissipated energy E_D + equivalent viscous damping ξ_eq;
  NONLINEAR time-history (Newmark-β + Newton-Raphson) → ductility μ, hysteretic
  energy, residual displacement; Park-Ang energy-based damage index; Mainstone/
  FEMA-356 masonry-infill equivalent diagonal strut. COMPLEMENTS the LINEAR
  timehistory.ts 🌊 and pushover.ts/seismicdynamics.ts. Source = GM 257–272
  (Bouc-Wen/Takeda/T(x) models, ENGLTHA degradation, Park-Ang energy assessment,
  EC8 precast connections, PEER/FEMA-356 infilled RC). Trigger on: hysteresis,
  cyclic, Bouc-Wen, Takeda, pinching, stiffness/strength degradation, nonlinear
  time-history, ductility demand, equivalent damping, Park-Ang, infill strut.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
RULE: GM 257–272 are textbooks/theses/journals → procedure/model only, NOT their
  example numbers. Assert closed-form IDENTITIES in tests.
BILINEAR (kinematic, return-mapping): H_d=α·k0/(1−α); k1=α·k0.
  F_trial=F+k0·Δu; f=|F_trial−q|−Fy; if f>0: Δu_p=f/(k0+H_d),
  F=F_trial−k0·sgn·Δu_p, q+=H_d·sgn·Δu_p. Elasto-plastic α=0 ⇒ F capped ±Fy.
BOUC-WEN: ż=A·u̇−β|u̇||z|^(n−1)z−γ·u̇|z|^n; F=α·k0·u+(1−α)·Fy·z (z dimensionless,
  normalized by u_y=Fy/k0); monotonic saturation z_max=(A/(β+γ))^(1/n).
TAKEDA: unloading k_unl=k0·(u_y/u_max)^β_s·pinch, clamped to bilinear envelope.
ENERGY/DAMPING: E_D=∮F du over a CLOSED steady cycle (+a→−a→+a); k_sec=Fmax/a;
  ξ_eq=E_D/(4π·½·k_sec·a²); elasto-plastic ⇒ ξ_eq=(2/π)(1−1/μ).
NONLINEAR TH: Newmark γ=½,β=¼; Newton on g(u)=p−m·a−c·v−F_int(u);
  k_eff=m/(βΔt²)+c·γ/(βΔt)+k_T; μ=u_peak/u_y.
PARK-ANG: DI=μ/μ_cap+β_PA·E_H/(Fy·u_u), u_u=μ_cap·u_y.
INFILL STRUT (Mainstone/FEMA 356): λ1=[Em·t·sin2θ/(4·Ec·Icol·h_inf)]^¼;
  a=0.175·(λ1·h_col)^(−0.4)·r_inf; A=a·t; k_lat=A·Em·cos²θ/r.
VERIFY: E_D=4Fy(um−uy); ξ_eq=(2/π)(1−1/μ); F capped ±Fy; post-yield k1=αk0;
  Bouc-Wen z_max; Takeda degraded loop < non-degraded; elastic μ≈1 vs yield μ>1 &
  E_H>0; Park-Ang terms; Mainstone θ/λ1/a/k/V.
```

## Skill: limit-analysis (yield-line + plastic collapse + concrete plasticity)

```
name: limit-analysis
description: >
  LIMIT ANALYSIS & PLASTICITY collapse design — engine/limitanalysis.ts, tab ⚖️.
  UPPER-bound (kinematic) side of plasticity: Johansen yield-line theory for RC
  two-way slabs, plastic collapse of beams (mechanism loads), Nielsen concrete
  effectiveness factor ν + plastic (web-crushing) shear, and the bound-theorem
  classifier. COMPLEMENTS strut-and-tie ▽ (the LOWER-bound/static/safe side) and
  elastic plate FEM ▦. Source = ASM 1–92 applied-solid-mechanics library
  (Nielsen & Hoang "Limit Analysis and Concrete Plasticity" ×3, Johansen,
  plastic theory, computational plasticity). Trigger on: yield line, limit
  analysis, plastic collapse, mechanism load, plastic hinge, Johansen, slab
  ultimate load, effectiveness factor, lower/upper bound, concrete plasticity.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
RULE: ASM books are textbooks → formulas/procedure only, NOT example numbers.
  Assert exact closed-form limit-analysis IDENTITIES in tests.
YIELD-LINE (rect slab UDL, bottom m, edge ratio i=m'/m):
  w_u=(24·m/Lx²)(1+i)/[√(3+(Lx/Ly)²)−Lx/Ly]²  (Lx=short). mRequired = inverse.
  exact: square SS 24m/L², fixed i=1 → 48m/L²; 1-way SS 8 / fixed 16 ·m/Lx².
PLASTIC BEAM COLLAPSE (mechanism): UDL SS 8Mp/L², fixed 16Mp/L², propped 11.657Mp/L²
  (root of (wL/2−Mps/L)²=2wMp); point-mid SS 4Mp/L, fixed 8Mp/L, propped 6Mp/L.
CONCRETE PLASTICITY (Nielsen): ν=0.7−fc/200 (clamp 0.4–1); τ=ν·fc·sinθcosθ
  (max ½ν·fc @45°); V_plastic=τ·bw·z.
BOUNDS: static/lower = SAFE (strut-and-tie); kinematic/upper = UNSAFE, lowest
  mechanism governs (yield-line). They coincide at the true plastic limit load.
VERIFY: slab 24/48 m/L²; 1-way 8/16; beam UDL 8/16/11.657; point 4/8/6; ν & V
  plastic; mRequired round-trip; bound safe/unsafe flags.
```

## Skill: modal-dynamics (N-DOF eigen + Response Spectrum Analysis)

```
name: modal-dynamics
description: >
  GENERAL N-DOF modal analysis & Response Spectrum Analysis — engine/
  modaldynamics.ts, tab 📳. Generalized eigenproblem Kφ=ω²Mφ (Cholesky + Jacobi),
  participation factors, effective modal mass, RSA with SRSS & CQC. Reuses the
  ASCE design spectrum (buildingseismic.ts). COMPLEMENTS linear SDOF time-history
  🌊 and the 2-DOF bridge modal (seismicdynamics.ts). Source = DS 1–96 structural-
  dynamics library (Chopra, Craig & Kurdila, Gupta, Wilson, Paz, Humar). Trigger
  on: modal analysis, mode shape, eigenvalue, natural frequency, response
  spectrum, RSA, SRSS, CQC, participation factor, effective modal mass.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
RULE: DS books are textbooks → formulas only, NOT example numbers. Assert exact
  closed-form modal identities.
EIGEN: K φ = ω² M φ → Cholesky M=LLᵀ; Ã=L⁻¹KL⁻ᵀ (symmetric); Jacobi cyclic;
  φ=L⁻ᵀψ (mass-orthonormal φᵀMφ=1). shearBuilding → M diag, K tridiagonal.
MODAL: Γₙ=φᵀM r/φᵀM φ; Mₙ*=(φᵀM r)²/φᵀM φ; ΣMₙ*=Σmᵢ; cum ratio ≥0.9 (ASCE §12.9).
RSA: uₙ=Γₙφₙ·Sa(Tₙ)/ωₙ²; fₙ=Γₙ M φₙ·Sa(Tₙ); base Vₙ=ΣfₙPass Sa in m/s² (=Sa_g·9.81).
COMBINE: SRSS=√Σrₙ²; CQC ρᵢⱼ=8ζ²(1+r)r^1.5/[(1−r²)²+4ζ²r(1+r)²], r=ωᵢ/ωⱼ.
VERIFY: 2-DOF golden ω²=(k/m)(3∓√5)/2; uniform N-story ωₙ=2√(k/m)sin((2n−1)π/(2(2N+1)));
  mass-orthonormality; ΣMₙ*=Mtot; flat-spectrum ΣVₙ=Sa·Mtot; CQC≈SRSS separated.
```

## Skill: force-method (matrix flexibility + three-moment)

```
name: force-method
description: >
  MATRIX FORCE (flexibility) METHOD & three-moment equation — engine/
  forcemethod.ts, tab 🔢. The classical dual of the stiffness/displacement method
  (which already powers the FEM ecosystem): Clapeyron three-moment for continuous
  beams, generic flexibility redundants [f]{X}=−{Δ0}, classic indeterminate
  closed forms. Cross-validates the stiffness-method FEM. Source = MTH 1–116
  matrix-structural-analysis library (Przemieniecki, Azar, Paz, Weaver & Gere).
  Trigger on: force method, flexibility method, three-moment, Clapeyron,
  continuous beam, redundant, statically indeterminate, support moment.
tools: [read, write, bash]
model: sonnet
```

### Task Protocol

```
RULE: MTH books are textbooks → formulas only, NOT example numbers.
THREE-MOMENT (UDL, simple ends M0=MN=0):
  M_{i−1}Lᵢ+2Mᵢ(Lᵢ+Lᵢ₊₁)+M_{i+1}Lᵢ₊₁ = −¼(wᵢLᵢ³+wᵢ₊₁Lᵢ₊₁³) → tridiagonal solve.
REACTIONS: R_left=wL/2+(M_right−M_left)/L; R_right=wL/2+(M_left−M_right)/L.
  mid moment = wL²/8+(M_left+M_right)/2.
FORCE CORE: [f]{X}=−{Δ0}. Classics: propped 3wL/8 & Mfix=wL²/8; fixed-fixed wL²/12.
VERIFY: 2-span M_B=wL²/8 & R_B=1.25wL & R_A=3wL/8; ΣR=Σw·L; 1-span→SS (mid wL²/8);
  propped 3wL/8; fixed-fixed wL²/12. Results match the stiffness-method FEM.
```
