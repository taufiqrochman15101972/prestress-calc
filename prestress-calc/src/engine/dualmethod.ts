/**
 * Dual Design Method — Full Prestressing vs LRFD Partial Prestressing
 * Computes BOTH philosophies in parallel for the same section/forces so they
 * can be displayed side-by-side (the user works both ways):
 *
 *   FULL (ACI Class U, "fully prestressed") — service tension limited to
 *     0.5√f'c; the section is expected to stay UNCRACKED. No bonded mild steel
 *     is relied upon for the SLS tension.
 *   PARTIAL (ACI Class C / AASHTO LRFD partial prestressing) — service tension
 *     up to 1.0√f'c is permitted; beyond the rupture stress f_r = 0.62√f'c the
 *     section CRACKS and bonded reinforcement controls the crack width
 *     (Gergely–Lutz). The Partial Prestress Ratio PPR = A_ps·f_ps /
 *     (A_ps·f_ps + A_s·f_y) quantifies how much of the tension capacity is
 *     prestressed.
 *
 * The fibre stresses are identical for both methods — only the ALLOWABLE
 * tension, the verdict and the cracked-section checks differ.
 *
 * + tension, − compression.  Internal SI: N, mm, MPa, kN·m.
 */

import { computeCrackWidth, crackedSectionSteel } from "@/engine/crackwidth";

export interface DualMethodInputs {
  /** Service top-fibre stress (MPa, + tension) */
  sigmaTopService: number;
  /** Service bottom-fibre stress (MPa, + tension) */
  sigmaBotService: number;
  /** Concrete service strength f'c (MPa) */
  fc: number;
  /** Service moment (kN·m) */
  Mservice: number;
  /** Cracking moment (kN·m) */
  Mcr: number;
  /** Prestressing steel area A_ps (mm²) */
  Aps: number;
  /** Stress in prestressing steel at flexural strength f_ps (MPa) */
  fps: number;
  /** Provided bonded mild-steel area A_s (mm²) */
  As: number;
  /** Mild-steel yield f_y (MPa) */
  fy: number;
  /** Lever arm to the bonded steel jd ≈ 0.9·yb (mm) */
  jd: number;
  /** Web width for crack-spacing (mm) */
  bw: number;
}

export interface MethodVerdict {
  readonly limTens: number;     // service tension limit (MPa)
  readonly limComp: number;     // service compression limit (MPa)
  readonly topSafe: boolean;
  readonly botSafe: boolean;
  readonly safe: boolean;
}

export interface DualMethodResult {
  readonly sigmaTop: number;
  readonly sigmaBot: number;
  readonly fr: number;          // modulus of rupture 0.62√f'c (MPa)
  readonly full: MethodVerdict;
  readonly partial: MethodVerdict & {
    readonly cracked: boolean;
    readonly fsSteel: number;       // service steel stress (MPa)
    readonly crackWidthMm: number;  // Gergely–Lutz crack width (mm)
    readonly crackOk: boolean;      // ≤ 0.3 mm (exterior)
    readonly AsForCrack: number;    // bonded steel to hold w ≤ 0.3 mm (mm²)
    readonly PPR: number;           // partial prestress ratio
  };
  readonly governs: string;
}

const CRACK_LIMIT = 0.30; // mm, exterior exposure

export function computeDualMethod(inp: DualMethodInputs): DualMethodResult {
  const { sigmaTopService: st, sigmaBotService: sb, fc, Mservice, Mcr, Aps, fps, As, fy, jd, bw } = inp;

  const sqrtFc = Math.sqrt(fc);
  const fr = 0.62 * sqrtFc;
  const limComp = 0.45 * fc;

  // ── Full prestressing (Class U) ────────────────────────────
  const fullTens = 0.50 * sqrtFc;
  const fullTopSafe = st <= fullTens && st >= -limComp;
  const fullBotSafe = sb <= fullTens && sb >= -limComp;
  const full: MethodVerdict = Object.freeze({
    limTens: fullTens, limComp,
    topSafe: fullTopSafe,
    botSafe: fullBotSafe,
    safe: fullTopSafe && fullBotSafe,
  });

  // ── Partial prestressing (Class C / LRFD) ──────────────────
  const partTens = 1.00 * sqrtFc;
  const topSafeP = st <= partTens && st >= -limComp;
  const botSafeP = sb <= partTens && sb >= -limComp;

  const cracked = sb > fr;     // bottom fibre exceeds rupture → cracked
  // Service steel stress in the cracked section (decompression-based)
  const AsEff = Math.max(As, 1);
  const fsSteel = cracked ? crackedSectionSteel(Mservice, Mcr, AsEff, jd) : 0;
  const nBars = Math.max(1, Math.round(AsEff / 200));
  const cw = cracked
    ? computeCrackWidth({ fs: fsSteel, dc: 40, bw, nBars, exposure: "exterior" })
    : null;
  const crackWidthMm = cw ? cw.w_cr : 0;
  const crackOk = !cracked || crackWidthMm <= CRACK_LIMIT;

  // Bonded steel needed to hold the crack width ≤ limit (scale linearly: w ∝ fs ∝ 1/As)
  const AsForCrack = cracked && crackWidthMm > CRACK_LIMIT
    ? AsEff * (crackWidthMm / CRACK_LIMIT)
    : AsEff;

  const PPR = (Aps * fps) > 0
    ? (Aps * fps) / (Aps * fps + Math.max(As, 0) * fy)
    : 1.0;

  const partial = Object.freeze({
    limTens: partTens, limComp,
    topSafe: topSafeP, botSafe: botSafeP,
    safe: topSafeP && botSafeP && crackOk,
    cracked, fsSteel, crackWidthMm, crackOk, AsForCrack, PPR,
  });

  const governs = full.safe
    ? "Penampang memenuhi prategang PENUH (tak retak) — paling konservatif."
    : partial.safe
      ? "Prategang PENUH overstress; metode PARSIAL (LRFD) memadai dengan kontrol retak."
      : "Kedua metode overstress — tambah prategang / penampang / tulangan.";

  return Object.freeze({
    sigmaTop: st, sigmaBot: sb, fr,
    full, partial, governs,
  });
}
