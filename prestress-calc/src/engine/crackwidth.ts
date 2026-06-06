/**
 * Crack Width Engine — ACI 224R-01 / ACI 318-19 §24.3
 * For partially prestressed (Class T and C) beams.
 *
 * Modified Gergely-Lutz equation (ACI 224R):
 *   w = 11 × 10⁻⁶ · β · fs · ∛(dc · A)    [mm, MPa]
 *
 * where:
 *   β  = ratio of distances to neutral axis from extreme tension fiber
 *         and from centroid of tension steel ≈ (h − c) / (d − c)
 *         simplified ≈ 1.2 for typical beams
 *   fs = net stress in tension steel / non-PS rebar at cracked section (MPa)
 *   dc = concrete cover to centroid of tensile steel (mm)
 *   A  = area of concrete surrounding each bar = 2·dc · s_bar (mm²)
 *        where s_bar = bar spacing or bw/number_of_bars
 *
 * ACI 318-19 §24.3.2 approach (maximum bar spacing):
 *   s ≤ 380·(280/fs) − 2.5·cc    [in, psi → converted to mm, MPa]
 *   s ≤ 300·(280/fs)              [upper limit]
 *
 * Limits (ACI 224R Table 4.1):
 *   Interior exposure: w_max = 0.33 mm
 *   Exterior exposure: w_max = 0.25 mm
 */

export type ExposureClass = "interior" | "exterior" | "aggressive";

export interface CrackWidthInputs {
  /** Net tensile stress in non-PS bar at cracked section (MPa) */
  fs: number;
  /** Cover from extreme tension face to centroid of tension steel (mm) */
  dc: number;
  /** Web/effective width at tension face (mm) */
  bw: number;
  /** Number of tension steel bars (or equivalent) */
  nBars: number;
  /** Ratio of neutral-axis depth to extreme tension fiber / (d − c) ≈ 1.2 */
  beta?: number;
  /** Exposure class for limit selection */
  exposure?: ExposureClass;
}

export interface CrackWidthResult {
  /** Computed crack width (mm) */
  readonly w_cr: number;
  /** Allowable crack width (mm) from ACI 224R */
  readonly w_limit: number;
  /** Exposure class used */
  readonly exposure: ExposureClass;
  /** true if w_cr ≤ w_limit */
  readonly isOk: boolean;
  /** ACI 318-19 §24.3.2 max bar spacing (mm) */
  readonly sMax_ACI318: number;
}

export function computeCrackWidth(inp: CrackWidthInputs): CrackWidthResult {
  const { fs, dc, bw, nBars, beta = 1.2, exposure = "exterior" } = inp;

  // Effective area of concrete surrounding each bar (mm²)
  const A = (2 * dc * bw) / nBars;

  // Gergely-Lutz crack width (mm)
  const w_cr = 11e-6 * beta * fs * Math.cbrt(dc * A);

  // Exposure limit
  const w_limit =
    exposure === "interior"   ? 0.33 :
    exposure === "exterior"   ? 0.25 : 0.15; // aggressive

  // ACI 318-19 (SI) §24.3.2: maximum bar spacing — coefficients are already SI,
  // used directly with fs [MPa] and cc [mm], giving s [mm]:
  //   s ≤ 380·(280/fs) − 2.5·cc   and   s ≤ 300·(280/fs)
  const s1   = 380 * (280 / fs) - 2.5 * dc; // mm
  const s2   = 300 * (280 / fs);            // mm
  const sMax_ACI318 = Math.min(s1, s2);     // mm

  return Object.freeze({
    w_cr,
    w_limit,
    exposure,
    isOk: w_cr <= w_limit,
    sMax_ACI318: Math.max(50, sMax_ACI318), // never less than 50 mm
  });
}

/**
 * Compute steel stress at cracked section for Class T or C beams.
 * Uses cracked-section analysis:
 *   fs = (M_cr_excess) / (As · jd)
 * where M_cr_excess = M_applied − M_cr (moment causing cracking)
 */
export function crackedSectionSteel(
  M_applied_kNm: number,
  M_cr_kNm: number,
  As: number,        // mm²
  dp: number,        // effective depth (mm)
  jFactor = 0.87     // j = 1 − a/2d ≈ 0.87
): number {
  const dM = Math.max(0, M_applied_kNm - M_cr_kNm) * 1e6; // N·mm
  if (As <= 0 || dp <= 0) return 0;
  return dM / (As * jFactor * dp);
}
