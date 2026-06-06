/**
 * Post-Tensioning Field Control — tendon elongation & gage force
 * Libby "Modern Prestressed Concrete" §16-7 (Computation of Gage Pressures
 * and Elongations).  Post-tensioned construction only.
 *
 * The measured tendon elongation is the field check on the prestress force.
 * It is the integral of the steel strain along the tendon:
 *
 *     Δ = ∫ P(x) / (A_ps · E_ps) dx
 *
 * Using the friction-decayed force profile P(x) (Pj at the live end decaying
 * by μ·α + K·x), and subtracting the anchor seating draw-in δ_set at the live
 * end, gives the net elongation the inspector should read off the ram.
 *
 * All inputs SI: forces kN, lengths mm, areas mm², modulus MPa.
 */

export interface ElongationInputs {
  frictionProfile: readonly number[]; // P(x) along tendon BEFORE anchor set (kN)
  Pj: number;          // jacking force at live end (kN)
  spanMm: number;      // tendon length used for integration (mm)
  Aps: number;         // total prestressing-steel area (mm²)
  Eps: number;         // strand modulus (MPa)
  deltaSet: number;    // anchorage seating / draw-in (mm)
  ramArea?: number;    // jack ram piston area (mm²) — for gage pressure, optional
}

export interface ElongationResult {
  readonly deltaTheoretical: number; // Δ with no friction = Pj·L/(Aps·Eps) (mm)
  readonly deltaFriction: number;    // Δ from friction profile (mm)
  readonly deltaNet: number;         // deltaFriction − deltaSet (mm)
  readonly frictionLossPct: number;  // (Pj − P_end)/Pj × 100
  readonly Pend: number;             // force at dead end after friction (kN)
  readonly gagePressureMPa: number;  // Pj / ramArea (0 if no ramArea)
}

export function computeElongation(inp: ElongationInputs): ElongationResult {
  const { frictionProfile: P, Pj, spanMm, Aps, Eps, deltaSet } = inp;
  const n = P.length;
  const stiff = Aps * Eps; // N (since P in N gives mm)

  // Theoretical (no friction): uniform Pj
  const deltaTheoretical = (Pj * 1000 * spanMm) / stiff;

  // Friction-decayed: trapezoidal integration of P(x) over the length
  const dx = spanMm / (n - 1);
  let area_kNmm = 0;
  for (let i = 0; i < n - 1; i++) {
    area_kNmm += ((P[i] + P[i + 1]) / 2) * dx; // kN·mm
  }
  const deltaFriction = (area_kNmm * 1000) / stiff; // (kN→N)·mm / N = mm
  const deltaNet = Math.max(0, deltaFriction - deltaSet);

  const Pend = P[n - 1];
  const frictionLossPct = Pj > 0 ? ((Pj - Pend) / Pj) * 100 : 0;
  const gagePressureMPa = inp.ramArea && inp.ramArea > 0 ? (Pj * 1000) / inp.ramArea : 0;

  return Object.freeze({
    deltaTheoretical,
    deltaFriction,
    deltaNet,
    frictionLossPct,
    Pend,
    gagePressureMPa,
  });
}
