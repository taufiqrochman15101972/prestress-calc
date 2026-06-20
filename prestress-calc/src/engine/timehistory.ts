/**
 * timehistory.ts — Linear DYNAMIC time-history analysis by Newmark-β direct
 * integration (average-acceleration, unconditionally stable γ=½, β=¼), MIDAS/
 * Robot "time history" style. SDOF oscillator (e.g. a pier reduced to m,k,ζ)
 * under a harmonic force or a base-acceleration record → full response history
 * u(t), v(t), a(t) + peak response and dynamic amplification.
 *
 * Units SI: m kg (=N·s²/m·1000? — keep consistent: m in ton = kN·s²/m, k kN/m,
 * force kN). Here we use SI base: m [kg], k [N/m], force [N] → u [m].
 */

export type Forcing = "HARMONIC" | "GROUND_SINE" | "PULSE";
export interface NewmarkInputs {
  m: number;        // mass, kg
  k: number;        // stiffness, N/m
  zeta: number;     // damping ratio
  dt: number;       // time step, s
  tEnd: number;     // duration, s
  forcing: Forcing;
  p0: number;       // force amplitude (HARMONIC, N) or PGA (GROUND_SINE, m/s²)
  omega: number;    // forcing circular frequency, rad/s
  u0?: number; v0?: number;   // initial conditions
}
export interface NewmarkResult {
  readonly t: ReadonlyArray<number>;
  readonly u: ReadonlyArray<number>;   // m
  readonly wn: number;   // rad/s
  readonly Tn: number;   // s
  readonly peak: number; // max |u|, m
  readonly uStatic: number;  // p0/k reference
  readonly DAF: number;      // peak / uStatic (harmonic)
}

export function computeNewmarkSDOF(i: NewmarkInputs): NewmarkResult {
  const { m, k, zeta, dt, tEnd } = i;
  const wn = Math.sqrt(k / m), Tn = (2 * Math.PI) / wn;
  const c = 2 * zeta * Math.sqrt(k * m);
  const gamma = 0.5, beta = 0.25;

  const force = (t: number): number => {
    switch (i.forcing) {
      case "HARMONIC": return i.p0 * Math.sin(i.omega * t);
      case "GROUND_SINE": return -m * i.p0 * Math.sin(i.omega * t);   // p_eff = −m·a_g
      case "PULSE": return t < 0.5 ? i.p0 : 0;
    }
  };

  const a1 = m / (beta * dt * dt) + (gamma / (beta * dt)) * c;
  const a2 = m / (beta * dt) + (gamma / beta - 1) * c;
  const a3 = (1 / (2 * beta) - 1) * m + dt * (gamma / (2 * beta) - 1) * c;
  const khat = k + a1;

  let u = i.u0 ?? 0, v = i.v0 ?? 0;
  let a = (force(0) - c * v - k * u) / m;
  const ts: number[] = [0], us: number[] = [u];
  let peak = Math.abs(u);
  const n = Math.ceil(tEnd / dt);
  for (let s = 1; s <= n; s++) {
    const t = s * dt;
    const phat = force(t) + a1 * u + a2 * v + a3 * a;
    const uNew = phat / khat;
    const vNew = (gamma / (beta * dt)) * (uNew - u) + (1 - gamma / beta) * v + dt * (1 - gamma / (2 * beta)) * a;
    const aNew = (1 / (beta * dt * dt)) * (uNew - u) - (1 / (beta * dt)) * v - (1 / (2 * beta) - 1) * a;
    u = uNew; v = vNew; a = aNew;
    ts.push(t); us.push(u);
    if (Math.abs(u) > peak) peak = Math.abs(u);
  }
  const uStatic = i.forcing === "HARMONIC" ? Math.abs(i.p0) / k : (m * Math.abs(i.p0)) / k;
  return Object.freeze({ t: Object.freeze(ts), u: Object.freeze(us), wn, Tn, peak, uStatic, DAF: uStatic > 0 ? peak / uStatic : 0 });
}
