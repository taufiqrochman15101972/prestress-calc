/**
 * Layer 4 — SLS Stress Matrix Validator
 * Evaluates fiber stresses at Transfer and Service stages against
 * ACI 318 / SNI 2847 / AASHTO LRFD allowable limits.
 *
 * Sign convention: positive σ = tension, negative σ = compression.
 * Reference: y = 0 at bottom fiber of precast girder.
 *
 * Two equivalent formula variants:
 *   STANDARD: f = −P/A ± P·e/Z ∓ M/Z
 *   KERNEL  : f = −P/A·(1 ± e·y/r²) ∓ M/Z   [TY Lin form; r² = Ig/Ag]
 *   Both are algebraically identical.
 */

import type {
  GrossSectionProps,
  CompositeSectionProps,
  FiberStressResult,
  SLSCheckResults,
  ACIBeamClass,
} from "@/types";

// ─── Allowable limits ────────────────────────────────────────

function limCompTransfer(fci: number): number { return 0.60 * fci; }
function limCompService(fc: number):  number  { return 0.45 * fc;  }
function limTensTransfer(fci: number): number { return 0.50 * Math.sqrt(fci); }

/** Service tension limit based on ACI beam class (§24.5.2.1) */
function limTensService(fc: number, cls: ACIBeamClass): number {
  switch (cls) {
    case "U": return 0.50 * Math.sqrt(fc);   // Class U: fully prestressed, no cracking
    case "T": return 1.00 * Math.sqrt(fc);   // Class T: transition (cracked but managed)
    case "C": return 1.00 * Math.sqrt(fc);   // Class C: cracked — use non-PS analysis beyond
    default:  return 0.50 * Math.sqrt(fc);
  }
}

// ─── Fiber evaluator ────────────────────────────────────────

function evaluateFiber(
  stage: "Transfer" | "Service",
  fiber: "Top" | "Bottom" | "Deck",
  stressMpa: number,
  terms: { axial: number; eccentricity: number; moment: number },
  limitComp: number,
  limitTens: number
): FiberStressResult {
  const isSafe = stressMpa >= -limitComp && stressMpa <= limitTens;
  return Object.freeze({
    stage, fiber, stressMpa, terms,
    limitCompMpa: limitComp,
    limitTensMpa: limitTens,
    utilizationComp: stressMpa < 0 ? Math.abs(stressMpa) / limitComp : 0,
    utilizationTens: stressMpa > 0 ? stressMpa / limitTens : 0,
    isSafe,
    verdict: isSafe ? "AMAN" : "OVERSTRESS",
  });
}

// ─── Stress computations ────────────────────────────────────

function transferStress(
  P: number, e: number, M: number,
  gross: GrossSectionProps,
  atTop: boolean
): { stress: number; terms: { axial: number; eccentricity: number; moment: number } } {
  const PN   = P * 1000;
  const MNmm = M * 1e6;
  const A = gross.areaAg;
  const Z = atTop ? gross.Ztg : gross.Zbg;
  const sign = atTop ? +1 : -1;

  const axial        = -PN / A;
  const eccentricity = sign * PN * e / Z;
  const moment       = -sign * MNmm / Z;
  const stress       = axial + eccentricity + moment;

  return { stress, terms: { axial, eccentricity, moment } };
}

function serviceStressTop(
  Pe: number, e: number,
  MgPlusMsdl: number, Mlive: number,
  gross: GrossSectionProps, comp: CompositeSectionProps
): { stress: number; terms: { axial: number; eccentricity: number; moment: number } } {
  const PeN = Pe * 1000;
  const M1  = MgPlusMsdl * 1e6;
  const M2  = Mlive * 1e6;

  const axial        = -PeN / gross.areaAg;
  const eccentricity = PeN * e / gross.Ztg;
  const moment       = -M1 / gross.Ztg - M2 / comp.Ztgc;
  const stress       = axial + eccentricity + moment;

  return { stress, terms: { axial, eccentricity, moment } };
}

function serviceStressBottom(
  Pe: number, e: number,
  MgPlusMsdl: number, Mlive: number,
  gross: GrossSectionProps, comp: CompositeSectionProps
): { stress: number; terms: { axial: number; eccentricity: number; moment: number } } {
  const PeN = Pe * 1000;
  const M1  = MgPlusMsdl * 1e6;
  const M2  = Mlive * 1e6;

  const axial        = -PeN / gross.areaAg;
  const eccentricity = -PeN * e / gross.Zbg;
  const moment       = M1 / gross.Zbg + M2 / comp.Zbc;
  const stress       = axial + eccentricity + moment;

  return { stress, terms: { axial, eccentricity, moment } };
}

function serviceStressDeck(
  Mlive: number, comp: CompositeSectionProps
): { stress: number; terms: { axial: number; eccentricity: number; moment: number } } {
  const stress = -(Mlive * 1e6) / comp.Zttc;
  return { stress, terms: { axial: 0, eccentricity: 0, moment: stress } };
}

// ─── Public API ─────────────────────────────────────────────

export interface SLSInputs {
  Pi: number;
  Pe: number;
  e: number;
  Mg: number;
  Msdl: number;
  Mlive: number;
  fci: number;
  fc: number;
  beamClass?: ACIBeamClass;
}

export function computeSLSChecks(
  inputs: SLSInputs,
  gross: GrossSectionProps,
  comp: CompositeSectionProps
): SLSCheckResults {
  const cls = inputs.beamClass ?? "U";

  const limCompTr = limCompTransfer(inputs.fci);
  const limTensTr = limTensTransfer(inputs.fci);
  const limCompSv = limCompService(inputs.fc);
  const limTensSv = limTensService(inputs.fc, cls);

  // Transfer
  const topTrData = transferStress(inputs.Pi, inputs.e, inputs.Mg, gross, true);
  const botTrData = transferStress(inputs.Pi, inputs.e, inputs.Mg, gross, false);

  const topTr = evaluateFiber("Transfer", "Top",    topTrData.stress, topTrData.terms, limCompTr, limTensTr);
  const botTr = evaluateFiber("Transfer", "Bottom", botTrData.stress, botTrData.terms, limCompTr, limTensTr);

  // Service
  const MgMsdl = inputs.Mg + inputs.Msdl;
  const topSvData  = serviceStressTop   (inputs.Pe, inputs.e, MgMsdl, inputs.Mlive, gross, comp);
  const botSvData  = serviceStressBottom(inputs.Pe, inputs.e, MgMsdl, inputs.Mlive, gross, comp);
  const deckData   = serviceStressDeck  (inputs.Mlive, comp);

  const topSv   = evaluateFiber("Service", "Top",    topSvData.stress,  topSvData.terms,  limCompSv, limTensSv);
  const botSv   = evaluateFiber("Service", "Bottom", botSvData.stress,  botSvData.terms,  limCompSv, limTensSv);
  const deckFib = evaluateFiber("Service", "Deck",   deckData.stress,   deckData.terms,   limCompSv, limTensSv);

  const transferSafe = topTr.isSafe && botTr.isSafe;
  const serviceSafe  = topSv.isSafe && botSv.isSafe && deckFib.isSafe;

  return Object.freeze({
    transfer: Object.freeze({
      sigmaTop: topTrData.stress,
      sigmaBot: botTrData.stress,
      topFiber: topTr,
      botFiber: botTr,
      isStagesSafe: transferSafe,
    }),
    service: Object.freeze({
      sigmaTop:   topSvData.stress,
      sigmaBot:   botSvData.stress,
      sigmaDeck:  deckData.stress,
      topFiber:   topSv,
      botFiber:   botSv,
      deckFiber:  deckFib,
      isStageSafe: serviceSafe,
    }),
    isOverallSafe: transferSafe && serviceSafe,
    beamClass: cls,
  });
}

/** Linear stress distribution from top to bottom fiber for charting */
export function stressProfile(
  sigmaTop: number,
  sigmaBot: number,
  hMm: number,
  nPoints = 50
): { yMm: number; stressMpa: number }[] {
  return Array.from({ length: nPoints }, (_, i) => {
    const yMm = (hMm * i) / (nPoints - 1);
    return { yMm, stressMpa: sigmaBot + (sigmaTop - sigmaBot) * (yMm / hMm) };
  });
}
