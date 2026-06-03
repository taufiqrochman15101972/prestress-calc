/**
 * Layer 2 — Tendon Profile & Force Engine
 * Computes tendon profile geometry, jacking force, and immediate losses
 * (friction/wobble, anchorage slip, elastic shortening).
 */

import type {
  TendonConfig,
  IGirderGeometry,
  GrossSectionProps,
  MomentResults,
  TendonProfilePoint,
  PrestressForces,
  ImmediateLossParams,
} from "@/types";

const PROFILE_POINTS = 100;

/** Eccentricity and slope at position x along span (0 ≤ x ≤ L) */
export function tendonProfile(
  cfg: TendonConfig,
  spanMm: number,
  numPoints = PROFILE_POINTS
): readonly TendonProfilePoint[] {
  const em = cfg.eccentricityMidspan ?? cfg.eccentricitySupport;
  const es = cfg.eccentricitySupport;
  const { profileType } = cfg;
  const L = spanMm;
  const xg = cfg.holdDownRatio * L; // hold-down point for harped profile

  const points: TendonProfilePoint[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = (L * i) / (numPoints - 1);
    let e: number;
    let theta: number;

    if (profileType === "STRAIGHT") {
      e = em;
      theta = 0;
    } else if (profileType === "HARPED") {
      if (x < xg) {
        e = es + ((em - es) / xg) * x;
        theta = Math.atan((em - es) / xg);
      } else if (x <= L - xg) {
        e = em;
        theta = 0;
      } else {
        // mirror of left side
        const xr = L - x;
        e = es + ((em - es) / xg) * xr;
        theta = -Math.atan((em - es) / xg);
      }
    } else {
      // PARABOLIC — symmetric about midspan
      const xRatio = x / L;
      e = es + 4 * (em - es) * (xRatio - xRatio ** 2);
      theta = Math.atan((4 * (em - es) * (1 - 2 * xRatio)) / L);
    }

    points.push(Object.freeze({ xMm: x, eMm: e, thetaRad: theta }));
  }
  return Object.freeze(points);
}

/**
 * Friction & wobble losses along span.
 * Returns P(x) in kN at PROFILE_POINTS positions.
 * P(x) = Pj * exp(-(μ*α(x) + K*x))
 */
function frictionProfile(
  Pj: number,
  profile: readonly TendonProfilePoint[],
  mu: number,
  K: number
): number[] {
  const results: number[] = [];
  let cumulativeAlpha = 0;

  for (let i = 0; i < profile.length; i++) {
    const pt = profile[i];
    if (i > 0) {
      // Cumulative change in angle from jacking end
      cumulativeAlpha += Math.abs(pt.thetaRad - profile[i - 1].thetaRad);
    }
    const exponent = mu * cumulativeAlpha + K * pt.xMm;
    // Use linear approximation when exponent ≤ 0.3 (AASHTO guidance)
    const Px =
      exponent <= 0.3
        ? Pj / (1 + exponent)
        : Pj * Math.exp(-exponent);
    results.push(Px);
  }
  return results;
}

/**
 * Anchorage slip correction.
 * Finds L_set and computes ΔP_slip(x).
 * Returns updated P(x) after slip.
 */
function anchorageSlipProfile(
  frictionPx: number[],
  Pj: number,
  Aps: number,
  Eps: number,
  deltaSet: number, // mm
  L: number
): number[] {
  const PL = frictionPx[frictionPx.length - 1];
  const p = (Pj - PL) / L; // N/mm (using kN → N: multiply after)
  // Convert p to N/mm: Pj and PL are in kN, so p is in kN/mm → ×1000 for N/mm
  const pNmm = p * 1000;
  const Lset = Math.sqrt((deltaSet * Aps * Eps) / pNmm);

  const n = frictionPx.length;
  const dx = L / (n - 1);

  return frictionPx.map((Px, i) => {
    const x = i * dx;
    if (x > Lset) return Px;
    const deltaP = 2 * pNmm * (Lset - x) / 1000; // back to kN
    return Math.max(0, Px - deltaP);
  });
}

/**
 * Elastic shortening loss for post-tensioning (MPa).
 * ΔES = (N-1)/(2N) * (Eps/Eci) * f_cgp
 */
function elasticShortening(
  cfg: TendonConfig,
  gross: GrossSectionProps,
  Mg: number, // kN·m
  Pi: number, // kN (approx = Pj for first pass)
  Eci: number, // MPa
  N: number,  // number of jacking groups
): number {
  const Aps = cfg.totalStrands! * cfg.singleStrandArea;
  const eMm = cfg.eccentricityMidspan ?? cfg.eccentricitySupport;

  // Stress in concrete at tendon level at transfer
  const PiN = Pi * 1000; // N
  const MgNmm = Mg * 1e6; // N·mm
  const fcgp =
    PiN / gross.areaAg +
    (PiN * eMm ** 2) / gross.momentOfInertiaIg -
    (MgNmm * eMm) / gross.momentOfInertiaIg;

  const n = cfg.Eps / Eci;
  const factor = N > 1 ? (N - 1) / (2 * N) : 0.5;
  return factor * n * fcgp;
}

/**
 * Compute full prestress force chain: Pj → friction → slip → Pi → Pe.
 */
export function computePrestressForces(
  cfg: TendonConfig,
  gross: GrossSectionProps,
  Mg: number, // kN·m (self-weight moment at midspan)
  spanMm: number,
  params: ImmediateLossParams,
  Eci: number, // MPa (concrete modulus at transfer)
  longTermLossMpa: number // MPa (from Layer 3)
): PrestressForces {
  const Aps = cfg.totalStrands! * cfg.singleStrandArea;
  const jackingStressMpa = cfg.jackingRatio * cfg.fpu;
  const Pj = (jackingStressMpa * Aps) / 1000; // kN

  const profile = tendonProfile(cfg, spanMm);

  // Friction profile
  const fricPx = frictionProfile(Pj, profile, params.mu, params.K);

  // After anchorage slip
  const afterSlipPx = anchorageSlipProfile(
    fricPx,
    Pj,
    Aps,
    cfg.Eps,
    params.deltaSet,
    spanMm
  );

  // Transfer force at midspan (approximate as average of near-midspan values)
  const midIdx = Math.floor(afterSlipPx.length / 2);
  const PiApprox = afterSlipPx[midIdx];

  // Friction loss at midspan (MPa)
  const deltaFR = Math.max(0, (Pj - fricPx[midIdx]) / Aps * 1000);
  // Anchorage slip loss at midspan (MPa) — additional loss beyond friction
  const deltaAS = Math.max(0, (fricPx[midIdx] - afterSlipPx[midIdx]) / Aps * 1000);

  // Elastic shortening
  const deltaES = elasticShortening(
    cfg,
    gross,
    Mg,
    PiApprox,
    Eci,
    params.numJackingGroups
  );
  const Pi = Math.max(0, PiApprox - (deltaES * Aps) / 1000);

  // Effective prestress after long-term losses
  const Pe = Math.max(0, Pi - (longTermLossMpa * Aps) / 1000);

  const fse = Aps > 0 ? (Pe * 1000) / Aps : 0;

  return Object.freeze({
    jackingStressMpa,
    Pj,
    Pi,
    frictionProfile: Object.freeze(fricPx),
    afterSlipProfile: Object.freeze(afterSlipPx),
    deltaFR,
    deltaAS,
    deltaES,
    Pe,
    fse,
  });
}

/**
 * Equivalent balance load from prestress (upward positive, kN/m).
 * For parabolic profile: w_p = 8*P*(em-es)/L²
 */
export function balanceLoad(
  Pj: number,
  cfg: TendonConfig,
  spanMm: number
): number {
  const delta = cfg.eccentricityMidspan ?? cfg.eccentricitySupport - cfg.eccentricitySupport;
  const LM = spanMm / 1000; // m
  if (cfg.profileType === "PARABOLIC") {
    return (8 * Pj * (delta / 1000)) / LM ** 2; // kN/m
  }
  if (cfg.profileType === "HARPED" && cfg.holdDownRatio > 0) {
    const xg = cfg.holdDownRatio * LM;
    return (Pj * (delta / 1000)) / xg; // point load equiv in kN, not UDL
  }
  return 0;
}
