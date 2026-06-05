/**
 * Layer 3 — Time-Dependent Loss Tracker
 * AASHTO LRFD Refined Method: creep, shrinkage, and relaxation.
 * Returns losses in MPa (stress units on strand).
 */

import type {
  TendonConfig,
  GrossSectionProps,
  TimeDependentLosses,
} from "@/types";

interface LossInputs {
  tendon: TendonConfig;
  gross: GrossSectionProps;
  fci: number;    // f'ci (MPa)
  fc: number;     // f'c service (MPa)
  Eps: number;    // strand modulus (MPa)
  Ec: number;     // girder concrete modulus at service (MPa)
  RH: number;     // relative humidity (%)
  fcgp: number;   // stress at strand level at transfer (MPa)
  volToSurface: number; // V/S ratio (mm)
  ti: number;     // age at transfer (days)
  tf: number;     // final age for losses calc (days, default 10000)
}

// ─── AASHTO Correction Factors ──────────────────────────────

function k_vs(VS: number): number {
  // Volume-to-surface factor
  return Math.max(0.01, 1.45 - 0.13 * VS); // VS in mm
}

function k_hs(RH: number): number {
  return 2.0 - 0.014 * RH;
}

function k_hc(RH: number): number {
  return 1.56 - 0.008 * RH;
}

function k_f(fci: number): number {
  return 35 / (7 + fci);
}

function k_td(t: number, fci: number): number {
  return t / (61 - 4 * fci + t);
}

// ─── Creep Coefficient ──────────────────────────────────────

function creepCoefficient(
  tf: number,
  ti: number,
  VS: number,
  RH: number,
  fci: number
): number {
  return (
    1.9 *
    k_vs(VS) *
    k_hc(RH) *
    k_f(fci) *
    k_td(tf - ti, fci) *
    ti ** -0.118
  );
}

// ─── Transformed Section Stiffness Factor (K_df) ────────────

function transformedSectionFactor(
  tendon: TendonConfig,
  gross: GrossSectionProps,
  Eps: number,
  Ec: number,
  psi: number
): number {
  const Aps = tendon.totalStrands! * tendon.singleStrandArea;
  const e = tendon.eccentricityMidspan!;
  const modRatio = Eps / Ec;
  const ApsRatio = Aps / gross.areaAg;
  const eccentricityTerm = 1 + (gross.areaAg * e ** 2) / gross.momentOfInertiaIg;

  return 1 / (1 + modRatio * ApsRatio * eccentricityTerm * (1 + 0.7 * psi));
}

// ─── Shrinkage Loss ─────────────────────────────────────────

function shrinkageLoss(inputs: LossInputs, Kdf: number): number {
  const { VS, RH, fci, tf, ti, Eps } = {
    VS: inputs.volToSurface,
    RH: inputs.RH,
    fci: inputs.fci,
    tf: inputs.tf,
    ti: inputs.ti,
    Eps: inputs.Eps,
  };
  const eps_sh =
    k_vs(VS) *
    k_hs(RH) *
    k_f(fci) *
    k_td(tf - ti, fci) *
    0.00048;

  return eps_sh * Eps * Kdf;
}

// ─── Creep Loss ─────────────────────────────────────────────

function creepLoss(inputs: LossInputs, psi: number, Kdf: number): number {
  const n = inputs.Eps / inputs.Ec;
  return n * inputs.fcgp * psi * Kdf;
}

// ─── Relaxation Loss (Low-Relaxation Strand) ─────────────────

function relaxationLoss(
  tendon: TendonConfig,
  fpt: number, // initial stress in strand (MPa)
  ti: number,  // hours
  tf: number   // hours
): number {
  const ratio = fpt / tendon.fpu;
  if (ratio <= 0.55) return 0;
  return (fpt / 45) * (ratio - 0.55) * Math.log10(tf / ti);
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Compute all time-dependent prestress losses using AASHTO LRFD Refined Method.
 *
 * @param tendon   Tendon configuration
 * @param gross    Gross section properties
 * @param fci      Concrete strength at transfer (MPa)
 * @param fc       Concrete strength at service (MPa)
 * @param Eps      Strand modulus (MPa)
 * @param Ec       Girder concrete modulus (MPa)
 * @param Pj       Jacking force (kN)
 * @param Mg       Self-weight moment at midspan (kN·m)
 * @param RH       Relative humidity (%)
 * @param spanMm   Span length (mm) — used for default V/S ratio estimate
 */
export function computeTimeDependentLosses(
  tendon: TendonConfig,
  gross: GrossSectionProps,
  fci: number,
  fc: number,
  Eps: number,
  Ec: number,
  Pj: number,
  Mg: number,
  RH: number,
  spanMm: number
): TimeDependentLosses {
  const Aps = tendon.totalStrands! * tendon.singleStrandArea;

  // Approximate V/S ratio for a typical girder cross-section
  const VS = gross.areaAg / (2 * gross.hTotal + 2 * Math.sqrt(gross.areaAg / gross.hTotal));
  const ti = 1; // days at transfer
  const tf = 10000; // days, long-term

  // Stress at tendon level at transfer
  const PiN = Pj * 1000; // N
  const MgNmm = Mg * 1e6; // N·mm
  const e = tendon.eccentricityMidspan!;
  const fcgp =
    PiN / gross.areaAg +
    (PiN * e ** 2) / gross.momentOfInertiaIg -
    (MgNmm * e) / gross.momentOfInertiaIg;

  const psi = creepCoefficient(tf, ti, VS, RH, fci);
  const Kdf = transformedSectionFactor(tendon, gross, Eps, Ec, psi);

  const inputs: LossInputs = {
    tendon,
    gross,
    fci,
    fc,
    Eps,
    Ec,
    RH,
    fcgp,
    volToSurface: VS,
    ti,
    tf,
  };

  const deltaFpSR = shrinkageLoss(inputs, Kdf);
  const deltaFpCR = creepLoss(inputs, psi, Kdf);

  // Relaxation: use time in hours
  const tiHours = ti * 24;
  const tfHours = tf * 24;
  const fpt = tendon.jackingRatio * tendon.fpu;
  const deltaFpR2 = relaxationLoss(tendon, fpt, tiHours, tfHours);

  const deltaFpLT = deltaFpSR + deltaFpCR + deltaFpR2;
  const effectivePe = Math.max(0, Pj - (deltaFpLT * Aps) / 1000);

  return Object.freeze({ deltaFpSR, deltaFpCR, deltaFpR2, deltaFpLT, effectivePe });
}

// ─── Lump-Sum / Approximate Loss Estimate ────────────────────
// Nilson §6.2; AASHTO LRFD §5.9.3.3 (Approximate Estimate of
// Time-Dependent Losses). A quick alternative to the refined
// method above, useful as a sanity check.
//
//   ΔfpLT = 10·(fpi·Aps/Ag)·γh·γst + 12·γh·γst + ΔfpR
//   γh = 1.7 − 0.01·H            (humidity factor)
//   γst = 35 / (7 + f'ci)        (strength factor)
//   ΔfpR ≈ 16.5 MPa             (relaxation, low-relax strand)

export interface LumpSumLossResult {
  readonly gamma_h: number;
  readonly gamma_st: number;
  readonly deltaFp_creepShrink: number; // first two terms combined (MPa)
  readonly deltaFp_relax: number;       // ΔfpR (MPa)
  readonly deltaFpLT: number;           // total long-term lump-sum (MPa)
}

export function computeLumpSumLosses(
  fpi: number,    // stress in strand immediately before transfer (MPa)
  Aps: number,    // mm²
  Ag: number,     // gross area mm²
  fci: number,    // f'ci (MPa)
  RH: number      // relative humidity (%)
): LumpSumLossResult {
  const gamma_h = 1.7 - 0.01 * RH;
  const gamma_st = 35 / (7 + fci);
  const term1 = 10 * ((fpi * Aps) / Ag) * gamma_h * gamma_st;
  const term2 = 12 * gamma_h * gamma_st;
  const deltaFp_relax = 16.5; // MPa, low-relaxation strand
  const deltaFp_creepShrink = term1 + term2;
  return Object.freeze({
    gamma_h,
    gamma_st,
    deltaFp_creepShrink,
    deltaFp_relax,
    deltaFpLT: deltaFp_creepShrink + deltaFp_relax,
  });
}
