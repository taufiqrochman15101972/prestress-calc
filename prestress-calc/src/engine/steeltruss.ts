/**
 * steeltruss.ts — Steel truss bridge (jembatan rangka baja) member analysis &
 * capacity. Procedure/flow after "Desain Jembatan Rangka Baja" (Taufiq Rochman
 * & Suhariyanto, 2024) + AASHTO LRFD / SNI 1729 steel provisions. PDF numbers
 * are NOT code references — only the chapter/sub-chapter order & procedure.
 *
 * Statically-determinate parallel-chord Pratt/Warren truss under uniform deck
 * load: panel-point loads, support reactions, panel shear & moment, then the
 * chord force (= M/h) and diagonal/vertical force (= V/sinθ). Member design:
 * tension yielding/rupture (φ=0.90/0.75) and column buckling (AISC/SNI 1729
 * flexural buckling Fcr) for compression chords/diagonals.
 *
 * Units (SI): force kN · length m · stress MPa · area mm². Frozen results.
 */

export type TrussType = "PRATT" | "WARREN" | "HOWE";

export interface SteelTrussInputs {
  /** span, m */
  span: number;
  /** number of equal panels, n */
  panels: number;
  /** truss height (chord c/c), m */
  height: number;
  type: TrussType;
  /** uniform load on the loaded chord, kN/m */
  w: number;
  /** steel yield strength Fy, MPa */
  Fy: number;
  /** steel ultimate Fu, MPa */
  Fu: number;
  /** elastic modulus E, MPa (200 000) */
  E: number;
  /** member cross-sectional area A, mm² (governing member trial) */
  area: number;
  /** radius of gyration r, mm (for buckling) */
  rGyration: number;
  /** effective-length factor K */
  Kfac: number;
}

export interface SteelTrussResult {
  readonly panelLength: number;   // m
  readonly panelLoad: number;     // kN at each interior panel point
  readonly reaction: number;      // kN
  readonly maxChordForce: number; // kN (mid-span chord, M/h)
  readonly maxDiagForce: number;  // kN (end diagonal, V/sinθ)
  readonly diagAngle: number;     // deg
  readonly Pn_tension: number;    // kN nominal tension (yield)
  readonly phiPn_tension: number; // kN φ·Pn
  readonly Fcr: number;           // MPa critical buckling stress
  readonly Pn_comp: number;       // kN nominal compression
  readonly phiPn_comp: number;    // kN
  readonly lambda: number;        // slenderness KL/r
  readonly tensionOk: boolean;
  readonly compressionOk: boolean;
}

export function computeSteelTruss(i: SteelTrussInputs): SteelTrussResult {
  const Lp = i.span / i.panels;                 // panel length, m
  const P = i.w * Lp;                            // panel-point load, kN
  const wTotal = i.w * i.span;
  const R = wTotal / 2;                          // support reaction

  // Max bending moment at mid-span (simple beam analogy) → chord force = M/h.
  const Mmax = (i.w * i.span * i.span) / 8;      // kN·m
  const maxChordForce = Mmax / i.height;         // kN

  // Max shear at end panel → end diagonal carries V/sinθ.
  const Vend = R - P / 2;                         // shear in first panel
  const diagAngleR = Math.atan2(i.height, Lp);
  const maxDiagForce = Vend / Math.sin(diagAngleR);

  // Tension capacity (gross yielding governs for compact connections).
  const Pn_tension = i.Fy * i.area / 1000;       // kN
  const phiPn_tension = 0.90 * Pn_tension;

  // Compression capacity — AISC/SNI 1729 flexural buckling.
  const KLr = (i.Kfac * (Lp) * 1000) / i.rGyration;  // use panel length as member length
  const Fe = (Math.PI ** 2 * i.E) / (KLr * KLr);     // Euler stress, MPa
  const ratio = i.Fy / Fe;
  const Fcr = ratio <= 2.25
    ? Math.pow(0.658, ratio) * i.Fy        // inelastic
    : 0.877 * Fe;                          // elastic
  const Pn_comp = Fcr * i.area / 1000;     // kN
  const phiPn_comp = 0.90 * Pn_comp;

  return Object.freeze({
    panelLength: Lp, panelLoad: P, reaction: R,
    maxChordForce, maxDiagForce, diagAngle: (diagAngleR * 180) / Math.PI,
    Pn_tension, phiPn_tension,
    Fcr, Pn_comp, phiPn_comp, lambda: KLr,
    tensionOk: phiPn_tension >= maxChordForce,
    compressionOk: phiPn_comp >= maxChordForce,
  });
}
