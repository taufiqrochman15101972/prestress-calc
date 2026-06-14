/**
 * Bridge Deck Slab Design (transverse, over girders)
 * PCI Bridge Design Manual §8.8 + Ch.9 Ex. 9.8 (SIP panel system)
 *
 * The CIP (or SIP-panel + topping) deck spans TRANSVERSELY between girder
 * top flanges. Two parallel code paths, computed side by side:
 *
 * 1) AASHTO Standard Specifications (STD 3.24.3):
 *      M_LL = c·((S + 2)/32)·P        [ft·kip/ft, S ft, P = 16 kip wheel]
 *      continuity factor c = 0.8 (≥ 3 supports), impact 30%
 *      overhang: M = P·X/E, E = 0.8X + 3.75 (ft)
 *      M_u = 1.3·(M_D + 1.67·M_LL+I)
 *
 * 2) AASHTO LRFD strip method (LRFD 4.6.2.1.3):
 *      equivalent strip width (mm, S mm):
 *        E⁺ = 660 + 0.55·S   ·   E⁻ = 1220 + 0.25·S
 *        overhang E_ov = 1140 + 0.833·X
 *      72.5-kN wheel (32-kip axle/2) on the strip, continuous over rigid
 *      girders → M± per metre width ≈ c·(P·S/4)/E, IM = 33%
 *      M_u = 1.25·M_DC + 1.50·M_DW + 1.75·M_LL+IM
 *
 * Common serviceability/detailing screens:
 *      t_min = 175 mm (LRFD 9.7.1.1, excl. wearing/grinding);
 *      Δ_LL ≤ S/800 (cantilever S/300); covers 50 mm top / 25 mm bottom;
 *      required A_s from rectangular section; min reinforcement 1.2·M_cr.
 *
 * Internal SI: kN, m, mm, MPa.
 */

export interface DeckSlabInputs {
  /** Effective transverse span between girder lines S (m) */
  S: number;
  /** Structural deck thickness t_d (mm) */
  td: number;
  /** Wearing surface / SDL on the deck (kPa) */
  wSdl: number;
  /** Deck overhang beyond exterior girder X (m), 0 = none */
  X: number;
  /** Wheel load P (kN) — HS20/HL-93 wheel = 72.5 kN */
  P: number;
  /** Continuity factor (0.8 for ≥ 3 girders) */
  cont: number;
  /** f'c deck (MPa) */
  fc: number;
  /** f_y reinforcement (MPa) */
  fy: number;
  /** Effective depth d (mm) — t_d − cover − Ø/2 */
  d: number;
  /** Concrete unit weight (kN/m³) */
  gammaC: number;
}

export interface DeckSlabResult {
  // dead load
  readonly wSelf: number;          // kN/m² deck self weight
  readonly M_D: number;            // dead-load moment ≈ w·S²/10 (kN·m/m)
  // Standard Specifications path
  readonly M_LL_std: number;       // (S+2)/32·P·c (kN·m/m), no impact
  readonly M_LLI_std: number;      // incl. 30% impact
  readonly Mu_std: number;         // 1.3(M_D + 1.67 M_LL+I)
  // LRFD strip path
  readonly Epos: number;           // strip widths (mm)
  readonly Eneg: number;
  readonly Eov: number;
  readonly M_LL_pos: number;       // per metre incl. IM (kN·m/m)
  readonly M_LL_neg: number;
  readonly M_ov: number;           // overhang wheel moment (kN·m/m)
  readonly Mu_lrfd_pos: number;
  readonly Mu_lrfd_neg: number;
  // section design (on the governing +M)
  readonly Mu_gov: number;
  readonly As_req: number;         // mm²/m
  readonly Mcr: number;            // kN·m/m
  readonly minReinfOk: boolean;    // φMn(As_req) ≥ 1.2 Mcr proxy
  // screens
  readonly tdMin: number;          // 175 mm
  readonly thicknessOk: boolean;
  readonly deflLimit: number;      // S/800 (mm)
}

export function computeDeckSlab(inp: DeckSlabInputs): DeckSlabResult {
  const { S, td, wSdl, X, P, cont, fc, fy, d, gammaC } = inp;

  // ── dead load (continuous slab ≈ wS²/10) ──
  const wSelf = (td / 1000) * gammaC;          // kN/m²
  const wD = wSelf + wSdl;
  const M_D = (wD * S ** 2) / 10;

  // ── Standard Specifications ──
  const S_ft = S / 0.3048;
  const P_kip = P / 4.448222;
  const M_LL_std_ftkip = cont * ((S_ft + 2) / 32) * P_kip;   // ft·kip/ft
  const M_LL_std = M_LL_std_ftkip * 4.448222;                // kN·m/m
  const M_LLI_std = M_LL_std * 1.30;
  const Mu_std = 1.3 * (M_D + 1.67 * M_LLI_std);

  // ── LRFD strip method ──
  const S_mm = S * 1000;
  const X_mm = X * 1000;
  const Epos = 660 + 0.55 * S_mm;
  const Eneg = 1220 + 0.25 * S_mm;
  const Eov = 1140 + 0.833 * X_mm;
  const IM = 1.33;
  // wheel at midspan of the continuous strip: M ≈ cont·P·S/4, spread over E
  const M_LL_pos = ((cont * P * S) / 4 / (Epos / 1000)) * IM;  // kN·m/m
  const M_LL_neg = ((cont * P * S) / 4 / (Eneg / 1000)) * IM;
  const M_ov = X > 0 ? ((P * X) / (Eov / 1000)) * IM : 0;
  const Mu_lrfd_pos = 1.25 * M_D + 1.75 * M_LL_pos;
  const Mu_lrfd_neg = 1.25 * M_D + 1.75 * Math.max(M_LL_neg, M_ov);

  // ── section design on the governing moment ──
  const Mu_gov = Math.max(Mu_std, Mu_lrfd_pos, Mu_lrfd_neg);
  // As = Mu/(φ·fy·j·d), j ≈ 0.9
  const As_req = (Mu_gov * 1e6) / (0.9 * fy * 0.9 * d);        // mm²/m
  const fr = 0.62 * Math.sqrt(fc);
  const Z = (1000 * td ** 2) / 6;                              // per metre
  const Mcr = (fr * Z) / 1e6;
  const phiMn = (0.9 * As_req * fy * 0.9 * d) / 1e6;
  const minReinfOk = phiMn >= Math.min(1.2 * Mcr, (4 / 3) * Mu_gov);

  const tdMin = 175;
  return Object.freeze({
    wSelf, M_D,
    M_LL_std, M_LLI_std, Mu_std,
    Epos, Eneg, Eov, M_LL_pos, M_LL_neg, M_ov,
    Mu_lrfd_pos, Mu_lrfd_neg,
    Mu_gov, As_req, Mcr, minReinfOk,
    tdMin, thicknessOk: td >= tdMin,
    deflLimit: S_mm / 800,
  });
}
