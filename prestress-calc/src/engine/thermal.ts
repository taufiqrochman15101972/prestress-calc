/**
 * Thermal Gradient Stresses — Libby "Modern Prestressed Concrete" §11-5
 * (Normal Temperature Variation), per AASHTO LRFD §3.12.3 procedure.
 *
 * A non-linear temperature gradient through the section depth produces
 * self-equilibrating ("eigenstress") fibre stresses even in a statically
 * determinate (simply-supported) beam, because plane sections must remain
 * plane.  Procedure (numbers below are user inputs, not taken from any book):
 *
 *   1. Define T(y) over the depth (AASHTO positive vertical gradient).
 *   2. Fully restrain the section → restrained stress σ_r(y) = −E·α·T(y).
 *   3. Release axial force N_r and moment M_r of σ_r (free ends) → the
 *      self-equilibrating stress is
 *         σ(y) = E·α·[ T_avg + ψ·(y − y_b) − T(y) ]
 *      with  T_avg = (1/A)∫T·b dy   and   ψ = (1/I)∫T·(y−y_b)·b dy.
 *
 * Sign convention: positive σ = tension (project-wide). All inputs SI
 * (mm, MPa, °C); α in 1/°C.
 */

import type { IGirderGeometry, GrossSectionProps } from "@/types";
import { widthAt, girderHeight } from "@/engine/section";

export interface ThermalGradientInputs {
  girder: IGirderGeometry;
  gross: GrossSectionProps;
  Ec: number;     // girder modulus (MPa)
  alpha: number;  // coefficient of thermal expansion (1/°C), ~1.08e-5 normal-weight
  T1: number;     // °C at top surface (AASHTO Zone value)
  T2: number;     // °C at 100 mm below top
  T3: number;     // °C at bottom fibre (positive gradient → small)
  nStrips?: number;
}

export interface ThermalGradientResult {
  readonly Tavg: number;        // area-weighted mean temperature (°C)
  readonly psi: number;         // thermal curvature parameter (1/mm) × ... (°C/mm)
  readonly sigmaTop: number;    // self-equilibrating stress at top fibre (MPa)
  readonly sigmaBot: number;    // at bottom fibre (MPa)
  readonly sigmaMid: number;    // at centroid (MPa)
  readonly N_restrained: number;// axial restraint force if ends fixed (kN)
  readonly M_restrained: number;// restraint moment if ends fixed (kN·m)
  readonly profile: ReadonlyArray<{ y: number; T: number; sigma: number }>;
}

/** AASHTO positive vertical temperature gradient T(y), y from bottom fibre. */
function tempAt(y: number, h: number, T1: number, T2: number, T3: number): number {
  const d = h - y; // depth from top
  let Ttop = 0;
  if (d <= 100) Ttop = T1 + (T2 - T1) * (d / 100);
  else if (d <= 300) Ttop = T2 * (1 - (d - 100) / 200); // T2 → 0 over 100..300 mm
  let Tbot = 0;
  if (y <= 200) Tbot = T3 * (1 - y / 200); // T3 at bottom → 0 at 200 mm up
  // Deep sections: top & bottom zones never overlap, so the sum is exact.
  return Ttop + Tbot;
}

export function computeThermalGradient(inp: ThermalGradientInputs): ThermalGradientResult {
  const { girder, gross, Ec, alpha, T1, T2, T3 } = inp;
  const N = inp.nStrips ?? 400;
  const h = girderHeight(girder);
  const dy = h / N;
  const A = gross.areaAg;
  const I = gross.momentOfInertiaIg;
  const yb = gross.yb;

  // ── Integrate ∫T·b dy and ∫T·(y−yb)·b dy by strips ──
  let intT = 0, intTm = 0;
  for (let i = 0; i < N; i++) {
    const y = (i + 0.5) * dy;
    const b = widthAt(girder, y);
    const T = tempAt(y, h, T1, T2, T3);
    const dA = b * dy;
    intT += T * dA;
    intTm += T * (y - yb) * dA;
  }
  const Tavg = intT / A;          // °C
  const psi  = intTm / I;         // °C/mm  (thermal curvature × ... )

  // Restraint resultants (if both ends fully fixed): σ_r = −E·α·T
  const N_restrained = -Ec * alpha * intT / 1000;             // N → kN
  const M_restrained = -Ec * alpha * intTm / 1e6;             // N·mm → kN·m

  const sigmaAt = (y: number) => {
    const T = tempAt(y, h, T1, T2, T3);
    return Ec * alpha * (Tavg + psi * (y - yb) - T);
  };

  const profile: { y: number; T: number; sigma: number }[] = [];
  const M = 24;
  for (let i = 0; i <= M; i++) {
    const y = (h * i) / M;
    profile.push({ y, T: tempAt(y, h, T1, T2, T3), sigma: sigmaAt(y) });
  }

  return Object.freeze({
    Tavg,
    psi,
    sigmaTop: sigmaAt(h),
    sigmaBot: sigmaAt(0),
    sigmaMid: sigmaAt(yb),
    N_restrained,
    M_restrained,
    profile: Object.freeze(profile),
  });
}
