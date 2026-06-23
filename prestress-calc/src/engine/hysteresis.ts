/**
 * hysteresis.ts — NONLINEAR hysteretic cyclic & seismic response.
 *
 * Fills the gap left by the *linear* `timehistory.ts` (Newmark) and the
 * capacity-design `seismicdynamics.ts`/`pushover.ts`: a genuine rate-independent
 * hysteresis constitutive layer + nonlinear step-by-step dynamics with strength/
 * stiffness degradation, pinching, ductility & energy demand, plus energy-based
 * damage assessment and a masonry-infill equivalent diagonal strut.
 *
 * References (procedure/sequence only — NOT their numbers): mathematical models
 * of hysteresis (Bouc-Wen / Takeda family), degrading SDOF nonlinear dynamics
 * (ENGLTHA-style in-cycle + cyclic strength degradation, stiffness degradation,
 * pinching), energy-based seismic assessment of RC columns (Park-Ang), and the
 * Mainstone/FEMA-356 equivalent strut for infilled RC frames.
 *
 * Units SI: stiffness k [kN/m] or [N/m] (caller-consistent), force F same/length,
 * displacement u [m], mass m [kg] with k [N/m] → consistent dynamics; energy in
 * F·u units. Sign convention follows the project: tension/“push” positive.
 */

export type HysteresisModel = "BILINEAR" | "BOUCWEN" | "TAKEDA";

export interface HysteresisParams {
  model: HysteresisModel;
  k0: number;          // initial (elastic) stiffness
  Fy: number;          // yield force
  alpha: number;       // post-yield stiffness ratio k1/k0 (0 = elasto-plastic)
  // Bouc-Wen smooth-hysteresis shape parameters:
  A?: number;          // default 1
  beta?: number;       // default 0.5
  gamma?: number;      // default 0.5
  n?: number;          // sharpness, default 1
  // Takeda / degradation:
  stiffDegr?: number;  // unloading-stiffness degradation exponent β_s (0 = none)
  pinch?: number;      // pinching factor 0..1 (1 = no pinch); reload force scale
}

export interface HystState {
  u: number;           // current displacement
  F: number;           // current total force
  q: number;           // back-force (kinematic hardening) / Bouc-Wen hysteretic part
  z: number;           // Bouc-Wen dimensionless hysteretic variable
  uMaxPos: number;     // peak positive excursion (for Takeda)
  uMaxNeg: number;     // peak negative excursion
  kT: number;          // current tangent stiffness
}

const dflt = (p: HysteresisParams) => ({
  A: p.A ?? 1, beta: p.beta ?? 0.5, gamma: p.gamma ?? 0.5, n: p.n ?? 1,
  stiffDegr: p.stiffDegr ?? 0, pinch: p.pinch ?? 1,
});

export function initState(): HystState {
  return { u: 0, F: 0, q: 0, z: 0, uMaxPos: 0, uMaxNeg: 0, kT: 0 };
}

/** Hardening modulus (force/length) giving post-yield tangent k1 = α·k0. */
function hardMod(p: HysteresisParams): number {
  const a = p.alpha;
  return a >= 1 ? Number.POSITIVE_INFINITY : (a * p.k0) / (1 - a);
}

// ── Bilinear kinematic-hardening return mapping ────────────────────────────
function stepBilinear(p: HysteresisParams, s: HystState, u: number): HystState {
  const du = u - s.u;
  const Ftr = s.F + p.k0 * du;          // elastic predictor
  const xi = Ftr - s.q;
  const fy = Math.abs(xi) - p.Fy;
  if (fy <= 0) {                         // elastic
    return { ...s, u, F: Ftr, kT: p.k0 };
  }
  const Hd = hardMod(p);
  const sgn = Math.sign(xi);
  const dup = fy / (p.k0 + (isFinite(Hd) ? Hd : p.k0)); // plastic disp increment
  const F = Ftr - p.k0 * sgn * dup;
  const q = s.q + (isFinite(Hd) ? Hd : 0) * sgn * dup;
  return { ...s, u, F, q, kT: p.alpha * p.k0 };
}

// ── Bouc-Wen smooth hysteresis ─────────────────────────────────────────────
// ż = A·u̇ − β|u̇||z|^(n−1)z − γ·u̇|z|^n ;  F = α·k0·u + (1−α)·k0·z
function stepBoucWen(p: HysteresisParams, s: HystState, u: number): HystState {
  const { A, beta, gamma, n } = dflt(p);
  const uy = p.Fy / p.k0;               // yield displacement → normalizes z to be dimensionless
  const du = u - s.u;
  // Sub-step the dimensionless z-ODE for accuracy on coarse displacement increments.
  const NS = 8;
  let z = s.z;
  const dStep = du / NS;
  for (let i = 0; i < NS; i++) {
    const za = Math.abs(z);
    const dz = (A * dStep - beta * Math.abs(dStep) * Math.pow(za, n - 1) * z - gamma * dStep * Math.pow(za, n)) / uy;
    z += dz;
  }
  // F = α·k0·u + (1−α)·Fy·z   (z dimensionless, saturates at z_max=(A/(β+γ))^(1/n))
  const F = p.alpha * p.k0 * u + (1 - p.alpha) * p.Fy * z;
  const za = Math.abs(z);
  const dzdu = (A - beta * Math.sign(du) * Math.pow(za, n - 1) * z - gamma * Math.pow(za, n)) / uy;
  const kT = p.alpha * p.k0 + (1 - p.alpha) * p.Fy * dzdu;
  return { ...s, u, F, z, kT };
}

// ── Takeda degrading-stiffness (RC) with optional pinching ─────────────────
function stepTakeda(p: HysteresisParams, s: HystState, u: number): HystState {
  const { stiffDegr, pinch } = dflt(p);
  const uy = p.Fy / p.k0;
  const du = u - s.u;
  const loading = Math.sign(du) === Math.sign(s.F) || s.F === 0;
  // Backbone (bilinear) target force
  const bil = stepBilinear(p, s, u);
  if (loading) {
    // on the backbone / virgin loading → bilinear envelope
    const uMaxPos = Math.max(s.uMaxPos, u);
    const uMaxNeg = Math.min(s.uMaxNeg, u);
    return { ...bil, uMaxPos, uMaxNeg };
  }
  // Unloading/reloading: degraded stiffness k_unl = k0·(uy/umax)^β_s
  const umax = Math.max(Math.abs(s.uMaxPos), Math.abs(s.uMaxNeg), uy);
  const kUnl = p.k0 * Math.pow(uy / umax, stiffDegr) * pinch;
  const F = s.F + kUnl * du;
  // clamp to backbone envelope
  const Fenv = bil.F;
  const F2 = Math.abs(F) > Math.abs(Fenv) && Math.sign(F) === Math.sign(Fenv) ? Fenv : F;
  return { ...s, u, F: F2, kT: kUnl, uMaxPos: Math.max(s.uMaxPos, u), uMaxNeg: Math.min(s.uMaxNeg, u) };
}

export function hystStep(p: HysteresisParams, s: HystState, u: number): HystState {
  switch (p.model) {
    case "BILINEAR": return stepBilinear(p, s, u);
    case "BOUCWEN": return stepBoucWen(p, s, u);
    case "TAKEDA": return stepTakeda(p, s, u);
  }
}

// ── Trace a prescribed displacement history → force history + energy ────────
export interface HystTrace {
  readonly u: ReadonlyArray<number>;
  readonly F: ReadonlyArray<number>;
  readonly energyCum: ReadonlyArray<number>; // cumulative ∮F du (absorbed)
  readonly EdTotal: number;
}
export function traceHysteresis(p: HysteresisParams, disp: ReadonlyArray<number>): HystTrace {
  let s = initState();
  const u: number[] = [], F: number[] = [], E: number[] = [];
  let energy = 0;
  s = hystStep(p, s, disp[0]); u.push(s.u); F.push(s.F); E.push(0);
  for (let i = 1; i < disp.length; i++) {
    const prevF = s.F, prevU = s.u;
    s = hystStep(p, s, disp[i]);
    energy += 0.5 * (s.F + prevF) * (s.u - prevU);
    u.push(s.u); F.push(s.F); E.push(energy);
  }
  return Object.freeze({ u: Object.freeze(u), F: Object.freeze(F), energyCum: Object.freeze(E), EdTotal: energy });
}

/** Build a symmetric increasing-amplitude cyclic protocol (triangular). */
export function cyclicProtocol(amps: ReadonlyArray<number>, ptsPerQuarter = 25): number[] {
  const d: number[] = [0];
  const ramp = (from: number, to: number) => {
    for (let i = 1; i <= ptsPerQuarter; i++) d.push(from + (to - from) * (i / ptsPerQuarter));
  };
  for (const a of amps) { ramp(0, a); ramp(a, -a); ramp(-a, 0); }
  return d;
}

// ── Equivalent viscous damping from one symmetric loop ─────────────────────
export interface CycleResult {
  amp: number; Fmax: number; kSec: number; Ed: number; xiEq: number;
}
export function cyclicAssessment(p: HysteresisParams, amps: ReadonlyArray<number>, ptsPerQuarter = 50): CycleResult[] {
  const out: CycleResult[] = [];
  const q = ptsPerQuarter;
  for (const a of amps) {
    // 0→+a (q pts), then one CLOSED steady cycle +a→−a→+a (4q pts) — measure
    // the dissipated area over the closed cycle only (skip the first quarter).
    const disp: number[] = [0];
    const ramp = (from: number, to: number, np: number) => {
      for (let i = 1; i <= np; i++) disp.push(from + (to - from) * (i / np));
    };
    ramp(0, a, q); ramp(a, -a, 2 * q); ramp(-a, a, 2 * q);
    const tr = traceHysteresis(p, disp);
    let Fmax = 0;
    for (const f of tr.F) Fmax = Math.max(Fmax, Math.abs(f));
    const iStart = q;                 // index of first +a peak
    const Ed = tr.energyCum[tr.energyCum.length - 1] - tr.energyCum[iStart]; // closed-loop area
    const kSec = Fmax / a;
    const Eso = 0.5 * kSec * a * a;
    const xiEq = Eso > 0 ? Ed / (4 * Math.PI * Eso) : 0;
    out.push({ amp: a, Fmax, kSec, Ed, xiEq });
  }
  return out;
}

// ── Nonlinear time-history (Newmark-β average accel + Newton-Raphson) ───────
export interface NLTHInputs {
  p: HysteresisParams;
  m: number;            // mass (kg)  with k0 in N/m
  zeta: number;         // viscous damping ratio (in addition to hysteresis)
  dt: number;
  ag: ReadonlyArray<number>;  // ground acceleration record (m/s²)
}
export interface NLTHResult {
  readonly t: ReadonlyArray<number>;
  readonly u: ReadonlyArray<number>;
  readonly peak: number;
  readonly uy: number;
  readonly mu: number;          // displacement ductility demand
  readonly Einput: number;      // input energy (relative)
  readonly Ehyst: number;       // hysteretic dissipated energy
  readonly wn: number; readonly Tn: number;
  readonly residual: number;    // permanent (residual) displacement
}
export function nonlinearTH(inp: NLTHInputs): NLTHResult {
  const { p, m, zeta, dt, ag } = inp;
  const wn = Math.sqrt(p.k0 / m), Tn = (2 * Math.PI) / wn;
  const c = 2 * zeta * Math.sqrt(p.k0 * m);
  const gamma = 0.5, beta = 0.25;
  const c1 = 1 / (beta * dt * dt);
  const c2 = gamma / (beta * dt);
  const c2m = 1 / (beta * dt);
  const c3m = 1 / (2 * beta) - 1;

  let s = initState();
  let u = 0, v = 0;
  let a = (-m * ag[0] - c * v - 0) / m;
  const ts: number[] = [0], us: number[] = [0];
  let peak = 0, Einput = 0, Ehyst = 0, prevU = 0, prevFint = 0;

  for (let i = 1; i < ag.length; i++) {
    const pEff = -m * ag[i];
    const up = u, vp = v, ap = a;
    let uIter = up;                      // initial guess
    // Newton iterations on equilibrium g(u)=pEff − m·a − c·v − Fint
    for (let it = 0; it < 30; it++) {
      const aN = c1 * (uIter - up) - c2m * vp - c3m * ap;
      const vN = vp + dt * (1 - gamma) * ap + gamma * dt * aN;
      const st = hystStep(p, s, uIter);
      const g = pEff - m * aN - c * vN - st.F;
      const kEff = m * c1 + c * c2 + st.kT;
      const dU = g / kEff;
      uIter += dU;
      if (Math.abs(dU) < 1e-12) break;
    }
    // commit
    s = hystStep(p, s, uIter);
    u = uIter;
    a = c1 * (u - up) - c2m * vp - c3m * ap;
    v = vp + dt * (1 - gamma) * ap + gamma * dt * a;

    const du = u - prevU;
    Einput += -m * 0.5 * (ag[i] + ag[i - 1]) * du;
    Ehyst += 0.5 * (s.F + prevFint) * du;
    prevU = u; prevFint = s.F;
    if (Math.abs(u) > peak) peak = Math.abs(u);
    ts.push(i * dt); us.push(u);
  }
  const uy = p.Fy / p.k0;
  // hysteretic dissipation ≈ absorbed − recoverable elastic strain energy
  const Erec = 0.5 * (s.F * s.F) / p.k0;
  return Object.freeze({
    t: Object.freeze(ts), u: Object.freeze(us), peak, uy,
    mu: uy > 0 ? peak / uy : 0, Einput, Ehyst: Math.max(0, Ehyst - Erec),
    wn, Tn, residual: u,
  });
}

// ── Park-Ang damage index (energy-based assessment) ────────────────────────
export interface ParkAng {
  DI: number; deformationTerm: number; energyTerm: number; state: string;
}
export function parkAngDamage(
  muDemand: number, muCapacity: number, Ehyst: number, Fy: number, uy: number, betaPA = 0.10
): ParkAng {
  const uu = muCapacity * uy;
  const deformationTerm = muDemand / muCapacity;
  const energyTerm = (betaPA * Ehyst) / (Fy * uu);
  const DI = deformationTerm + energyTerm;
  const state =
    DI < 0.1 ? "tanpa kerusakan" :
    DI < 0.25 ? "kerusakan ringan" :
    DI < 0.4 ? "kerusakan sedang" :
    DI < 1.0 ? "kerusakan berat (dapat diperbaiki)" : "runtuh / kolaps";
  return Object.freeze({ DI, deformationTerm, energyTerm, state });
}

// ── Mainstone / FEMA-356 masonry-infill equivalent diagonal strut ──────────
export interface InfillInputs {
  Em: number;     // masonry modulus (MPa)
  tInf: number;   // infill thickness (mm)
  hInf: number;   // infill height (mm)
  LInf: number;   // infill length (mm)
  Ec: number;     // column concrete modulus (MPa)
  Icol: number;   // column moment of inertia (mm⁴)
  hCol: number;   // column height (mm)
  fmPrime?: number; // masonry compressive strength (MPa) for strut capacity
}
export interface InfillResult {
  theta: number;       // strut inclination (rad)
  rInf: number;        // diagonal length (mm)
  lambda1: number;     // 1/mm
  aStrut: number;      // equivalent strut width (mm)
  Astrut: number;      // strut area (mm²)
  kLateral: number;    // lateral stiffness contribution (N/mm)
  Vstrut: number;      // lateral strength from strut crushing (kN), if fmPrime given
}
export function infillStrut(i: InfillInputs): InfillResult {
  const theta = Math.atan(i.hInf / i.LInf);
  const rInf = Math.hypot(i.LInf, i.hInf);
  // λ1 = [ Em·t·sin(2θ) / (4·Ec·Icol·hInf) ]^0.25   (Stafford-Smith / Mainstone)
  const lambda1 = Math.pow((i.Em * i.tInf * Math.sin(2 * theta)) / (4 * i.Ec * i.Icol * i.hInf), 0.25);
  const aStrut = 0.175 * Math.pow(lambda1 * i.hCol, -0.4) * rInf;
  const Astrut = aStrut * i.tInf;
  // lateral stiffness of a single diagonal strut: A·E/r · cos²θ
  const kLateral = (Astrut * i.Em / rInf) * Math.cos(theta) * Math.cos(theta);
  const Vstrut = i.fmPrime ? (i.fmPrime * Astrut * Math.cos(theta)) / 1000 : 0;
  return Object.freeze({ theta, rInf, lambda1, aStrut, Astrut, kLateral, Vstrut });
}
