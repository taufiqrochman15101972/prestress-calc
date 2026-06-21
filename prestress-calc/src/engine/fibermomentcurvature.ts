/**
 * fibermomentcurvature.ts — Nonlinear material MOMENT–CURVATURE by the FIBER
 * method with USER-MATERIAL (UMAT-style) constitutive laws (#3). The section is
 * sliced into concrete fibers + steel layers; each material returns stress from
 * strain through its own nonlinear law (Hognestad concrete with post-peak
 * softening & crushing; elastic-perfectly-plastic steel; optional prestress
 * pre-strain). For each curvature the top strain is found by Newton iteration on
 * axial equilibrium ΣF = N → the full M–φ response (cracking → yield → ultimate),
 * the engine behind fiber pushover / nonlinear time-history.
 *
 * Units SI (N, mm, MPa). Compression strain taken positive internally.
 */

export interface SteelBar { A: number; d: number; Es: number; fy: number; epsPE?: number; }
export interface FiberMCInputs {
  b: number; h: number; fc: number;
  nFib?: number;            // concrete fibers (default 40)
  eps0?: number;            // peak strain (0.002)
  epscu?: number;           // crushing strain (0.0038)
  bars: SteelBar[];         // tension/compression steel (and prestress) layers
  N?: number;               // axial load, N (compression +); 0 = pure bending
  steps?: number;
}
export interface MCPoint { phi: number; M: number; cTop: number; }
export interface FiberMCResult {
  readonly curve: ReadonlyArray<MCPoint>;
  readonly Mcr: number;     // first significant moment (~cracking proxy)
  readonly My: number;      // first-yield moment
  readonly Mu: number;      // ultimate (peak) moment, N·mm
  readonly phiU: number;    // curvature at ultimate, 1/mm
  readonly ductility: number;  // φ_u / φ_y
}

/** Hognestad concrete (compression +); tension ignored. */
function fConc(eps: number, fc: number, eps0: number, epscu: number): number {
  if (eps <= 0) return 0;
  if (eps <= eps0) return fc * (2 * eps / eps0 - (eps / eps0) ** 2);
  if (eps <= epscu) return fc * (1 - 0.15 * (eps - eps0) / (epscu - eps0));
  return 0;   // crushed
}
const fSteel = (eps: number, Es: number, fy: number) => Math.max(-fy, Math.min(fy, Es * eps));

export function computeFiberMC(i: FiberMCInputs): FiberMCResult {
  const nFib = i.nFib ?? 40, eps0 = i.eps0 ?? 0.002, epscu = i.epscu ?? 0.0038;
  const dyf = i.h / nFib, Afib = i.b * dyf, N = i.N ?? 0;
  const yc = i.h / 2;   // reference axis (centroid) from top

  // axial force & moment for given (top strain εt, curvature φ); ε(y)=εt−φ·y
  const state = (epsT: number, phi: number) => {
    let F = 0, M = 0;
    for (let k = 0; k < nFib; k++) {
      const y = (k + 0.5) * dyf;
      const eps = epsT - phi * y;
      const f = fConc(eps, i.fc, eps0, epscu);    // compression +
      F += f * Afib; M += f * Afib * (yc - y);
    }
    for (const s of i.bars) {
      const eps = epsT - phi * s.d + (s.epsPE ?? 0);
      const f = fSteel(eps, s.Es, s.fy);          // tension − relative? use as steel stress
      // steel force sign: compression (eps>0) adds +; tension subtracts (acts opposite)
      F += f * s.A; M += f * s.A * (yc - s.d);
    }
    return { F, M };
  };

  // Newton on εt so that F = N (compression +)
  const solveTop = (phi: number, guess: number) => {
    let epsT = guess;
    for (let it = 0; it < 60; it++) {
      const f0 = state(epsT, phi).F - N;
      const dEps = 1e-7;
      const f1 = state(epsT + dEps, phi).F - N;
      const dF = (f1 - f0) / dEps;
      if (Math.abs(dF) < 1e-6) break;
      const step = f0 / dF;
      epsT -= step;
      if (Math.abs(step) < 1e-9) break;
      epsT = Math.max(-0.01, Math.min(epscu * 1.2, epsT));
    }
    return epsT;
  };

  const steps = i.steps ?? 60;
  const phiMax = epscu / (0.2 * i.h);     // curvature where top reaches ~crushing
  const curve: MCPoint[] = [];
  let epsTguess = 0.0002;
  for (let s = 1; s <= steps; s++) {
    const phi = (phiMax * s) / steps;
    const epsT = solveTop(phi, epsTguess);
    epsTguess = epsT;
    const { M } = state(epsT, phi);
    curve.push({ phi, M: Math.abs(M), cTop: epsT });
    if (epsT >= epscu) break;
  }

  const Mu = Math.max(...curve.map(p => p.M));
  const phiU = curve.find(p => p.M === Mu)?.phi ?? curve[curve.length - 1].phi;
  // first yield: when extreme tension bar reaches fy (steel strain), proxy via curve knee
  const dMax = Math.max(...i.bars.map(b => b.d), i.h * 0.9);
  let My = Mu, phiY = phiU;
  for (const p of curve) {
    const epsSteel = Math.abs(p.cTop - p.phi * dMax);
    const eyield = i.bars.length ? i.bars[0].fy / i.bars[0].Es : 0.002;
    if (epsSteel >= eyield) { My = p.M; phiY = p.phi; break; }
  }
  const Mcr = curve.length ? curve[0].M : 0;
  return Object.freeze({
    curve: Object.freeze(curve), Mcr, My, Mu, phiU,
    ductility: phiY > 0 ? phiU / phiY : 1,
  });
}
