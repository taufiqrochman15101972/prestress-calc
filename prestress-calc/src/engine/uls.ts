/**
 * Layer 5 — ULS Detailing Suite
 * Flexural capacity (Whitney block iteration), shear (Vci/Vcw), deflection,
 * interface shear, and load-balance analysis.
 */

import type {
  TendonConfig,
  GrossSectionProps,
  CompositeSectionProps,
  IGirderGeometry,
  DeckGeometry,
  ULSFlexureResult,
  ULSShearResult,
  InterfaceShearResult,
  DeflectionResult,
  LoadBalanceResult,
} from "@/types";
import { girderHeight } from "@/engine/section";

const PHI_FLEX  = 0.90;
const PHI_SHEAR = 0.75;

// ─── β₁ Factor (ACI 318-19 Table 22.2.2.4.3) ────────────────

function beta1(fcMpa: number): number {
  if (fcMpa <= 28) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((fcMpa - 28) / 7));
}

// ─── Compression block depth for 5-zone I-girder + deck ──────

/**
 * Net compression force in the Whitney stress block for a given depth a.
 * Zones (bottom of block = top of composite section, a measured down):
 *   Zone 1: deck slab (fc_deck × b_eff)
 *   Zone 2: top flange rectangle (fc_girder × b1 × h1_eff)
 *   Zone 3: top fillet (trapezoid: b1 → b2, height h5)
 *   Zone 4: web (fc_girder × b2)
 *
 * a is measured from the TOP of the composite section downward.
 * td = deck thickness, h1 = girder top flange, h5 = top fillet.
 */
function compressionForce(
  a: number,
  td: number,
  h1: number,
  h5: number,
  fc_deck: number,
  fc_girder: number,
  bEff: number,
  b1: number,
  b2: number
): number {
  let C = 0;
  const h1_fillet = h5; // fillet depth

  if (a <= td) {
    // Entirely in deck
    C = 0.85 * fc_deck * bEff * a;
  } else if (a <= td + h1) {
    // Deck + part of top flange
    C = 0.85 * fc_deck * bEff * td
      + 0.85 * fc_girder * b1 * (a - td);
  } else if (a <= td + h1 + h1_fillet) {
    // Deck + full top flange + part of top fillet
    const intoFillet = a - td - h1;
    // Width at fillet depth d from top of fillet: linearly interpolates b1→b2
    const w_top  = b1;
    const w_bot  = b2;
    const w_avg  = w_top + (w_bot - w_top) * (intoFillet / h1_fillet) / 2
                   + w_top / 2; // trapezoid average up to intoFillet
    // More precisely: average width from 0 to intoFillet
    // w(z) = b1 + (b2-b1)·z/h_fillet  → avg = b1 + (b2-b1)·intoFillet/(2·h_fillet)
    const wAvgFillet = b1 + (b2 - b1) * intoFillet / (2 * h1_fillet);
    C = 0.85 * fc_deck * bEff * td
      + 0.85 * fc_girder * b1 * h1
      + 0.85 * fc_girder * wAvgFillet * intoFillet;
  } else {
    // Into web
    const intoWeb = a - td - h1 - h1_fillet;
    const filletContrib = h1_fillet > 0
      ? 0.85 * fc_girder * ((b1 + b2) / 2) * h1_fillet
      : 0;
    C = 0.85 * fc_deck * bEff * td
      + 0.85 * fc_girder * b1 * h1
      + filletContrib
      + 0.85 * fc_girder * b2 * intoWeb;
  }

  return C;
}

/** Stiffness dC/da for Newton update */
function dCda(
  a: number,
  td: number,
  h1: number,
  h5: number,
  fc_deck: number,
  fc_girder: number,
  bEff: number,
  b1: number,
  b2: number
): number {
  const h5e = h5 > 0 ? h5 : 0;
  if (a <= td)                    return 0.85 * fc_deck * bEff;
  if (a <= td + h1)               return 0.85 * fc_girder * b1;
  if (a <= td + h1 + h5e)         return 0.85 * fc_girder * (b1 + b2) / 2;
  return 0.85 * fc_girder * b2;
}

// ─── Flexural ULS ────────────────────────────────────────────

export interface ULSFlexInputs {
  tendon: TendonConfig;
  girder: IGirderGeometry;
  deck: DeckGeometry;
  comp: CompositeSectionProps;
  gross: GrossSectionProps;
  As: number;
  fy: number;
  Mu: number;
  Mcr?: number;   // for 1.2Mcr check
}

/**
 * Flexural strength using Whitney equivalent stress block.
 * Iterates block depth 'a' until ΣF = 0 within 1×10⁻⁵ N.
 * Handles 5-zone compression (deck, top flange, fillet, web).
 */
export function computeFlexuralStrength(inputs: ULSFlexInputs): ULSFlexureResult {
  const { tendon, girder, deck, comp, gross, As, fy, Mu, Mcr = 0 } = inputs;

  const Aps = tendon.totalStrands! * tendon.singleStrandArea;
  const fpu = tendon.fpu;
  const fc_girder = deck.fcGirder;
  const fc_deck   = deck.fcDeck;
  const b1_factor = beta1(fc_deck);

  const h5 = girder.h5 ?? 0;
  const h4 = girder.h4 ?? 0;

  // Composite height and tendon depth from top
  const hComp        = gross.hTotal + deck.thicknessTd;
  const tendonFromBot = gross.yb - tendon.eccentricityMidspan!;
  const dp = hComp - tendonFromBot;

  // Mild steel effective depth (assume bottom of bottom flange + ~50mm cover)
  const d = hComp - 50;

  // ρ_p and ω for f_ps formula (ACI 318-19 Eq. 20.3.2.4a)
  const rho_p  = Aps / (deck.widthBeff * dp);
  const omega   = As > 0 ? (As * fy) / (deck.widthBeff * dp * fc_deck) : 0;
  const gamma_p = 0.28; // low-relaxation strand

  const fps = fpu * (
    1 - (gamma_p / b1_factor) * (rho_p * fpu / fc_deck + (d / dp) * omega)
  );

  const Ttotal = Aps * fps + As * fy;

  // Initial estimate of a
  let a = Ttotal / (0.85 * fc_deck * deck.widthBeff);
  const MAX_ITER = 800;
  const TOL      = 1e-4; // N

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const Cb = compressionForce(
      a, deck.thicknessTd, girder.h1, h5,
      fc_deck, fc_girder, deck.widthBeff, girder.b1, girder.b2
    );
    const residual = Cb - Ttotal;
    if (Math.abs(residual) < TOL) break;
    const dc = dCda(
      a, deck.thicknessTd, girder.h1, h5,
      fc_deck, fc_girder, deck.widthBeff, girder.b1, girder.b2
    );
    a -= residual / (dc || 1);
    a = Math.max(1, a);
  }

  const c = a / b1_factor;

  // Nominal moment (N·mm → kN·m)
  const Mn_Nmm = Aps * fps * (dp - a / 2) + As * fy * (d - a / 2);
  const Mn     = Mn_Nmm / 1e6;
  const phiMn  = PHI_FLEX * Mn;

  // 1.2 Mcr check (ACI 318 §9.6.2.1 / 20.3.2.5)
  const Mcr_12   = 1.2 * Mcr;
  const govMn    = Math.max(phiMn, Mcr_12);
  const is12McrOk = phiMn >= Mcr_12;

  return Object.freeze({
    fps,
    a,
    c,
    Mn,
    phiMn,
    Mu,
    isAdequate: phiMn >= Mu,
    Mcr_12,
    govMn,
    is12McrOk,
  });
}

// ─── Shear ULS ───────────────────────────────────────────────

export interface ULSShearInputs {
  Vu: number;
  Pe: number;
  thetaSupport: number;
  gross: GrossSectionProps;
  fc: number;
  fpc: number;
  fpe: number;
  fd: number;
  Vd: number;
  Vi: number;
  Mmax: number;
  Mcr: number;
  bw: number;
  dv: number;
  fys: number;
}

export function computeShearStrength(inputs: ULSShearInputs): ULSShearResult {
  const { Vu, Pe, thetaSupport, fc, fpc, fpe, fd, Vd, Vi, Mmax, bw, dv, fys } = inputs;

  const Vp = Pe * Math.sin(thetaSupport);

  const Mcr = inputs.Mcr;

  // Vci — flexure-shear cracking (ACI 318-19 §22.5.8.3.1)
  const VciMin = (0.17 * Math.sqrt(fc) * bw * dv) / 1000;
  const Vci = Math.max(
    VciMin,
    (0.05 * Math.sqrt(fc) * bw * dv) / 1000 + Vd + (Vi * Mcr) / Math.max(Mmax, 1e-6)
  );

  // Vcw — web-shear cracking (ACI 318-19 §22.5.8.3.2)
  const Vcw = ((0.29 * Math.sqrt(fc) + 0.3 * fpc) * bw * dv) / 1000 + Vp;

  const Vc = Math.min(Vci, Vcw);

  const VsRequired = Vu / PHI_SHEAR - Vc - Vp;
  const AvPerS = Math.max(0, (VsRequired * 1000) / (fys * dv));

  return Object.freeze({
    Vp,
    Vci,
    Vcw,
    Vc,
    AvPerS,
    Vu,
    Mcr,
    dv: inputs.dv,
    bw: inputs.bw,
    isAdequate: PHI_SHEAR * (Vc + Vp) >= Vu,
  });
}

// ─── Interface Shear ────────────────────────────────────────

export interface InterfaceShearInputs {
  Vu: number;
  comp: CompositeSectionProps;
  gross: GrossSectionProps;
  hGirder: number;
  tDeck: number;
  bvi: number;
  fy_avf: number;
  roughened?: boolean;
}

export function computeInterfaceShear(inp: InterfaceShearInputs): InterfaceShearResult {
  const { Vu, comp, gross, hGirder, tDeck, bvi, fy_avf, roughened = true } = inp;

  const y_deck  = hGirder + tDeck / 2;
  const Q_deck  = comp.deckTransformedArea * (y_deck - comp.ybc);
  const Vhu     = (Vu * 1000 * Q_deck) / comp.momentOfInertiaIc;

  const c  = roughened ? 0.52 : 0.17;
  const mu = roughened ? 1.0  : 0.6;

  const phiVni_conc = PHI_SHEAR * c * bvi;
  const AvfPerS_req = phiVni_conc >= Vhu
    ? 0
    : Math.max(0, (Vhu / PHI_SHEAR - c * bvi) / (mu * fy_avf));

  const sMax   = Math.min(gross.hTotal / 4, 600);
  const phi_Vni_total = PHI_SHEAR * (c * bvi + mu * Math.max(AvfPerS_req, 0) * fy_avf);

  return Object.freeze({
    Vhu,
    bvi,
    cFactor: c,
    muFactor: mu,
    phiVni_conc,
    AvfPerS_req,
    sMax,
    isAdequate: phi_Vni_total >= Vhu,
  });
}

// ─── Deflection ──────────────────────────────────────────────

export interface DeflectionInputs {
  Pe: number;
  Pi: number;
  e_midspan: number;
  spanMm: number;
  EcGirder: number;
  gross: GrossSectionProps;
  comp: CompositeSectionProps;
  wSelf: number;
  wDeck: number;
  wLive: number;
  creepMultiplier?: number;
}

export function computeDeflection(inputs: DeflectionInputs): DeflectionResult {
  const {
    Pe, Pi, e_midspan, spanMm, EcGirder, gross, comp,
    wSelf, wDeck, wLive, creepMultiplier = 2.0,
  } = inputs;

  const LMm = spanMm;
  const EI  = EcGirder * gross.momentOfInertiaIg;
  const EIc = EcGirder * comp.momentOfInertiaIc;

  const PeN = Pe * 1000;
  const deltaCamber = (5 / 48) * (PeN * e_midspan * LMm ** 2) / EI;

  function udl(w_kNm: number, EI_Nmm2: number): number {
    return (5 * w_kNm * LMm ** 4) / (384 * EI_Nmm2);
  }

  const deltaSW   = udl(wSelf, EI);
  const deltaDeck = udl(wDeck, EI);
  const deltaLive = udl(wLive, EIc);

  const deltaTotal =
    deltaCamber  * creepMultiplier
    - deltaSW    * creepMultiplier
    - deltaDeck  * creepMultiplier
    - deltaLive;

  const limitLive  = spanMm / 360;
  const limitTotal = spanMm / 300;

  return Object.freeze({
    deltaCamber,
    deltaSW,
    deltaDeck,
    deltaLive,
    deltaTotal,
    limitLive,
    limitTotal,
    liveOk:  deltaLive <= limitLive,
    totalOk: Math.abs(deltaTotal) <= limitTotal,
  });
}

// ─── Load Balance ────────────────────────────────────────────

/**
 * Equivalent upward load from parabolic prestress profile.
 * w_bal = 8·Pe·Δe / L²   [kN/m]
 * M_bal = Pe · e_mid      [kN·m]
 */
export function computeLoadBalance(
  Pe: number,        // kN
  eMidspan: number,  // mm
  eSupport: number,  // mm
  spanMm: number,    // mm
  Mservice: number   // kN·m
): LoadBalanceResult {
  const LM    = spanMm / 1000;   // m
  const delta = (eMidspan - eSupport) / 1000; // m
  const w_bal = (8 * Pe * delta) / (LM ** 2); // kN/m
  const M_bal = Pe * eMidspan / 1000;          // kN·m (Pe·e_mid)
  const percentBalance = Mservice > 0 ? (M_bal / Mservice) * 100 : 0;

  return Object.freeze({ w_bal, M_bal, percentBalance });
}

// ─── Ductility Check (ACI 318-19 §21.2) ─────────────────────

export interface DuctilityResult {
  /** Net tensile strain at extreme tension steel */
  readonly epsilon_t: number;
  /** ACI classification: "tension-controlled" | "transition" | "compression-controlled" */
  readonly strainClass: "tension-controlled" | "transition" | "compression-controlled";
  /** Applicable φ factor */
  readonly phi: number;
  /** c/dp ratio */
  readonly c_dp_ratio: number;
  /** Is section ductile (εt ≥ 0.004)? */
  readonly isDuctile: boolean;
}

/**
 * ACI 318-19 §21.2: εt = εcu × (dt − c) / c  where εcu = 0.003
 * Tension-controlled: εt ≥ 0.005 → φ = 0.90
 * Transition:         0.002 ≤ εt < 0.005 → φ interpolated 0.65–0.90
 * Compression-ctrl:   εt < 0.002 → φ = 0.65
 */
export function checkDuctility(c_mm: number, dp_mm: number): DuctilityResult {
  const ECU = 0.003;
  const epsilon_t = ECU * (dp_mm - c_mm) / c_mm;
  const c_dp_ratio = c_mm / dp_mm;

  let strainClass: DuctilityResult["strainClass"];
  let phi: number;
  if (epsilon_t >= 0.005) {
    strainClass = "tension-controlled"; phi = 0.90;
  } else if (epsilon_t >= 0.002) {
    strainClass = "transition";
    // Linear interpolation 0.65→0.90 over 0.002→0.005
    phi = 0.65 + (0.90 - 0.65) * (epsilon_t - 0.002) / (0.005 - 0.002);
  } else {
    strainClass = "compression-controlled"; phi = 0.65;
  }

  return Object.freeze({ epsilon_t, strainClass, phi, c_dp_ratio, isDuctile: epsilon_t >= 0.004 });
}

// ─── Minimum Flexural Reinforcement (ACI 318-19 §9.6.2) ──────

export interface MinSteelResult {
  /** ACI §9.6.2.1: Mn ≥ 1.2·Mcr */
  readonly Mn_12Mcr_req: number;   // kN·m
  readonly is_12Mcr_Ok: boolean;
  /** ACI §9.6.2.2: Mn ≥ 1.33·Mu */
  readonly Mn_133Mu_req: number;   // kN·m
  readonly is_133Mu_Ok: boolean;
  /** Governing minimum */
  readonly Mn_min_req: number;
  readonly isMinOk: boolean;
}

export function checkMinSteel(Mcr: number, Mu: number, phiMn: number): MinSteelResult {
  const req12Mcr = 1.2 * Mcr;
  const req133Mu = 1.33 * Mu;
  return Object.freeze({
    Mn_12Mcr_req: req12Mcr,
    is_12Mcr_Ok: phiMn >= req12Mcr,
    Mn_133Mu_req: req133Mu,
    is_133Mu_Ok: phiMn >= req133Mu,
    Mn_min_req: Math.min(req12Mcr, req133Mu), // ACI: either (a) or (b) is sufficient
    isMinOk: phiMn >= req12Mcr || phiMn >= req133Mu,
  });
}

// ─── fps for Unbonded Tendons (ACI 318-19 §20.3.2.4b) ────────

/**
 * ACI Eq. 20.3.2.4.a-c for unbonded single-strand tendons:
 *   fps = fse + 10000/dp + f'c/(100·ρ_p)  [psi, in → convert]
 * or in SI (approximate equivalent):
 *   fps = fse + 70 + fc'/(100·ρ_p)        [MPa]
 * Subject to: fps ≤ fpy  and  fps ≤ fse + 420 MPa
 *
 * For span-to-depth ratio:
 *   L/dp ≤ 35: Eq. (a) — use 70 MPa
 *   L/dp > 35: Eq. (b) — use 35 MPa
 */
export function computeUnbondedFps(
  fse_MPa: number,   // effective prestress
  fpy_MPa: number,   // yield stress
  fc_MPa: number,    // f'c
  rho_p: number,     // Aps / (b·dp)
  L_dp_ratio: number // span/dp
): number {
  const delta = L_dp_ratio <= 35 ? 70 : 35; // MPa
  const fps_calc = fse_MPa + delta + fc_MPa / (100 * rho_p);
  return Math.min(fps_calc, fpy_MPa, fse_MPa + 420);
}

// ─── PCI Deflection Multipliers (PCI Design Handbook 7th Ed.) ──

/**
 * PCI multipliers for long-term deflection of pretensioned members.
 * Branson method (1963) / PCI Table 4.4.2.
 *
 * At erection (typical 30–60 days):
 *   Camber ×1.80, Deflection (DL) ×1.85
 * Final after SDL:
 *   Camber ×1.80, DL ×2.70
 */
export const PCI_MULTIPLIERS = Object.freeze({
  /** Multiplier for initial camber at erection */
  camber_at_erection: 1.80,
  /** Multiplier for dead-load deflection at erection */
  dl_at_erection: 1.85,
  /** Final long-term multiplier for camber (prestress) */
  camber_final: 1.80,
  /** Final long-term multiplier for dead-load deflection */
  dl_final: 2.70,
  /** Live load — no creep multiplier (instantaneous) */
  ll_multiplier: 1.00,
} as const);

export interface DeflectionStagedResult extends DeflectionResult {
  /** At erection: camber minus DL (before SDL) */
  readonly delta_erection: number;
  /** Final net (after creep on all DL + live) */
  readonly delta_final_net: number;
  /** PCI method used? */
  readonly usedPCI: boolean;
}

export function computeDeflectionPCI(inputs: DeflectionInputs): DeflectionStagedResult {
  const base = computeDeflection(inputs);
  const m = PCI_MULTIPLIERS;
  const delta_erection  = base.deltaCamber * m.camber_at_erection - base.deltaSW * m.dl_at_erection;
  const delta_final_net = base.deltaCamber * m.camber_final - base.deltaSW * m.dl_final
                        - base.deltaDeck * m.dl_final - base.deltaLive;
  return Object.freeze({
    ...base,
    delta_erection,
    delta_final_net,
    usedPCI: true,
  });
}

// ─── Fatigue Check (ACI 318-19 §26.12, TY Lin Ch.13) ─────────

export interface FatigueResult {
  /** Live-load stress range in prestressed steel (MPa) */
  readonly delta_fps: number;
  /** ACI limit for stress range in low-relax strand: 125 MPa */
  readonly limit: number;
  /** true if delta_fps ≤ limit */
  readonly isOk: boolean;
}

/**
 * Fatigue stress range in bonded tendon at midspan.
 * Δfps = Aps_area and M_live contribution at cracked section.
 * Simplified: Δfps ≈ M_live × dp / (Aps × d_arm × jd)
 * More precise: use cracked section analysis
 *
 * ACI 318-19 §26.12.5.1: stress range ≤ 125 MPa for low-relax strand.
 */
export function checkFatigue(
  M_live_kNm: number,
  Aps: number,     // mm²
  dp: number,      // mm — tendon depth from compression face
  jd = 0.90        // lever arm factor ≈ 0.85–0.95
): FatigueResult {
  // Stress range = M_live / (Aps × j × dp)
  const delta_fps = (M_live_kNm * 1e6) / (Aps * jd * dp);
  const limit = 125; // MPa — ACI low-relax strand limit
  return Object.freeze({ delta_fps, limit, isOk: delta_fps <= limit });
}

