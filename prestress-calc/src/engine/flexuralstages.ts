/**
 * Flexural Load Stages & Changes in Prestress Force
 * Nilson "Design of Prestressed Concrete" 2nd Ed.
 *   §1.4  Overload Behavior and Strength in Flexure
 *   §1.7  Changes in Prestress Force
 *   §3.6  Cracking Load
 *
 * ── Concept ──────────────────────────────────────────────────
 * As external moment on a prestressed beam grows from zero, the
 * member passes through distinct stages, and the steel stress
 * climbs only slightly until the concrete cracks — then rapidly:
 *
 *   Stage 0  No external load   — bottom fiber heavily compressed
 *   Stage 1  Balanced load      — uniform stress −Pe/A (e moment cancels)
 *   Stage 2  Decompression      — bottom-fiber stress = 0  (M_dec)
 *   Stage 3  Cracking           — bottom fiber reaches +fr  (M_cr)
 *   Stage 4  Ultimate           — tendon at f_ps, M_n
 *
 * Steel-stress milestones (the "change in prestress force"):
 *   f_pe                         effective prestress
 *   f_p,dec = f_pe + n·f_ce      when concrete at steel level decompresses
 *   f_ps                         at ultimate (from ULS layer)
 *   where f_ce = stress in concrete at the steel centroid under Pe
 *         n    = E_ps / E_c (modular ratio)
 *
 * Sign convention: + tension, − compression (consistent w/ app).
 */

export interface FlexuralStageInputs {
  /** Effective prestress force (kN) */
  Pe: number;
  /** Effective steel stress f_se = Pe/Aps (MPa) */
  fse: number;
  /** Eccentricity at the analysis section (mm, + = below NA) */
  e: number;
  /** Prestressed steel area (mm²) */
  Aps: number;
  /** Gross area (mm²) */
  A: number;
  /** Gross moment of inertia (mm⁴) */
  I: number;
  /** Section modulus bottom fiber Zb (mm³) */
  Zb: number;
  /** Lower kern distance (=r²/yt) — not used directly but kept for clarity */
  kt: number;
  /** Self-weight (+ dead) moment already on the section (kN·m) */
  Mdead: number;
  /** Modulus of rupture fr (MPa) — default 0.62√f'c is applied by caller */
  fr: number;
  /** Modular ratio n = E_ps/E_c */
  n: number;
  /** Ultimate steel stress f_ps (MPa, from ULS) */
  fps: number;
}

export interface FlexuralStageResult {
  /** Decompression moment (bottom fiber → 0 stress), kN·m */
  readonly M_dec: number;
  /** Cracking moment (bottom fiber → +fr), kN·m */
  readonly M_cr: number;
  /** Decompression moment measured from the no-load state, kN·m */
  readonly M_dec_total: number;
  // Steel stress milestones (MPa)
  readonly fse: number;
  /** Concrete stress at steel level under Pe + dead (MPa, − = compression) */
  readonly f_ce: number;
  /** Steel stress at concrete decompression = fse + n·|f_ce| (MPa) */
  readonly fp_dec: number;
  /** Steel stress at ultimate (MPa) */
  readonly fps: number;
  /** Total stress rise from effective to ultimate, Δfp = fps − fse (MPa) */
  readonly delta_fp_total: number;
  /** Fraction of fps that the change in prestress represents (small ⇒ efficient) */
  readonly stress_rise_ratio: number;
}

/**
 * Compute load-stage moments and steel-stress milestones.
 * M_dec and M_cr are reported as the *additional* moment beyond the
 * dead load already present, plus a total-from-zero figure.
 */
export function computeFlexuralStages(inp: FlexuralStageInputs): FlexuralStageResult {
  const { Pe, fse, e, A, I, Zb, Mdead, fr, n, fps } = inp;

  const PeN = Pe * 1000; // N
  const yb = I / Zb;     // recover yb from Zb = I/yb

  // Concrete stress at bottom fiber under Pe alone (− = compression)
  const sigma_bot_Pe = -(PeN / A) - (PeN * e) / Zb;

  // Decompression: additional moment to raise bottom fiber from σ(Pe+dead) to 0
  const Mdead_Nmm = Mdead * 1e6;
  const sigma_bot_dead = sigma_bot_Pe + Mdead_Nmm / Zb;
  // M to bring it to zero: σ_bot_dead + M_extra/Zb = 0
  const M_dec_Nmm = -sigma_bot_dead * Zb;             // extra beyond dead
  const M_dec = M_dec_Nmm / 1e6;                       // kN·m
  const M_dec_total = (-sigma_bot_Pe * Zb) / 1e6;      // from zero (Pe only)

  // Cracking: extra moment to reach +fr at bottom fiber
  const M_cr_Nmm = (-sigma_bot_dead + fr) * Zb;
  const M_cr = M_cr_Nmm / 1e6;

  // Concrete stress at the steel centroid (depth e below NA) under Pe + dead
  // f_ce = −Pe/A − Pe·e²/I + Mdead·e/I  (− = compression at steel level)
  const f_ce =
    -(PeN / A) - (PeN * e * e) / I + (Mdead_Nmm * e) / I;

  // Steel-stress rise as concrete at steel level decompresses
  const fp_dec = fse + n * Math.abs(f_ce);

  const delta_fp_total = fps - fse;
  const stress_rise_ratio = fps > 0 ? delta_fp_total / fps : 0;

  return Object.freeze({
    M_dec,
    M_cr,
    M_dec_total,
    fse,
    f_ce,
    fp_dec,
    fps,
    delta_fp_total,
    stress_rise_ratio,
  });
}
