/**
 * mohrcoulomb.ts — Mohr–Coulomb / Modified-Mohr-Coulomb shear strength and the
 * drained-triaxial-at-failure relation that the MIDAS GTS constitutive
 * verification (MD 474 "Tri-axial test using MMC model") is built on.
 *
 * Used by the geotechnical analysis (failure envelope, triaxial strength) and as
 * a constitutive benchmark with absolute closed-form targets:
 *   c=0, φ=30°, σ3=100 kPa → Kp=3, σ1f=300 kPa, q_f=200 kPa
 *   c=cu, φ=0  (Tresca)    → q_f = 2·cu.
 *
 * Stresses in kPa; φ in degrees. Pure → Object.freeze().
 */

/** Rankine passive coefficient Kp = tan²(45+φ/2). */
export function passiveCoeff(phiDeg: number): number {
  return Math.tan(Math.PI / 4 + (phiDeg * Math.PI) / 360) ** 2;
}

export interface TriaxialInputs {
  /** cohesion c (kPa). */
  readonly c: number;
  /** friction angle φ (deg). */
  readonly phi: number;
  /** confining (minor principal) stress σ3 (kPa). */
  readonly sigma3: number;
}

export interface TriaxialResult {
  readonly Kp: number;
  /** major principal stress at failure σ1f = σ3·Kp + 2c√Kp (kPa). */
  readonly sigma1f: number;
  /** deviator stress at failure q_f = σ1f − σ3 (kPa). */
  readonly qf: number;
  /** mobilised shear strength on the failure plane (kPa). */
  readonly tauf: number;
}

/** Drained triaxial compression at failure (Mohr–Coulomb). */
export function triaxialFailure(i: TriaxialInputs): TriaxialResult {
  const Kp = passiveCoeff(i.phi);
  const sqKp = Math.sqrt(Kp);
  const sigma1f = i.sigma3 * Kp + 2 * i.c * sqKp;
  const qf = sigma1f - i.sigma3;
  // τ on the failure plane = (σ1−σ3)/2·cosφ
  const tauf = (qf / 2) * Math.cos((i.phi * Math.PI) / 180);
  return Object.freeze({ Kp, sigma1f, qf, tauf });
}

/** Shear strength on a plane: τ_f = c + σn·tanφ (Coulomb envelope). */
export function shearStrength(c: number, phiDeg: number, sigmaN: number): number {
  return c + sigmaN * Math.tan((phiDeg * Math.PI) / 180);
}
