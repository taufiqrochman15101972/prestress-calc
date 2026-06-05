/**
 * Brackets & Corbels — Shear-Friction Design
 * Nilson "Design of Prestressed Concrete" 2nd Ed.
 *   §12.4  Shear Friction Method for Connection Design
 *   §12.5  Brackets and Corbels
 * ACI 318-19 §16.5 (Brackets and Corbels)
 *
 * ── Design model ─────────────────────────────────────────────
 * A corbel with shear span a_v ≤ d behaves as a deep cantilever /
 * truss. Three steel demands superpose at the top:
 *   1. Shear-friction across the column face:  Avf = Vu/(φ·μ·fy)
 *   2. Flexure from Vu·a_v + Nuc·(h−d):        Af  = Mu/(φ·fy·jd)
 *   3. Direct tension from horizontal Nuc:     An  = Nuc/(φ·fy)
 *
 * Primary tension steel (ACI 16.5.5.1):
 *   Asc = max( Af + An ,  (2/3)Avf + An ,  0.04·(f'c/fy)·b·d )
 * Closed horizontal stirrups (ACI 16.5.5.2):
 *   Ah = 0.5·(Asc − An), over 2/3·d adjacent to Asc.
 *
 * Capacity caps (ACI 16.5.2.4, normalweight, SI):
 *   Vn ≤ 0.2·f'c·b·d
 *   Vn ≤ (3.3 + 0.08·f'c)·b·d
 *   Vn ≤ 11·b·d                     [N, f'c in MPa, dims mm]
 *
 * Validity: a_v/d ≤ 1.0 and Nuc ≤ Vu (Nuc taken ≥ 0.2·Vu unless restrained).
 */

export type CorbelConcrete = "MONOLITHIC" | "ROUGHENED" | "SMOOTH";

export interface CorbelInputs {
  /** Factored vertical reaction Vu (kN) */
  Vu: number;
  /** Factored horizontal force Nuc (kN); if < 0.2Vu it is raised to 0.2Vu */
  Nuc: number;
  /** Shear span a_v — load to column face (mm) */
  av: number;
  /** Corbel width b (mm) */
  b: number;
  /** Total depth at column face h (mm) */
  h: number;
  /** Effective depth d (mm) */
  d: number;
  /** Concrete f'c (MPa) */
  fc: number;
  /** Reinforcement yield fy (MPa) */
  fy: number;
  /** Interface condition (sets μ) */
  concrete?: CorbelConcrete;
  /** φ for shear-friction / corbel (default 0.75) */
  phi?: number;
}

export interface CorbelResult {
  /** μ used (ACI 22.9.4.2) */
  readonly mu: number;
  /** Effective Nuc after the 0.2·Vu floor (kN) */
  readonly Nuc_design: number;
  /** Factored moment at column face (kN·m) */
  readonly Mu: number;
  /** Shear-friction steel (mm²) */
  readonly Avf: number;
  /** Flexural steel (mm²) */
  readonly Af: number;
  /** Direct-tension steel (mm²) */
  readonly An: number;
  /** Governing primary tension steel (mm²) */
  readonly Asc: number;
  /** Which term governs Asc */
  readonly AscGovern: "Af+An" | "(2/3)Avf+An" | "min 0.04 f'c/fy·b·d";
  /** Closed stirrup area total (mm²) */
  readonly Ah: number;
  /** Capacity cap Vn,max (kN) */
  readonly Vn_max: number;
  /** φVn,max (kN) */
  readonly phiVn_max: number;
  /** a_v/d ratio */
  readonly av_d_ratio: number;
  /** Geometry valid (a_v/d ≤ 1)? */
  readonly geometryOk: boolean;
  /** Vu within capacity cap? */
  readonly capacityOk: boolean;
}

function frictionMu(c: CorbelConcrete): number {
  switch (c) {
    case "MONOLITHIC": return 1.4;
    case "ROUGHENED":  return 1.0;
    case "SMOOTH":     return 0.6;
  }
}

export function computeCorbel(inp: CorbelInputs): CorbelResult {
  const {
    Vu, av, b, h, d, fc, fy,
    concrete = "MONOLITHIC", phi = 0.75,
  } = inp;

  const mu = frictionMu(concrete);

  // Nuc floor of 0.2·Vu (ACI 16.5.3.1 — treat as restrained tensile force)
  const Nuc_design = Math.max(inp.Nuc, 0.2 * Vu); // kN

  // Demands in N, N·mm
  const VuN = Vu * 1000;
  const NucN = Nuc_design * 1000;
  const Mu_Nmm = VuN * av + NucN * (h - d);
  const Mu = Mu_Nmm / 1e6; // kN·m

  // Steel areas (mm²)
  const Avf = VuN / (phi * mu * fy);
  const jd = 0.85 * d; // internal lever arm approximation
  const Af = Mu_Nmm / (phi * fy * jd);
  const An = NucN / (phi * fy);

  // Primary tension steel — governing of three (ACI 16.5.5.1)
  const cand1 = Af + An;
  const cand2 = (2 / 3) * Avf + An;
  const cand3 = 0.04 * (fc / fy) * b * d;
  const Asc = Math.max(cand1, cand2, cand3);
  const AscGovern: CorbelResult["AscGovern"] =
    Asc === cand1 ? "Af+An" : Asc === cand2 ? "(2/3)Avf+An" : "min 0.04 f'c/fy·b·d";

  // Closed stirrups (ACI 16.5.5.2)
  const Ah = 0.5 * (Asc - An);

  // Capacity cap (ACI 16.5.2.4, SI)
  const Vn_max_N = Math.min(
    0.2 * fc * b * d,
    (3.3 + 0.08 * fc) * b * d,
    11 * b * d
  );
  const Vn_max = Vn_max_N / 1000;
  const phiVn_max = phi * Vn_max;

  const av_d_ratio = av / d;

  return Object.freeze({
    mu,
    Nuc_design,
    Mu,
    Avf,
    Af,
    An,
    Asc,
    AscGovern,
    Ah,
    Vn_max,
    phiVn_max,
    av_d_ratio,
    geometryOk: av_d_ratio <= 1.0,
    capacityOk: phiVn_max >= Vu,
  });
}
