/**
 * RC T-Beam Bridge Girder — Ordinary Reinforced-Concrete Superstructure
 * ====================================================================
 * Standar Jembatan "Gelagar Beton Bertulang Balok-T, Bentang 5–25 m"
 * (Bina Marga / Direktorat Jenderal Bina Marga, book 152) + AASHTO LRFD
 * §4.6.2.6 (effective flange width) / §5 (RC flexure & shear) + SNI
 * 2847:2019 + SNI 1725:2016 (beban "D").
 *
 * The BETON-BERTULANG-BIASA companion to the prestressed superstructure:
 * a standardised cast-in-place / precast RC T-beam deck-girder for short
 * and medium spans (5–25 m) where prestressing is uneconomic. The deck
 * slab acts as the compression flange of the T; the web carries the
 * tension steel and stirrups.
 *
 * Procedure (chronological design order):
 *   1. Effective flange width  b_eff  (LRFD §4.6.2.6 / SNI 2847 §9.2.4)
 *   2. Loads → factored M_u, V_u  (self + deck + asphalt + "D" live load)
 *   3. Flexure as a T-section: locate the stress block (rectangular if
 *      a ≤ h_f, otherwise true-T with the overhanging-flange couple);
 *      solve A_s, strain-control φ, A_s,min, doubly-reinforced if needed.
 *   4. One-way shear: V_c = 0.17λ√f'c·b_w·d, stirrups A_v/s.
 *
 * CONVENTIONS: dimensions mm, stresses MPa, forces kN, moments kN·m;
 * section-level work in N, N·mm. Tension steel strain control identical to
 * the substructure engine (εcu = 0.003; φ ramp 0.65/0.75 → 0.90). Numeric
 * procedure per the cited codes; never any single PDF's example figures.
 */

import { beta1, phiFromStrain } from "@/engine/substructure";

const ECU = 0.003;

export interface RCGirderInputs {
  /** Span (centre-to-centre of bearings) (m). */
  L: number;
  /** Girder spacing centre-to-centre (m). */
  S: number;
  /** Slab/flange thickness h_f (mm). */
  hf: number;
  /** Web width b_w (mm). */
  bw: number;
  /** Total girder depth incl. slab, H (mm). */
  H: number;
  /** Effective depth d to tension steel centroid (mm). */
  d: number;
  /** f'c (MPa). */
  fc: number;
  /** f_y main bars (MPa). */
  fy: number;
  /** Asphalt wearing-course thickness (mm). */
  tAsphalt: number;
  /** Superimposed dead load (parapet, utilities) per girder (kN/m). */
  wSdl: number;
  /** Concrete unit weight (kN/m³). */
  gammaC: number;
  /** Provided tension-steel area A_s (mm²) — for capacity check. */
  As: number;
  /** Compression-steel area A_s' (mm², 0 if singly reinforced). */
  Asp?: number;
  /** d' to compression steel (mm). */
  dp?: number;
  /** Live-load distribution factor g (per-girder fraction of one lane). */
  gLL?: number;
}

export interface RCGirderResult {
  // geometry / loads
  readonly beff: number;        // effective flange width (mm)
  readonly wSelf: number;       // girder self-weight (kN/m)
  readonly wDeck: number;       // tributary deck weight (kN/m)
  readonly wAsphalt: number;    // asphalt (kN/m)
  readonly wDC: number;         // total dead (kN/m)
  readonly Mlive: number;       // live moment per girder (kN·m)
  readonly Vlive: number;       // live shear per girder (kN)
  readonly Mu: number;          // factored design moment (kN·m)
  readonly Vu: number;          // factored design shear (kN)
  // flexural capacity
  readonly a: number;           // stress-block depth (mm)
  readonly cNA: number;         // neutral-axis depth (mm)
  readonly isTrueT: boolean;    // a > h_f → true T behaviour
  readonly epsT: number;        // net tensile strain
  readonly phi: number;         // strength-reduction factor
  readonly classification: "tarik" | "transisi" | "tekan";
  readonly Mn: number;          // nominal moment (kN·m)
  readonly phiMn: number;       // design moment (kN·m)
  readonly AsMin: number;       // minimum steel (mm²)
  readonly AsReq: number;       // steel required for M_u (mm²)
  readonly flexureOk: boolean;
  readonly minSteelOk: boolean;
  // shear
  readonly Vc: number;          // concrete shear (kN)
  readonly phiVc: number;       // φ·V_c (kN)
  readonly Vs: number;          // stirrup demand (kN)
  readonly AvS: number;         // required A_v/s (mm²/mm)
  readonly sMax: number;        // max stirrup spacing (mm)
  readonly needStirrups: boolean;
  readonly shearOk: boolean;
}

/** Design / check an ordinary RC T-beam bridge girder. */
export function computeRCGirder(i: RCGirderInputs): RCGirderResult {
  const L_mm = i.L * 1000;

  // ── 1. Effective flange width (min of three; LRFD §4.6.2.6 / SNI 2847) ──
  const beff = Math.min(
    L_mm / 4,                 // span/4
    i.S * 1000,               // centre-to-centre girder spacing
    i.bw + 16 * i.hf          // b_w + 16·h_f
  );

  // ── 2. Loads (per girder) ─────────────────────────────────────────────
  const webH = i.H - i.hf;
  const Aweb = i.bw * webH;                       // mm²
  const Aflange = i.S * 1000 * i.hf;              // tributary deck slab mm²
  const wSelf = (Aweb / 1e6) * i.gammaC;          // kN/m (web stem)
  const wDeck = (Aflange / 1e6) * i.gammaC;       // kN/m (tributary slab)
  const wAsphalt = (i.S * (i.tAsphalt / 1000)) * 22; // kN/m (asphalt γ≈22)
  const wDC = wSelf + wDeck + i.wSdl;
  const wDW = wAsphalt;

  // SNI 1725 "D" lane load per girder (simplified equivalent, see bridgeload.ts)
  const q = i.L <= 30 ? 9.0 : 9.0 * (0.5 + 15 / i.L);   // kPa BTR
  const p = 49.0;                                        // kN/m BGT line load
  const FBD = i.L <= 50 ? 0.4 : 0.3;                     // dynamic allowance
  const trib = i.S;                                      // tributary width (m)
  const g = i.gLL ?? 1.0;
  const Mlane = (q * trib) * i.L ** 2 / 8 + (1 + FBD) * (p * trib) * i.L / 4;
  const Mlive = g * Mlane;
  const Vlane = (q * trib) * i.L / 2 + (1 + FBD) * (p * trib) / 2;
  const Vlive = g * Vlane;

  // factored (Strength I): 1.25 DC + 1.5 DW + 1.8 LL  (SNI 1725 Tabel 6)
  const Mdc = wDC * i.L ** 2 / 8;
  const Mdw = wDW * i.L ** 2 / 8;
  const Mu = 1.25 * Mdc + 1.5 * Mdw + 1.8 * Mlive;
  const Vdc = wDC * i.L / 2;
  const Vdw = wDW * i.L / 2;
  const Vu = 1.25 * Vdc + 1.5 * Vdw + 1.8 * Vlive;

  // ── 3. Flexural capacity of the provided steel (T-section) ─────────────
  const b1 = beta1(i.fc);
  const Asp = i.Asp ?? 0;
  const dp = i.dp ?? 50;
  // assume rectangular (flange in compression): a = (As fy − As' fy)/(0.85 f'c b_eff)
  let a = ((i.As - Asp) * i.fy) / (0.85 * i.fc * beff);
  let isTrueT = false;
  let Mn: number;
  if (a <= i.hf) {
    // rectangular section of width b_eff
    Mn = (i.As * i.fy * (i.d - a / 2) + Asp * i.fy * (i.d - dp)) / 1e6;
  } else {
    // ── true T: overhanging-flange couple + web couple ──
    isTrueT = true;
    const Asf = (0.85 * i.fc * (beff - i.bw) * i.hf) / i.fy; // steel for flange overhang
    const Asw = i.As - Asf;
    a = (Asw * i.fy) / (0.85 * i.fc * i.bw);                 // web block depth
    const Mflange = Asf * i.fy * (i.d - i.hf / 2);
    const Mweb = Asw * i.fy * (i.d - a / 2);
    Mn = (Mflange + Mweb) / 1e6;
  }
  const cNA = a / b1;
  const epsT = ECU * (i.d - cNA) / cNA;
  const sc = phiFromStrain(epsT, i.fy);
  const phi = sc.phi;
  const phiMn = phi * Mn;

  // A_s,min = max(0.25√f'c/fy·b_w·d, 1.4/fy·b_w·d)  (SNI 2847 §9.6.1)
  const AsMin = Math.max(
    (0.25 * Math.sqrt(i.fc) / i.fy) * i.bw * i.d,
    (1.4 / i.fy) * i.bw * i.d
  );
  // A_s required for M_u (iterate jd): A_s = M_u/(φ fy jd), jd≈0.9d first pass
  let AsReq = (Mu * 1e6) / (0.9 * i.fy * 0.92 * i.d);
  for (let k = 0; k < 6; k++) {
    const aa = (AsReq * i.fy) / (0.85 * i.fc * beff);
    AsReq = (Mu * 1e6) / (0.9 * i.fy * (i.d - aa / 2));
  }
  const flexureOk = phiMn >= Mu;
  const minSteelOk = i.As >= AsMin;

  // ── 4. One-way shear (SNI 2847 §22.5 / LRFD simplified) ────────────────
  const Vc = (0.17 * Math.sqrt(i.fc) * i.bw * i.d) / 1000; // kN
  const phiV = 0.75;
  const phiVc = phiV * Vc;
  const needStirrups = Vu > 0.5 * phiVc;
  const Vs = Math.max(0, Vu / phiV - Vc);                  // kN
  const AvS = (Vs * 1000) / (i.fy * i.d);                  // mm²/mm
  // s_max: d/2 ≤ 600, halved if Vs > 0.33√f'c b_w d
  const VsLimit = (0.33 * Math.sqrt(i.fc) * i.bw * i.d) / 1000;
  const sMax = Vs > VsLimit ? Math.min(i.d / 4, 300) : Math.min(i.d / 2, 600);
  const VsCap = (0.66 * Math.sqrt(i.fc) * i.bw * i.d) / 1000; // max Vs allowed
  const shearOk = Vs <= VsCap;

  return Object.freeze({
    beff, wSelf, wDeck, wAsphalt, wDC, Mlive, Vlive, Mu, Vu,
    a, cNA, isTrueT, epsT, phi, classification: sc.classification, Mn, phiMn,
    AsMin, AsReq, flexureOk, minSteelOk,
    Vc, phiVc, Vs, AvS, sMax, needStirrups, shearOk,
  });
}
