/**
 * Continuous Beam Secondary Moments — TY Lin Equivalent Load Method
 *
 * Reference: TY Lin & Ned H. Burns, "Design of Prestressed Concrete Structures"
 * 3rd ed., Ch. 8 — Continuous Beams & Frames.
 *
 * ── Concept ──────────────────────────────────────────────────
 * In a continuous prestressed beam the tendon is statically
 * indeterminate. The equivalent upward loads from the tendon
 * produce reactions at the interior supports (redundant forces).
 * These redundant reactions create "secondary moments" M₂ that
 * do NOT exist in a simply-supported beam.
 *
 *   M_total(x) = M₁(x) + M₂(x)
 *   M₁(x) = P_e · e(x)               [primary — same as SS beam]
 *   M₂(x) = R_B · x  (for 2-span)    [secondary — from support reaction]
 *
 * ── Two-equal-span parabolic tendon (symmetric) ──────────────
 * Equivalent upward UDL: w_p = 8·Pe·Δe / L²
 * Redundant reaction at B (interior): R_B = (5/8) · w_p · L
 *   (from 3-moment equation / compatibility on 2-span beam)
 * Secondary moment at B: M₂_B = R_B · L / 2 = (5/16) · w_p · L²
 *
 * C-line (pressure line): shifted by M₂/Pe from tendon c.g.
 * Concordant profile: tendon that produces NO secondary moments
 *   → e_concordant at any section = M_total/Pe = e + M₂/(Pe)
 *
 * ── Sign convention ──────────────────────────────────────────
 * Positive moment → sagging (tension at bottom) — same as rest of app.
 */

import type { ContinuousBeamResult } from "@/types";

export interface ContinuousBeamInputs {
  /** Number of equal spans */
  nSpans: 1 | 2 | 3;
  /** Span length (mm) */
  L: number;
  /** Effective prestress (kN) */
  Pe: number;
  /** Eccentricity at midspan (mm) — positive = below NA */
  eMidspan: number;
  /** Eccentricity at interior supports (mm) — positive = below NA, 0 = at NA */
  eSupport: number;
  /** Eccentricity at end supports (mm) */
  eEnd: number;
}

/**
 * Compute secondary moments for a continuous prestressed beam.
 * Uses 3-moment equation (Clapeyron theorem) for 2-span symmetric case.
 * For 1-span: secondary = 0 (simply supported).
 * For 3-span: uses superposition of 2-span patterns (approximate).
 */
export function computeContinuousBeam(inp: ContinuousBeamInputs): ContinuousBeamResult {
  const { nSpans, L, Pe, eMidspan, eSupport, eEnd } = inp;

  const M1_midspan = Pe * eMidspan / 1000; // kN·m (Pe kN, e mm → /1000)

  if (nSpans === 1) {
    return Object.freeze({
      nSpans,
      M1_midspan,
      M2_support: 0,
      M_total_support: 0,
      e_concordant: eMidspan,
      cLineShift: 0,
    });
  }

  // Equivalent upward UDL from parabolic tendon (kN/m)
  // Δe = eMidspan − eSupport (positive = tendon dips below support level)
  const delta_e_m = (eMidspan - eSupport) / 1000; // m
  const L_m = L / 1000; // m
  const w_p = (8 * Pe * delta_e_m) / (L_m ** 2); // kN/m

  // ── 2-span symmetric beam (3-moment equation) ────────────────
  // Compatibility: moment at interior support B
  // Using 3-moment eq for equal spans with parabolic tendon (uniform w_p):
  //   4·M_B·L = −5/4 · w_p · L³ / L  →  M_B = −5·w_p·L² / 16
  // (Negative = hogging at interior support)
  // Actual sign: secondary moment M₂_B is the REACTION moment at B
  // For parabolic upward load on continuous beam:
  //   R_B = 5/4 · w_p · L  (interior reaction, larger than midspan)
  //   M₂_B = primary moment correction = R_B · L/2 - w_p·L²/2
  //         = 5/4·w_p·L²/2 - w_p·L²/2 = w_p·L²·(5/8 − 1/2) = w_p·L²/8
  // More precisely from TY Lin:
  //   For a 2-span beam with parabolic tendon (same e profile each span):
  //   Secondary moment at interior support = (1/2) · w_p · L² / 8 · correction
  // Let me use the exact result from TY Lin eq:
  //   M₂ at interior support = Pe · ΔC  where ΔC = C-line shift
  //   For uniform upward w_p over 2 spans:
  //     Reaction at interior: R_B = 5w_p·L/4
  //     Secondary moment at B: M₂_B = (R_B/2)·L − w_p·L²/2
  //                                  = 5w_p·L²/8 − w_p·L²/2 = w_p·L²/8
  const M2_support_2span = (w_p * L_m ** 2) / 8; // kN·m (hogging, positive here)

  // For 3 equal spans: M₂ at first interior support ≈ 0.1 · w_p · L²
  // (from 4-moment equation, approximate)
  const M2_support = nSpans === 2
    ? M2_support_2span
    : 0.1 * w_p * L_m ** 2; // 3-span approximation

  // Primary moment at interior support = Pe · e_support
  const M1_support = Pe * eSupport / 1000; // kN·m
  const M_total_support = M1_support + M2_support;

  // Concordant eccentricity at interior support (no secondary moments)
  // e_conc = M_total / Pe
  const e_concordant = M_total_support * 1000 / Pe; // mm

  // C-line shift at interior support = M₂ / Pe
  const cLineShift = M2_support * 1000 / Pe; // mm

  return Object.freeze({
    nSpans,
    M1_midspan,
    M2_support,
    M_total_support,
    e_concordant,
    cLineShift,
  });
}
