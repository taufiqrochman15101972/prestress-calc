/**
 * umat.ts — User-MATerial (UMAT) interface + library, after the MIDAS GTS
 * User-Supplied-Subroutine (USSR) manual (file 255) / ABAQUS UMAT concept: a
 * uniaxial constitutive routine that, given the total strain (and history state),
 * returns the stress AND the consistent tangent modulus E_t — pluggable into the
 * fiber section (fibermomentcurvature.ts) and truss/fiber-frame elements.
 *
 * 1D form (fiber/truss). Compression strain POSITIVE for concrete-style laws,
 * but steel law is sign-symmetric. Units MPa, strain dimensionless.
 */

export interface UMatOut { sigma: number; Et: number; state?: number[]; }
export type UMat = (eps: number, state?: number[]) => UMatOut;

/** Linear elastic. */
export function umatLinear(E: number): UMat {
  return (eps) => ({ sigma: E * eps, Et: E });
}

/** Hognestad concrete (nonlinear-elastic, compression +): parabola to f'c at
 *  eps0, linear softening to crushing, zero beyond; small tension stiffness fct. */
export function umatHognestad(fc: number, eps0 = 0.002, epscu = 0.0038, fct = 0): UMat {
  const Ec = (2 * fc) / eps0;
  return (eps) => {
    if (eps <= 0) {                      // tension
      const ect = fct > 0 ? fct / Ec : 0;
      if (fct > 0 && -eps < ect) return { sigma: Ec * eps, Et: Ec };
      return { sigma: 0, Et: 1e-6 };
    }
    if (eps <= eps0) return { sigma: fc * (2 * eps / eps0 - (eps / eps0) ** 2), Et: fc * (2 / eps0 - 2 * eps / eps0 ** 2) };
    if (eps <= epscu) return { sigma: fc * (1 - 0.15 * (eps - eps0) / (epscu - eps0)), Et: -fc * 0.15 / (epscu - eps0) };
    return { sigma: 0, Et: 1e-6 };       // crushed
  };
}

/** Elasto-plastic steel (bilinear, isotropic hardening E_h ≥ 0), sign-symmetric. */
export function umatElastoPlastic(E: number, fy: number, Eh = 0): UMat {
  const epsY = fy / E;
  return (eps) => {
    const a = Math.abs(eps), sgn = Math.sign(eps) || 1;
    if (a <= epsY) return { sigma: E * eps, Et: E };
    const sig = sgn * (fy + Eh * (a - epsY));
    return { sigma: sig, Et: Eh };
  };
}

/** Sample a UMAT over a monotonic strain path → stress-strain curve (USSR test). */
export interface UMatCurvePoint { eps: number; sigma: number; Et: number; }
export function computeUmatCurve(mat: UMat, epsMax: number, n = 80): {
  curve: ReadonlyArray<UMatCurvePoint>; peak: number; epsAtPeak: number;
} {
  const curve: UMatCurvePoint[] = [];
  let peak = 0, epsAtPeak = 0;
  for (let k = 0; k <= n; k++) {
    const eps = (epsMax * k) / n;
    const { sigma, Et } = mat(eps);
    curve.push({ eps, sigma, Et });
    if (Math.abs(sigma) > Math.abs(peak)) { peak = sigma; epsAtPeak = eps; }
  }
  return { curve: Object.freeze(curve), peak, epsAtPeak };
}
