/**
 * Prategang Sirkuler — Tangki, Pipa, Cincin (TY Lin Ch. 10)
 * ACI 318-19, ACI 350 (Liquid-Retaining Structures), AWWA D110
 *
 * ── Konsep ─────────────────────────────────────────────────
 * Winding prestress wire/strand mengelilingi dinding silindris:
 *   - Gaya pretegang → tegangan annular (tangential/hoop) kompresi
 *   - Tekanan internal → tegangan hoop tarik: σ_hoop = p·r/t
 *   - Prategang mengimbangi tegangan tarik dari tekanan cairan
 *
 * Distribusi gaya dalam dinding:
 *   - Hoop (tangensial): N_h = p·r  [kN/m] (pada kedalaman h)
 *   - Vertical bending: tergantung kondisi tumpuan (fixed/sliding base)
 *
 * ── Fixed-Base Cylinder (TY Lin Fig. 10-7) ──────────────────
 * At base: M_base = 0.19·p·r²·H (untuk H²/(r·t) ≤ 3)
 * At base: N_h (modified by fixity) = from tables
 *
 * ── Prestress ────────────────────────────────────────────────
 * P_hoop = T_wrap / (spacing_s) [kN/m]
 * σ_pe = P_hoop / t [MPa] (uniform compression)
 * Net hoop stress: σ_net = σ_pe − N_h/t [MPa] (negative = compression OK)
 */

export type TankBaseCondition = "FIXED" | "SLIDING" | "HINGED";

export interface TankInputs {
  /** Inner radius (mm) */
  r: number;
  /** Wall thickness (mm) */
  t: number;
  /** Total height (mm) */
  H: number;
  /** Specific weight of liquid (kN/m³) — water = 9.81 */
  gamma_l: number;
  /** f'c (MPa) */
  fc: number;
  /** Prestress wire/strand yield (MPa) */
  fpy: number;
  /** Prestress wire/strand ultimate (MPa) */
  fpu: number;
  /** Wire/strand modulus (MPa) */
  Eps: number;
  /** Prestress wire cross-section area per unit length circumference (mm²/m) */
  Aps_per_m: number;
  /** Jacking ratio */
  jackingRatio: number;
  /** Base condition */
  baseCondition: TankBaseCondition;
}

export interface TankResult {
  // Geometry
  readonly r: number;
  readonly t: number;
  readonly H: number;
  readonly volumeM3: number;        // internal volume (m³)
  // Liquid pressure
  readonly p_base: number;          // pressure at base = gamma_l × H (kN/m²)
  readonly N_h_base: number;        // hoop force at base (kN/m)
  readonly N_h_mid: number;         // hoop force at midheight (kN/m)
  // Prestress
  readonly fse: number;             // effective prestress (MPa)
  readonly Pe_per_m: number;        // prestress force per unit height (kN/m)
  readonly sigma_pe: number;        // uniform compressive prestress (MPa, negative)
  // Net stresses at base (governing)
  readonly sigma_hoop_base: number; // net hoop stress (MPa, + = tension)
  readonly sigma_hoop_mid: number;
  // Limits
  readonly limComp: number;         // −0.45f'c
  readonly limTens: number;         // +0.50√f'c (ACI 318)
  readonly limTens_ACI350: number;  // 0 (no tension — ACI 350 liquid-retaining)
  // Vertical bending moment at base (fixed base only)
  readonly M_base_kNm: number;      // kN·m/m
  readonly sigma_bend_outer: number;// bending stress at outer face
  readonly sigma_bend_inner: number;
  // Combined check
  readonly isSls350Ok: boolean;     // no tension per ACI 350 (zero tension limit)
  readonly isSlsACI: boolean;       // 0.50√f'c tension limit (ACI 318)
  // Required prestress wire spacing
  readonly s_req_mm: number;        // required spacing of circumferential wire (mm)
  readonly etaLoss: number;         // assumed total loss fraction
}

export function computeCircularPrestress(inp: TankInputs): TankResult {
  const { r, t, H, gamma_l, fc, fpy, fpu, Eps, Aps_per_m, jackingRatio, baseCondition } = inp;

  const r_m = r / 1000; // m
  const t_m = t / 1000;
  const H_m = H / 1000;

  // Volume
  const volumeM3 = Math.PI * r_m ** 2 * H_m;

  // ── Liquid pressure ────────────────────────────────────────
  const p_base = gamma_l * H_m;      // kN/m² = kPa
  const p_mid  = gamma_l * H_m / 2;

  // Hoop force N_h = p·r (kN/m), where p in kN/m² and r in m
  const N_h_base = p_base * r_m; // kN/m
  const N_h_mid  = p_mid  * r_m;

  // ── Prestress ─────────────────────────────────────────────
  // Simplified losses: ~15% for circular winding
  const fjack = jackingRatio * fpu;
  const etaLoss = 0.15;
  const fse = fjack * (1 - etaLoss);

  // Prestress force per unit height from wound wire (Aps_per_m in mm²/m → per mm of height)
  const Pe_per_m = (fse * Aps_per_m) / 1000; // kN/m (per meter of height)
  const sigma_pe = -(Pe_per_m * 1000) / (t * 1000); // MPa, compression = negative
  // Note: Pe_per_m [kN/m] × 1000 = N/m, divided by t [mm] × 1000 = N/m per mm height
  // Better: sigma_pe = −Pe_per_m / t [kN/m / mm = kN/(m·mm)] → need consistent units
  // σ = P / (t × 1) [N/mm² = MPa]: P in N/m, t in mm → σ = P/t [N/(m·mm)] = N/mm²·(1/1000)
  // Let's redo: Pe_per_m [kN/m] per unit height
  // For 1m of wall height: force = Pe_per_m kN acting on section bw=1m, h=t
  // σ = Pe_per_m×1000 / (1000×t) = Pe_per_m / t [MPa]
  const sigma_pe_MPa = -(Pe_per_m) / t * 1000; // MPa (kN/m → N/mm via ×1000/(1000×t))
  // Simpler: sigma_pe = -fse × (Aps_per_m/1e3) / t [MPa] where Aps_per_m in mm²/m
  // = -fse × ρ_circ where ρ_circ = Aps/(perimeter×t) per unit height
  const sigma_pe_correct = -(fse * (Aps_per_m / 1000)) / t; // MPa

  // ── Net hoop stress ────────────────────────────────────────
  // Hoop stress from liquid membrane force N_h [kN/m] over wall thickness t [mm]:
  //   N_h [kN/m] = (N_h·1000 N)/(1000 mm) = N_h N/mm  ⇒  σ = N_h/t [N/mm² = MPa]
  // (no extra ×1000 — kN/m and N/mm are numerically equal)
  const sigma_hoop_liq_base = N_h_base / t; // MPa (tension = positive)
  const sigma_hoop_base = sigma_pe_correct + sigma_hoop_liq_base; // net hoop
  const sigma_hoop_mid  = sigma_pe_correct + N_h_mid / t;

  // ── Vertical bending (fixed base) ─────────────────────────
  // TY Lin: for short tank H²/(r·t) < 3: M_base = 0.19·p·r²·H
  // For long tank (flexible base): M_base = p·r²·H / (H²/(r·t))^0.5
  let M_base_kNm = 0;
  if (baseCondition === "FIXED") {
    const geomParam = H_m ** 2 / (r_m * t_m);
    if (geomParam < 3) {
      M_base_kNm = 0.19 * p_base * r_m ** 2 * H_m; // kN·m/m (moment per unit perimeter)
    } else {
      // ACI 350 Table: use 0.10 for intermediate case (simplified)
      M_base_kNm = 0.10 * p_base * r_m ** 2 * H_m;
    }
  }

  // Bending stress at wall faces (vertical bending)
  const Z_vert = t ** 2 / 6; // mm³/mm (per unit length)
  const sigma_bend_outer = (M_base_kNm * 1e6) / (Z_vert * 1000); // MPa
  const sigma_bend_inner = -sigma_bend_outer;

  // ── Limits ─────────────────────────────────────────────────
  const limComp     = -0.45 * fc;
  const limTens     = +0.50 * Math.sqrt(fc);
  const limTens_ACI350 = 0; // no tension — ACI 350 for liquid-retaining structures

  // ── Required wire spacing for zero-tension (ACI 350) ──────
  // σ_net = σ_pe + σ_hoop_liquid = 0 → σ_pe = −σ_hoop_liquid
  // −fse × (Aps_per_m/1000) / t = −N_h_base / t × 1000
  // Aps_req = N_h_base × 1000 / fse  [mm²/m]
  // If single wire area = Aps_per_m/n_wires, spacing s = 1000/n_wires
  // Since Aps_per_m = Awire / s × 1000: s = Awire × 1000 / Aps_per_m
  // Required: Aps_req/m = N_h_base×1000/fse
  const Aps_req_per_m = (N_h_base * 1000) / fse; // mm²/m
  // Spacing for same wire area: s = Aps_per_m_per_wire × 1000 / Aps_req_per_m
  // We don't know wire area separately, so just return required Aps
  const s_req_mm = Aps_per_m > 0
    ? (Aps_per_m / Aps_req_per_m) * 1000 // mm
    : Infinity;

  const isSls350Ok = sigma_hoop_base <= limTens_ACI350 && sigma_hoop_base >= limComp;
  const isSlsACI   = sigma_hoop_base <= limTens && sigma_hoop_base >= limComp;

  return Object.freeze({
    r, t, H, volumeM3,
    p_base, N_h_base, N_h_mid,
    fse, Pe_per_m, sigma_pe: sigma_pe_correct,
    sigma_hoop_base, sigma_hoop_mid,
    limComp, limTens, limTens_ACI350,
    M_base_kNm, sigma_bend_outer, sigma_bend_inner,
    isSls350Ok, isSlsACI,
    s_req_mm, etaLoss,
  });
}
