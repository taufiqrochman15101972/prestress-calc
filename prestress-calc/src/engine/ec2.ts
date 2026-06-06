/**
 * Eurocode 2 (EN 1992-1-1) Prestressed Concrete — M.K. Hurst,
 * "Prestressed Concrete Design" 2nd ed. (2003).
 *
 * The fourth design-code path of the suite, parallel to the ACI 318 /
 * AASHTO LRFD engine (uls.ts, losses.ts) and the BS 8110 engine (bs8110.ts).
 * Only the genuinely EC2-distinctive procedures are implemented here; the
 * Magnel diagram (§9.4), cable zone (§9.5), concordancy/linear transformation
 * (§11), load balancing (§6.5/§12.2), composite construction (§10), bursting
 * forces (§8.3) and transmission length (§8.4) already exist elsewhere and are
 * NOT duplicated.
 *
 *   §2 / Table 3.1   Design material values  (fcd, fctm, fctd, Ecm, fpd, η, λ, ν1)
 *   §3.7 / EC2 §7.2  Allowable stresses by load combination
 *                    (characteristic / frequent / quasi-permanent)
 *   §4.6 / EC2 §5.10.6  Combined time-dependent loss (single equation 5.46)
 *   §5.7 / EC2 §6.1  ULS flexure — rectangular stress block (λx, η·fcd, fpd)
 *   §7   / EC2 §6.2  Shear — uncracked region VRd,c (6.4) + cracked (6.2a)
 *                    + variable-strut VRd,max (6.9)
 *
 * Notation: fck = characteristic CYLINDER strength (MPa). γc = 1.5, γs = 1.15.
 * Structure & procedure follow Hurst/EC2; numeric coefficients are the
 * published EN 1992-1-1 values, never taken from the book's worked examples.
 * Sign convention matches the suite: + = tension, − = compression.
 */

// ─── §2 / Table 3.1 — Design material values ─────────────────
export interface EC2MaterialResult {
  readonly fcm: number;     // mean cylinder strength fck + 8 (MPa)
  readonly fcd: number;     // design compressive strength αcc·fck/γc (MPa)
  readonly fctm: number;    // mean axial tensile strength (MPa)
  readonly fctk005: number; // 5% fractile tensile strength (MPa)
  readonly fctd: number;    // design tensile strength αct·fctk005/γc (MPa)
  readonly Ecm: number;     // secant modulus of elasticity (MPa)
  readonly fpd: number;     // design tendon strength fp0.1k/γs (MPa)
  readonly eta: number;     // effective-strength factor η (≤1)
  readonly lambda: number;  // stress-block depth factor λ (≤0.8)
  readonly nu1: number;     // strength-reduction factor for cracked shear
  readonly gammaC: number;
  readonly gammaS: number;
}

/** EN 1992-1-1 §3.1 material design values. αcc per UK NA default 0.85. */
export function ec2Material(
  fck: number,
  fpk: number,
  alphaCc = 0.85,
): EC2MaterialResult {
  const gammaC = 1.5, gammaS = 1.15;
  const fcm = fck + 8;
  const fcd = (alphaCc * fck) / gammaC;
  // fctm — EN 1992-1-1 Table 3.1
  const fctm = fck <= 50
    ? 0.30 * Math.pow(fck, 2 / 3)
    : 2.12 * Math.log(1 + fcm / 10);
  const fctk005 = 0.7 * fctm;
  const fctd = (1.0 * fctk005) / gammaC; // αct = 1.0
  const Ecm = 22000 * Math.pow(fcm / 10, 0.3); // MPa (22 GPa coefficient)
  // fp0.1k ≈ 0.9·fpk ; fpd = fp0.1k/γs
  const fpd = (0.9 * fpk) / gammaS;
  // High-strength reductions (fck > 50 MPa)
  const eta = fck <= 50 ? 1.0 : Math.max(0.8, 1.0 - (fck - 50) / 200);
  const lambda = fck <= 50 ? 0.8 : Math.max(0.7, 0.8 - (fck - 50) / 400);
  const nu1 = 0.6 * (1 - fck / 250);
  return Object.freeze({
    fcm, fcd, fctm, fctk005, fctd, Ecm, fpd, eta, lambda, nu1, gammaC, gammaS,
  });
}

// ─── §3.7 / EC2 §5.10.2.2 + §7.2 — Allowable stresses ────────
export interface EC2StressLimits {
  /** At transfer: compression limit 0.6·fck(t) — magnitude, MPa */
  readonly compTransfer: number;
  /** Transfer tension (no bonded reinf.) ≤ fctm(t) — MPa, + */
  readonly tensTransfer: number;
  /** Service compression, characteristic (rare) combo: 0.6·fck — magnitude */
  readonly compCharacteristic: number;
  /** Service compression, quasi-permanent: 0.45·fck (linear-creep limit) */
  readonly compQuasiPermanent: number;
  /** Service tension limit ≤ fctm (decompression / class) — MPa, + */
  readonly tensService: number;
  readonly note: string;
}

/**
 * EC2 stress limits. compTransfer uses fck(t) at transfer; the 0.45·fck
 * quasi-permanent compression cap (EN 1992-1-1 §7.2(3)) keeps creep linear.
 */
export function ec2StressLimits(
  fck: number,
  fckTransfer: number,
): EC2StressLimits {
  const fcmT = fckTransfer + 8;
  const fctmT = fckTransfer <= 50
    ? 0.30 * Math.pow(fckTransfer, 2 / 3)
    : 2.12 * Math.log(1 + fcmT / 10);
  const fctm = fck <= 50
    ? 0.30 * Math.pow(fck, 2 / 3)
    : 2.12 * Math.log(1 + (fck + 8) / 10);
  return Object.freeze({
    compTransfer: 0.6 * fckTransfer,
    tensTransfer: fctmT,
    compCharacteristic: 0.6 * fck,
    compQuasiPermanent: 0.45 * fck,
    tensService: fctm,
    note: "EC2 §7.2: σc ≤ 0.6fck (rare) & ≤ 0.45fck (quasi-permanent, creep linear)",
  });
}

// ─── §4.6 / EC2 §5.10.6(2) eq. (5.46) — Combined loss ────────
export interface EC2LossInputs {
  /** Total shrinkage strain εcs (microstrain → pass as strain, e.g. 0.0003) */
  eps_cs: number;
  /** Tendon modulus Ep (MPa) */
  Ep: number;
  /** Concrete secant modulus Ecm (MPa) */
  Ecm: number;
  /** Relaxation loss Δσpr (MPa, magnitude) */
  delta_pr: number;
  /** Creep coefficient φ(t,t0) */
  phi: number;
  /** Concrete stress at tendon level under quasi-permanent loads (MPa, +comp) */
  sigma_c_qp: number;
  /** Tendon area Ap (mm²) */
  Ap: number;
  /** Concrete (gross) area Ac (mm²) */
  Ac: number;
  /** Second moment of area Ic (mm⁴) */
  Ic: number;
  /** Tendon eccentricity zcp (mm) */
  zcp: number;
}

export interface EC2LossResult {
  readonly shrinkageTerm: number;  // εcs·Ep (MPa)
  readonly relaxationTerm: number; // 0.8·Δσpr (MPa)
  readonly creepTerm: number;      // (Ep/Ecm)·φ·σc,qp (MPa)
  readonly numerator: number;      // MPa
  readonly denominator: number;    // dimensionless ageing/restraint factor
  readonly deltaSigma_csr: number; // combined time-dependent loss Δσp,c+s+r (MPa)
}

/**
 * EN 1992-1-1 eq. (5.46): the three time-dependent effects (shrinkage, creep,
 * relaxation) interact and are reduced by the ageing/restraint denominator.
 * This single coupled equation is EC2's signature departure from the AASHTO
 * Refined (separate ΔfpSR/ΔfpCR/ΔfpR) and BS 8110 lump approaches.
 */
export function ec2TimeDependentLoss(inp: EC2LossInputs): EC2LossResult {
  const { eps_cs, Ep, Ecm, delta_pr, phi, sigma_c_qp, Ap, Ac, Ic, zcp } = inp;
  const n = Ep / Ecm;

  const shrinkageTerm = eps_cs * Ep;
  const relaxationTerm = 0.8 * delta_pr;
  const creepTerm = n * phi * sigma_c_qp;
  const numerator = shrinkageTerm + relaxationTerm + creepTerm;

  const denominator =
    1 + n * (Ap / Ac) * (1 + (Ac / Ic) * zcp * zcp) * (1 + 0.8 * phi);

  const deltaSigma_csr = numerator / denominator;
  return Object.freeze({
    shrinkageTerm, relaxationTerm, creepTerm, numerator, denominator,
    deltaSigma_csr,
  });
}

// ─── §5.7 / EC2 §6.1 — ULS flexure (rectangular stress block) ─
export interface EC2FlexureInputs {
  Ap: number;        // prestressing steel area (mm²)
  d: number;         // effective depth to Ap centroid (mm)
  b: number;         // compression-flange width (mm)
  fck: number;       // characteristic cylinder strength (MPa)
  fpk: number;       // tendon characteristic strength (MPa)
  Mu_demand: number; // design moment MEd (kN·m)
  alphaCc?: number;
}

export interface EC2FlexureResult {
  readonly fcd: number;       // MPa
  readonly fpd: number;       // MPa
  readonly eta: number;
  readonly lambda: number;
  readonly Fp: number;        // tendon force at ULS (kN)
  readonly x: number;         // neutral-axis depth (mm)
  readonly x_d: number;       // x/d (ductility check vs 0.45 / 0.617)
  readonly a: number;         // stress-block depth λx (mm)
  readonly MRd: number;       // moment of resistance (kN·m)
  readonly ductile: boolean;  // x/d within balanced limit
  readonly isAdequate: boolean;
}

/**
 * EC2 rectangular stress block: concrete stress η·fcd over depth λ·x; tendon
 * assumed at design strength fpd (the over-reinforced strain check is reported
 * via x/d). MRd = Ap·fpd·(d − λx/2).
 */
export function ec2Flexure(inp: EC2FlexureInputs): EC2FlexureResult {
  const { Ap, d, b, fck, fpk, Mu_demand, alphaCc = 0.85 } = inp;
  const m = ec2Material(fck, fpk, alphaCc);
  const { fcd, fpd, eta, lambda } = m;

  const Fp_N = Ap * fpd;                       // N
  const x = Fp_N / (eta * fcd * lambda * b);   // mm
  const a = lambda * x;
  const x_d = x / d;
  const MRd = (Fp_N * (d - a / 2)) / 1e6;      // kN·m

  // Balanced/ductility limit: for prestressing steel x/d ≈ 0.45 (≤C50) keeps
  // the tendon adequately strained at failure (EN 1992-1-1 §5.6.3 / NA).
  const ductile = x_d <= 0.45;

  return Object.freeze({
    fcd, fpd, eta, lambda,
    Fp: Fp_N / 1000, x, x_d, a, MRd,
    ductile,
    isAdequate: MRd >= Mu_demand,
  });
}

// ─── §7 / EC2 §6.2 — Shear resistance ────────────────────────
export interface EC2ShearInputs {
  bw: number;     // web width (mm)
  d: number;      // effective depth (mm)
  h: number;      // overall depth (mm)
  fck: number;    // characteristic cylinder strength (MPa)
  fpk: number;    // tendon characteristic strength (MPa)
  I: number;      // second moment of area (mm⁴)
  S: number;      // first moment of area above centroid (mm³)
  sigma_cp: number; // mean axial concrete stress from prestress (MPa, +comp)
  rho_l: number;  // longitudinal reinforcement ratio Asl/(bw·d) (≤0.02)
  V: number;      // design shear VEd (kN)
  M: number;      // design moment MEd at section (kN·m)
  Mcr: number;    // cracking moment (kN·m) — region selector
  alphaCc?: number;
  /** Strut angle θ (deg, 21.8–45); default 21.8 (cotθ = 2.5) */
  thetaDeg?: number;
}

export interface EC2ShearResult {
  readonly region: "uncracked" | "cracked"; // flexurally un-/cracked region
  readonly fctd: number;        // MPa
  readonly VRd_c_uncracked: number; // eq 6.4 (kN)
  readonly VRd_c_cracked: number;   // eq 6.2a (kN)
  readonly VRd_c: number;       // governing design shear resistance (kN)
  readonly VRd_max: number;     // strut crushing limit eq 6.9 (kN)
  readonly k: number;           // size effect 1+√(200/d) ≤ 2
  readonly vmin: number;        // minimum 0.035·k^1.5·√fck (MPa)
  readonly alpha_cw: number;    // prestress enhancement factor
  readonly needsLinks: boolean; // VEd > VRd,c
  readonly isAdequate: boolean; // VEd ≤ VRd,max (web crushing OK)
}

export function ec2Shear(inp: EC2ShearInputs): EC2ShearResult {
  const {
    bw, d, fck, fpk, I, S, sigma_cp, rho_l, V, M, Mcr,
    alphaCc = 0.85, thetaDeg = 21.8,
  } = inp;
  const m = ec2Material(fck, fpk, alphaCc);
  const { fcd, fctd, nu1 } = m;

  // Region: uncracked in flexure when applied M ≤ cracking moment.
  const region: "uncracked" | "cracked" = Math.abs(M) <= Mcr ? "uncracked" : "cracked";

  // Eq (6.4) — uncracked region: VRd,c = (I·bw/S)·√(fctd² + αl·σcp·fctd)
  const alpha_l = 1.0; // fully bonded beyond transmission length
  const VRd_c_uncracked =
    ((I * bw) / S) * Math.sqrt(fctd * fctd + alpha_l * sigma_cp * fctd) / 1000;

  // Eq (6.2a) — cracked region
  const CRd_c = 0.18 / m.gammaC; // 0.12
  const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
  const rho = Math.min(rho_l, 0.02);
  const k1 = 0.15;
  const sigma_cp_cap = Math.min(sigma_cp, 0.2 * fcd);
  const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
  const v_cracked = Math.max(
    CRd_c * k * Math.pow(100 * rho * fck, 1 / 3) + k1 * sigma_cp_cap,
    vmin + k1 * sigma_cp_cap,
  );
  const VRd_c_cracked = (v_cracked * bw * d) / 1000;

  const VRd_c = region === "uncracked"
    ? Math.min(VRd_c_uncracked, VRd_c_cracked) // lesser governs near transition
    : VRd_c_cracked;

  // Eq (6.9) — strut crushing limit (variable-angle truss)
  // αcw enhancement for prestress (0 < σcp ≤ 0.25fcd ⇒ 1+σcp/fcd)
  let alpha_cw = 1.0;
  if (sigma_cp > 0 && sigma_cp <= 0.25 * fcd) alpha_cw = 1 + sigma_cp / fcd;
  else if (sigma_cp <= 0.5 * fcd) alpha_cw = 1.25;
  else if (sigma_cp < fcd) alpha_cw = 2.5 * (1 - sigma_cp / fcd);
  const z = 0.9 * d;
  const theta = (thetaDeg * Math.PI) / 180;
  const cot = 1 / Math.tan(theta), tan = Math.tan(theta);
  const VRd_max = (alpha_cw * bw * z * nu1 * fcd / (cot + tan)) / 1000;

  return Object.freeze({
    region, fctd,
    VRd_c_uncracked, VRd_c_cracked, VRd_c, VRd_max,
    k, vmin, alpha_cw,
    needsLinks: V > VRd_c,
    isAdequate: V <= VRd_max,
  });
}

// ─── Aggregate EC2 result (stored in DesignResults.ec2) ──────
export interface EC2Result {
  readonly material: EC2MaterialResult;
  readonly stressLimits: EC2StressLimits;
  readonly loss: EC2LossResult;
  readonly flexure: EC2FlexureResult;
  readonly shear: EC2ShearResult;
}
