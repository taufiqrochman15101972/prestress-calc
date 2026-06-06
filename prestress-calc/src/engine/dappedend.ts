/**
 * Dapped-End Connection — Libby "Modern Prestressed Concrete" §12-6,
 * reinforcement per the PCI Design Handbook five potential failure modes.
 *
 * A dapped (notched) beam end transfers the reaction through a reduced depth.
 * Five regions need reinforcement (PCI):
 *   1. Flexure + axial tension in the extended end       → A_s (main hanger)
 *   2. Direct shear at the dap (shear-friction)          → A_vf
 *   3. Diagonal tension at the re-entrant corner         → A_sh (hanger)
 *   4. Diagonal tension in the extended end              → A_v + A_h
 *   5. Bearing on the nib                                → check
 *
 * SI units: forces kN, lengths mm, stresses MPa. φ per ACI 318 (0.75 shear,
 * 0.90 flexure/tension). Procedure only — no book numbers used as inputs.
 */

export interface DappedEndInputs {
  Vu: number;     // factored reaction (kN)
  Nu?: number;    // factored horizontal tension at bearing (kN), default 0.2·Vu
  a: number;      // shear span: distance from reaction to re-entrant corner (mm)
  h: number;      // full beam depth (mm)
  d: number;      // effective depth of extended end (nib) (mm)
  fy: number;     // reinforcement yield (MPa)
  fc: number;     // concrete f'c (MPa)
  bw: number;     // web width (mm)
  lambda?: number;// lightweight factor, default 1.0
  mu?: number;    // shear-friction coefficient, default 1.4 (monolithic)
}

export interface DappedEndResult {
  readonly Nu: number;
  readonly As_flexure: number; // mode 1 — flexure/axial in nib (mm²)
  readonly Avf_shear: number;  // mode 2 — direct shear friction (mm²)
  readonly Ash_corner: number; // mode 3 — re-entrant corner hanger (mm²)
  readonly Av_diag: number;    // mode 4 — diagonal tension extended end (mm²)
  readonly Ah_diag: number;    // mode 4 — horizontal bars (mm²)
  readonly Vn_max: number;     // upper limit on nib shear (kN)
  readonly isShearOk: boolean; // Vu ≤ φ·Vn_max
}

export function computeDappedEnd(inp: DappedEndInputs): DappedEndResult {
  const { Vu, a, h, d, fy, fc, bw } = inp;
  const Nu = inp.Nu ?? 0.2 * Vu;
  const lambda = inp.lambda ?? 1.0;
  const mu = inp.mu ?? 1.4 * lambda;
  const phiS = 0.75, phiF = 0.90;

  const VuN = Vu * 1000, NuN = Nu * 1000;

  // Mode 1 — cantilever flexure of the nib + direct axial tension (PCI):
  //   A_s = (1/φfy)·[ Vu·a/d + Nu·(h/d) ]
  const As_flexure = (1 / (phiF * fy)) * (VuN * a / d + NuN * (h / d));

  // Mode 2 — direct shear by shear-friction across the dap face:
  //   A_vf = Vu/(φ·μ·fy) + Nu/(φ·fy)
  const Avf_shear = VuN / (phiS * mu * fy) + NuN / (phiS * fy);

  // Mode 3 — diagonal tension at re-entrant corner, full hanger for reaction:
  //   A_sh = Vu/(φ·fy)
  const Ash_corner = VuN / (phiS * fy);

  // Mode 4 — diagonal tension in the extended end:
  //   A_v = Vu/(φ·fy)  (closed stirrups), with A_h = 0.5·A_v horizontal bars
  const Av_diag = VuN / (phiS * fy);
  const Ah_diag = 0.5 * Av_diag;

  // Upper limit on nib shear (PCI): Vn ≤ 0.2·f'c·bw·d and ≤ 5.5·bw·d (MPa)
  const Vn_max = Math.min(0.2 * fc * bw * d, 5.5 * bw * d) / 1000; // kN
  const isShearOk = Vu <= phiS * Vn_max;

  return Object.freeze({
    Nu,
    As_flexure,
    Avf_shear,
    Ash_corner,
    Av_diag,
    Ah_diag,
    Vn_max,
    isShearOk,
  });
}
