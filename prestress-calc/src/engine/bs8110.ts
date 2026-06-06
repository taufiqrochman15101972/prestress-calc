/**
 * BS 8110 Prestressed Concrete — Kong & Evans, Ch. 9
 * British Standard treatment, parallel to the ACI 318 engine.
 *
 *   §9.1  Member classes 1 / 2 / 3 (permissible service tension)
 *   §9.5  ULS flexure:  Mu = fpb·Aps·(d − 0.45x)
 *   §9.6  ULS shear:    Vco (uncracked) and Vcr (cracked)
 *
 * Notation: fcu = characteristic cube strength (MPa); fpu = strand
 * characteristic strength; fpe = effective prestress; fpb = design
 * tendon stress at failure. All forces N/kN, lengths mm, stress MPa.
 *
 * NOTE: structure & procedure follow Kong & Evans; numeric coefficients
 * are the published BS 8110 values, not taken from the scanned examples.
 */

import type { BSMemberClass } from "@/types";

// ─── §9.1 Member class permissible service tension ───────────
// Class 1: no tension. Class 2: tension up to 0.45√fcu (pre-tens) /
// 0.36√fcu (post-tens), no visible cracking. Class 3: cracked, design
// crack width 0.1 mm (very severe) or 0.2 mm (others).

export interface BSClassLimits {
  readonly cls: BSMemberClass;
  /** Permissible service tensile stress (MPa, + = tension) */
  readonly permTension: number;
  /** Permissible service compressive stress (MPa, magnitude) */
  readonly permCompression: number;
  readonly description: string;
}

export function bsClassLimits(
  cls: BSMemberClass,
  fcu: number,
  pretensioned: boolean
): BSClassLimits {
  const sqrtFcu = Math.sqrt(fcu);
  let permTension: number;
  let description: string;
  switch (cls) {
    case "1":
      permTension = 1.0; // ~1 MPa nominal (BS allows 1 N/mm² at transfer)
      description = "Class 1 — tanpa tarik (no tension)";
      break;
    case "2":
      permTension = pretensioned ? 0.45 * sqrtFcu : 0.36 * sqrtFcu;
      description = "Class 2 — tanpa retak terlihat (no visible cracking)";
      break;
    case "3":
      // Class 3 "cracked" — hypothetical tensile stress (design crack width)
      permTension = pretensioned ? 0.55 * sqrtFcu + 4 : 0.55 * sqrtFcu;
      description = "Class 3 — retak terkontrol (≤0.1–0.2 mm)";
      break;
  }
  return Object.freeze({
    cls,
    permTension,
    permCompression: 0.33 * fcu, // BS 8110 service compression at extreme fibre
    description,
  });
}

// ─── §9.5 ULS flexure (BS 8110 rectangular stress block) ─────
// Mu = fpb·Aps·(d − 0.45x).
// Bonded tendons: fpb/(0.87fpu) and x/d from Table 9.5-1 (interpolated).
// Unbonded:  fpb = fpe + 7000/(L/d)·(1 − 1.7·fpuAps/(fcu·b·d)) ≤ 0.7fpu
//            x   = 2.47·(fpuAps/(fcu·b·d))·(fpb/fpu)·d

// Table 9.5-1 (BS 8110 Cl. 4.3.7.3) — bonded tendons.
// Rows: fpuAps/(fcu·b·d) = 0.05..0.50 ; cols: fpe/fpu = 0.6,0.5,0.4
const TBL_RATIO = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
const TBL_FPB = [ // fpb/(0.87fpu)
  [1.00, 1.00, 1.00], [1.00, 1.00, 1.00], [0.99, 0.97, 0.95],
  [0.92, 0.90, 0.88], [0.88, 0.86, 0.84], [0.85, 0.83, 0.80],
  [0.83, 0.80, 0.76], [0.81, 0.77, 0.72], [0.79, 0.74, 0.68],
  [0.77, 0.71, 0.64],
];
const TBL_XD = [ // x/d
  [0.11, 0.11, 0.11], [0.22, 0.22, 0.22], [0.32, 0.32, 0.31],
  [0.40, 0.39, 0.38], [0.48, 0.47, 0.46], [0.55, 0.54, 0.52],
  [0.63, 0.60, 0.58], [0.70, 0.67, 0.62], [0.77, 0.72, 0.66],
  [0.83, 0.77, 0.69],
];
const TBL_FPE = [0.6, 0.5, 0.4];

function interp1(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

/** Bilinear lookup of Table 9.5-1 over (ratio, fpe/fpu). */
function table951(ratio: number, fpeRatio: number, tbl: number[][]): number {
  // interpolate across fpe columns at each ratio row, then across ratio
  const colVals = TBL_RATIO.map((_, i) =>
    interp1(fpeRatio, [...TBL_FPE].reverse(), [...tbl[i]].reverse())
  );
  return interp1(ratio, TBL_RATIO, colVals);
}

export interface BSFlexureInputs {
  /** Strand area in tension zone (mm²) */
  Aps: number;
  /** Effective depth to centroid of Aps (mm) */
  d: number;
  /** Beam / effective flange width (mm) */
  b: number;
  /** Characteristic cube strength fcu (MPa) */
  fcu: number;
  /** Strand characteristic strength fpu (MPa) */
  fpu: number;
  /** Effective prestress after losses fpe (MPa) */
  fpe: number;
  /** Bonded tendons? (false = unbonded post-tensioned) */
  bonded: boolean;
  /** Tendon length between anchorages (mm) — unbonded only */
  L?: number;
  /** Factored design moment Mu_demand (kN·m) */
  Mu_demand: number;
}

export interface BSFlexureResult {
  readonly ratio: number;       // fpuAps/(fcu·b·d)
  readonly fpeRatio: number;    // fpe/fpu
  readonly fpb: number;         // design tendon stress at failure (MPa)
  readonly x: number;           // neutral axis depth (mm)
  readonly x_d: number;         // x/d
  readonly Mu: number;          // ultimate moment of resistance (kN·m)
  readonly isAdequate: boolean; // Mu ≥ Mu_demand
  readonly bonded: boolean;
}

export function computeBSFlexure(inp: BSFlexureInputs): BSFlexureResult {
  const { Aps, d, b, fcu, fpu, fpe, bonded, L = 0, Mu_demand } = inp;

  const ratio = (fpu * Aps) / (fcu * b * d); // fpuAps/(fcu·b·d)
  const fpeRatio = fpe / fpu;

  let fpb: number, x: number;
  if (bonded) {
    const fpbOver = table951(ratio, fpeRatio, TBL_FPB); // fpb/(0.87fpu)
    const xd = table951(ratio, fpeRatio, TBL_XD);
    fpb = fpbOver * 0.87 * fpu;
    x = xd * d;
  } else {
    const Ld = L > 0 ? L / d : 30; // span/depth fallback
    fpb = Math.min(fpe + (7000 / Ld) * (1 - 1.7 * ratio), 0.7 * fpu);
    x = 2.47 * ratio * (fpb / fpu) * d;
  }

  const x_d = x / d;
  const Mu = (fpb * Aps * (d - 0.45 * x)) / 1e6; // kN·m

  return Object.freeze({
    ratio, fpeRatio, fpb, x, x_d, Mu,
    isAdequate: Mu >= Mu_demand,
    bonded,
  });
}

// ─── §9.6 ULS shear (BS 8110) ────────────────────────────────
// Vco (uncracked) = 0.67·bv·h·√(ft² + 0.8·fcp·ft),  ft = 0.24√fcu
// Vcr (cracked)   = (1 − 0.55·fpe/fpu)·vc·bv·d + M0·V/M  ≥ 0.1·bv·d·√fcu
//   M0 = 0.8·fpt·I/y  (moment for zero stress at extreme tension fibre)

export interface BSShearInputs {
  /** Web width bv (mm) */
  bv: number;
  /** Overall depth h (mm) */
  h: number;
  /** Effective depth d (mm) */
  d: number;
  /** fcu (MPa) */
  fcu: number;
  /** Concrete compressive stress at centroid due to prestress fcp (MPa, +) */
  fcp: number;
  /** Concrete compressive stress at extreme tension fibre fpt (MPa, +) */
  fpt: number;
  /** Second moment of area I (mm⁴) */
  I: number;
  /** Distance extreme tension fibre to centroid y (mm) */
  y: number;
  /** Effective prestress ratio fpe/fpu */
  fpe_fpu: number;
  /** Design concrete shear stress vc from Table 6.4-1 (MPa) */
  vc: number;
  /** Factored shear at section V (kN) */
  V: number;
  /** Factored moment at section M (kN·m) */
  M: number;
}

export interface BSShearResult {
  readonly ft: number;       // limiting tensile stress 0.24√fcu (MPa)
  readonly Vco: number;      // uncracked shear resistance (kN)
  readonly M0: number;       // decompression moment (kN·m)
  readonly Vcr: number;      // cracked shear resistance (kN)
  readonly Vc: number;       // governing min(Vco, Vcr) (kN)
  readonly isUncracked: boolean; // M < M0 ⇒ uncracked governs
  readonly Vcr_min: number;  // floor 0.1·bv·d·√fcu (kN)
}

export function computeBSShear(inp: BSShearInputs): BSShearResult {
  const { bv, h, d, fcu, fcp, fpt, I, y, fpe_fpu, vc, V, M } = inp;

  const ft = 0.24 * Math.sqrt(fcu);

  // Vco — uncracked (N → kN)
  const Vco = (0.67 * bv * h * Math.sqrt(ft * ft + 0.8 * fcp * ft)) / 1000;

  // M0 = 0.8·fpt·I/y  (N·mm → kN·m)
  const M0 = (0.8 * fpt * I / y) / 1e6;

  // Vcr — cracked
  const Vcr_min = (0.1 * bv * d * Math.sqrt(fcu)) / 1000;
  const Msafe = Math.abs(M) < 1e-6 ? 1e-6 : M;
  const Vcr = Math.max(
    Vcr_min,
    (1 - 0.55 * fpe_fpu) * vc * bv * d / 1000 + (M0 * V) / Msafe
  );

  // Uncracked if applied M < M0
  const isUncracked = Math.abs(M) < M0;
  const Vc = isUncracked ? Vco : Math.min(Vco, Vcr);

  return Object.freeze({ ft, Vco, M0, Vcr, Vc, isUncracked, Vcr_min });
}
