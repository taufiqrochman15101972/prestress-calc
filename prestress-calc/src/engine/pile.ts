/**
 * Tiang Pancang Prategang (Pretensioned Prestressed Pile) Engine
 * TY Lin & Burns, Ch. 10 — Tension & Compression Members
 * Reference: ACI 318-19, PCI Design Handbook 7th Ed., SNI 7833:2012
 *
 * Covers:
 *  - Section properties (square, circular, octagonal)
 *  - Effective prestress after simplified losses
 *  - Axial capacity (pure compression)
 *  - Flexural capacity (Whitney block)
 *  - Combined P+M interaction check
 *  - Transfer: hanging/lifting check (2-point pickup at 0.207L)
 *  - Driving: dynamic tensile stress limit
 *  - Service: fiber stress under Pu + Mu
 */

export type PileShape = "SQUARE" | "CIRCULAR" | "OCTAGONAL";

// ─── Section Properties ───────────────────────────────────────

export interface PileSectionProps {
  readonly shape: PileShape;
  readonly size: number;    // mm — square: side; circular/octagonal: diameter (face-to-face)
  readonly Ag: number;      // mm²
  readonly Ig: number;      // mm⁴
  readonly yb: number;      // mm — centroid from bottom (= size/2 for all)
  readonly Zg: number;      // mm³ = Ig/yb
  readonly cover: number;   // mm — clear cover to strand centroid
  readonly dp: number;      // mm — strand centroid from extreme compression fiber
}

export function pileSection(shape: PileShape, size: number, cover = 60): PileSectionProps {
  let Ag: number, Ig: number;
  switch (shape) {
    case "SQUARE":
      Ag = size ** 2;
      Ig = size ** 4 / 12;
      break;
    case "CIRCULAR":
      Ag = Math.PI * size ** 2 / 4;
      Ig = Math.PI * size ** 4 / 64;
      break;
    case "OCTAGONAL": {
      // Regular octagon: face-to-face distance D → side a = D·tan(π/8)
      // Ag = 2(1+√2)·a²  ≈ 0.8284·D²
      // Ig ≈ 0.0547·D⁴  (exact for regular octagon)
      Ag = 0.8284 * size ** 2;
      Ig = 0.0547 * size ** 4;
      break;
    }
  }
  const yb = size / 2;
  const dp  = size - cover;
  return Object.freeze({ shape, size, Ag, Ig, yb, Zg: Ig / yb, cover, dp });
}

// ─── Inputs & Results ────────────────────────────────────────

export interface PileInputs {
  shape: PileShape;
  size: number;         // mm
  cover: number;        // mm (to strand centroid)
  fci: number;          // f'ci at transfer (MPa)
  fc: number;           // f'c service (MPa)
  fpu: number;          // strand ultimate (MPa)
  fpy: number;          // strand yield (MPa)
  Eps: number;          // strand modulus (MPa)
  nStrands: number;     // total strands, symmetric layout
  strandArea: number;   // area per strand (mm²)
  jackingRatio: number; // fraction of fpu at jacking (typical 0.75)
  /** Pile length (mm) — for hanging and weight check */
  lengthMm: number;
  /** Design axial load (kN) — positive = compression */
  Pu: number;
  /** Design moment (kN·m) */
  Mu: number;
  /** Design shear (kN) */
  Vu: number;
}

export interface PileResult {
  // Section
  readonly sec: PileSectionProps;
  readonly Aps: number;       // total strand area (mm²)
  // Prestress
  readonly fjack: number;     // jacking stress (MPa)
  readonly Pj: number;        // jacking force (kN)
  readonly fse: number;       // effective prestress after losses (MPa)
  readonly Pe: number;        // effective force (kN)
  readonly etaLoss: number;   // total loss fraction
  // Axial capacity
  readonly Pn0: number;       // pure compression (kN)
  readonly phiPn0: number;    // φ·Pn0 (φ=0.80)
  // Flexural capacity
  readonly fps_bending: number; // tendon stress in pure bending (MPa)
  readonly a_bending: number;   // Whitney block depth for pure bending (mm)
  readonly Mn: number;          // nominal flexural (kN·m)
  readonly phiMn: number;       // φ·Mn (φ=0.90)
  // P-M interaction (simplified linear)
  readonly PMRatio: number;    // Pu/φPn + Mu/φMn ≤ 1.0
  readonly isAdequate: boolean;
  // Fiber stresses under service P_u + M_u
  readonly sigma_top: number;  // MPa (compression = negative)
  readonly sigma_bot: number;  // MPa
  readonly isSlsOk: boolean;
  // Transfer: hanging (2-point pickup at 0.207L from each end)
  readonly wSelf: number;      // self-weight (kN/m)
  readonly M_hang: number;     // max moment during hanging (kN·m)
  readonly sigma_hang_tens: number; // tensile stress during hanging (MPa, positive)
  readonly sigma_hang_comp: number; // compressive stress during hanging (MPa)
  readonly limitHangTens: number;   // ACI limit at transfer (MPa)
  readonly limitHangComp: number;
  readonly isHangOk: boolean;
  // Driving: dynamic tension limit
  readonly sigma_drive_limit: number; // 3√f'ci MPa
}

const PHI_FLEX  = 0.90;
const PHI_COMP  = 0.80;  // for compression-controlled pile
const PHI_SHEAR = 0.75;

/** Simplified losses for pretensioned piles:
 *  ES ≈ n·fcgp (≈ 3–5%); CR+SH+RE ≈ 12–15% total
 *  Combined: fse ≈ (0.78–0.82)·fjack
 */
function simplifiedEffectivePrestress(fjack: number, Aps: number, Ag: number, Ig: number, e = 0): number {
  // Elastic shortening: ΔfES = (Eps/Ec) × fcgp
  // fcgp ≈ Pj/Ag for concentric (e=0)
  const Ec = 4700 * Math.sqrt(40); // approximate Ec at 40 MPa
  const n  = 197_000 / Ec;
  const fcgp = (fjack * Aps) / Ag; // simplified (concentric)
  const deltaES = n * fcgp;
  // Long-term: ~12% of fjack
  const deltaLT = 0.12 * fjack;
  return Math.max(0, fjack - deltaES - deltaLT);
}

function beta1(fc: number): number {
  if (fc <= 28) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((fc - 28) / 7));
}

export function computePile(inp: PileInputs): PileResult {
  const sec = pileSection(inp.shape, inp.size, inp.cover);
  const { Ag, Ig, yb, Zg, dp } = sec;

  const Aps    = inp.nStrands * inp.strandArea;
  const fjack  = inp.jackingRatio * inp.fpu;
  const Pj     = (fjack * Aps) / 1000; // kN
  const fse    = simplifiedEffectivePrestress(fjack, Aps, Ag, Ig);
  const Pe     = (fse * Aps) / 1000;   // kN
  const etaLoss = 1 - fse / fjack;

  // ── Pure axial compression ───────────────────────────────
  // ACI 318 §22.4.2: Pn0 = 0.85f'c(Ag − Aps) + fse·Aps
  const Pn0    = (0.85 * inp.fc * (Ag - Aps) + fse * Aps) / 1000;
  const phiPn0 = PHI_COMP * Pn0;

  // ── Pure flexure (Whitney block, symmetric section) ───────
  // Treat as rectangular section width = sec.size (top in compression)
  // Simplified: effective width for Whitney block = sec.size
  const bEff = sec.shape === "CIRCULAR"
    ? (4/3) * sec.size * 0.5 // effective width at mid-depth ≈ 2r = D (approx)
    : sec.size;

  const gamma_p = 0.28;  // low-relax
  const rho_p   = Aps / (bEff * dp);
  const fps_bending = inp.fpu * (1 - (gamma_p / beta1(inp.fc)) * (rho_p * inp.fpu / inp.fc));

  const T_flex  = Aps * fps_bending;
  const a_bending = T_flex / (0.85 * inp.fc * bEff);
  const Mn = (T_flex * (dp - a_bending / 2)) / 1e6; // kN·m
  const phiMn = PHI_FLEX * Mn;

  // ── Combined P-M (simplified linear interaction) ─────────
  // For compression-controlled: Pu/(φPn0) + Mu/(φMn0) ≤ 1.0
  // For tension case (pile uplift): check fiber stresses only
  const PMRatio = (Math.abs(inp.Pu) / phiPn0) + (inp.Mu / phiMn);

  // ── Fiber stresses under service P+M ─────────────────────
  // Positive P = compression, applied uniformly + eccentrically
  const PuN = inp.Pu * 1000;  // N (compression = positive)
  const MuNmm = inp.Mu * 1e6; // N·mm
  const PeN   = Pe * 1000;
  const MeNmm = PeN * 0; // concentric prestress (e=0 at centroid)

  // Net stress at extreme fibers:
  // σ = −Pe/Ag ± (Pe·e/Zg) + Pu/Ag ± Mu/Zg
  // For concentric prestress (symmetric): fpe effect is purely axial
  const sigma_bot = -PeN/Ag + PuN/Ag + MuNmm/Zg;  // tension at bottom = positive
  const sigma_top = -PeN/Ag + PuN/Ag - MuNmm/Zg;

  const limComp = -0.45 * inp.fc;
  const limTens = +0.50 * Math.sqrt(inp.fc);
  const isSlsOk = sigma_bot >= limComp && sigma_bot <= limTens
                && sigma_top >= limComp && sigma_top <= limTens;

  // ── Hanging check ─────────────────────────────────────────
  // 2-point pickup at 0.207L from each end → M_max = 0.0214·w·L²
  const gammaPile = 25; // kN/m³
  const wSelf = gammaPile * Ag * 1e-6; // kN/m
  const LM = inp.lengthMm / 1000; // m
  const M_hang = 0.0214 * wSelf * LM ** 2; // kN·m (moment between pickup points)

  // At transfer (Pi = Pj, simplified: use Pe conservatively)
  // Fiber stress: f = -Pe/Ag ± M_hang/Zg
  const PeN_transfer = (fjack * 0.95 * Aps); // N — Pi ≈ 0.95·Pj (just after jacking)
  const M_hangNmm = M_hang * 1e6;
  const sigma_hang_tens = -PeN_transfer / Ag + M_hangNmm / Zg; // bottom fiber (tension side)
  const sigma_hang_comp = -PeN_transfer / Ag - M_hangNmm / Zg; // top fiber (compression)

  const limitHangTens = 0.50 * Math.sqrt(inp.fci); // ACI limit at transfer
  const limitHangComp = -0.60 * inp.fci;
  const isHangOk = sigma_hang_tens <= limitHangTens && sigma_hang_comp >= limitHangComp;

  // Driving: dynamic tensile wave limit
  const sigma_drive_limit = 3 * Math.sqrt(inp.fci); // MPa — PCI guideline

  return Object.freeze({
    sec,
    Aps, fjack, Pj, fse, Pe, etaLoss,
    Pn0, phiPn0,
    fps_bending, a_bending, Mn, phiMn,
    PMRatio,
    isAdequate: PMRatio <= 1.0,
    sigma_top, sigma_bot, isSlsOk,
    wSelf, M_hang,
    sigma_hang_tens, sigma_hang_comp,
    limitHangTens, limitHangComp,
    isHangOk,
    sigma_drive_limit,
  });
}
