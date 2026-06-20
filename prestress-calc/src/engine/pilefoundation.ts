/**
 * pilefoundation.ts — Deep-foundation (pile / bored-pile / drilled-shaft)
 * geotechnical analysis & design, STATIC capacity + pile-driving DYNAMICS.
 *
 * Procedure/flow after Bowles "Foundation Analysis and Design" 5th Ed,
 * Budhu "Soil Mechanics and Foundations" 3rd Ed, US Army TM 5-818-1, and the
 * Vulcanhammer "Wave Equation Page for Piling" (dynamic driving formulas).
 * Numbers in the PDFs are NOT used as code references — only the procedure.
 *
 * Units (SI): force kN · length m · soil stress kPa · concrete MPa.
 * Sign: compression capacity positive. Pure functions → Object.freeze().
 *
 * Connects to engine/substructure.ts `computePileGroup` (rigid-cap reaction
 * distribution R = P/n ± M·x/Σx²) — that gives the DEMAND per pile, this gives
 * the geotechnical CAPACITY (Qall) and settlement the pile must satisfy.
 */

export type PileInstall = "DRIVEN" | "BORED";
export type PileShape = "CIRCULAR" | "SQUARE";
export type SoilModel = "CLAY" | "SAND";

export interface PileAxialInputs {
  install: PileInstall;
  shape: PileShape;
  /** Diameter (circular) or side (square), m */
  size: number;
  /** Embedded length, m */
  length: number;
  soil: SoilModel;
  /** Soil total unit weight, kN/m³ */
  gamma: number;
  /** Water-table depth from pile head, m (≥ length ⇒ no submergence) */
  waterDepth: number;
  /** Undrained shear strength c_u, kPa (CLAY) */
  cu: number;
  /** Effective friction angle φ', deg (SAND) */
  phi: number;
  /** Factor of safety on ultimate (typ. 2.5 driven, 3.0 bored) */
  FS: number;
}

export interface PileAxialResult {
  readonly perimeter: number;   // m
  readonly tipArea: number;     // m²
  readonly alpha: number;       // adhesion factor (clay)
  readonly beta: number;        // β = K·tanδ (sand)
  readonly Nq: number;          // end-bearing factor (sand)
  readonly fsAvg: number;       // average unit skin friction, kPa
  readonly qp: number;          // unit end bearing, kPa
  readonly Qs: number;          // skin friction capacity, kN
  readonly Qp: number;          // end bearing capacity, kN
  readonly Qult: number;        // ultimate, kN
  readonly Qall: number;        // allowable, kN
  readonly sigmaVtip: number;   // effective vertical stress at tip, kPa
}

/** Adhesion factor α (API/Tomlinson-style) from c_u for driven vs bored piles. */
function adhesionAlpha(cu: number, bored: boolean): number {
  // API: α = 0.5·ψ^-0.5 (ψ≤1), 0.5·ψ^-0.25 (ψ>1), ψ = cu/σ'≈ use cu only band.
  let a: number;
  if (cu <= 25) a = 1.0;
  else if (cu >= 200) a = 0.35;
  else a = 1.0 - 0.65 * (cu - 25) / 175;       // linear band 1.0→0.35
  if (bored) a *= 0.7;                          // bored shafts mobilise less adhesion
  return Math.max(0.3, Math.min(1.0, a));
}

export function computePileAxialCapacity(i: PileAxialInputs): PileAxialResult {
  const bored = i.install === "BORED";
  const D = i.size;
  const tipArea = i.shape === "CIRCULAR" ? Math.PI * D * D / 4 : D * D;
  const perimeter = i.shape === "CIRCULAR" ? Math.PI * D : 4 * D;

  // Effective unit weight (buoyant below water table).
  const gammaW = 9.81;
  const submerged = i.waterDepth < i.length;
  const gEffMid = submerged && i.waterDepth <= i.length / 2 ? i.gamma - gammaW : i.gamma;
  const gEffTip = submerged ? i.gamma - gammaW : i.gamma;
  const sigmaVmid = gEffMid * (i.length / 2);
  const sigmaVtip = gEffTip * i.length;

  let alpha = 0, beta = 0, Nq = 0, fsAvg = 0, qp = 0;

  if (i.soil === "CLAY") {
    // α-method skin friction + N_c·c_u end bearing (N_c = 9 for deep piles).
    alpha = adhesionAlpha(i.cu, bored);
    fsAvg = alpha * i.cu;
    qp = 9 * i.cu;
  } else {
    // β-method (effective stress) skin friction + σ'_v·N_q end bearing.
    const phiR = (i.phi * Math.PI) / 180;
    // K (lateral earth-pressure on shaft): driven ≈ 1.0·K0..1.5, bored ≈ K0.
    const K0 = 1 - Math.sin(phiR);
    const K = bored ? K0 : 1.4 * K0;
    const delta = (bored ? 1.0 : 0.8) * phiR;    // interface friction angle
    beta = K * Math.tan(delta);
    fsAvg = beta * sigmaVmid;
    // Berezantsev/Meyerhof bearing factor N_q = e^(π tanφ)·tan²(45+φ/2).
    Nq = Math.exp(Math.PI * Math.tan(phiR)) * Math.tan(Math.PI / 4 + phiR / 2) ** 2;
    if (bored) Nq *= 0.6;                         // bored-shaft tip disturbance
    qp = sigmaVtip * Nq;
  }

  const Qs = fsAvg * perimeter * i.length;
  const Qp = qp * tipArea;
  const Qult = Qs + Qp;
  const Qall = Qult / i.FS;

  return Object.freeze({
    perimeter, tipArea, alpha, beta, Nq, fsAvg, qp,
    Qs, Qp, Qult, Qall, sigmaVtip,
  });
}

// ─── Pile group: efficiency + block failure ──────────────────────────────

export interface PileGroupCapInputs {
  rows: number;            // m
  cols: number;            // n
  spacing: number;         // centre-to-centre, m
  size: number;            // pile diameter/side, m
  length: number;          // m
  QultSingle: number;      // single-pile ultimate, kN
  soil: SoilModel;
  cu: number;              // kPa (clay block failure)
  FS: number;
}

export interface PileGroupCapResult {
  readonly nPiles: number;
  readonly efficiency: number;     // Converse-Labarre η
  readonly QgroupIndiv: number;    // η·n·Qult, kN
  readonly Qblock: number;         // block failure, kN (clay)
  readonly Qgroup: number;         // governing ultimate, kN
  readonly QgroupAll: number;      // allowable, kN
  readonly Bg: number; readonly Lg: number;
}

export function computePileGroupCapacity(i: PileGroupCapInputs): PileGroupCapResult {
  const n = i.cols, m = i.rows, nPiles = n * m;
  const theta = (Math.atan(i.size / i.spacing) * 180) / Math.PI;   // deg
  // Converse–Labarre group efficiency.
  const eff = 1 - (theta / 90) * ((n - 1) * m + (m - 1) * n) / (m * n);
  const QgroupIndiv = eff * nPiles * i.QultSingle;

  // Block (perimeter-shear + base) capacity — governs for closely-spaced clay.
  const Bg = (m - 1) * i.spacing + i.size;
  const Lg = (n - 1) * i.spacing + i.size;
  let Qblock = Infinity;
  if (i.soil === "CLAY") {
    const Nc = 9;
    Qblock = 2 * (Bg + Lg) * i.length * i.cu + Nc * i.cu * (Bg * Lg);
  }
  const Qgroup = Math.min(QgroupIndiv, Qblock);
  return Object.freeze({
    nPiles, efficiency: eff, QgroupIndiv, Qblock,
    Qgroup, QgroupAll: Qgroup / i.FS, Bg, Lg,
  });
}

// ─── Pile settlement (Vesic semi-empirical) ──────────────────────────────

export interface PileSettlementInputs {
  Qp: number;        // working point load, kN
  Qs: number;        // working skin load, kN
  length: number;    // m
  size: number;      // m
  tipArea: number;   // m²
  perimeter: number; // m
  Ep: number;        // pile modulus, MPa (≈ 4700√fc for concrete)
  Es: number;        // soil modulus, MPa
  mu: number;        // soil Poisson
}

export interface PileSettlementResult {
  readonly s1: number; readonly s2: number; readonly s3: number;
  readonly total: number;       // mm
  readonly allowable: number;   // mm
  readonly ok: boolean;
}

export function computePileSettlement(i: PileSettlementInputs): PileSettlementResult {
  // s1 — axial elastic compression of the pile shaft, ξ ≈ 0.6 (parabolic skin).
  const xi = 0.6;
  const EpkPa = i.Ep * 1000, EskPa = i.Es * 1000;
  const s1 = ((i.Qp + xi * i.Qs) * i.length) / (i.tipArea * EpkPa);   // m
  // s2 — settlement from load at tip (Vesic), Iwp ≈ 0.85.
  const qp = i.Qp / i.tipArea;          // kPa
  const Iwp = 0.85;
  const s2 = (qp * i.size * (1 - i.mu * i.mu) * Iwp) / EskPa;          // m
  // s3 — settlement from skin load, Iws = 2 + 0.35√(L/D).
  const fs = i.Qs / (i.perimeter * i.length);   // kPa
  const Iws = 2 + 0.35 * Math.sqrt(i.length / i.size);
  const s3 = (fs * i.size * (1 - i.mu * i.mu) * Iws) / EskPa;          // m
  const total = (s1 + s2 + s3) * 1000;          // mm
  const allowable = Math.max(25, 0.1 * i.size * 1000);    // 25 mm or 0.1D
  return Object.freeze({
    s1: s1 * 1000, s2: s2 * 1000, s3: s3 * 1000,
    total, allowable, ok: total <= allowable,
  });
}

// ─── Lateral capacity — Broms method ─────────────────────────────────────

export interface LateralPileInputs {
  soil: SoilModel;
  size: number;       // m
  length: number;     // m
  /** load eccentricity above ground, m */
  e: number;
  cu: number;         // kPa (clay)
  phi: number;        // deg (sand)
  gamma: number;      // kN/m³
  /** pile yield moment, kN·m */
  Myield: number;
  headFixed: boolean;
}

export interface LateralPileResult {
  readonly Kp: number;
  readonly HuShort: number;    // kN
  readonly HuLong: number;     // kN
  readonly Hu: number;         // governing, kN
  readonly mode: string;
}

export function computeLateralPileBroms(i: LateralPileInputs): LateralPileResult {
  const D = i.size, L = i.length, e = i.e;
  const phiR = (i.phi * Math.PI) / 180;
  const Kp = i.soil === "SAND" ? Math.tan(Math.PI / 4 + phiR / 2) ** 2 : 0;
  let HuShort: number, HuLong: number;

  if (i.soil === "CLAY") {
    // Broms cohesive. Soil reaction 9·cu·D below 1.5D depth.
    const k = 9 * i.cu * D;     // kN/m
    // Short, free-head: Hu = k·L'·(...). Use simplified Broms closed form.
    const Lp = L - 1.5 * D;
    HuShort = i.headFixed
      ? (9 * i.cu * D * (L - 1.5 * D))            // fixed-head short
      : (9 * i.cu * D * Lp * Lp) / (2 * (e + 1.5 * D + 0.5 * Lp) + 1e-9);
    // Long pile: governed by yield moment. Mmax at f = Hu/(9·cu·D) below 1.5D.
    // Hu·(e+1.5D+0.5f) = Myield → solve quadratic in Hu.
    // f = Hu/k ⇒ Myield = Hu(e+1.5D) + Hu²/(2k)
    const a = 1 / (2 * k), b = (e + 1.5 * D), cc = -i.Myield;
    HuLong = (-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a);
    if (i.headFixed) HuLong *= 2;     // fixed-head ≈ 2× free-head (Broms)
  } else {
    // Broms cohesionless. Passive triangular soil reaction.
    HuShort = i.headFixed
      ? (1.5 * i.gamma * D * L * L * L * Kp) / (e + L + 1e-9)
      : (0.5 * i.gamma * D * L * L * L * Kp) / (e + L + 1e-9);
    // Long pile: Mmax = Hu(e + 0.54·√(Hu/(γ·D·Kp))) = Myield → iterate.
    let Hu = HuShort;
    for (let k = 0; k < 40; k++) {
      const f = 0.54 * Math.sqrt(Math.max(Hu, 1) / (i.gamma * D * Kp));
      Hu = i.Myield / (e + f + 1e-9);
    }
    HuLong = i.headFixed ? 2 * Hu : Hu;
  }
  const Hu = Math.min(HuShort, HuLong);
  return Object.freeze({
    Kp, HuShort, HuLong, Hu,
    mode: HuShort <= HuLong ? "tiang pendek (rotasi tanah)" : "tiang panjang (leleh momen)",
  });
}

// ─── Dynamic pile driving formulas (set per blow → capacity) ─────────────

export type DrivingFormula = "ENR" | "MODIFIED_ENR" | "HILEY" | "JANBU";

export interface PileDrivingInputs {
  formula: DrivingFormula;
  /** rated hammer energy per blow, kN·m */
  Eh: number;
  /** hammer efficiency η_h (0.7–0.9) */
  eff: number;
  /** permanent set per blow, mm */
  set: number;
  /** ram weight, kN */
  Wr: number;
  /** pile (+cap) weight, kN */
  Wp: number;
  /** coefficient of restitution n (0.25 timber – 0.5 steel) */
  nRest: number;
  /** elastic compression sum c1+c2+c3 for Hiley, mm */
  cElastic: number;
  /** pile length & section for Janbu */
  length: number;   // m
  Ap: number;       // m²
  Ep: number;       // MPa
  FS: number;
}

export interface PileDrivingResult {
  readonly Ru: number;     // ultimate driving resistance, kN
  readonly Ra: number;     // allowable, kN
  readonly setM: number;   // m
  readonly note: string;
}

export function computePileDriving(i: PileDrivingInputs): PileDrivingResult {
  const s = i.set / 1000;             // m
  const E = i.eff * i.Eh;             // delivered energy, kN·m
  let Ru = 0, note = "";

  switch (i.formula) {
    case "ENR": {
      // Engineering News-Record: Ru = E/(s + C), C = 2.54 mm (modern).
      const C = 0.00254;
      Ru = E / (s + C);
      note = "ENR (C=2.54 mm); FS tinggi (≈6).";
      break;
    }
    case "MODIFIED_ENR": {
      const C = 0.00254;
      Ru = (E / (s + C)) * (i.Wr + i.nRest * i.nRest * i.Wp) / (i.Wr + i.Wp);
      note = "Modified ENR (efisiensi + restitusi).";
      break;
    }
    case "HILEY": {
      const c = i.cElastic / 1000;    // m
      Ru = (E / (s + 0.5 * c)) * (i.Wr + i.nRest * i.nRest * i.Wp) / (i.Wr + i.Wp);
      note = "Hiley (kompresi elastik c1+c2+c3).";
      break;
    }
    case "JANBU": {
      const lamE = (E * i.length) / (i.Ap * (i.Ep * 1000) * s * s + 1e-12);
      const Cd = 0.75 + 0.14 * (i.Wp / i.Wr);
      const Ku = Cd * (1 + Math.sqrt(1 + lamE / Cd));
      Ru = E / (Ku * s);
      note = "Janbu (Ku dari λe & Cd).";
      break;
    }
  }
  return Object.freeze({ Ru, Ra: Ru / i.FS, setM: s, note });
}
