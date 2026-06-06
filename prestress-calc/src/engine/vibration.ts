/**
 * Floor Vibration Serviceability — Khan & Williams "Post-tensioned Concrete
 * Floors" §9.2 (footfall-induced vibration), consistent with SCI P354 / CCIP.
 *
 * Post-tensioned floors are thin and lightly damped, so walking-induced
 * vibration is a governing serviceability limit. Procedure:
 *
 *   1. Fundamental natural frequency from the gravity deflection of the
 *      participating (permanent) mass — prestress does NOT change EI:
 *          δ = 5·w·L⁴/(384·EI)          f₀ = 18/√δ   (δ in mm)
 *   2. Identify the walking harmonic h that excites the floor (h = f₀/f_p),
 *      take its Fourier (dynamic load) coefficient α_h.
 *   3. Resonant peak acceleration   a = α_h·Q / (2·ζ·M_modal).
 *   4. Response factor R = a_rms / 0.005  (m/s² base curve), check vs use limit.
 *
 * Numbers used as inputs are user-editable; only the procedure is taken from
 * the source. SI in: m, mm, MPa, kN/m². Out: Hz, m/s², dimensionless R.
 */

export type FloorUse = "office" | "residential" | "gym" | "hospital";

export interface FloorVibrationInputs {
  spanL_m: number;      // effective span
  width_m: number;      // panel width (perpendicular)
  t_mm: number;         // slab thickness
  fc: number;           // MPa (concrete cylinder strength)
  wPermanent: number;   // kN/m² — vibrating mass (self + SDL + ψ·LL)
  dampingRatio: number; // ζ (≈0.02 bare, 0.03 furnished, 0.045 partitions)
  walkingFreq?: number; // f_p (Hz), default 2.0
  personWeight?: number;// Q (N), default 700
  use?: FloorUse;       // acceptance category
}

export interface FloorVibrationResult {
  readonly Ec_dyn: number;     // dynamic modulus (MPa)
  readonly deflection_mm: number; // δ under permanent mass (gross)
  readonly f0: number;         // fundamental natural frequency (Hz)
  readonly isLowFrequency: boolean; // f0 ≤ ~4·f_p ⇒ resonant build-up governs
  readonly harmonic: number;   // exciting harmonic h
  readonly alphaH: number;     // dynamic load (Fourier) coefficient
  readonly modalMass: number;  // kg
  readonly accelPeak: number;  // m/s²
  readonly accelRatioG: number;// a/g (%)
  readonly responseFactor: number; // R
  readonly limitR: number;     // acceptance limit for the use category
  readonly isOk: boolean;
}

const R_LIMIT: Record<FloorUse, number> = {
  office: 8, residential: 4, hospital: 1, gym: 32,
};

/** Fourier coefficient of the h-th walking harmonic (decays with h). */
function fourierCoeff(h: number): number {
  const table = [0.4, 0.1, 0.06, 0.05]; // α1..α4 (typical walking)
  return table[h - 1] ?? 0.4 * Math.exp(-0.4 * (h - 1));
}

export function computeFloorVibration(inp: FloorVibrationInputs): FloorVibrationResult {
  const { spanL_m, width_m, t_mm, fc, wPermanent, dampingRatio } = inp;
  const fp = inp.walkingFreq ?? 2.0;
  const Q = inp.personWeight ?? 700;
  const use = inp.use ?? "office";
  const g = 9.81;

  // Dynamic modulus ≈ 1.1 × static (concrete stiffer under fast cyclic load)
  const Ec_dyn = 1.1 * 4700 * Math.sqrt(fc); // MPa

  // Gravity deflection of a 1 m strip under the permanent (vibrating) mass.
  const L = spanL_m * 1000;                 // mm
  const w = wPermanent;                      // kN/m² = N/mm on a 1 m strip
  const EI = Ec_dyn * (1000 * t_mm ** 3) / 12; // N·mm² (1 m wide strip)
  const deflection_mm = (5 * w * L ** 4) / (384 * EI);

  const f0 = 18 / Math.sqrt(deflection_mm);

  // Exciting harmonic and its dynamic load coefficient.
  const harmonic = Math.max(1, Math.round(f0 / fp));
  const alphaH = fourierCoeff(harmonic);
  const isLowFrequency = f0 <= 4 * fp;

  // Modal mass: participating area ≈ ¼ of the panel for the fundamental mode.
  const massPerArea = (wPermanent * 1000) / g; // kg/m²  (kN/m²·1000/g)
  const modalMass = massPerArea * spanL_m * width_m * 0.25; // kg

  // Resonant peak acceleration (low-frequency floor). For high-frequency
  // floors the same expression is conservative (resonance unlikely).
  const accelPeak = (alphaH * Q) / (2 * dampingRatio * modalMass); // m/s²
  const accelRatioG = (accelPeak / g) * 100;

  // Response factor relative to the ISO base curve (a_rms,base = 0.005 m/s²).
  const a_rms = accelPeak / Math.SQRT2;
  const responseFactor = a_rms / 0.005;
  const limitR = R_LIMIT[use];
  const isOk = responseFactor <= limitR;

  return Object.freeze({
    Ec_dyn,
    deflection_mm,
    f0,
    isLowFrequency,
    harmonic,
    alphaH,
    modalMass,
    accelPeak,
    accelRatioG,
    responseFactor,
    limitR,
    isOk,
  });
}
