/**
 * Compression Field Theory — Sectional Shear Design
 * Nilson "Design of Prestressed Concrete" 2nd Ed. §5.11
 * AASHTO LRFD §5.7.3 General Procedure (Modified Compression Field Theory)
 *
 * ── Concept ──────────────────────────────────────────────────
 * The MCFT treats the cracked web as a variable-angle truss with
 * diagonally-cracked concrete carrying compression and the stirrups
 * carrying tension across the cracks. Instead of the empirical
 * Vci/Vcw split, β (concrete tension factor) and θ (diagonal crack
 * angle) are derived from the longitudinal strain εx at mid-depth.
 *
 *   εx = [ Mu/dv + 0.5·Nu + |Vu − Vp| − Aps·fpo ]
 *        ───────────────────────────────────────────
 *                 2·(Es·As + Ep·Aps)
 *
 *   β = 4.8 / (1 + 750·εx)            θ = 29 + 3500·εx   [deg]
 *   Vc = 0.083·β·√f'c·bv·dv          (SI, N, f'c in MPa)
 *   Vs = Av·fy·dv·cot(θ) / s
 *
 * fpo ≈ 0.70·fpu (locked-in strand stress, AASHTO C5.7.3.4.2).
 * εx is clamped to [−0.40, 6.0] ×10⁻³; if negative, the concrete in
 * the tension half stiffens the response (denominator includes Ec·Act).
 */

export interface MCFTInputs {
  /** Factored shear at section (kN) */
  Vu: number;
  /** Factored moment at section (kN·m) — use ≥ Vu·dv */
  Mu: number;
  /** Factored axial force (kN, + = tension) — usually 0 */
  Nu: number;
  /** Vertical component of prestress (kN) */
  Vp: number;
  /** f'c (MPa) */
  fc: number;
  /** Web width bv (mm) */
  bv: number;
  /** Effective shear depth dv (mm) */
  dv: number;
  /** Prestressed steel area on flexural tension side (mm²) */
  Aps: number;
  /** Mild steel area on flexural tension side (mm²) */
  As: number;
  /** Strand ultimate fpu (MPa) — fpo taken as 0.70·fpu */
  fpu: number;
  /** Strand modulus Ep (MPa) */
  Ep: number;
  /** Mild steel modulus Es (MPa, default 200000) */
  Es?: number;
  /** Stirrup yield fyt (MPa) */
  fyt: number;
  /** Provided stirrup area per spacing Av/s (mm²/mm) — 0 lets routine size it */
  AvPerS?: number;
  /** φ for shear (default 0.75) */
  phi?: number;
  /** Lightweight factor λ (default 1.0) */
  lambda?: number;
}

export interface MCFTResult {
  /** Longitudinal strain at mid-depth (×10⁻³ for display convenience: raw value) */
  readonly epsilon_x: number;
  /** Concrete tension factor β */
  readonly beta: number;
  /** Diagonal crack angle θ (degrees) */
  readonly theta_deg: number;
  /** Concrete shear contribution Vc (kN) */
  readonly Vc: number;
  /** Steel (stirrup) shear contribution Vs (kN) at provided/min Av/s (kN) */
  readonly Vs: number;
  /** Nominal shear Vn = Vc + Vs + Vp, capped by 0.25 f'c bv dv (kN) */
  readonly Vn: number;
  /** φVn (kN) */
  readonly phiVn: number;
  /** Upper limit Vn,max = 0.25 f'c bv dv + Vp (kN) */
  readonly Vn_max: number;
  /** Required Av/s for the demand (mm²/mm) */
  readonly AvPerS_req: number;
  /** fpo used (MPa) */
  readonly fpo: number;
  /** Adequate? φVn ≥ Vu */
  readonly isAdequate: boolean;
}

export function computeMCFT(inp: MCFTInputs): MCFTResult {
  const {
    Vu, Mu, Nu, Vp, fc, bv, dv, Aps, As, fpu, Ep,
    Es = 200_000, fyt, AvPerS = 0, phi = 0.75, lambda = 1.0,
  } = inp;

  const fpo = 0.70 * fpu;

  // Convert demands to N, N·mm
  const VuN = Vu * 1000;
  const VpN = Vp * 1000;
  const NuN = Nu * 1000;
  // Mu must not be taken less than (Vu − Vp)·dv  (AASHTO 5.7.3.4.2)
  const MuNmm = Math.max(Math.abs(Mu) * 1e6, Math.abs(VuN - VpN) * dv);

  const steelStiff = Es * As + Ep * Aps; // N (per unit strain)

  // First pass: assume cracked (denominator = 2·steelStiff)
  let epsilon_x =
    (MuNmm / dv + 0.5 * NuN + Math.abs(VuN - VpN) - Aps * fpo) /
    (2 * steelStiff);

  // If negative, concrete in tension half participates → stiffer, smaller |εx|
  if (epsilon_x < 0) {
    const Ec = 4700 * Math.sqrt(fc);
    const Act = (bv * dv) / 2; // approx area of concrete on the tension side
    epsilon_x =
      (MuNmm / dv + 0.5 * NuN + Math.abs(VuN - VpN) - Aps * fpo) /
      (2 * (Ec * Act + steelStiff));
  }

  // Clamp per AASHTO (−0.40 to +6.0 ×10⁻³)
  epsilon_x = Math.max(-0.0004, Math.min(0.006, epsilon_x));

  // β and θ (sections with at least minimum transverse reinforcement)
  const beta = 4.8 / (1 + 750 * epsilon_x);
  const theta_deg = 29 + 3500 * epsilon_x;
  const cotTheta = 1 / Math.tan((theta_deg * Math.PI) / 180);

  // Vc (N → kN)
  const VcN = 0.083 * beta * lambda * Math.sqrt(fc) * bv * dv;
  const Vc = VcN / 1000;

  // Required Av/s from demand: Vs_req = Vu/φ − Vc − Vp
  const Vs_req_N = VuN / phi - VcN - VpN;
  const AvPerS_req = Math.max(0, Vs_req_N / (fyt * dv * cotTheta));

  // Vs from provided (or required) Av/s
  const AvUse = AvPerS > 0 ? AvPerS : AvPerS_req;
  const VsN = AvUse * fyt * dv * cotTheta;
  const Vs = VsN / 1000;

  // Upper limit Vn,max = 0.25 f'c bv dv + Vp
  const Vn_max_N = 0.25 * fc * bv * dv + VpN;
  const VnN = Math.min(VcN + VsN + VpN, Vn_max_N);
  const Vn = VnN / 1000;
  const phiVn = phi * Vn;

  return Object.freeze({
    epsilon_x,
    beta,
    theta_deg,
    Vc,
    Vs,
    Vn,
    phiVn,
    Vn_max: Vn_max_N / 1000,
    AvPerS_req,
    fpo,
    isAdequate: phiVn >= Vu,
  });
}
