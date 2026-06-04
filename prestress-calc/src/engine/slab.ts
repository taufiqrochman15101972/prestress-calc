/**
 * Pelat Post-Tension 2-Arah — Load Balancing Engine
 * TY Lin & Burns, Ch. 9 — Two-Way Slabs
 * Reference: ACI 318-19 §8.10, PTI DC20.9
 *
 * Method: Load Balancing (TY Lin, 1963)
 *   - Prestress is replaced by equivalent upward UDL: wb = 8·Pe·e / L²
 *   - Residual stress from unbalanced load: σ = Pe/Ag ± M_unbal/Z
 *   - Punching shear at column face (ACI §22.6)
 *
 * Geometry: rectangular panel Lx × Ly (Lx ≤ Ly)
 * Prestress in BOTH directions: Pe_x (kN/m) and Pe_y (kN/m)
 */

export interface PTSlabInputs {
  /** Short span (mm) */
  Lx: number;
  /** Long span (mm) */
  Ly: number;
  /** Slab thickness (mm) */
  t: number;
  /** Column dimension parallel to x (mm) — for punching */
  cx: number;
  /** Column dimension parallel to y (mm) — for punching */
  cy: number;
  /** f'c slab (MPa) */
  fc: number;
  /** Concrete unit weight (kN/m³) */
  gamma: number;
  /** Superimposed dead load (kN/m²) */
  wSDL: number;
  /** Live load (kN/m²) */
  wLive: number;
  /** Effective prestress force per unit width, x-direction (kN/m) */
  Pe_x: number;
  /** Effective prestress force per unit width, y-direction (kN/m) */
  Pe_y: number;
  /** Tendon sag (eccentricity) in x-direction (mm) */
  e_x: number;
  /** Tendon sag (eccentricity) in y-direction (mm) */
  e_y: number;
}

export interface PTSlabResult {
  // Loads
  readonly wSelf: number;        // kN/m² — slab self-weight
  readonly wTotal: number;       // kN/m² — total (self + SDL + LL)
  readonly wTotalDL: number;     // kN/m² — DL only (self + SDL)
  // Balanced loads from prestress
  readonly wb_x: number;         // kN/m² — upward balanced load from x-tendons
  readonly wb_y: number;         // kN/m² — upward balanced load from y-tendons
  readonly wb_total: number;     // kN/m² — total balanced
  readonly percentBalanced: number; // wb_total / wTotalDL × 100 (%)
  // Unbalanced load
  readonly wu_net: number;       // kN/m² — net unbalanced (unfactored, for stress check)
  readonly wu_factored: number;  // kN/m² — 1.2DL + 1.6LL factored for ULS
  // Residual stress at midspan (from unbalanced moment using ACI equivalent frame, simplified)
  // Simplified: treat as 2-way simply supported with uniform unbalanced load
  readonly M_unbal_x: number;    // kN·m/m — unbalanced moment in x-direction (per unit width)
  readonly M_unbal_y: number;    // kN·m/m — unbalanced moment in y-direction
  // Fiber stresses at midspan (critical section)
  readonly sigma_top_x: number;  // MPa (compression = negative) — from Pe_x + M_unbal_x
  readonly sigma_bot_x: number;  // MPa
  readonly sigma_top_y: number;
  readonly sigma_bot_y: number;
  readonly sigma_top_net: number; // worst-case combined
  readonly sigma_bot_net: number;
  readonly limComp: number;       // ACI service: −0.45f'c (MPa)
  readonly limTens: number;       // ACI Class U: +0.50√f'c (MPa)
  readonly isSlsOk: boolean;
  // Punching shear (ACI §22.6)
  readonly bo: number;            // critical perimeter (mm)
  readonly Vu_punch: number;      // factored punching shear (kN)
  readonly Vc_punch: number;      // concrete punching capacity (kN)
  readonly phiVc_punch: number;   // φ × Vc (kN)
  readonly isPunchOk: boolean;
  // Deflection (simplified elastic)
  readonly delta_unbal: number;   // mm — elastic deflection from unbalanced load
  readonly limitDefl: number;     // Ly/240 (mm)
  readonly isDeflOk: boolean;
}

export function computePTSlab(inp: PTSlabInputs): PTSlabResult {
  const { Lx, Ly, t, cx, cy, fc, gamma, wSDL, wLive, Pe_x, Pe_y, e_x, e_y } = inp;

  const Lx_m = Lx / 1000; // m
  const Ly_m = Ly / 1000;
  const t_m  = t  / 1000;

  // ── Loads ──────────────────────────────────────────────────
  const wSelf     = gamma * t_m;                  // kN/m²
  const wTotalDL  = wSelf + wSDL;
  const wTotal    = wTotalDL + wLive;

  // ── Balanced loads ────────────────────────────────────────
  // wb = 8·Pe·e / L²  [kN/m; Pe in kN/m, e in m, L in m]
  const wb_x = (8 * Pe_x * (e_x / 1000)) / Lx_m ** 2;  // kN/m²
  const wb_y = (8 * Pe_y * (e_y / 1000)) / Ly_m ** 2;

  // Total balanced load allocated proportionally to L⁴:
  // wb_total = wb_x + wb_y (independent loads in each direction)
  // but for load balancing concept, we balance against gravity:
  const wb_total = wb_x + wb_y;
  const percentBalanced = (wb_total / wTotalDL) * 100;

  // ── Unbalanced load ───────────────────────────────────────
  const wu_net      = wTotal - wb_total;              // unfactored residual
  const wu_factored = 1.2 * wTotalDL + 1.6 * wLive - wb_total; // ULS

  // ── Residual moments from unbalanced load ─────────────────
  // Simplified: use ACI two-way slab coefficients for rectangular panels
  // Two-way slab simply supported: Mx = αx·wu·Lx², My = αy·wu·Ly²
  // For simply supported: αx = αy = 1/8 (each direction carries its share)
  // More accurate: use ACI α factors from Table R8.10.4
  // For L_ratio = Ly/Lx (≥ 1):
  const ratio = Ly_m / Lx_m; // ≥ 1
  // Approximate distribution: x-direction takes more load for square panels
  // wx = wu × Lx⁴/(Lx⁴ + Ly⁴), wy = wu - wx (Grashof coefficients)
  const wx_frac = Ly_m ** 4 / (Lx_m ** 4 + Ly_m ** 4);
  const wy_frac = 1 - wx_frac;

  // Midspan moments (positive = sagging, per unit width kN·m/m)
  const M_unbal_x = wx_frac * wu_net * Lx_m ** 2 / 8;
  const M_unbal_y = wy_frac * wu_net * Ly_m ** 2 / 8;

  // ── Fiber stresses ────────────────────────────────────────
  const Ag_per_m = t * 1000;          // mm² per m width = t × 1000
  const Zg_per_m = t ** 2 * 1000 / 6; // mm³ per m = bh²/6 = 1000×t²/6

  // Stress from prestress (axial compression):
  const sigma_pe_x = -(Pe_x * 1000) / Ag_per_m; // MPa (compression = negative)
  const sigma_pe_y = -(Pe_y * 1000) / Ag_per_m;

  // Stress from unbalanced moments (N·mm/m → MPa):
  const M_x_Nmm = M_unbal_x * 1e6; // N·mm per mm width
  const M_y_Nmm = M_unbal_y * 1e6;
  const sigma_bend_top_x = -M_x_Nmm / Zg_per_m; // hogging at top, sagging at bottom
  const sigma_bend_bot_x = +M_x_Nmm / Zg_per_m;
  const sigma_bend_top_y = -M_y_Nmm / Zg_per_m;
  const sigma_bend_bot_y = +M_y_Nmm / Zg_per_m;

  const sigma_top_x = sigma_pe_x + sigma_bend_top_x;
  const sigma_bot_x = sigma_pe_x + sigma_bend_bot_x;
  const sigma_top_y = sigma_pe_y + sigma_bend_top_y;
  const sigma_bot_y = sigma_pe_y + sigma_bend_bot_y;

  // Combined worst case (biaxial superposition, conservative)
  const sigma_top_net = sigma_top_x + sigma_top_y - (sigma_pe_x + sigma_pe_y); // remove double-counted axial
  const sigma_bot_net = sigma_bot_x + sigma_bot_y - (sigma_pe_x + sigma_pe_y);

  const limComp = -0.45 * fc;
  const limTens = +0.50 * Math.sqrt(fc);
  const isSlsOk = sigma_top_net >= limComp && sigma_top_net <= limTens
                && sigma_bot_net >= limComp && sigma_bot_net <= limTens;

  // ── Punching shear (ACI 318-19 §22.6) ────────────────────
  // Critical section at d/2 from column face, d = t − cover (≈ 0.8t)
  const d_eff = 0.8 * t; // effective depth (mm)
  const bo = 2 * (cx + d_eff) + 2 * (cy + d_eff); // critical perimeter (mm)

  // Reaction on critical section: wu_factored × (Lx × Ly − critical_area) / panel
  // Simplified: Vu_punch = wu_factored × Lx_m × Ly_m × 0.85 (minus column area)
  const A_crit = (cx + d_eff) * (cy + d_eff); // mm²
  const Vu_punch = (wu_factored * Lx_m * Ly_m) * 1000
                 - (wu_factored * A_crit * 1e-6); // kN

  // ACI §22.6.5.2: Vc = min of 3 equations
  const beta_c = Math.max(cx, cy) / Math.min(cx, cy);
  const alpha_s = 40; // interior column
  const Vc1 = (0.17 * (1 + 2 / beta_c) * Math.sqrt(fc) * bo * d_eff) / 1000;
  const Vc2 = (0.083 * (alpha_s * d_eff / bo + 2) * Math.sqrt(fc) * bo * d_eff) / 1000;
  const Vc3 = (0.33 * Math.sqrt(fc) * bo * d_eff) / 1000;
  const Vc_punch = Math.min(Vc1, Vc2, Vc3);
  const phiVc_punch = 0.75 * Vc_punch;
  const isPunchOk = phiVc_punch >= Vu_punch;

  // ── Deflection ────────────────────────────────────────────
  // Elastic deflection from unbalanced load on 2-way slab:
  // δ = 0.003 × wu_net × Lx⁴ / (Ec × t³/12) — approximate isotropic formula
  const Ec = 4700 * Math.sqrt(fc); // MPa
  const EI = Ec * (t ** 3) / 12;  // N·mm²/mm (per unit width)
  const delta_unbal = (0.003 * wu_net * Lx_m ** 4 * 1e9) / EI; // mm
  const limitDefl = Ly_m * 1000 / 240; // mm
  const isDeflOk = delta_unbal <= limitDefl;

  return Object.freeze({
    wSelf, wTotal, wTotalDL,
    wb_x, wb_y, wb_total, percentBalanced,
    wu_net, wu_factored,
    M_unbal_x, M_unbal_y,
    sigma_top_x, sigma_bot_x, sigma_top_y, sigma_bot_y,
    sigma_top_net, sigma_bot_net,
    limComp, limTens, isSlsOk,
    bo, Vu_punch, Vc_punch, phiVc_punch, isPunchOk,
    delta_unbal, limitDefl, isDeflOk,
  });
}
