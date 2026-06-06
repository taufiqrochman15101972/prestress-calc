/**
 * Elastomeric Bearing Pad — Libby "Modern Prestressed Concrete" §12-9,
 * design per AASHTO LRFD §14.7.6 "Method A" (steel-reinforced elastomeric
 * bearings).
 *
 * Checks for a rectangular laminated pad:
 *   • Shape factor of a layer        S = L·W / (2·h_ri·(L+W))
 *   • Service compressive stress     σ_s = R / (L·W) ≤ 1.25·G·S and ≤ σ_lim
 *   • Shear deformation               h_rt ≥ 2·Δ_s  (movement)
 *   • Instantaneous compressive defl. δ = Σ ε_c·h_ri  (from σ/G·S)
 *   • Rotation / stability (slenderness L,W ≥ 3·h_rt — Method A proxy)
 *
 * SI units: forces kN, lengths mm, stresses/modulus MPa.
 */

export interface BearingInputs {
  R: number;       // service reaction (kN) — dead + live
  L: number;       // pad length along span (mm)
  W: number;       // pad width transverse (mm)
  hri: number;     // thickness of one interior elastomer layer (mm)
  nLayers: number; // number of interior layers
  G: number;       // shear modulus of elastomer (MPa), typ 0.7–1.0
  deltaS: number;  // service shear movement to accommodate (mm)
  sigmaLimit?: number; // absolute stress cap (MPa), AASHTO Method A default 7.0
}

export interface BearingResult {
  readonly S: number;          // shape factor of a layer
  readonly hrt: number;        // total elastomer thickness (mm)
  readonly sigma_s: number;    // service compressive stress (MPa)
  readonly sigma_allow: number;// min(1.25·G·S, σ_limit) (MPa)
  readonly stressOk: boolean;
  readonly shearOk: boolean;   // hrt ≥ 2·Δs
  readonly stabilityOk: boolean; // L,W ≥ 3·hrt (Method A slenderness proxy)
  readonly deltaC: number;     // instantaneous compressive deflection (mm)
}

export function computeBearing(inp: BearingInputs): BearingResult {
  const { R, L, W, hri, nLayers, G, deltaS } = inp;
  const sigmaLimit = inp.sigmaLimit ?? 7.0;

  const S = (L * W) / (2 * hri * (L + W));
  const hrt = hri * nLayers;

  const sigma_s = (R * 1000) / (L * W); // N/mm² = MPa
  const sigma_allow = Math.min(1.25 * G * S, sigmaLimit);
  const stressOk = sigma_s <= sigma_allow;

  const shearOk = hrt >= 2 * deltaS;
  const stabilityOk = Math.min(L, W) >= 3 * hrt;

  // Instantaneous compressive strain ε_c ≈ σ_s/(G·S) (small-strain proxy);
  // δ = ε_c·h_rt.
  const eps_c = G * S > 0 ? sigma_s / (6 * G * S) : 0; // /6 ≈ AASHTO chart slope
  const deltaC = eps_c * hrt;

  return Object.freeze({
    S,
    hrt,
    sigma_s,
    sigma_allow,
    stressOk,
    shearOk,
    stabilityOk,
    deltaC,
  });
}
