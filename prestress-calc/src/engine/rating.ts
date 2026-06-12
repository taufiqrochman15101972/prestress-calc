/**
 * Bridge Load Rating Engine — LRFR (Load & Resistance Factor Rating)
 * CDOT Bridge Rating Manual §9B "Post-Tensioned Concrete Girder Bridges"
 * (procedure / required checks) with factors per AASHTO Manual for Bridge
 * Evaluation (MBE) §6A — the LRFR companion of the project's AASHTO LRFD path.
 *
 * Rating factor (strength limit states):
 *     RF = (φ_c·φ_s·φ·R_n − γ_DC·DC − γ_DW·DW) / (γ_LL·(LL + IM))
 *       Inventory : γ_DC = 1.25, γ_DW = 1.50, γ_LL = 1.75
 *       Operating : same dead-load factors,   γ_LL = 1.35
 *       φ_c·φ_s ≥ 0.85
 *
 * Service III (prestressed members, inventory level only, γ_LL = 0.80):
 *     RF = (f_R − f_D) / (γ_LL · f_LL)
 *     f_R = allowable tension  (0.5·√f'c per adopted code)
 *     f_D = bottom-fibre stress under dead load + effective prestress
 *           (+ tension convention; compression reserve makes RF larger)
 *
 * The governing (smallest) RF rates the bridge; RF ≥ 1.0 = adequate for the
 * rating vehicle. Tonnage = RF × rating-vehicle weight.
 *
 * Inputs in kN·m / kN / MPa. Pure function, frozen result.
 */

export interface RatingInputs {
  // ── Capacities (nominal, UNfactored — φ applied here) ────────
  /** Nominal flexural capacity M_n (kN·m) */
  Mn: number;
  /** Nominal shear capacity V_n (kN) */
  Vn: number;
  /** Resistance factor flexure φ_f (—) */
  phiF: number;
  /** Resistance factor shear φ_v (—) */
  phiV: number;
  /** Condition factor φ_c (1.00 good / 0.95 fair / 0.85 poor) */
  phiC: number;
  /** System factor φ_s (redundancy; 1.00 multi-girder) */
  phiS: number;

  // ── Load effects at the rated section ────────────────────────
  /** Moment from structural dead load DC (kN·m) */
  M_DC: number;
  /** Moment from wearing surface / utilities DW (kN·m) */
  M_DW: number;
  /** Moment from rating live load incl. impact LL+IM (kN·m) */
  M_LL: number;
  /** Shear from DC (kN) */
  V_DC: number;
  /** Shear from DW (kN) */
  V_DW: number;
  /** Shear from rating live load incl. impact (kN) */
  V_LL: number;

  // ── Service III stress rating (bottom fibre, + tension) ──────
  /** Bottom-fibre stress: dead load + effective prestress combined (MPa) */
  fD_bot: number;
  /** Bottom-fibre stress from the rating live load (MPa, tension +) */
  fLL_bot: number;
  /** f'c at service for the tension limit (MPa) */
  fc: number;

  /** Rating-vehicle gross weight (kN) — for the tonnage line */
  vehicleWeight: number;
}

export interface RatingLine {
  /** Capacity term C (kN·m, kN, or MPa) */
  readonly C: number;
  /** Total factored dead-load effect (same unit) */
  readonly D: number;
  /** Factored live-load effect (same unit) */
  readonly L: number;
  readonly RF: number;
  readonly ok: boolean;
}

export interface RatingResult {
  readonly flexInv: RatingLine;
  readonly flexOp: RatingLine;
  readonly shearInv: RatingLine;
  readonly shearOp: RatingLine;
  readonly serviceIII: RatingLine;
  /** Smallest rating factor of all checks */
  readonly RFgoverning: number;
  readonly governs: string;
  /** Safe load = RF_inv,governing × vehicle weight (kN) */
  readonly safeLoadInv: number;
  /** Operating load = RF_op,governing × vehicle weight (kN) */
  readonly safeLoadOp: number;
  readonly adequate: boolean;
}

const G_DC = 1.25, G_DW = 1.5, G_LL_INV = 1.75, G_LL_OP = 1.35, G_LL_SRV = 0.8;

function line(C: number, D: number, L: number): RatingLine {
  const RF = L > 0 ? (C - D) / L : Infinity;
  return { C, D, L, RF, ok: RF >= 1.0 };
}

export function computeRating(inp: RatingInputs): RatingResult {
  const {
    Mn, Vn, phiF, phiV, phiC, phiS,
    M_DC, M_DW, M_LL, V_DC, V_DW, V_LL,
    fD_bot, fLL_bot, fc, vehicleWeight,
  } = inp;

  const phiSys = Math.max(0.85, phiC * phiS); // MBE floor φ_c·φ_s ≥ 0.85

  // ── Strength I — flexure ─────────────────────────────────────
  const Cm = phiSys * phiF * Mn;
  const Dm = G_DC * M_DC + G_DW * M_DW;
  const flexInv = line(Cm, Dm, G_LL_INV * M_LL);
  const flexOp = line(Cm, Dm, G_LL_OP * M_LL);

  // ── Strength I — shear ───────────────────────────────────────
  const Cv = phiSys * phiV * Vn;
  const Dv = G_DC * V_DC + G_DW * V_DW;
  const shearInv = line(Cv, Dv, G_LL_INV * V_LL);
  const shearOp = line(Cv, Dv, G_LL_OP * V_LL);

  // ── Service III — bottom-fibre tension (inventory only) ──────
  // f_R = allowable tension; margin = f_R − f_D (f_D negative when the
  // dead-load + prestress state is still in compression → bigger margin).
  const fR = 0.5 * Math.sqrt(fc);
  const serviceIII = line(fR, fD_bot, G_LL_SRV * fLL_bot);

  // ── Governing ────────────────────────────────────────────────
  const all: [string, RatingLine][] = [
    ["Lentur (Strength I, Inventory)", flexInv],
    ["Geser (Strength I, Inventory)", shearInv],
    ["Service III (tegangan tarik)", serviceIII],
  ];
  let governs = all[0][0];
  let RFgoverning = all[0][1].RF;
  for (const [name, l] of all) {
    if (l.RF < RFgoverning) { RFgoverning = l.RF; governs = name; }
  }

  const safeLoadInv = RFgoverning * vehicleWeight;
  const safeLoadOp = Math.min(flexOp.RF, shearOp.RF) * vehicleWeight;

  return Object.freeze({
    flexInv, flexOp, shearInv, shearOp, serviceIII,
    RFgoverning, governs, safeLoadInv, safeLoadOp,
    adequate: RFgoverning >= 1.0,
  });
}
