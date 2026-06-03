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
