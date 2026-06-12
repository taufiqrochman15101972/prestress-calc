/**
 * Fatigue Limit State — prestressing strand & mild reinforcement
 * FHWA NHI-04-043/044 "Comprehensive Design Example" step 5.6.6,
 * per AASHTO LRFD §5.5.3 (Fatigue I load combination).
 *
 * Procedure:
 *  1. UNCRACKED SCREEN — fatigue of the strand need not be checked when
 *     the extreme-fibre stress under (permanent loads + Fatigue I LL)
 *     stays below the fatigue tension threshold:
 *        σ_bot = σ_perm + γ_fat·M_fat/Z_bc  ≤  0.25·√f'c   (+ tension)
 *     (compressive σ_bot trivially passes).
 *  2. STRAND STRESS RANGE (uncracked section, elastic):
 *        Δf_p = n_p · γ_fat·M_fat·e_ps / I_c        n_p = E_p/E_c
 *     vs the constant-amplitude threshold ΔF_TH by tendon curvature:
 *        radius > 9 m  → 125 MPa ;  radius ≤ 3.6 m → 70 MPa
 *        (linear interpolation between, AASHTO Table 5.5.3.3-1 in SI)
 *  3. MILD-STEEL RANGE (when bonded rebar is present):
 *        Δf_s = n_s · γ_fat·M_fat·(d_s − y_NA)/I_c
 *        ΔF_TH = 166 − 0.33·f_min   (MPa, straight bars)
 *
 * Units kN·m / mm / MPa; + tension. Procedure from the design example,
 * limits per the adopted AASHTO SI code path — never the book's numbers.
 */

export interface FatigueInputs {
  /** Fatigue-truck moment incl. IM = 1.15, UNfactored (kN·m) */
  Mfat: number;
  /** Fatigue I load factor (default 1.75) */
  gammaFat?: number;
  /** Composite inertia I_c (mm⁴) */
  Ic: number;
  /** Composite NA from bottom y_bc (mm) */
  ybc: number;
  /** Bottom section modulus Z_bc (mm³) */
  Zbc: number;
  /** Strand eccentricity below composite NA e_ps (mm) */
  ePs: number;
  /** Bottom-fibre stress under permanent loads + effective PT (MPa, + tension) */
  sigmaPerm: number;
  /** f'c service (MPa) */
  fc: number;
  /** Modular ratio strand n_p = E_p/E_c */
  np: number;
  /** Tendon curvature radius at the section (m) — picks ΔF_TH */
  radiusM: number;
  /** Mild steel: depth from bottom d_s (mm), 0 = skip rebar check */
  dsBot?: number;
  /** Modular ratio rebar n_s = E_s/E_c */
  ns?: number;
  /** Minimum (permanent) rebar stress f_min (MPa, + tension) */
  fmin?: number;
}

export interface FatigueResult {
  /** Bottom-fibre stress under Fatigue I combination (MPa) */
  readonly sigmaFatBot: number;
  /** Uncracked-screen threshold 0.25·√f'c (MPa) */
  readonly screenLimit: number;
  /** Section stays uncracked → strand fatigue check waived */
  readonly uncracked: boolean;
  /** Strand stress range Δf_p (MPa) */
  readonly dfStrand: number;
  /** Strand threshold ΔF_TH by radius (MPa) */
  readonly thStrand: number;
  readonly strandOk: boolean;
  /** Rebar stress range Δf_s (MPa, 0 when skipped) */
  readonly dfRebar: number;
  /** Rebar threshold 166 − 0.33·f_min (MPa) */
  readonly thRebar: number;
  readonly rebarOk: boolean;
  readonly ok: boolean;
}

export function computeFatigue(inp: FatigueInputs): FatigueResult {
  const {
    Mfat, gammaFat = 1.75, Ic, Zbc, ePs, sigmaPerm, fc, np, radiusM,
    dsBot = 0, ns = 0, fmin = 0, ybc,
  } = inp;

  const MfatN = gammaFat * Mfat * 1e6; // N·mm

  // ── 1. Uncracked screen at the bottom fibre ──────────────────
  const sigmaFatBot = sigmaPerm + MfatN / Zbc;
  const screenLimit = 0.25 * Math.sqrt(fc);
  const uncracked = sigmaFatBot <= screenLimit;

  // ── 2. Strand stress range (elastic, uncracked) ──────────────
  const dfStrand = (np * MfatN * ePs) / Ic;
  // ΔF_TH by curvature radius (SI values of AASHTO Table 5.5.3.3-1)
  let thStrand: number;
  if (radiusM >= 9) thStrand = 125;
  else if (radiusM <= 3.6) thStrand = 70;
  else thStrand = 70 + ((radiusM - 3.6) / (9 - 3.6)) * (125 - 70);
  // Waived when the screen passes; otherwise the range must pass.
  const strandOk = uncracked || dfStrand <= thStrand;

  // ── 3. Mild-steel range (optional) ───────────────────────────
  const hasRebar = dsBot > 0 && ns > 0;
  const dfRebar = hasRebar ? (ns * MfatN * Math.abs(ybc - dsBot)) / Ic : 0;
  const thRebar = 166 - 0.33 * fmin;
  const rebarOk = !hasRebar || dfRebar <= thRebar;

  return Object.freeze({
    sigmaFatBot, screenLimit, uncracked,
    dfStrand, thStrand, strandOk,
    dfRebar, thRebar, rebarOk,
    ok: strandOk && rebarOk,
  });
}
