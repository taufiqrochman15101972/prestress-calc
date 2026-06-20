/**
 * fem/designcheck.ts — Automatic member DESIGN CHECK on FEM results, MIDAS/Robot
 * style (utilization ratio per member). Steel members per AISC 360 / SNI 1729:
 * axial (tension yield / compression flexural buckling Fcr), flexure (φMn), shear
 * (φVn), and the combined axial+flexure interaction H1-1 → governing demand/
 * capacity RATIO with pass/fail. The result table + colour bar mirror the MIDAS
 * "design result" and Robot "code check" post-processors.
 *
 * Procedure/flow per MD design flowcharts (column / steel member, MD15/MD25/MD35);
 * code numbers are the standard formulas, not from the PDFs. Units SI (N, mm, MPa).
 */

export interface SteelCheckInput {
  N: number;     // axial (+ tension, − compression), N
  M: number;     // governing moment magnitude, N·mm
  V: number;     // governing shear magnitude, N
  L: number;     // unbraced length, mm
  A: number; I: number; d: number;   // mm², mm⁴, depth mm
  Fy: number; E: number; Kfac: number;
}
export interface SteelCheckResult {
  readonly lambda: number; readonly Fcr: number;
  readonly phiPn: number;   // governing axial capacity (tension or compression)
  readonly phiMn: number;
  readonly phiVn: number;
  readonly Pr_Pc: number; readonly Mr_Mc: number;
  readonly interaction: number;   // H1-1 ratio
  readonly shearRatio: number;
  readonly ratio: number;         // governing utilisation
  readonly ok: boolean;
  readonly govern: string;
}

export function checkSteelMember(i: SteelCheckInput): SteelCheckResult {
  const ry = Math.sqrt(i.I / i.A);
  const lambda = (i.Kfac * i.L) / ry;
  const Fe = (Math.PI ** 2 * i.E) / (lambda * lambda);
  const Fcr = lambda <= 4.71 * Math.sqrt(i.E / i.Fy)
    ? Math.pow(0.658, i.Fy / Fe) * i.Fy
    : 0.877 * Fe;
  const phiPnC = 0.90 * Fcr * i.A;            // compression
  const phiPnT = 0.90 * i.Fy * i.A;           // tension yield
  const phiPn = i.N >= 0 ? phiPnT : phiPnC;
  const S = (2 * i.I) / i.d;
  const Z = 1.12 * S;                          // approx plastic modulus (compact I)
  const phiMn = 0.90 * i.Fy * Z;
  const Aw = 0.5 * i.A;                        // approx web shear area
  const phiVn = 0.90 * 0.6 * i.Fy * Aw;

  const Pr = Math.abs(i.N), Pc = Math.max(phiPn, 1);
  const Mr = Math.abs(i.M), Mc = Math.max(phiMn, 1);
  const Pr_Pc = Pr / Pc, Mr_Mc = Mr / Mc;
  const interaction = Pr_Pc >= 0.2 ? Pr_Pc + (8 / 9) * Mr_Mc : Pr_Pc / 2 + Mr_Mc;
  const shearRatio = Math.abs(i.V) / Math.max(phiVn, 1);
  const ratio = Math.max(interaction, shearRatio);
  return Object.freeze({
    lambda, Fcr, phiPn, phiMn, phiVn, Pr_Pc, Mr_Mc, interaction, shearRatio, ratio,
    ok: ratio <= 1.0,
    govern: shearRatio > interaction ? "geser" : (i.N >= 0 ? "tarik+lentur" : "tekan+lentur (H1-1)"),
  });
}
