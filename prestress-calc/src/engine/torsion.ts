/**
 * Torsion Design Engine — ACI 318-19 §22.7
 *
 * For non-circular sections under combined T + V + M.
 * Uses space-truss analogy with θ = 45° (non-PS) or 37.5° (PS).
 *
 * Threshold torque: T_th = 0.083λ√f'c · Acp²/pcp · √(1 + fpc/(0.33λ√f'c))  [N·mm, SI]
 * Cracking torque:  T_cr = 4 · T_th
 * If Tu < φ · T_th → torsion may be neglected
 *
 * Required transverse: At/s = Tu/(2·Ao·φ·fy·cot θ)   [mm²/mm]
 * Required longitud.:  Al   = Tu·ph·cot²θ/(2·Ao·φ·fyl) [mm²]
 * Combined V+T check:  (Vu/bw·dv)² + (Tu·ph/(1.7·Aoh²))² ≤ (Vc/bw·dv + 0.66√f'c)²
 */

export interface TorsionInputs {
  /** Factored torque (kN·m) */
  Tu: number;
  /** Factored shear (kN) — for combined V+T check */
  Vu: number;
  /** Web width (mm) */
  bw: number;
  /** Effective shear depth (mm) */
  dv: number;
  /** Gross cross-sectional area enclosed by outer perimeter (mm²) */
  Acp: number;
  /** Outer perimeter of concrete cross-section (mm) */
  pcp: number;
  /** Area enclosed by centerline of outermost closed transverse torsion steel (mm²) */
  Aoh: number;
  /** Perimeter of Aoh (mm) */
  ph: number;
  /** f'c of section (MPa) */
  fc: number;
  /** Average axial compressive stress from prestress: Pe/Ag (MPa) */
  fpc: number;
  /** Transverse steel yield (MPa) */
  fyt: number;
  /** Longitudinal steel yield (MPa) */
  fyl: number;
  /** true if the section is prestressed */
  isPrestressed: boolean;
  /** Vc for V+T combination check (kN) — already computed */
  Vc: number;
}

export interface TorsionResult {
  /** φ factor for torsion (0.75 per ACI) */
  readonly phi: number;
  /** Threshold torque below which torsion may be neglected (kN·m) */
  readonly T_th: number;
  /** Cracking torque (kN·m) */
  readonly T_cr: number;
  /** true if Tu < φ·T_th (torsion negligible) */
  readonly isNegligible: boolean;
  /** Assumed strut angle θ (degrees) */
  readonly theta_deg: number;
  /** Effective torsional area ≈ 0.85·Aoh (mm²) */
  readonly Ao: number;
  /** Required transverse torsion steel At/s (mm²/mm per leg) */
  readonly At_per_s: number;
  /** Required total longitudinal torsion steel Al (mm²) */
  readonly Al_req: number;
  /** Combined V+T stress ratio (≤ 1.0 means section is adequate) */
  readonly combinedRatio: number;
  /** true if combined V+T stress ratio ≤ 1.0 */
  readonly isAdequate: boolean;
}

const PHI_T = 0.75;

export function computeTorsion(inp: TorsionInputs): TorsionResult {
  const {
    Tu, Vu, bw, dv, Acp, pcp, Aoh, ph,
    fc, fpc, fyt, fyl, isPrestressed, Vc,
  } = inp;

  const lambda = 1.0; // normal-weight concrete
  const sqrt_fc = Math.sqrt(fc);

  // ── Threshold torque (N·mm) — ACI 318-19 (SI) §22.7.4.1 ─────
  // T_th = 0.083·λ·√f'c·(Acp²/pcp)·√(1 + fpc/(0.33·λ·√f'c))
  const T_th_Nmm =
    (0.083 * lambda * sqrt_fc) *
    ((Acp ** 2) / pcp) *
    Math.sqrt(1 + fpc / (0.33 * lambda * sqrt_fc));

  const T_th  = T_th_Nmm / 1e6; // → kN·m
  const T_cr  = 4 * T_th;
  const Tu_Nmm = Tu * 1e6;      // kN·m → N·mm

  const isNegligible = Tu <= PHI_T * T_th;

  // ── Strut angle ──────────────────────────────────────────────
  const theta_deg = isPrestressed ? 37.5 : 45.0;
  const theta_rad = (theta_deg * Math.PI) / 180;
  const cot = 1 / Math.tan(theta_rad);

  const Ao = 0.85 * Aoh;

  // ── Transverse reinforcement (per leg) ──────────────────────
  // At/s = Tu / (2·Ao·φ·fyt·cotθ)   [mm²/mm]
  const At_per_s = isNegligible
    ? 0
    : Tu_Nmm / (2 * Ao * PHI_T * fyt * cot);

  // ── Longitudinal reinforcement ────────────────────────────────
  // Al = Tu·ph·cot²θ / (2·Ao·φ·fyl)   [mm²]
  const Al_req = isNegligible
    ? 0
    : (Tu_Nmm * ph * cot ** 2) / (2 * Ao * PHI_T * fyl);

  // ── Combined V + T check ─────────────────────────────────────
  // ACI §22.7.7.1: √[(Vu/bw·dv)² + (Tu·ph/(1.7·Aoh²))²] ≤ φ·(Vc/bw·dv + 0.66λ√f'c)
  const Vu_N = Vu * 1000;       // kN → N
  const Vc_N = Vc * 1000;
  const v_shear = Vu_N / (bw * dv);
  const v_torsion = (Tu_Nmm * ph) / (1.7 * Aoh ** 2);
  const v_lhs = Math.sqrt(v_shear ** 2 + v_torsion ** 2);
  const v_rhs = PHI_T * (Vc_N / (bw * dv) + 0.66 * lambda * sqrt_fc);
  const combinedRatio = v_rhs > 0 ? v_lhs / v_rhs : 0;

  return Object.freeze({
    phi:           PHI_T,
    T_th,
    T_cr,
    isNegligible,
    theta_deg,
    Ao,
    At_per_s,
    Al_req,
    combinedRatio,
    isAdequate: combinedRatio <= 1.0,
  });
}

/**
 * Estimate Acp and pcp for a simple rectangular or I-section.
 * For an I-girder: use the bounding rectangle (conservative).
 */
export function estimateAcpPcp(bTotal: number, hTotal: number): { Acp: number; pcp: number } {
  return {
    Acp: bTotal * hTotal,
    pcp: 2 * (bTotal + hTotal),
  };
}

/**
 * Estimate Aoh and ph for closed stirrups around the web.
 * Stirrups follow the outer face of the web at a cover distance.
 */
export function estimateAohPh(
  bw: number,
  hTotal: number,
  cover = 40
): { Aoh: number; ph: number } {
  const bInner = bw - 2 * cover;
  const hInner = hTotal - 2 * cover;
  return {
    Aoh: bInner * hInner,
    ph:  2 * (bInner + hInner),
  };
}
