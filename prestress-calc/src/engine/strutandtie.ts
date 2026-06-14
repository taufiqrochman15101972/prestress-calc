/**
 * Strut-and-Tie Modeling of Disturbed (D-) Regions
 * PCI Bridge Design Manual §8.12 — AASHTO LRFD §5.6.3 (pre-2017 numbering)
 *
 * Cracked reinforced concrete carries load as a TRUSS: straight concrete
 * compression STRUTS + reinforcement tension TIES meeting at NODES. Use
 * where plane sections do not remain plane: deep beams/pier caps, dapped
 * ends, post-tensioning anchorages, corbels — "when the distance between
 * the centres of applied load and support is less than about twice the
 * member depth".
 *
 * Design steps (§8.12.4.2):
 *  1. bearing areas → 2. truss geometry → 3. tie reinforcement →
 *  4. tie anchorage/development → 5. strut capacities →
 *  6. crack-control mesh → 7. detailing
 *
 * Capacities (φ = 0.70 compression, 0.90 tension):
 *  STRUT:  P_r = φ·f_cu·A_cs (+ φ·f_y·A_ss if reinforced & tied)
 *          f_cu = f'c/(0.8 + 170·ε₁) ≤ 0.85·f'c       [LRFD 5.6.3.3.3-1]
 *          ε₁ = (ε_s + 0.002)·cot²α_s                  [LRFD 5.6.3.3.3-2]
 *          (α_s = smallest strut–tie angle; ε_s = tie tensile strain)
 *  TIE:    P_r = φ·[f_y·A_st + A_ps·(f_pe + f_y)]      [LRFD 5.6.3.4.1-1]
 *  NODE:   σ ≤ m·φ·f'c — m = 0.85 (CCC), 0.75 (CCT), 0.65 (CTT/TTT)
 *  CRACK CONTROL: orthogonal mesh ρ ≥ 0.003 each direction, spacing ≤ 300 mm
 *
 * Internal SI: N, mm, MPa (I/O kN).
 */

export type NodeType = "CCC" | "CCT" | "CTT";

export const NODE_FACTORS: Record<NodeType, { m: number; label: string }> = {
  CCC: { m: 0.85, label: "CCC — dikelilingi strut tekan/tumpuan" },
  CCT: { m: 0.75, label: "CCT — mengangkur satu tie" },
  CTT: { m: 0.65, label: "CTT — mengangkur tie di >1 arah" },
};

export interface StrutTieInputs {
  /** f'c (MPa) */
  fc: number;
  // ── strut ──
  /** Factored strut force P_u (kN, +) */
  PuStrut: number;
  /** Effective strut cross-section A_cs (mm²) — from anchorage geometry */
  Acs: number;
  /** Smallest angle between the strut and adjoining ties α_s (deg) */
  alphaS: number;
  /** Tensile strain in the tie direction ε_s (≈ f_y/E_s at yield = 0.002) */
  epsS: number;
  /** Strut confinement/parallel steel A_ss (mm²), 0 if unreinforced */
  Ass: number;
  // ── tie ──
  /** Factored tie force P_u (kN) */
  PuTie: number;
  /** Mild steel area A_st (mm²) and yield f_y (MPa) */
  Ast: number;
  fy: number;
  /** Prestressing steel in the tie A_ps (mm²), effective prestress f_pe (MPa) */
  Aps: number;
  fpe: number;
  // ── node ──
  /** Factored bearing/node force P_u (kN) */
  PuNode: number;
  /** Node face area A_n (mm²) */
  An: number;
  /** Node type (anchorage condition) */
  nodeType: NodeType;
  // ── crack control ──
  /** Web width b_w (mm), bar spacing s (mm), bar area per layer A_bar (mm²),
   *  number of bars per spacing (e.g. 2 faces) */
  bw: number;
  sBar: number;
  AbarCrack: number;
  nFaces: number;
}

export interface StrutTieResult {
  // strut
  readonly eps1: number;
  readonly fcu: number;            // MPa
  readonly fcuCapped: boolean;     // hit the 0.85f'c ceiling
  readonly PnStrut: number;        // kN
  readonly PrStrut: number;        // kN (φ=0.70)
  readonly strutOk: boolean;
  // tie
  readonly PnTie: number;          // kN
  readonly PrTie: number;          // kN (φ=0.90)
  readonly tieOk: boolean;
  // node
  readonly nodeLimit: number;      // MPa (m·φ·f'c)
  readonly sigmaNode: number;      // MPa
  readonly nodeOk: boolean;
  // crack control
  readonly rhoProvided: number;
  readonly rhoMin: number;         // 0.003
  readonly spacingMax: number;     // 300 mm
  readonly crackOk: boolean;
  readonly allOk: boolean;
}

const PHI_C = 0.70;
const PHI_T = 0.90;

export function computeStrutTie(inp: StrutTieInputs): StrutTieResult {
  const { fc, PuStrut, Acs, alphaS, epsS, Ass, PuTie, Ast, fy, Aps, fpe,
    PuNode, An, nodeType, bw, sBar, AbarCrack, nFaces } = inp;

  // ── strut ──
  const cot = 1 / Math.tan((alphaS * Math.PI) / 180);
  const eps1 = (epsS + 0.002) * cot * cot;
  const fcuRaw = fc / (0.8 + 170 * eps1);
  const fcu = Math.min(fcuRaw, 0.85 * fc);
  const PnStrut = (fcu * Acs + Ass * fy) / 1000;     // kN
  const PrStrut = PHI_C * PnStrut;
  const strutOk = PrStrut >= PuStrut;

  // ── tie ──  (f_pe + f_y ≤ 0.95·f_py handled upstream via inputs)
  const PnTie = (fy * Ast + Aps * (fpe + fy)) / 1000;
  const PrTie = PHI_T * PnTie;
  const tieOk = PrTie >= PuTie;

  // ── node ──
  const m = NODE_FACTORS[nodeType].m;
  const nodeLimit = m * PHI_C * fc;
  const sigmaNode = (PuNode * 1000) / An;
  const nodeOk = sigmaNode <= nodeLimit;

  // ── crack control mesh (each direction) ──
  const rhoProvided = (nFaces * AbarCrack) / (bw * sBar);
  const rhoMin = 0.003;
  const spacingMax = 300;
  const crackOk = rhoProvided >= rhoMin && sBar <= spacingMax;

  return Object.freeze({
    eps1, fcu, fcuCapped: fcuRaw > 0.85 * fc,
    PnStrut, PrStrut, strutOk,
    PnTie, PrTie, tieOk,
    nodeLimit, sigmaNode, nodeOk,
    rhoProvided, rhoMin, spacingMax, crackOk,
    allOk: strutOk && tieOk && nodeOk && crackOk,
  });
}

/**
 * Two-panel symmetric pier-cap / deep-beam truss helper (PCI §8.12.5
 * geometry): two point loads P_u at distance aLoad each side of two
 * supports — returns member forces of the classic 6-node truss
 * (top tie C–D, diagonals A–C and A–D, bottom chord A–B).
 *   F_CD = P_u/ tanθ₁ ;  F_AC = P_u/ sinθ₁  (compression)
 *   F_AD = P_u/ sinθ₂ ;  F_DE = F_CD + F_AD·cosθ₂
 * θ from the drawn geometry: tanθ = z (lever arm) / horizontal projection.
 */
export interface PierCapTrussInputs {
  /** Factored load per bearing P_u (kN) */
  Pu: number;
  /** Horizontal distance load → near support (mm) */
  aOuter: number;
  /** Horizontal distance inner load → support (mm) */
  aInner: number;
  /** Internal lever arm z between top tie and bottom chord (mm) */
  z: number;
}

export interface PierCapTrussResult {
  readonly theta1: number;   // deg, outer diagonal
  readonly theta2: number;   // deg, inner diagonal
  readonly F_topTie: number; // kN tension
  readonly F_diag1: number;  // kN compression (outer)
  readonly F_diag2: number;  // kN compression (inner)
  readonly F_chord: number;  // kN compression (bottom, at support panel)
}

export function computePierCapTruss(inp: PierCapTrussInputs): PierCapTrussResult {
  const { Pu, aOuter, aInner, z } = inp;
  const t1 = Math.atan(z / aOuter);
  const t2 = Math.atan(z / aInner);
  const F_topTie = Pu / Math.tan(t1);
  const F_diag1 = Pu / Math.sin(t1);
  const F_diag2 = Pu / Math.sin(t2);
  const F_chord = F_topTie + F_diag2 * Math.cos(t2);
  return Object.freeze({
    theta1: (t1 * 180) / Math.PI,
    theta2: (t2 * 180) / Math.PI,
    F_topTie, F_diag1, F_diag2, F_chord,
  });
}
