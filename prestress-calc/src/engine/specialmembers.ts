/**
 * Special Prestressed Members — Pipes, Poles, Railway Sleepers
 * Krishna Raju "Prestressed Concrete" Ch.16 (circular prestressing /
 * pipes) and Ch.19 (poles, sleepers). Formulas are first-principles
 * mechanics; allowable stresses follow the suite's adopted codes
 * (ACI 318 / SNI 2847), NOT the book's worked numbers.
 *
 * Sign convention: + tension, − compression. SI: mm, MPa, kN, kN·m.
 */

// ─── 1. Circular prestressed pipe (hoop / wire winding) ──────

export interface PipeInputs {
  /** Internal diameter D_i (mm) */
  Di: number;
  /** Wall (core) thickness t (mm) */
  t: number;
  /** Working internal fluid pressure p (MPa) */
  p: number;
  /** Required residual hoop compression at working pressure (MPa, ≥0) */
  residualComp: number;
  /** Concrete strength f'c (MPa) */
  fc: number;
  /** Winding wire diameter (mm) */
  wireDia: number;
  /** Wire stress at winding σ_w (MPa) */
  sigmaWire: number;
  /** Hoop loss ratio η (effective/initial, ≈0.8) */
  eta: number;
}

export interface PipeResult {
  readonly hoopTension: number;      // N_θ = p·D_i/2 per mm length (N/mm)
  readonly sigmaHoopService: number; // fluid-induced hoop tension in wall (MPa)
  readonly sigmaPreReq: number;      // required effective hoop precompression (MPa)
  readonly sigmaPreInitial: number;  // at winding, before losses (MPa)
  readonly compAtTransfer: number;   // wall compression right after winding (MPa)
  readonly transferOk: boolean;      // ≤ 0.60·f'c? (treated as transfer condition)
  readonly wireArea: number;         // single wire area (mm²)
  readonly pitchMm: number;          // required winding pitch s (mm)
  readonly nTurnsPerM: number;       // turns per metre
  readonly testPressure: number;     // pressure at zero residual compression (MPa)
}

export function computePipe(inp: PipeInputs): PipeResult {
  const { Di, t, p, residualComp, fc, wireDia, sigmaWire, eta } = inp;

  // Thin-wall hoop tension from fluid pressure (per unit length of pipe)
  const Ntheta = (p * Di) / 2;             // N per mm of pipe length
  const sigmaHoop = Ntheta / t;            // MPa tension in the wall

  // Required effective precompression so that the wall keeps a residual
  // compression at working pressure: σ_pre,eff = σ_hoop + σ_residual
  const sigmaPreReq = sigmaHoop + residualComp;
  const sigmaPreInitial = sigmaPreReq / Math.max(eta, 1e-6);

  // Wire winding: a wire at stress σ_w wound at pitch s squeezes the core
  // with σ_c = A_w·σ_w / (s·t)  →  s = A_w·σ_w / (σ_pre,initial·t)
  const Aw = (Math.PI * wireDia * wireDia) / 4;
  const pitch = (Aw * sigmaWire) / (sigmaPreInitial * t);

  const compAtTransfer = -sigmaPreInitial;  // wall stress before fluid load
  const transferOk = Math.abs(compAtTransfer) <= 0.60 * fc;

  // Pressure at which the residual compression is exhausted (σ_wall = 0):
  // p₀·D_i/(2t) = σ_pre,eff  →  p₀ = 2·t·σ_pre,eff / D_i
  const testPressure = (2 * t * sigmaPreReq) / Di;

  return Object.freeze({
    hoopTension: Ntheta,
    sigmaHoopService: sigmaHoop,
    sigmaPreReq,
    sigmaPreInitial,
    compAtTransfer,
    transferOk,
    wireArea: Aw,
    pitchMm: pitch,
    nTurnsPerM: pitch > 0 ? 1000 / pitch : 0,
    testPressure,
  });
}

// ─── 2. Prestressed pole (annular/tapered, wind cantilever) ──

export interface PoleInputs {
  /** Pole height above ground H (m) */
  H: number;
  /** Outer diameter at base D_o (mm) */
  Do: number;
  /** Wall thickness (mm) — 0 = solid */
  tWall: number;
  /** Tip point load from conductors/cable P_tip (kN, horizontal) */
  Ptip: number;
  /** Wind pressure on the pole face (kN/m², applied on projected width) */
  windPressure: number;
  /** Average projected width of the pole (mm) for wind */
  avgWidth: number;
  /** Effective prestress force P_e (kN, concentric) */
  Pe: number;
  /** Concrete strength f'c (MPa) */
  fc: number;
}

export interface PoleResult {
  readonly A: number;            // base section area (mm²)
  readonly Z: number;            // base section modulus (mm³)
  readonly Mbase: number;        // base moment (kN·m)
  readonly sigmaAxial: number;   // −P/A (MPa)
  readonly sigmaTensFace: number;   // −P/A + M/Z (MPa)
  readonly sigmaCompFace: number;   // −P/A − M/Z (MPa)
  readonly limTens: number;      // 0.50√f'c (Class U, no cracking in service)
  readonly limComp: number;      // 0.45·f'c
  readonly tensOk: boolean;
  readonly compOk: boolean;
  readonly Mcrack: number;       // moment at f_r with prestress (kN·m)
  readonly safetyCrack: number;  // M_crack / M_base
}

export function computePole(inp: PoleInputs): PoleResult {
  const { H, Do, tWall, Ptip, windPressure, avgWidth, Pe, fc } = inp;

  const ro = Do / 2;
  const ri = tWall > 0 ? Math.max(ro - tWall, 0) : 0;
  const A = Math.PI * (ro * ro - ri * ri);
  const Iv = (Math.PI / 4) * (ro ** 4 - ri ** 4);
  const Z = Iv / ro;

  // Base moment: tip load + distributed wind on the projected face
  const wWind = windPressure * (avgWidth / 1000);          // kN/m
  const Mbase = Ptip * H + (wWind * H * H) / 2;            // kN·m

  const sigmaAxial = -(Pe * 1000) / A;
  const sigmaTensFace = sigmaAxial + (Mbase * 1e6) / Z;
  const sigmaCompFace = sigmaAxial - (Mbase * 1e6) / Z;

  const limTens = 0.50 * Math.sqrt(fc);
  const limComp = 0.45 * fc;

  // Cracking moment with concentric prestress: M_cr = Z·(f_r + P/A)
  const fr = 0.62 * Math.sqrt(fc);
  const Mcrack = (Z * (fr + (Pe * 1000) / A)) / 1e6;

  return Object.freeze({
    A, Z, Mbase,
    sigmaAxial, sigmaTensFace, sigmaCompFace,
    limTens, limComp,
    tensOk: sigmaTensFace <= limTens,
    compOk: Math.abs(sigmaCompFace) <= limComp,
    Mcrack,
    safetyCrack: Mbase > 0 ? Mcrack / Mbase : Infinity,
  });
}

// ─── 3. Railway sleeper (rail-seat + centre moments) ─────────

export interface SleeperInputs {
  /** Static axle load (kN) */
  axleLoad: number;
  /** Dynamic/impact factor i (e.g. 1.5–2.5 applied to wheel load) */
  impact: number;
  /** Sleeper length L (mm) */
  L: number;
  /** Rail gauge centre-to-centre g (mm) */
  gauge: number;
  /** Sleeper bottom width B (mm) */
  B: number;
  /** Section modulus at rail seat Z_rs (mm³) */
  Zrs: number;
  /** Section modulus at centre Z_c (mm³) */
  Zc: number;
  /** Effective prestress P_e (kN, concentric) */
  Pe: number;
  /** Cross-section area A (mm²) */
  A: number;
  /** Concrete strength f'c (MPa) */
  fc: number;
}

export interface SleeperResult {
  readonly R: number;            // dynamic rail-seat load (kN)
  readonly pBallast: number;     // uniform ballast pressure (MPa)
  readonly Mrs: number;          // rail-seat sagging moment (kN·m)
  readonly Mc: number;           // centre hogging moment (kN·m, −)
  readonly sigmaPre: number;     // −P/A (MPa)
  readonly sigmaRailSeat: number;   // bottom fibre at rail seat (MPa)
  readonly sigmaCentreTop: number;  // top fibre at centre (MPa)
  readonly limTens: number;
  readonly railSeatOk: boolean;
  readonly centreOk: boolean;
}

export function computeSleeper(inp: SleeperInputs): SleeperResult {
  const { axleLoad, impact, L, gauge, B, Zrs, Zc, Pe, A, fc } = inp;

  // Dynamic load on one rail seat
  const R = (axleLoad / 2) * impact;

  // Uniform ballast reaction under the full soffit
  const pBallast = (2 * R * 1000) / (B * L);     // MPa

  // Overhang from rail seat to sleeper end
  const a = (L - gauge) / 2;
  // Rail-seat moment: ballast pressure on the overhang cantilever
  const Mrs = (pBallast * B * a * a) / 2 / 1e6;  // kN·m (sagging at seat)
  // Centre moment: rail-seat force vs ballast reaction inboard half
  const half = L / 2;
  const McNmm = R * 1000 * (half - a) - (pBallast * B * half * half) / 2;
  const Mc = -Math.abs(McNmm) / 1e6;             // hogging (negative)

  const sigmaPre = -(Pe * 1000) / A;
  // Rail seat: sagging → bottom fibre tension
  const sigmaRailSeat = sigmaPre + (Mrs * 1e6) / Zrs;
  // Centre: hogging → top fibre tension
  const sigmaCentreTop = sigmaPre + (Math.abs(Mc) * 1e6) / Zc;

  const limTens = 0.50 * Math.sqrt(fc);

  return Object.freeze({
    R, pBallast, Mrs, Mc,
    sigmaPre, sigmaRailSeat, sigmaCentreTop,
    limTens,
    railSeatOk: sigmaRailSeat <= limTens,
    centreOk: sigmaCentreTop <= limTens,
  });
}
