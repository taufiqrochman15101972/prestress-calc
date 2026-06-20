/**
 * straincompat.ts — Ultimate flexural analysis by STRAIN COMPATIBILITY (layered),
 * after Naaman "Ultimate analysis of prestressed and partially prestressed
 * sections by strain compatibility" (PCI J.) + ACI/AASHTO. Works seamlessly for
 * FULL (only prestress) and PARTIAL (prestress + mild steel) sections — the
 * neutral axis is found from real layer strains/stresses, not the approximate
 * f_ps formula in uls.ts (which this complements/validates). Honours the
 * project-wide εcu = 0.003 strain-control philosophy.
 *
 * Sign: compression block from top; tension steel below NA. Units SI (N, mm, MPa).
 */
import { beta1, phiFromStrain } from "./substructure";

export type LayerKind = "PS" | "RC";
export interface SteelLayer {
  kind: LayerKind;
  A: number;        // area, mm²
  d: number;        // depth from top compression fibre, mm
  // PS:
  Eps?: number; fpu?: number; fpy?: number; epsPE?: number;   // effective prestrain
  // RC:
  Es?: number; fy?: number;
}
export interface StrainCompatInputs {
  b: number;        // compression width (rect or effective flange), mm
  h: number;        // overall depth, mm
  fc: number;       // MPa
  ecu?: number;     // ultimate concrete strain (default 0.003)
  layers: SteelLayer[];
}
export interface LayerResult {
  kind: LayerKind; d: number; A: number;
  strain: number; stress: number; force: number;   // MPa, N (tension +)
}
export interface StrainCompatResult {
  readonly c: number;          // neutral axis, mm
  readonly a: number;          // Whitney block, mm
  readonly beta1: number;
  readonly Cc: number;         // concrete compression, N
  readonly layers: ReadonlyArray<LayerResult>;
  readonly Mn: number;         // N·mm
  readonly phi: number;
  readonly phiMn: number;      // N·mm
  readonly epsT: number;       // extreme tension-steel strain
  readonly tensionControlled: boolean;
  readonly converged: boolean;
}

/** PS tendon stress–strain (bilinear w/ strain hardening; Grade-aware). */
function fps(eps: number, Eps: number, fpu: number, fpy: number): number {
  if (eps <= 0) return Eps * eps;          // (rare) compression branch, linear
  const epy = fpy / Eps, esu = 0.04;
  if (eps <= epy) return Eps * eps;
  const f = fpy + (fpu - fpy) * (eps - epy) / (esu - epy);
  return Math.min(f, fpu);
}
function fsRC(eps: number, Es: number, fy: number): number {
  return Math.max(-fy, Math.min(fy, Es * eps));
}

export function computeStrainCompatibility(i: StrainCompatInputs): StrainCompatResult {
  const ecu = i.ecu ?? 0.003;
  const b1 = beta1(i.fc);

  // net steel force (tension +) and equilibrium residual g(c) = Cc − ΣT
  const eval_c = (c: number) => {
    const a = Math.min(b1 * c, i.h);
    const Cc = 0.85 * i.fc * i.b * a;        // N (compression)
    let T = 0;
    const layers: LayerResult[] = i.layers.map(L => {
      const dStrain = ecu * (L.d - c) / c;   // + = tension (d>c)
      let strain = dStrain, stress = 0;
      if (L.kind === "PS") {
        strain = (L.epsPE ?? 0) + dStrain;
        stress = fps(strain, L.Eps ?? 197000, L.fpu ?? 1860, L.fpy ?? 1674);
      } else {
        stress = fsRC(strain, L.Es ?? 200000, L.fy ?? 420);
      }
      const force = L.A * stress;             // tension +
      T += force;
      return { kind: L.kind, d: L.d, A: L.A, strain, stress, force };
    });
    return { a, Cc, T, layers, g: Cc - T };
  };

  // bisection on c (g increases with c)
  let lo = 0.02 * i.h, hi = i.h, c = 0.4 * i.h, converged = false;
  let glo = eval_c(lo).g, ghi = eval_c(hi).g;
  if (glo * ghi > 0) { c = glo < 0 ? hi : lo; }   // fallback
  else {
    for (let k = 0; k < 80; k++) {
      c = 0.5 * (lo + hi);
      const g = eval_c(c).g;
      if (Math.abs(g) < 1) { converged = true; break; }
      if (glo * g <= 0) { hi = c; ghi = g; } else { lo = c; glo = g; }
    }
    converged = true;
  }

  const st = eval_c(c);
  // moments about top compression fibre: Mn = ΣT·d − Cc·(a/2)
  let Mn = -st.Cc * (st.a / 2);
  for (const L of st.layers) Mn += L.force * L.d;
  const dt = Math.max(...i.layers.map(L => L.d));
  const epsT = ecu * (dt - c) / c;
  const fyRef = i.layers.find(L => L.kind === "RC")?.fy ?? 420;
  const { phi } = phiFromStrain(epsT, fyRef);
  return Object.freeze({
    c, a: st.a, beta1: b1, Cc: st.Cc, layers: Object.freeze(st.layers),
    Mn, phi, phiMn: phi * Mn, epsT, tensionControlled: epsT >= 0.005, converged,
  });
}
